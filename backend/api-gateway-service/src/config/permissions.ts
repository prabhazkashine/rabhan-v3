export interface RoutePermission {
  resource: string;
  action: string;
  description?: string;
}

export interface RoutePermissionConfig {
  [route: string]: {
    [method: string]: RoutePermission | RoutePermission[];
  };
}

export const HTTP_METHOD_TO_ACTION = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE'
} as const;

export const ROUTE_PERMISSIONS: RoutePermissionConfig = {
  // User management routes
  '/api/users': {
    GET: { resource: 'USERS', action: 'READ', description: 'View users list' },
    POST: { resource: 'USERS', action: 'CREATE', description: 'Create new user' }
  },
  '/api/users/:id': {
    GET: { resource: 'USERS', action: 'READ', description: 'View user details' },
    PUT: { resource: 'USERS', action: 'UPDATE', description: 'Update user' },
    DELETE: { resource: 'USERS', action: 'DELETE', description: 'Delete user' }
  },

  // Product management routes
  '/api/products': {
    GET: { resource: 'PRODUCTS', action: 'READ', description: 'View products list' },
    POST: { resource: 'PRODUCTS', action: 'CREATE', description: 'Create new product' }
  },
  '/api/products/:id': {
    GET: { resource: 'PRODUCTS', action: 'READ', description: 'View product details' },
    PUT: { resource: 'PRODUCTS', action: 'UPDATE', description: 'Update product' },
    DELETE: { resource: 'PRODUCTS', action: 'DELETE', description: 'Delete product' }
  },

  // Document management routes
  '/api/documents': {
    GET: { resource: 'DOCUMENTS', action: 'READ', description: 'View documents list' },
    POST: { resource: 'DOCUMENTS', action: 'CREATE', description: 'Upload new document' }
  },
  '/api/documents/:id': {
    GET: { resource: 'DOCUMENTS', action: 'READ', description: 'View document details' },
    PUT: { resource: 'DOCUMENTS', action: 'UPDATE', description: 'Update document' },
    DELETE: { resource: 'DOCUMENTS', action: 'DELETE', description: 'Delete document' }
  },

  // Document categories
  '/api/document-categories': {
    GET: { resource: 'DOCUMENTS', action: 'READ', description: 'View document categories' },
    POST: { resource: 'DOCUMENTS', action: 'CREATE', description: 'Create document category' }
  },
  '/api/document-categories/:id': {
    GET: { resource: 'DOCUMENTS', action: 'READ', description: 'View category details' },
    PUT: { resource: 'DOCUMENTS', action: 'UPDATE', description: 'Update category' },
    DELETE: { resource: 'DOCUMENTS', action: 'DELETE', description: 'Delete category' }
  },

  // Admin management routes
  '/api/admins': {
    GET: { resource: 'ADMINS', action: 'READ', description: 'View admins list' },
    POST: { resource: 'ADMINS', action: 'CREATE', description: 'Create new admin' }
  },
  '/api/admins/:id': {
    GET: { resource: 'ADMINS', action: 'READ', description: 'View admin details' },
    PUT: { resource: 'ADMINS', action: 'UPDATE', description: 'Update admin' },
    DELETE: { resource: 'ADMINS', action: 'DELETE', description: 'Delete admin' }
  },

  // Role management routes
  '/api/roles': {
    GET: { resource: 'ROLES', action: 'READ', description: 'View roles list' },
    POST: { resource: 'ROLES', action: 'CREATE', description: 'Create new role' }
  },
  '/api/roles/:id': {
    GET: { resource: 'ROLES', action: 'READ', description: 'View role details' },
    PUT: { resource: 'ROLES', action: 'UPDATE', description: 'Update role' },
    DELETE: { resource: 'ROLES', action: 'DELETE', description: 'Delete role' }
  },

  // Permission management routes
  '/api/permissions': {
    GET: { resource: 'PERMISSIONS', action: 'READ', description: 'View permissions list' },
    POST: { resource: 'PERMISSIONS', action: 'CREATE', description: 'Create new permission' }
  },
  '/api/permissions/:id': {
    GET: { resource: 'PERMISSIONS', action: 'READ', description: 'View permission details' },
    PUT: { resource: 'PERMISSIONS', action: 'UPDATE', description: 'Update permission' },
    DELETE: { resource: 'PERMISSIONS', action: 'DELETE', description: 'Delete permission' }
  },

  // Vendor management routes
  '/api/vendors': {
    GET: { resource: 'VENDORS', action: 'READ', description: 'View vendors list' },
    POST: { resource: 'VENDORS', action: 'CREATE', description: 'Create new vendor' }
  },
  '/api/vendors/:id': {
    GET: { resource: 'VENDORS', action: 'READ', description: 'View vendor details' },
    PUT: { resource: 'VENDORS', action: 'UPDATE', description: 'Update vendor' },
    DELETE: { resource: 'VENDORS', action: 'DELETE', description: 'Delete vendor' }
  }
};

export const getRequiredPermission = (route: string, method: string): RoutePermission | RoutePermission[] | null => {
  const exactMatch = ROUTE_PERMISSIONS[route]?.[method.toUpperCase()];
  if (exactMatch) {
    return exactMatch;
  }

  for (const configRoute in ROUTE_PERMISSIONS) {
    if (configRoute.includes(':')) {
      const pattern = configRoute
        .replace(/:[^/]+/g, '[^/]+') 
        .replace(/\//g, '\\/'); 

      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(route)) {
        return ROUTE_PERMISSIONS[configRoute]?.[method.toUpperCase()] || null;
      }
    }
  }

  return null;
};

export const needsPermissionCheck = (route: string, method: string): boolean => {
  return getRequiredPermission(route, method) !== null;
};