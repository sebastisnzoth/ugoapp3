export type UserRole = 'cliente' | 'proveedor' | 'admin' | 'superadmin';

export type ProviderVerificationStatus =
  | 'registrado'
  | 'pendiente'
  | 'verificado'
  | 'rechazado'
  | 'suspendido';

export interface Usuario {
  id: string;
  nombre: string;
  apellido: string | null;
  tipo: UserRole;
  activo: boolean;
  fotoUrl: string | null;
  pais: string;
  zona: string | null;
  karma: number;
  serviciosCompletados: number;
  createdAt: string;
  updatedAt: string;
}

export interface PerfilProveedor {
  usuarioId: string;
  bio: string | null;
  tarifaBase: number;
  online: boolean;
  disponible: boolean;
  zonaRadioKm: number;
  estadoVerificacion: ProviderVerificationStatus;
  categoriaPrincipalId: string | null;
  onboardingPaso: number;
  motivoRechazo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  activa: boolean;
}

export const APP_ACCESS: Record<UserRole, readonly ('client' | 'provider' | 'admin')[]> = {
  cliente: ['client'],
  proveedor: ['provider'],
  admin: ['admin'],
  superadmin: ['admin'],
};
