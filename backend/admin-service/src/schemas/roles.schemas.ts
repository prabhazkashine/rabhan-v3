import { z } from 'zod';
import { ResourceType, PermissionAction } from '../generated/prisma';
import { RESOURCE_PERMISSIONS } from '../types/permissions.types';

const permissionSchema = z.object({
  resource: z.nativeEnum(ResourceType),
  action: z.nativeEnum(PermissionAction)
}).refine((data) => {
  const allowedActions = RESOURCE_PERMISSIONS[data.resource];
  return allowedActions.includes(data.action);
}, {
  message: 'Invalid action for this resource type'
});

export const createRoleSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Role name is required')
      .max(100, 'Role name cannot exceed 100 characters')
      .regex(/^[a-zA-Z0-9_\s-]+$/, 'Role name must contain only letters, numbers, spaces, hyphens, and underscores'),

    description: z
      .string()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),

    permissions: z
      .array(permissionSchema)
      .min(1, 'At least one permission is required')
      .max(20, 'Cannot assign more than 20 permissions')
      .refine((permissions) => {
        // Check for duplicates
        const unique = new Set(permissions.map(p => `${p.resource}:${p.action}`));
        return unique.size === permissions.length;
      }, {
        message: 'Duplicate permissions are not allowed'
      })
  })
});

export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid role ID format')
  }),
  body: z.object({
    name: z
      .string()
      .min(1, 'Role name is required')
      .max(100, 'Role name cannot exceed 100 characters')
      .regex(/^[a-zA-Z0-9_\s-]+$/, 'Role name must contain only letters, numbers, spaces, hyphens, and underscores')
      .optional(),

    description: z
      .string()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),

    isActive: z
      .boolean()
      .optional(),

    permissions: z
      .array(permissionSchema)
      .min(1, 'At least one permission is required')
      .max(20, 'Cannot assign more than 20 permissions')
      .refine((permissions) => {
        // Check for duplicates
        const unique = new Set(permissions.map(p => `${p.resource}:${p.action}`));
        return unique.size === permissions.length;
      }, {
        message: 'Duplicate permissions are not allowed'
      })
      .optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update'
  })
});

export const deleteRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid role ID format')
  })
});

export const getRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid role ID format')
  })
});

export const listRolesSchema = z.object({
  query: z.object({
    page: z
      .string()
      .regex(/^\d+$/, 'Page must be a positive number')
      .transform(Number)
      .refine(n => n > 0, 'Page must be greater than 0')
      .default(() => 1),

    limit: z
      .string()
      .regex(/^\d+$/, 'Limit must be a positive number')
      .transform(Number)
      .refine(n => n > 0 && n <= 50, 'Limit must be between 1 and 50')
      .default(() => 10),

    isActive: z
      .string()
      .transform(val => val === 'true')
      .optional()
  })
});

export const assignRoleSchema = z.object({
  params: z.object({
    adminId: z.string().uuid('Invalid admin ID format')
  }),
  body: z.object({
    roleId: z.string().uuid('Invalid role ID format').nullable()
  })
});

export type CreateRoleSchemaType = z.infer<typeof createRoleSchema>;
export type UpdateRoleSchemaType = z.infer<typeof updateRoleSchema>;
export type DeleteRoleSchemaType = z.infer<typeof deleteRoleSchema>;
export type GetRoleSchemaType = z.infer<typeof getRoleSchema>;
export type ListRolesSchemaType = z.infer<typeof listRolesSchema>;
export type AssignRoleSchemaType = z.infer<typeof assignRoleSchema>;