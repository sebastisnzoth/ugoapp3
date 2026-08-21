export type UserRole = 'client' | 'provider' | 'admin' | 'superadmin';

export type ProviderStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfile {
  userId: string;
  status: ProviderStatus;
  displayName: string | null;
  description: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const APP_ACCESS: Record<UserRole, readonly ('client' | 'provider' | 'admin')[]> = {
  client: ['client'],
  provider: ['provider'],
  admin: ['admin'],
  superadmin: ['admin'],
};
