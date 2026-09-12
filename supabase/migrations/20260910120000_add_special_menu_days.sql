create table if not exists public.special_menu_days (
  menu_date date primary key,
  kind text not null check (kind in ('closed', 'special_package')),
  label text not null,
  reason text not null default '',
  package_name text,
  package_price integer check (package_price is null or package_price >= 0),
  package_includes jsonb not null default '[]'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint special_menu_days_package_includes_are_array check (jsonb_typeof(package_includes) = 'array'),
  constraint special_menu_days_addons_are_array check (jsonb_typeof(addons) = 'array'),
  constraint special_menu_days_package_requires_fields check (
    kind <> 'special_package' or (package_name is not null and package_price is not null)
  )
);

drop trigger if exists special_menu_days_set_updated_at on public.special_menu_days;
create trigger special_menu_days_set_updated_at
before update on public.special_menu_days
for each row execute function public.set_updated_at();

alter table public.special_menu_days enable row level security;

revoke all on table public.special_menu_days from anon, authenticated;
grant all on table public.special_menu_days to service_role;

comment on table public.special_menu_days is 'FoodiePack holiday closures and fixed-price special day menus (e.g. pozole days); accessed by the server using service_role.';

-- Seed the September 2026 patriotic-holiday closure and the pozole special days.
insert into public.special_menu_days (menu_date, kind, label, reason, package_name, package_price, package_includes, addons)
values
  ('2026-09-16', 'closed', 'Día feriado', 'No recibimos pedidos el 16 de septiembre por ser día feriado.', null, null, '[]'::jsonb, '[]'::jsonb),
  ('2026-09-14', 'special_package', 'Menú especial de pozole', 'Solo pozole este día, precio único.', 'Pozole', 135, '["Crema", "Tostadas", "Verdura"]'::jsonb, '[{"name": "Agua de sabor", "price": 15}]'::jsonb),
  ('2026-09-15', 'special_package', 'Menú especial de pozole', 'Solo pozole este día, precio único.', 'Pozole', 135, '["Crema", "Tostadas", "Verdura"]'::jsonb, '[{"name": "Agua de sabor", "price": 15}]'::jsonb)
on conflict (menu_date) do update set
  kind = excluded.kind,
  label = excluded.label,
  reason = excluded.reason,
  package_name = excluded.package_name,
  package_price = excluded.package_price,
  package_includes = excluded.package_includes,
  addons = excluded.addons;
