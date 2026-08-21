-- UGO core compatibility migration.
-- The production Supabase project already contains the canonical tables:
-- public.usuarios, public.perfiles_proveedor, public.categorias and public.subcategorias.
-- Do not create parallel profile/category tables.

alter type public.usuario_tipo add value if not exists 'superadmin';
