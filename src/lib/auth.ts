import { supabase } from './supabase';

export type UserRole = 'cliente' | 'proveedor' | 'admin' | 'superadmin';

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

export async function getUserRole(uid?: string): Promise<UserRole | null> {
  const userId = uid ?? (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('tipo')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error obteniendo rol desde Supabase:', error);
    return null;
  }

  return normalizeUserRole(data?.tipo);
}

export function checkAdminAccess(role: UserRole | null | undefined): boolean {
  if (role === 'admin' || role === 'superadmin') return true;
  throw new Error('Acceso denegado: se requiere un rol administrativo.');
}

export function defaultViewForRole(role: UserRole | null): 'map' | 'provider' | 'admin' {
  if (role === 'admin' || role === 'superadmin') return 'admin';
  if (role === 'proveedor') return 'provider';
  return 'map';
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
