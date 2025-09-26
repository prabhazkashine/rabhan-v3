// Permission types for the roles & permissions system
import { ResourceType, PermissionAction } from '../generated/prisma';

// Re-export Prisma enums for consistency
export { ResourceType, PermissionAction };

// Permission mapping for each resource type
export const RESOURCE_PERMISSIONS: Record<ResourceType, PermissionAction[]> = {
  [ResourceType.USERS]: [PermissionAction.READ, PermissionAction.WRITE, PermissionAction.UPDATE, PermissionAction.DELETE],
  [ResourceType.CONTRACTORS]: [PermissionAction.READ, PermissionAction.WRITE, PermissionAction.UPDATE, PermissionAction.DELETE],
  [ResourceType.QUOTATIONS]: [PermissionAction.READ, PermissionAction.UPDATE], // Only read and update
  [ResourceType.PRODUCTS]: [PermissionAction.READ, PermissionAction.UPDATE]  // Only read and update
};

export interface PermissionCheck {
  resource: ResourceType;
  action: PermissionAction;
}

export interface RolePermission {
  id: string;
  resource: ResourceType;
  action: PermissionAction;
  description?: string;
}

export interface AdminRoleData {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  permissions: RolePermission[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface CreateRoleRequest {
  name: string;
  description?: string;
  permissions: PermissionCheck[];
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: PermissionCheck[];
  isActive?: boolean;
}