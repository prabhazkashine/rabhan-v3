import { UserRole, UserStatus } from '../generated/prisma';

export interface CreateAdminRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
}

export interface UpdateAdminRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
}

export interface AdminListResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export interface PaginatedAdminsResponse {
  admins: AdminListResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}