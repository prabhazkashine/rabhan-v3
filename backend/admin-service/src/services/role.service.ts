import { PrismaClient, ResourceType, PermissionAction } from '../generated/prisma';
import { logger } from '../utils/logger';
import {
  CreateRoleRequest,
  UpdateRoleRequest,
  AdminRoleData,
  PermissionCheck
} from '../types/permissions.types';

class RoleService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Initialize default permissions if they don't exist
  async initializePermissions(): Promise<void> {
    try {
      await this.prisma.$connect();

      const permissions = [
        // Users permissions
        { resource: ResourceType.USERS, action: PermissionAction.READ, description: 'View users' },
        { resource: ResourceType.USERS, action: PermissionAction.WRITE, description: 'Create users' },
        { resource: ResourceType.USERS, action: PermissionAction.UPDATE, description: 'Update users' },
        { resource: ResourceType.USERS, action: PermissionAction.DELETE, description: 'Delete users' },

        // Contractors permissions
        { resource: ResourceType.CONTRACTORS, action: PermissionAction.READ, description: 'View contractors' },
        { resource: ResourceType.CONTRACTORS, action: PermissionAction.WRITE, description: 'Create contractors' },
        { resource: ResourceType.CONTRACTORS, action: PermissionAction.UPDATE, description: 'Update contractors' },
        { resource: ResourceType.CONTRACTORS, action: PermissionAction.DELETE, description: 'Delete contractors' },

        // Quotations permissions (read and update only)
        { resource: ResourceType.QUOTATIONS, action: PermissionAction.READ, description: 'View quotations' },
        { resource: ResourceType.QUOTATIONS, action: PermissionAction.UPDATE, description: 'Update quotations' },

        // Products permissions (read and update only)
        { resource: ResourceType.PRODUCTS, action: PermissionAction.READ, description: 'View products' },
        { resource: ResourceType.PRODUCTS, action: PermissionAction.UPDATE, description: 'Update products' },

        // Documents permissions (read and write only)
        { resource: ResourceType.DOCUMENTS, action: PermissionAction.READ, description: 'View documents' },
        { resource: ResourceType.DOCUMENTS, action: PermissionAction.WRITE, description: 'Create documents' },

        // Tickets permissions (full CRUD)
        { resource: ResourceType.TICKETS, action: PermissionAction.READ, description: 'View tickets' },
        { resource: ResourceType.TICKETS, action: PermissionAction.WRITE, description: 'Create tickets' },
        { resource: ResourceType.TICKETS, action: PermissionAction.UPDATE, description: 'Update and assign tickets' },
        { resource: ResourceType.TICKETS, action: PermissionAction.DELETE, description: 'Delete tickets' },
      ];

      for (const permission of permissions) {
        await this.prisma.permission.upsert({
          where: {
            resource_action: {
              resource: permission.resource,
              action: permission.action
            }
          },
          update: {},
          create: permission
        });
      }

      logger.info('Permissions initialized successfully');
    } catch (error: any) {
      logger.error('Failed to initialize permissions:', {
        error: error.message
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async createRole(data: CreateRoleRequest, createdBy: string): Promise<AdminRoleData> {
    try {
      await this.prisma.$connect();

      // Check if role name already exists
      const existingRole = await this.prisma.adminRole.findUnique({
        where: { name: data.name }
      });

      if (existingRole) {
        throw new Error('Role name already exists');
      }

      // Get permission IDs for the requested permissions
      const permissionIds = await Promise.all(
        data.permissions.map(async (perm) => {
          const permission = await this.prisma.permission.findUnique({
            where: {
              resource_action: {
                resource: perm.resource,
                action: perm.action
              }
            }
          });

          if (!permission) {
            throw new Error(`Permission ${perm.resource}:${perm.action} does not exist`);
          }

          return permission.id;
        })
      );

      // Create role with permissions in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        const role = await tx.adminRole.create({
          data: {
            name: data.name,
            description: data.description,
            createdBy
          }
        });

        // Create role-permission associations
        await Promise.all(
          permissionIds.map(permissionId =>
            tx.adminRolePermission.create({
              data: {
                roleId: role.id,
                permissionId
              }
            })
          )
        );

        // Return role with permissions
        return await tx.adminRole.findUnique({
          where: { id: role.id },
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        });
      });

      if (!result) {
        throw new Error('Failed to create role');
      }

      const roleData: AdminRoleData = {
        id: result.id,
        name: result.name,
        description: result.description || undefined,
        isActive: result.isActive,
        permissions: result.permissions.map(rp => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description || undefined
        })),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        createdBy: result.createdBy
      };

      logger.info('Role created successfully', {
        roleId: result.id,
        roleName: result.name,
        createdBy,
        permissionsCount: data.permissions.length
      });

      return roleData;

    } catch (error: any) {
      logger.error('Role creation failed:', {
        error: error.message,
        roleName: data.name,
        createdBy
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async updateRole(roleId: string, data: UpdateRoleRequest, updatedBy: string): Promise<AdminRoleData> {
    try {
      await this.prisma.$connect();

      const existingRole = await this.prisma.adminRole.findUnique({
        where: { id: roleId }
      });

      if (!existingRole) {
        throw new Error('Role not found');
      }

      // Check if new name conflicts with existing role
      if (data.name && data.name !== existingRole.name) {
        const nameConflict = await this.prisma.adminRole.findUnique({
          where: { name: data.name }
        });

        if (nameConflict) {
          throw new Error('Role name already exists');
        }
      }

      const result = await this.prisma.$transaction(async (tx) => {
        // Update basic role info
        const updatedRole = await tx.adminRole.update({
          where: { id: roleId },
          data: {
            ...(data.name && { name: data.name }),
            ...(data.description !== undefined && { description: data.description }),
            ...(data.isActive !== undefined && { isActive: data.isActive })
          }
        });

        // Update permissions if provided
        if (data.permissions) {
          // Delete existing permissions
          await tx.adminRolePermission.deleteMany({
            where: { roleId }
          });

          // Get new permission IDs
          const permissionIds = await Promise.all(
            data.permissions.map(async (perm) => {
              const permission = await tx.permission.findUnique({
                where: {
                  resource_action: {
                    resource: perm.resource,
                    action: perm.action
                  }
                }
              });

              if (!permission) {
                throw new Error(`Permission ${perm.resource}:${perm.action} does not exist`);
              }

              return permission.id;
            })
          );

          // Create new role-permission associations
          await Promise.all(
            permissionIds.map(permissionId =>
              tx.adminRolePermission.create({
                data: {
                  roleId,
                  permissionId
                }
              })
            )
          );
        }

        // Return updated role with permissions
        return await tx.adminRole.findUnique({
          where: { id: roleId },
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        });
      });

      if (!result) {
        throw new Error('Failed to update role');
      }

      const roleData: AdminRoleData = {
        id: result.id,
        name: result.name,
        description: result.description || undefined,
        isActive: result.isActive,
        permissions: result.permissions.map(rp => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description || undefined
        })),
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        createdBy: result.createdBy
      };

      logger.info('Role updated successfully', {
        roleId: result.id,
        roleName: result.name,
        updatedBy,
        changes: Object.keys(data)
      });

      return roleData;

    } catch (error: any) {
      logger.error('Role update failed:', {
        error: error.message,
        roleId,
        updatedBy
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async deleteRole(roleId: string, deletedBy: string): Promise<void> {
    try {
      await this.prisma.$connect();

      const existingRole = await this.prisma.adminRole.findUnique({
        where: { id: roleId },
        include: {
          admins: { select: { id: true, email: true } }
        }
      });

      if (!existingRole) {
        throw new Error('Role not found');
      }

      // Check if role is assigned to any admins
      if (existingRole.admins.length > 0) {
        throw new Error('Cannot delete role that is assigned to admins');
      }

      await this.prisma.adminRole.delete({
        where: { id: roleId }
      });

      logger.info('Role deleted successfully', {
        roleId,
        roleName: existingRole.name,
        deletedBy
      });

    } catch (error: any) {
      logger.error('Role deletion failed:', {
        error: error.message,
        roleId,
        deletedBy
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async getRoleById(roleId: string): Promise<AdminRoleData> {
    try {
      await this.prisma.$connect();

      const role = await this.prisma.adminRole.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });

      if (!role) {
        throw new Error('Role not found');
      }

      return {
        id: role.id,
        name: role.name,
        description: role.description || undefined,
        isActive: role.isActive,
        permissions: role.permissions.map(rp => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description || undefined
        })),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        createdBy: role.createdBy
      };

    } catch (error: any) {
      logger.error('Failed to get role:', {
        error: error.message,
        roleId
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async listRoles(page: number = 1, limit: number = 10, isActive?: boolean) {
    try {
      await this.prisma.$connect();

      const offset = (page - 1) * limit;
      const where = isActive !== undefined ? { isActive } : {};

      const [roles, total] = await Promise.all([
        this.prisma.adminRole.findMany({
          where,
          include: {
            permissions: {
              include: {
                permission: true
              }
            },
            _count: {
              select: { admins: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit
        }),
        this.prisma.adminRole.count({ where })
      ]);

      const rolesData: (AdminRoleData & { adminCount: number })[] = roles.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description || undefined,
        isActive: role.isActive,
        permissions: role.permissions.map(rp => ({
          id: rp.permission.id,
          resource: rp.permission.resource,
          action: rp.permission.action,
          description: rp.permission.description || undefined
        })),
        createdAt: role.createdAt,
        updatedAt: role.updatedAt,
        createdBy: role.createdBy,
        adminCount: role._count.admins
      }));

      return {
        roles: rolesData,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };

    } catch (error: any) {
      logger.error('Failed to list roles:', {
        error: error.message,
        page,
        limit,
        isActive
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async assignRoleToAdmin(adminId: string, roleId: string | null, assignedBy: string): Promise<void> {
    try {
      await this.prisma.$connect();

      // Check if admin exists
      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId }
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      // Check if role exists (if roleId is provided)
      if (roleId) {
        const role = await this.prisma.adminRole.findUnique({
          where: { id: roleId }
        });

        if (!role) {
          throw new Error('Role not found');
        }

        if (!role.isActive) {
          throw new Error('Cannot assign inactive role');
        }
      }

      // Update admin's custom role
      await this.prisma.admin.update({
        where: { id: adminId },
        data: { customRoleId: roleId }
      });

      logger.info('Role assigned to admin successfully', {
        adminId,
        roleId,
        assignedBy
      });

    } catch (error: any) {
      logger.error('Failed to assign role to admin:', {
        error: error.message,
        adminId,
        roleId,
        assignedBy
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async getAdminById(adminId: string): Promise<{ id: string, role: string, email: string, firstName: string, lastName: string }> {
    try {
      await this.prisma.$connect();

      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          role: true,
          email: true,
          firstName: true,
          lastName: true
        }
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      return admin;

    } catch (error: any) {
      logger.error('Failed to get admin by ID:', {
        error: error.message,
        adminId
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  async getAdminPermissions(adminId: string): Promise<PermissionCheck[]> {
    try {
      await this.prisma.$connect();

      const admin = await this.prisma.admin.findUnique({
        where: { id: adminId },
        include: {
          customRole: {
            include: {
              permissions: {
                include: {
                  permission: true
                }
              }
            }
          }
        }
      });

      if (!admin) {
        throw new Error('Admin not found');
      }

      // If admin has SUPER_ADMIN role, they have all permissions
      if (admin.role === 'SUPER_ADMIN') {
        return [
          // All permissions for all resources
          { resource: ResourceType.USERS, action: PermissionAction.READ },
          { resource: ResourceType.USERS, action: PermissionAction.WRITE },
          { resource: ResourceType.USERS, action: PermissionAction.UPDATE },
          { resource: ResourceType.USERS, action: PermissionAction.DELETE },
          { resource: ResourceType.CONTRACTORS, action: PermissionAction.READ },
          { resource: ResourceType.CONTRACTORS, action: PermissionAction.WRITE },
          { resource: ResourceType.CONTRACTORS, action: PermissionAction.UPDATE },
          { resource: ResourceType.CONTRACTORS, action: PermissionAction.DELETE },
          { resource: ResourceType.QUOTATIONS, action: PermissionAction.READ },
          { resource: ResourceType.QUOTATIONS, action: PermissionAction.UPDATE },
          { resource: ResourceType.PRODUCTS, action: PermissionAction.READ },
          { resource: ResourceType.PRODUCTS, action: PermissionAction.UPDATE },
          { resource: ResourceType.DOCUMENTS, action: PermissionAction.READ },
          { resource: ResourceType.DOCUMENTS, action: PermissionAction.WRITE },
          { resource: ResourceType.TICKETS, action: PermissionAction.READ },
          { resource: ResourceType.TICKETS, action: PermissionAction.WRITE },
          { resource: ResourceType.TICKETS, action: PermissionAction.UPDATE },
          { resource: ResourceType.TICKETS, action: PermissionAction.DELETE }
        ];
      }

      // If admin has a custom role, return its permissions
      if (admin.customRole && admin.customRole.isActive) {
        return admin.customRole.permissions.map(rp => ({
          resource: rp.permission.resource,
          action: rp.permission.action
        }));
      }

      // Default ADMIN role has no specific permissions defined
      return [];

    } catch (error: any) {
      logger.error('Failed to get admin permissions:', {
        error: error.message,
        adminId
      });
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }
}

export { RoleService };