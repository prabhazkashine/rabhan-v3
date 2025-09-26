import { PrismaClient, UserRole, UserStatus } from '../generated/prisma';
import { PasswordUtils } from '../utils/password';
import { logger } from '../utils/logger';
import {
  CreateAdminRequest,
  UpdateAdminRequest,
  AdminListResponse,
  PaginatedAdminsResponse
} from '../types/admin.types';

class AdminService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createAdmin(data: CreateAdminRequest, createdBy: string): Promise<AdminListResponse> {
    try {
      await this.prisma.$connect();

      const passwordValidation = PasswordUtils.validate(data.password);
      if (!passwordValidation.valid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      const existingAdmin = await this.prisma.admin.findUnique({
        where: { email: data.email },
      });

      if (existingAdmin) {
        throw new Error('Email already registered');
      }

      const passwordHash = await PasswordUtils.hash(data.password);

      const admin = await this.prisma.admin.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          passwordHash,
          role: data.role,
          status: data.status,
          emailVerified: true,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      logger.info('Admin created successfully', {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        createdBy,
      });

      return admin;

    } catch (error: any) {
      logger.error('Admin creation failed:', {
        error: error.message,
        email: data.email,
        createdBy,
      });

      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('email')) {
          throw new Error('Email already registered');
        }
      }

      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async updateAdmin(adminId: string, data: UpdateAdminRequest, updatedBy: string): Promise<AdminListResponse> {
    try {
      await this.prisma.$connect();

      const existingAdmin = await this.prisma.admin.findUnique({
        where: { id: adminId },
      });

      if (!existingAdmin) {
        throw new Error('Admin not found');
      }

      // Prevent updating self to non-SUPER_ADMIN role
      if (adminId === updatedBy && data.role && data.role !== UserRole.SUPER_ADMIN) {
        throw new Error('Cannot change your own role from SUPER_ADMIN');
      }

      // Check if email is already taken by another admin
      if (data.email) {
        const emailTaken = await this.prisma.admin.findUnique({
          where: {
            email: data.email,
            NOT: { id: adminId }
          },
        });

        if (emailTaken) {
          throw new Error('Email already registered');
        }
      }

      const updatedAdmin = await this.prisma.admin.update({
        where: { id: adminId },
        data: {
          ...data,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      logger.info('Admin updated successfully', {
        adminId: updatedAdmin.id,
        email: updatedAdmin.email,
        updatedBy,
        changes: Object.keys(data),
      });

      return updatedAdmin;

    } catch (error: any) {
      logger.error('Admin update failed:', {
        error: error.message,
        adminId,
        updatedBy,
      });

      if (error.code === 'P2002') {
        if (error.meta?.target?.includes('email')) {
          throw new Error('Email already registered');
        }
      }

      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async deleteAdmin(adminId: string, deletedBy: string): Promise<void> {
    try {
      await this.prisma.$connect();

      const existingAdmin = await this.prisma.admin.findUnique({
        where: { id: adminId },
      });

      if (!existingAdmin) {
        throw new Error('Admin not found');
      }

      // Prevent self-deletion
      if (adminId === deletedBy) {
        throw new Error('Cannot delete your own account');
      }

      await this.prisma.admin.delete({
        where: { id: adminId },
      });

      logger.info('Admin deleted successfully', {
        adminId,
        email: existingAdmin.email,
        deletedBy,
      });

    } catch (error: any) {
      logger.error('Admin deletion failed:', {
        error: error.message,
        adminId,
        deletedBy,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async getAdminById(adminId: string): Promise<AdminListResponse> {
    try {
      await this.prisma.$connect();

      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      return admin;

    } catch (error: any) {
      logger.error('Failed to get admin:', {
        error: error.message,
        adminId,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async listAdmins(
    page: number = 1,
    limit: number = 10,
    role?: UserRole,
    status?: UserStatus
  ): Promise<PaginatedAdminsResponse> {
    try {
      await this.prisma.$connect();

      const offset = (page - 1) * limit;

      const where = {
        ...(role && { role }),
        ...(status && { status }),
      };

      const [admins, total] = await Promise.all([
        this.prisma.admin.findMany({
          where,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
            emailVerified: true,
            createdAt: true,
            lastLoginAt: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        this.prisma.admin.count({ where }),
      ]);

      const pages = Math.ceil(total / limit);

      return {
        admins,
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      };

    } catch (error: any) {
      logger.error('Failed to list admins:', {
        error: error.message,
        page,
        limit,
        role,
        status,
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

export { AdminService };