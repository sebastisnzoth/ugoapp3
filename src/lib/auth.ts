import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export type UserRole = 'cliente' | 'proveedor' | 'admin' | 'superadmin';
export type LegacyUserRole = 'cliente' | 'prestador' | 'soberano';

export function normalizeUserRole(role: string | null | undefined): UserRole | null {
  switch (role) {
    case 'cliente':
      return 'cliente';
    case 'prestador':
    case 'proveedor':
      return 'proveedor';
    case 'soberano':
    case 'superadmin':
      return 'superadmin';
    case 'admin':
      return 'admin';
    default:
      return null;
  }
}

function toLegacyUiRole(role: UserRole | null): LegacyUserRole | null {
  switch (role) {
    case 'cliente':
      return 'cliente';
    case 'proveedor':
      return 'prestador';
    case 'admin':
    case 'superadmin':
      return 'soberano';
    default:
      return null;
  }
}

export async function getCanonicalUserRole(uid: string): Promise<UserRole | null> {
  try {
    const profileRef = doc(db, 'profiles', uid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) return normalizeUserRole(profileSnap.data().tipo);
  } catch (error) {
    console.error('Error obteniendo rol del usuario:', error);
  }
  return null;
}

// Compatibilidad temporal con App.tsx mientras migra de Firebase a Supabase.
export async function getUserRole(uid: string): Promise<LegacyUserRole | null> {
  return toLegacyUiRole(await getCanonicalUserRole(uid));
}

export function checkAdminAccess(role: UserRole | null | undefined): boolean {
  if (role === 'admin' || role === 'superadmin') return true;
  throw new Error('Acceso denegado: se requiere un rol administrativo.');
}

export function routeUser(role: UserRole) {
  switch (role) {
    case 'admin':
    case 'superadmin':
      window.location.href = '/admin-touchboard';
      break;
    case 'proveedor':
      window.location.href = '/prestador-dashboard';
      break;
    case 'cliente':
      window.location.href = '/cliente-app';
      break;
    default:
      window.location.href = '/';
  }
}
