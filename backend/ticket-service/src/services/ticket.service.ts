import { PrismaClient, Ticket, TicketReply, TicketStatus, TicketTimeline } from '../generated/prisma';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/error-handler';
import {
  CreateTicketRequest,
  CreateAdminTicketRequest,
  UpdateTicketRequest,
  UpdateTicketStatusRequest,
  CreateTicketReplyRequest,
} from '../validation/ticket-schemas';
import { getProjectById, isProjectCompleted, isUserProjectOwner } from '../utils/project-client';

const prisma = new PrismaClient();

export class TicketService {
  // ============ TICKET OPERATIONS ============

  /**
   * Create a new support ticket for a completed project
   * Validates project exists and is completed before creating ticket
   * Automatically retrieves contractor_id from the project
   */
  async createTicket(
    data: CreateTicketRequest,
    userId: string,
    authToken: string
  ): Promise<Ticket> {
    try {
      logger.info('Creating new ticket', {
        project_id: data.project_id,
        user_id: userId
      });

      const project = await getProjectById(data.project_id, authToken);

      if (!project) {
        throw new AppError('Project not found', 404);
      }

      if (!isUserProjectOwner(project, userId)) {
        throw new AppError('You do not have permission to create a ticket for this project', 403);
      }

      if (!isProjectCompleted(project)) {
        throw new AppError('Support tickets can only be created for projects with status "installation_completed" or "completed"', 400);
      }

      const ticket = await prisma.ticket.create({
        data: {
          project_id: data.project_id,
          user_id: userId,
          contractor_id: project.contractor_id, 
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority || 'medium',
          status: 'open',
        },
        include: {
          replies: true,
          timeline: true,
          documents: true,
        },
      });

      await this.createTimelineEntry(ticket.id, {
        event_type: 'created',
        title: 'Ticket created',
        description: `Support ticket "${data.title}" has been created`,
        created_by_id: userId,
        created_by_role: 'user',
        created_by_name: 'User',
      });

      logger.info('Ticket created successfully', {
        ticket_id: ticket.id,
        project_id: data.project_id,
        contractor_id: project.contractor_id
      });

      return ticket;
    } catch (error) {
      logger.error('Error creating ticket:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        project_id: data.project_id,
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Create a new admin support ticket (User/Contractor -> Admin/SuperAdmin)
   * Admin tickets are always created unassigned (admin_id = null)
   * Super admin will assign them later if needed
   */
  async createAdminTicket(
    data: CreateAdminTicketRequest,
    userId: string,
    userRole: string
  ): Promise<Ticket> {
    try {
      logger.info('Creating new admin ticket', {
        user_id: userId,
        user_role: userRole,
        admin_id: 'unassigned'
      });

      const ticket = await prisma.ticket.create({
        data: {
          ticket_type: 'admin_support',
          user_id: userId,
          admin_id: null,
          project_id: null,
          contractor_id: null,
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority || 'medium',
          status: 'open',
        },
        include: {
          replies: true,
          timeline: true,
          documents: true,
        },
      });

      const roleDisplayName = userRole === 'contractor' ? 'Contractor' : 'User';

      await this.createTimelineEntry(ticket.id, {
        event_type: 'created',
        title: 'Admin ticket created',
        description: `Admin support ticket "${data.title}" has been created`,
        created_by_id: userId,
        created_by_role: userRole,
        created_by_name: roleDisplayName,
      });

      logger.info('Admin ticket created successfully', {
        ticket_id: ticket.id,
        user_id: userId,
        user_role: userRole
      });

      return ticket;
    } catch (error) {
      logger.error('Error creating admin ticket:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user_id: userId,
        user_role: userRole
      });
      throw error;
    }
  }

  /**
   * Get all admin tickets for admins/super_admins
   * - Super admins see ALL admin_support tickets
   * - Regular admins see tickets assigned to them + unassigned tickets
   */
  async getAdminTickets(
    adminId: string | null,
    userRole: string,
    filters?: {
      status?: TicketStatus;
      priority?: string;
      category?: string;
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ): Promise<{ tickets: Ticket[]; total: number; page: number; limit: number }> {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;
      const sort = filters?.sort || 'created_at';
      const order = filters?.order || 'desc';

      const whereClause: any = {
        ticket_type: 'admin_support'
      };

      if (userRole !== 'super_admin' && adminId) {
        whereClause.OR = [
          { admin_id: adminId }, 
          { admin_id: null }     
        ];
      }

      if (filters?.status) whereClause.status = filters.status;
      if (filters?.priority) whereClause.priority = filters.priority;
      if (filters?.category) whereClause.category = filters.category;

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where: whereClause,
          include: {
            replies: {
              orderBy: { created_at: 'desc' },
            },
            timeline: {
              orderBy: { created_at: 'desc' },
            },
            documents: true,
          },
          orderBy: {
            [sort]: order,
          },
          skip,
          take: limit,
        }),
        prisma.ticket.count({ where: whereClause }),
      ]);

      logger.info('Retrieved admin tickets', {
        admin_id: adminId || 'all',
        user_role: userRole,
        count: tickets.length,
        total,
        page,
        limit
      });

      return { tickets, total, page, limit };
    } catch (error) {
      logger.error('Error retrieving admin tickets:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        admin_id: adminId,
        user_role: userRole
      });
      throw error;
    }
  }

  /**
   * Assign an admin ticket to an admin
   * Only super_admin can assign tickets
   */
  async assignAdminTicket(
    ticketId: string,
    adminId: string,
    assignedById: string,
    assignedByRole: string
  ): Promise<Ticket> {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId }
      });

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      if (ticket.ticket_type !== 'admin_support') {
        throw new AppError('Only admin support tickets can be assigned to admins', 400);
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: ticketId },
        data: { admin_id: adminId },
        include: {
          replies: true,
          timeline: true,
          documents: true,
        },
      });

      // Create timeline entry
      await this.createTimelineEntry(ticketId, {
        event_type: 'assigned',
        title: 'Ticket assigned',
        description: `Ticket assigned to admin ${adminId} by ${assignedByRole}`,
        created_by_id: assignedById,
        created_by_role: assignedByRole,
        created_by_name: 'Super Admin',
        metadata: {
          admin_id: adminId,
          assigned_by: assignedById
        }
      });

      logger.info('Admin ticket assigned', {
        ticket_id: ticketId,
        admin_id: adminId,
        assigned_by: assignedById
      });

      return updatedTicket;
    } catch (error) {
      logger.error('Error assigning admin ticket:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId,
        admin_id: adminId
      });
      throw error;
    }
  }

  /**
   * Get all tickets for a user (consumer)
   */
  async getUserTickets(
    userId: string,
    filters?: {
      status?: TicketStatus;
      priority?: string;
      category?: string;
      ticket_type?: string;
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ): Promise<{ tickets: Ticket[]; total: number; page: number; limit: number }> {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;
      const sort = filters?.sort || 'created_at';
      const order = filters?.order || 'desc';

      const whereClause: any = { user_id: userId };

      if (filters?.status) whereClause.status = filters.status;
      if (filters?.priority) whereClause.priority = filters.priority;
      if (filters?.category) whereClause.category = filters.category;
      if (filters?.ticket_type) whereClause.ticket_type = filters.ticket_type;

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where: whereClause,
          include: {
            replies: {
              orderBy: { created_at: 'desc' },
            },
            timeline: {
              orderBy: { created_at: 'desc' },
            },
            documents: true,
          },
          orderBy: {
            [sort]: order,
          },
          skip,
          take: limit,
        }),
        prisma.ticket.count({ where: whereClause }),
      ]);

      logger.info('Retrieved user tickets', {
        user_id: userId,
        count: tickets.length,
        total,
        page,
        limit
      });

      return { tickets, total, page, limit };
    } catch (error) {
      logger.error('Error retrieving user tickets:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Get all tickets for a contractor
   * Includes: project_support tickets assigned to contractor + admin_support tickets created by contractor
   */
  async getContractorTickets(
    contractorId: string,
    filters?: {
      status?: TicketStatus;
      priority?: string;
      category?: string;
      ticket_type?: string;
      page?: number;
      limit?: number;
      sort?: string;
      order?: 'asc' | 'desc';
    }
  ): Promise<{ tickets: Ticket[]; total: number; page: number; limit: number }> {
    try {
      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;
      const sort = filters?.sort || 'created_at';
      const order = filters?.order || 'desc';

      const whereClause: any = {
        OR: [
          { contractor_id: contractorId }, // project_support tickets assigned to contractor
          { user_id: contractorId, ticket_type: 'admin_support' } // admin_support tickets created by contractor
        ]
      };

      if (filters?.status) whereClause.status = filters.status;
      if (filters?.priority) whereClause.priority = filters.priority;
      if (filters?.category) whereClause.category = filters.category;
      if (filters?.ticket_type) whereClause.ticket_type = filters.ticket_type;

      const [tickets, total] = await Promise.all([
        prisma.ticket.findMany({
          where: whereClause,
          include: {
            replies: {
              orderBy: { created_at: 'desc' },
            },
            timeline: {
              orderBy: { created_at: 'desc' },
            },
            documents: true,
          },
          orderBy: {
            [sort]: order,
          },
          skip,
          take: limit,
        }),
        prisma.ticket.count({ where: whereClause }),
      ]);

      logger.info('Retrieved contractor tickets', {
        contractor_id: contractorId,
        count: tickets.length,
        total,
        page,
        limit
      });

      return { tickets, total, page, limit };
    } catch (error) {
      logger.error('Error retrieving contractor tickets:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contractor_id: contractorId
      });
      throw error;
    }
  }

  /**
   * Get a specific ticket by ID
   */
  async getTicketById(ticketId: string): Promise<Ticket | null> {
    try {
      const ticket = await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: {
          replies: {
            orderBy: { created_at: 'asc' },
            include: {
              documents: true,
            },
          },
          timeline: {
            orderBy: { created_at: 'asc' },
          },
          documents: true,
        },
      });

      if (ticket) {
        logger.debug('Retrieved ticket', {
          ticket_id: ticketId
        });
      }

      return ticket;
    } catch (error) {
      logger.error('Error retrieving ticket:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId
      });
      throw error;
    }
  }

  /**
   * Update ticket details
   */
  async updateTicket(
    ticketId: string,
    data: UpdateTicketRequest,
    userId: string,
    userRole: string
  ): Promise<Ticket> {
    try {
      const ticket = await this.getTicketById(ticketId);

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      if (userRole === 'user' && ticket.user_id !== userId) {
        throw new AppError('You do not have permission to update this ticket', 403);
      }

      if (userRole === 'contractor') {
        // Contractor can update project_support tickets assigned to them
        // OR admin_support tickets they created
        const canUpdate =
          (ticket.ticket_type === 'project_support' && ticket.contractor_id === userId) ||
          (ticket.ticket_type === 'admin_support' && ticket.user_id === userId);

        if (!canUpdate) {
          throw new AppError('You do not have permission to update this ticket', 403);
        }
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: ticketId },
        data,
        include: {
          replies: true,
          timeline: true,
          documents: true,
        },
      });

      if (data.priority && data.priority !== ticket.priority) {
        await this.createTimelineEntry(ticketId, {
          event_type: 'priority_changed',
          title: 'Priority changed',
          description: `Priority changed from ${ticket.priority} to ${data.priority}`,
          created_by_id: userId,
          created_by_role: userRole,
          created_by_name: 'User',
          metadata: {
            old_priority: ticket.priority,
            new_priority: data.priority,
          },
        });
      }

      logger.info('Ticket updated', {
        ticket_id: ticketId,
        updated_by: userId,
        updated_by_role: userRole
      });

      return updatedTicket;
    } catch (error) {
      logger.error('Error updating ticket:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId,
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Update ticket status
   * Rules:
   * - Project tickets: Only user can mark as resolved
   * - Admin tickets: User, admin (assigned), or super_admin can mark as resolved
   */
  async updateTicketStatus(
    ticketId: string,
    data: UpdateTicketStatusRequest,
    userId: string,
    userRole: string
  ): Promise<Ticket> {
    try {
      const ticket = await this.getTicketById(ticketId);

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      if (data.status === 'resolved') {
        if (ticket.ticket_type === 'project_support') {
          if (userRole !== 'user' || ticket.user_id !== userId) {
            throw new AppError('Only the user who created this ticket can mark it as resolved', 403);
          }
        } else if (ticket.ticket_type === 'admin_support') {
          const canResolve =
            (userRole === 'user' && ticket.user_id === userId) ||
            (userRole === 'contractor' && ticket.user_id === userId) ||
            (userRole === 'admin' && ticket.admin_id === userId) ||
            (userRole === 'super_admin');

          if (!canResolve) {
            throw new AppError('You do not have permission to resolve this ticket', 403);
          }
        }
      }

      const updateData: any = {
        status: data.status,
      };

      if (data.status === 'resolved') {
        updateData.resolution_summary = data.resolution_summary;
        updateData.resolved_at = new Date();
        updateData.resolved_by_role = userRole;
      }

      if (data.status === 'closed') {
        updateData.closed_at = new Date();
      }

      if (data.status === 'in_progress') {
        updateData.first_response_at = ticket.first_response_at || new Date();
      }

      const updatedTicket = await prisma.ticket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          replies: true,
          timeline: true,
          documents: true,
        },
      });

      const roleDisplayName = userRole === 'super_admin' ? 'Super Admin' :
                             userRole === 'admin' ? 'Admin' :
                             userRole === 'contractor' ? 'Contractor' : 'User';

      await this.createTimelineEntry(ticketId, {
        event_type: 'status_changed',
        title: `Status changed to ${data.status}`,
        description: `Ticket status changed from ${ticket.status} to ${data.status}`,
        created_by_id: userId,
        created_by_role: userRole,
        created_by_name: roleDisplayName,
        metadata: {
          old_status: ticket.status,
          new_status: data.status,
          resolution_summary: data.resolution_summary,
        },
      });

      logger.info('Ticket status updated', {
        ticket_id: ticketId,
        old_status: ticket.status,
        new_status: data.status,
        updated_by: userId,
        updated_by_role: userRole
      });

      return updatedTicket;
    } catch (error) {
      logger.error('Error updating ticket status:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId,
        user_id: userId
      });
      throw error;
    }
  }

  // ============ REPLY OPERATIONS ============

  /**
   * Add a reply to a ticket
   * Supports: user, contractor, admin, super_admin
   */
  async addReply(
    ticketId: string,
    data: CreateTicketReplyRequest,
    userId: string,
    userRole: string
  ): Promise<TicketReply> {
    try {
      const ticket = await this.getTicketById(ticketId);

      if (!ticket) {
        throw new AppError('Ticket not found', 404);
      }

      if (ticket.ticket_type === 'project_support') {
        if (!['user', 'contractor'].includes(userRole)) {
          throw new AppError('Only user or contractor can reply to project support tickets', 403);
        }
        if (userRole === 'user' && ticket.user_id !== userId) {
          throw new AppError('You do not have permission to reply to this ticket', 403);
        }
        if (userRole === 'contractor' && ticket.contractor_id !== userId) {
          throw new AppError('You do not have permission to reply to this ticket', 403);
        }
      } else if (ticket.ticket_type === 'admin_support') {
        if (!['user', 'contractor', 'admin', 'super_admin'].includes(userRole)) {
          throw new AppError('Invalid role for replying to admin support tickets', 403);
        }
        if (userRole === 'user' && ticket.user_id !== userId) {
          throw new AppError('You do not have permission to reply to this ticket', 403);
        }
        if (userRole === 'contractor' && ticket.user_id !== userId) {
          throw new AppError('You can only reply to admin tickets you created', 403);
        }
        if (userRole === 'admin' && ticket.admin_id !== userId) {
          throw new AppError('You can only reply to tickets assigned to you', 403);
        }
      }

      const reply = await prisma.ticketReply.create({
        data: {
          ticket_id: ticketId,
          user_id: userId,
          role: userRole,
          message: data.message,
          is_solution: data.is_solution || false,
        },
        include: {
          documents: true,
        },
      });

      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          last_response_at: new Date(),
          first_response_at: ticket.first_response_at || new Date(),
        },
      });

      if (['contractor', 'admin', 'super_admin'].includes(userRole) && !ticket.first_response_at) {
        await prisma.ticket.update({
          where: { id: ticketId },
          data: {
            status: 'in_progress' as any,
            first_response_at: new Date(),
          },
        });
      }

      const roleDisplayName = userRole === 'super_admin' ? 'Super Admin' :
                             userRole === 'admin' ? 'Admin' :
                             userRole === 'contractor' ? 'Contractor' : 'User';

      await this.createTimelineEntry(ticketId, {
        event_type: 'replied',
        title: `${roleDisplayName} replied`,
        description: data.message.substring(0, 100) + (data.message.length > 100 ? '...' : ''),
        created_by_id: userId,
        created_by_role: userRole,
        created_by_name: roleDisplayName,
        metadata: {
          reply_id: reply.id,
          is_solution: data.is_solution,
        },
      });

      logger.info('Reply added to ticket', {
        ticket_id: ticketId,
        reply_id: reply.id,
        replied_by: userId,
        replied_by_role: userRole
      });

      return reply;
    } catch (error) {
      logger.error('Error adding reply to ticket:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId,
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Get all replies for a ticket
   */
  async getTicketReplies(ticketId: string): Promise<TicketReply[]> {
    try {
      const replies = await prisma.ticketReply.findMany({
        where: { ticket_id: ticketId },
        include: {
          documents: true,
        },
        orderBy: { created_at: 'asc' },
      });

      logger.debug('Retrieved ticket replies', {
        ticket_id: ticketId,
        reply_count: replies.length
      });

      return replies;
    } catch (error) {
      logger.error('Error retrieving ticket replies:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId
      });
      throw error;
    }
  }

  // ============ TIMELINE OPERATIONS ============

  /**
   * Create a timeline entry for a ticket
   */
  async createTimelineEntry(
    ticketId: string,
    data: {
      event_type: string;
      title: string;
      description: string;
      created_by_id: string;
      created_by_role: string;
      created_by_name?: string;
      metadata?: any;
    }
  ): Promise<TicketTimeline> {
    try {
      const timelineEntry = await prisma.ticketTimeline.create({
        data: {
          ticket_id: ticketId,
          event_type: data.event_type,
          title: data.title,
          description: data.description,
          created_by_id: data.created_by_id,
          created_by_role: data.created_by_role,
          created_by_name: data.created_by_name,
          metadata: data.metadata || {},
        },
      });

      logger.debug('Timeline entry created', {
        ticket_id: ticketId,
        event_type: data.event_type
      });

      return timelineEntry;
    } catch (error) {
      logger.error('Error creating timeline entry:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId
      });
      throw error;
    }
  }

  /**
   * Get timeline for a ticket
   */
  async getTicketTimeline(ticketId: string): Promise<TicketTimeline[]> {
    try {
      const timeline = await prisma.ticketTimeline.findMany({
        where: { ticket_id: ticketId },
        orderBy: { created_at: 'asc' },
      });

      logger.debug('Retrieved ticket timeline', {
        ticket_id: ticketId,
        event_count: timeline.length
      });

      return timeline;
    } catch (error) {
      logger.error('Error retrieving ticket timeline:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId
      });
      throw error;
    }
  }

  // ============ DOCUMENT OPERATIONS ============

  /**
   * Add a document to a ticket
   */
  async addTicketDocument(
    ticketId: string,
    documentData: {
      document_type: string;
      file_url: string;
      file_name: string;
      file_size?: number;
      file_mime_type?: string;
      title?: string;
      description?: string;
    },
    userId: string,
    userRole: string
  ) {
    try {
      const document = await prisma.ticketDocument.create({
        data: {
          ticket_id: ticketId,
          document_type: documentData.document_type,
          file_url: documentData.file_url,
          file_name: documentData.file_name,
          file_size: documentData.file_size,
          file_mime_type: documentData.file_mime_type,
          title: documentData.title,
          description: documentData.description,
          uploaded_by_id: userId,
          uploaded_by_role: userRole,
        },
      });

      logger.info('Document added to ticket', {
        ticket_id: ticketId,
        document_id: document.id,
        uploaded_by: userId
      });

      return document;
    } catch (error) {
      logger.error('Error adding document to ticket:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId,
        user_id: userId
      });
      throw error;
    }
  }

  /**
   * Get documents for a ticket
   */
  async getTicketDocuments(ticketId: string) {
    try {
      const documents = await prisma.ticketDocument.findMany({
        where: { ticket_id: ticketId },
        orderBy: { created_at: 'desc' },
      });

      return documents;
    } catch (error) {
      logger.error('Error retrieving ticket documents:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ticket_id: ticketId
      });
      throw error;
    }
  }
}

export const ticketService = new TicketService();
