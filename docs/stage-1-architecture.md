# UGO — Etapa 1: núcleo compartido

## Objetivo

Conectar tres superficies del producto a un mismo núcleo de datos y autenticación:

- App Cliente
- App Proveedor
- Panel Admin

La aplicación React/Vite existente se conserva como base del Panel Admin mientras se separan gradualmente las superficies cliente y proveedor.

## Fuente única de verdad

Todos los clientes deben consumir el mismo backend y los mismos contratos de dominio. La autenticación identifica al usuario y `profiles.role` determina su superficie y permisos.

Roles iniciales:

- `client`
- `provider`
- `admin`
- `superadmin`

## Estructura objetivo

```text
ugo/
├── apps/
│   ├── admin/
│   ├── client/
│   └── provider/
├── packages/
│   └── core/
│       └── src/
│           └── domain.ts
├── supabase/
│   └── migrations/
│       └── 001_core.sql
└── docs/
    └── stage-1-architecture.md
```

## Regla de integración

Ninguna app mantiene una copia independiente de usuarios, proveedores o servicios. Las tres superficies deben leer y escribir sobre las mismas entidades backend, aplicando control de acceso por rol.

## Entidades mínimas de la Etapa 1

- `profiles`: identidad de producto enlazada al usuario autenticado.
- `provider_profiles`: datos específicos del proveedor y estado de aprobación.
- `service_categories`: catálogo administrable de categorías.

## Siguiente paso

Aplicar `supabase/migrations/001_core.sql` al proyecto Supabase de UGO, configurar variables de entorno y conectar el cliente compartido de autenticación en las tres superficies.
