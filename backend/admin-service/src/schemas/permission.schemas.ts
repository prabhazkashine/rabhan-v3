import { z } from 'zod';
import { ResourceType, PermissionAction } from '../generated/prisma';
import { RESOURCE_PERMISSIONS } from '../types/permissions.types';

export const checkPermissionSchema = z.object({
  body: z.object({
    resource: z
      .nativeEnum(ResourceType),

    action: z
      .nativeEnum(PermissionAction)
  }).refine((data) => {
    const allowedActions = RESOURCE_PERMISSIONS[data.resource];
    return allowedActions.includes(data.action);
  }, {
    message: 'Invalid action for this resource type'
  })
});

export const checkMultiplePermissionsSchema = z.object({
  body: z.object({
    permissions: z
      .array(
        z.object({
          resource: z.nativeEnum(ResourceType),
          action: z.nativeEnum(PermissionAction)
        }).refine((data) => {
          const allowedActions = RESOURCE_PERMISSIONS[data.resource];
          return allowedActions.includes(data.action);
        }, {
          message: 'Invalid action for this resource type'
        })
      )
      .min(1, 'At least one permission is required')
      .max(10, 'Cannot check more than 10 permissions at once'),

    requireAll: z
      .boolean()
      .default(true)
      .describe('If true, user must have ALL permissions. If false, user must have ANY permission')
  })
});

export const checkPermissionByAdminIdSchema = z.object({
  body: z.object({
    adminId: z
      .string()
      .uuid('Invalid admin ID format'),

    resource: z
      .nativeEnum(ResourceType),

    action: z
      .nativeEnum(PermissionAction)
  }).refine((data) => {
    const allowedActions = RESOURCE_PERMISSIONS[data.resource];
    return allowedActions.includes(data.action);
  }, {
    message: 'Invalid action for this resource type'
  })
});

export const checkMultiplePermissionsByAdminIdSchema = z.object({
  body: z.object({
    adminId: z
      .string()
      .uuid('Invalid admin ID format'),

    permissions: z
      .array(
        z.object({
          resource: z.nativeEnum(ResourceType),
          action: z.nativeEnum(PermissionAction)
        }).refine((data) => {
          const allowedActions = RESOURCE_PERMISSIONS[data.resource];
          return allowedActions.includes(data.action);
        }, {
          message: 'Invalid action for this resource type'
        })
      )
      .min(1, 'At least one permission is required')
      .max(10, 'Cannot check more than 10 permissions at once'),

    requireAll: z
      .boolean()
      .default(true)
      .describe('If true, admin must have ALL permissions. If false, admin must have ANY permission')
  })
});

export type CheckPermissionSchemaType = z.infer<typeof checkPermissionSchema>;
export type CheckMultiplePermissionsSchemaType = z.infer<typeof checkMultiplePermissionsSchema>;
export type CheckPermissionByAdminIdSchemaType = z.infer<typeof checkPermissionByAdminIdSchema>;
export type CheckMultiplePermissionsByAdminIdSchemaType = z.infer<typeof checkMultiplePermissionsByAdminIdSchema>;