# Permission-Based Access Control Setup

## Overview

The API Gateway now supports fine-grained permission-based access control using your admin service's permission verification system. Each API endpoint can be protected with specific resource and action requirements.

## How It Works

1. **Authentication**: User gets authenticated via `authenticateToken` middleware
2. **Permission Check**: Each protected route calls the admin service's `/api/auth/verify-permissions` endpoint
3. **Access Control**: Only users with the required permissions can access the endpoint

## Middleware Components

### 1. Permission Middleware (`src/middleware/permissionMiddleware.ts`)
- `checkPermission(resource, action)` - Single permission check
- `checkMultiplePermissions(permissions, requireAll)` - Multiple permissions check

### 2. Dynamic Permission Middleware (`src/middleware/dynamicPermissionMiddleware.ts`)
- `createPermissionMiddleware(resource, action)` - Creates middleware for specific permission
- `createAnyPermissionMiddleware(permissions)` - Requires any one permission
- `createAllPermissionsMiddleware(permissions)` - Requires all permissions

### 3. Permission Configuration (`src/config/permissions.ts`)
- Maps routes to required permissions
- HTTP method to action mapping (GET→READ, POST→CREATE, etc.)

## Updated Routes

### Products (`/api/products`)
- **GET** `/api/products/*` → Requires `PRODUCTS:READ`
- **POST** `/api/products/*` → Requires `PRODUCTS:CREATE`
- **PUT/PATCH** `/api/products/*` → Requires `PRODUCTS:UPDATE`
- **DELETE** `/api/products/*` → Requires `PRODUCTS:DELETE`

### Documents (`/api/documents`)
- **GET** `/api/documents/*` → Requires `DOCUMENTS:READ`
- **POST** `/api/documents/*` → Requires `DOCUMENTS:CREATE`
- **PUT/PATCH** `/api/documents/*` → Requires `DOCUMENTS:UPDATE`
- **DELETE** `/api/documents/*` → Requires `DOCUMENTS:DELETE`

### Document Categories (`/api/document-categories`)
- **GET** `/api/document-categories/*` → Requires `DOCUMENTS:READ`
- **POST** `/api/document-categories/*` → Requires `DOCUMENTS:CREATE`
- **PUT/PATCH** `/api/document-categories/*` → Requires `DOCUMENTS:UPDATE`
- **DELETE** `/api/document-categories/*` → Requires `DOCUMENTS:DELETE`

### Admin Routes (`/api/admins`, `/api/roles`, `/api/permissions`)
- **GET** `/api/admins/*` → Requires `ADMINS:READ`
- **POST** `/api/admins/*` → Requires `ADMINS:CREATE`
- **PUT/PATCH** `/api/admins/*` → Requires `ADMINS:UPDATE`
- **DELETE** `/api/admins/*` → Requires `ADMINS:DELETE`

Similar patterns for roles and permissions resources.

## Testing the Permission System

### 1. Test User with LIMITED Permissions
```bash
# User with only DOCUMENTS:READ permission
curl -H "Authorization: Bearer <token>" \
     -X GET http://localhost:8000/api/documents/list
# ✅ Should work

curl -H "Authorization: Bearer <token>" \
     -X POST http://localhost:8000/api/documents \
     -H "Content-Type: application/json" \
     -d '{"name": "test.pdf"}'
# ❌ Should return 403 Forbidden
```

### 2. Test User with FULL Permissions
```bash
# User with DOCUMENTS:CREATE permission
curl -H "Authorization: Bearer <token>" \
     -X POST http://localhost:8000/api/documents \
     -H "Content-Type: application/json" \
     -d '{"name": "test.pdf"}'
# ✅ Should work
```

### 3. Expected Response for Permission Denied
```json
{
  "success": false,
  "message": "Permission denied",
  "requiredPermission": {
    "resource": "DOCUMENTS",
    "action": "CREATE"
  }
}
```

## Configuration

### Environment Variables
Make sure your `.env` file has:
```env
ADMIN_SERVICE_URL=http://localhost:3003
```

### Admin Service Integration
The gateway calls this endpoint in your admin service:
```
POST /api/auth/verify-permissions
Content-Type: application/json
Authorization: Bearer <token>

{
  "resource": "DOCUMENTS",
  "action": "CREATE"
}
```

## Adding New Protected Routes

### Example: Protecting a new `/api/reports` endpoint
```typescript
// In your router file
import { createPermissionMiddleware } from '../middleware/dynamicPermissionMiddleware';

// GET reports requires REPORTS:READ
router.get('/reports',
  requireAuth,
  createPermissionMiddleware('REPORTS', 'READ'),
  reportProxy
);

// POST reports requires REPORTS:CREATE
router.post('/reports',
  requireAuth,
  createPermissionMiddleware('REPORTS', 'CREATE'),
  reportProxy
);
```

## Benefits

1. **Centralized Authorization**: All permission logic in one place
2. **Fine-grained Control**: Different permissions for different operations
3. **Consistent Security**: Same permission model across all services
4. **Easy to Extend**: Add new resources and actions easily
5. **Performance**: Single permission check per request
6. **Debugging**: Clear error messages show exactly what permission is missing

## Note

SUPER_ADMIN users automatically pass all permission checks in the admin service, so they can access all endpoints regardless of specific permissions.