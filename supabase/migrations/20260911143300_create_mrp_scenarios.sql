create table public.mrp_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  created_by integer not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  vehicles jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  constraint mrp_scenarios_vehicles_array check (jsonb_typeof(vehicles) = 'array'),
  constraint mrp_scenarios_materials_array check (jsonb_typeof(materials) = 'array')
);

comment on table public.mrp_scenarios is 'Cenarios persistentes do MRP II; simulacoes nao criam O.S. nem movimentam estoque.';
comment on column public.mrp_scenarios.vehicles is 'Veiculos hipoteticos serializados conforme o contrato do MRP II.';
comment on column public.mrp_scenarios.materials is 'Necessidades hipoteticas serializadas conforme o contrato do MRP I.';

create index mrp_scenarios_created_at_idx on public.mrp_scenarios (created_at desc);
create index mrp_scenarios_created_by_idx on public.mrp_scenarios (created_by);

alter table public.mrp_scenarios enable row level security;
revoke all on table public.mrp_scenarios from anon, authenticated;
