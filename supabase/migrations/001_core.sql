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

create or replace function private.guard_usuario_tipo_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tipo is distinct from old.tipo then
    if auth.uid() = old.id and not private.is_admin(auth.uid()) then
      if new.tipo not in ('cliente'::public.usuario_tipo, 'proveedor'::public.usuario_tipo) then
        raise exception 'role escalation is not allowed';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_usuario_tipo_change on public.usuarios;
create trigger guard_usuario_tipo_change
before update of tipo on public.usuarios
for each row execute function private.guard_usuario_tipo_change();

drop policy if exists "proveedor_insert_own" on public.perfiles_proveedor;
create policy "proveedor_insert_own"
on public.perfiles_proveedor
for insert
to authenticated
with check (
  usuario_id = auth.uid()
  and exists (
    select 1 from public.usuarios u
    where u.id = auth.uid()
      and u.tipo = 'proveedor'::public.usuario_tipo
      and u.activo
  )
);
