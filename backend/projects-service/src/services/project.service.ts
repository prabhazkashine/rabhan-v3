import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError,
} from '../utils/errors';
import { ProjectStatus } from '../generated/prisma';
import { fetchQuote, calculateSystemSize } from '../utils/quote-client';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CancelProjectInput,
  GetProjectsQuery,
} from '../schemas/project.schemas';

export class ProjectService {
  /**
   * Create a new project from an approved quote
   */
  async createProject(
    userId: string,
    input: CreateProjectInput,
    authToken?: string
  ) {
    const startTime = Date.now();

    logger.info('Creating project', {
      userId,
      requestId: input.quote_id,
    });

    let quote;
    try {
      quote = await fetchQuote(input.quote_id, input.contractor_id, authToken);
    } catch (error) {
      logger.error('Failed to fetch quote', { error, requestId: input.quote_id });
      throw new BusinessRuleError(
        error instanceof Error ? error.message : 'Failed to fetch quote details'
      );
    }

    const existingProject = await prisma.project.findUnique({
      where: { quote_id: quote.id },
    });

    if (existingProject) {
      throw new ConflictError('A project already exists for this quote');
    }

    if (quote.admin_status !== 'approved') {
      throw new BusinessRuleError('Only admin-approved quotes can be converted to projects');
    }

    const systemSizeKwp = quote.system_specs?.system_size_kwp || calculateSystemSize(quote.line_items);

    if (systemSizeKwp === 0) {
      logger.warn('Could not determine system size', { quoteId: quote.id });
    }

    const project = await prisma.$transaction(async (tx) => {
      const newProject = await tx.project.create({
        data: {
          quote_id: quote.id, 
          user_id: userId,
          contractor_id: quote.contractor_id,
          total_amount: quote.base_price, 
          system_size_kwp: systemSizeKwp,
          project_name: input.project_name,
          description: input.description,
          preferred_installation_date: input.preferred_installation_date
            ? new Date(input.preferred_installation_date)
            : undefined,
          status: ProjectStatus.payment_pending,
        },
      });

      await tx.projectTimeline.create({
        data: {
          project_id: newProject.id,
          event_type: 'project_created',
          title: 'Project Created',
          description: 'Project was created from approved quote',
          created_by_id: userId,
          created_by_role: 'user',
          metadata: {
            quote_id: quote.id,
            request_id: input.quote_id,
            total_amount: quote.base_price,
          },
        },
      });

      return newProject;
    });

    logger.info('Project created successfully', {
      projectId: project.id,
      userId,
      quoteId: quote.id,
      requestId: input.quote_id,
      duration: Date.now() - startTime,
    });

    return project;
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string, userId: string, userRole: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        payment: {
          include: {
            installments: {
              orderBy: { installment_number: 'asc' },
            },
          },
        },
        installation: true,
        review: true,
        timeline: {
          orderBy: { created_at: 'desc' },
          take: 20,
        },
        documents: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (
      userRole.toLowerCase() !== 'admin' &&
      userRole.toLowerCase() !== 'super_admin' &&
      project.user_id !== userId &&
      project.contractor_id !== userId
    ) {
      throw new NotFoundError('Project not found');
    }

    logger.info('Project retrieved', {
      projectId,
      userId,
      status: project.status,
    });

    return project;
  }

  /**
   * Get user's projects with pagination and filters
   */
  async getUserProjects(userId: string, query: GetProjectsQuery) {
    const { page, limit, status, sort_by, sort_order } = query;
    const skip = (page - 1) * limit;

    const where: any = { user_id: userId };

    if (status) {
      where.status = status;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          payment: {
            select: {
              payment_method: true,
              payment_status: true,
              total_amount: true,
              paid_amount: true,
            },
          },
          installation: {
            select: {
              status: true,
              scheduled_date: true,
            },
          },
          review: {
            select: {
              rating: true,
              created_at: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ]);

    logger.info('User projects retrieved', {
      userId,
      count: projects.length,
      total,
      page,
    });

    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get contractor's projects
   */
  async getContractorProjects(contractorId: string, query: GetProjectsQuery) {
    const { page, limit, status, sort_by, sort_order } = query;
    const skip = (page - 1) * limit;

    const where: any = { contractor_id: contractorId };

    if (status) {
      where.status = status;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          payment: true,
          installation: true,
          review: true,
        },
      }),
      prisma.project.count({ where }),
    ]);

    logger.info('Contractor projects retrieved', {
      contractorId,
      count: projects.length,
      total,
      page,
    });

    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all projects (admin only)
   */
  async getAllProjects(query: GetProjectsQuery) {
    const { page, limit, status, contractor_id, user_id, from_date, to_date, sort_by, sort_order } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (contractor_id) where.contractor_id = contractor_id;
    if (user_id) where.user_id = user_id;
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at.gte = new Date(from_date);
      if (to_date) where.created_at.lte = new Date(to_date);
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
        include: {
          payment: true,
          installation: true,
          review: true,
        },
      }),
      prisma.project.count({ where }),
    ]);

    logger.info('All projects retrieved (admin)', {
      count: projects.length,
      total,
      page,
    });

    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    userId: string,
    input: UpdateProjectInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    if (project.user_id !== userId) {
      throw new BusinessRuleError('You can only update your own projects');
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        project_name: input.project_name,
        description: input.description,
        preferred_installation_date: input.preferred_installation_date
          ? new Date(input.preferred_installation_date)
          : undefined,
        property_address: input.property_address,
      },
    });

    logger.info('Project updated', {
      projectId,
      userId,
    });

    return updatedProject;
  }

  /**
   * Cancel project
   */
  async cancelProject(
    projectId: string,
    userId: string,
    userRole: string,
    input: CancelProjectInput
  ) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        payment: true,
      },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Only user or admin can cancel
    if (
      project.user_id !== userId &&
      userRole.toLowerCase() !== 'admin' &&
      userRole.toLowerCase() !== 'super_admin'
    ) {
      throw new BusinessRuleError('You do not have permission to cancel this project');
    }

    // Cannot cancel if installation is in progress or completed
    if (
      project.status === ProjectStatus.installation_in_progress ||
      project.status === ProjectStatus.installation_completed ||
      project.status === ProjectStatus.completed
    ) {
      throw new BusinessRuleError('Cannot cancel project at this stage');
    }

    const cancelledProject = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: projectId },
        data: {
          status: ProjectStatus.cancelled,
          cancelled_at: new Date(),
          cancellation_reason: input.cancellation_reason,
        },
      });

      // Add timeline entry
      await tx.projectTimeline.create({
        data: {
          project_id: projectId,
          event_type: 'project_cancelled',
          title: 'Project Cancelled',
          description: `Project was cancelled. Reason: ${input.cancellation_reason}`,
          created_by_id: userId,
          created_by_role: userRole,
        },
      });

      return updated;
    });

    logger.info('Project cancelled', {
      projectId,
      userId,
      reason: input.cancellation_reason,
    });

    return cancelledProject;
  }

  /**
   * Get project timeline
   */
  async getProjectTimeline(projectId: string) {
    const timeline = await prisma.projectTimeline.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
    });

    return timeline;
  }
}

export const projectService = new ProjectService();
