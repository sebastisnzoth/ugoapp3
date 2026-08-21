-- UGO core compatibility migration.
-- The production Supabase project already contains the canonical tables:
-- public.usuarios, public.perfiles_proveedor, public.categorias and public.subcategorias.
-- Do not create parallel profile/category tables.

alter type public.usuario_tipo add value if not exists 'superadmin';

create or replace function private.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.usuarios u
    where u.id = uid
      and u.tipo in ('admin', 'superadmin')
      and u.activo
  );
$$;
