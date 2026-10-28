-- FoodiePack: esquema completo para un proyecto de Supabase NUEVO.
-- Pégalo completo en Supabase > SQL Editor > Run. Generado a partir de supabase/migrations/ (en orden).

-- ================================================================
-- 20260821192935_create_foodiepack_storage.sql
-- ================================================================
create table if not exists public.menu_days (
  menu_date date primary key,
  meals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint menu_days_meals_are_array check (jsonb_typeof(meals) = 'array')
);

create table if not exists public.orders (
  id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  delivery_date date not null,
  status text not null default 'accepted',
  payment_method text not null,
  is_weekly_plan boolean not null default false,
  customer jsonb not null,
  delivery jsonb not null,
  items jsonb not null,
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  discount_rate numeric(5, 4) not null default 0 check (discount_rate >= 0 and discount_rate <= 1),
  discount_amount integer not null default 0 check (discount_amount >= 0),
  total integer not null check (total >= 0),
  constraint orders_payment_method_is_valid check (payment_method in ('card', 'cash')),
  constraint orders_customer_is_object check (jsonb_typeof(customer) = 'object'),
  constraint orders_delivery_is_object check (jsonb_typeof(delivery) = 'object'),
  constraint orders_items_are_array check (jsonb_typeof(items) = 'array')
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_delivery_date_idx on public.orders (delivery_date);

create or replace function public.set_menu_days_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists menu_days_set_updated_at on public.menu_days;
create trigger menu_days_set_updated_at
before update on public.menu_days
for each row execute function public.set_menu_days_updated_at();

alter table public.menu_days enable row level security;
alter table public.orders enable row level security;

revoke all on table public.menu_days from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
grant all on table public.menu_days to service_role;
grant all on table public.orders to service_role;
revoke execute on function public.set_menu_days_updated_at() from public, anon, authenticated;

comment on table public.menu_days is 'FoodiePack menus by delivery date; accessed by the server using service_role.';
comment on table public.orders is 'FoodiePack accepted orders; accessed by the server using service_role.';

-- ================================================================
-- 20260827120000_add_products_catalog.sql
-- ================================================================
create table if not exists public.products (
  id text primary key,
  name text not null,
  description text not null,
  price integer not null check (price >= 1),
  protein integer not null default 0 check (protein >= 0),
  kcal integer not null default 0 check (kcal >= 0),
  tags jsonb not null default '[]'::jsonb,
  image text not null default '/assets/meals/pollo-citrico.jpg',
  available boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_tags_are_array check (jsonb_typeof(tags) = 'array')
);

create index if not exists products_created_at_idx on public.products (created_at asc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.products enable row level security;

revoke all on table public.products from anon, authenticated;
grant all on table public.products to service_role;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

comment on table public.products is 'FoodiePack reusable meal catalog; accessed by the server using service_role.';

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ================================================================
-- 20260827130000_allow_transfer_payment_method.sql
-- ================================================================
alter table public.orders
  drop constraint if exists orders_payment_method_is_valid;

alter table public.orders
  add constraint orders_payment_method_is_valid check (payment_method in ('card', 'cash', 'transfer'));

-- ================================================================
-- 20260827140000_harden_trigger_search_paths.sql
-- ================================================================
alter function public.set_menu_days_updated_at() set search_path = '';

-- ================================================================
-- 20260828100000_seed_next_week_menu_and_packages.sql
-- ================================================================
-- Todos los productos publicados comparten las tres opciones comerciales.
alter table public.products
  add column if not exists packages jsonb not null default '["economico","ejecutivo","completo"]'::jsonb;

update public.products
set packages = '["economico","ejecutivo","completo"]'::jsonb
where packages is null or jsonb_typeof(packages) <> 'array';

alter table public.products
  drop constraint if exists products_packages_are_valid;

alter table public.products
  add constraint products_packages_are_valid check (
    jsonb_typeof(packages) = 'array'
    and packages @> '["economico","ejecutivo","completo"]'::jsonb
    and jsonb_array_length(packages) = 3
  );

comment on column public.products.packages is 'Paquetes disponibles para este producto; FoodiePack publica los tres.';

-- Menú de la siguiente semana: lunes 31 de agosto a viernes 4 de septiembre de 2026.
insert into public.menu_days (menu_date, meals)
values
('2026-08-31', $$[
  {"id":"menu-2026-08-31-alambre-puerco","name":"Alambre de puerco","description":"Alambre casero de puerco con verduras; acompáñalo con la base del día.","price":60,"protein":30,"kcal":560,"tags":["Guisado del día"],"image":"/assets/meals/next-week/alambre-puerco-lunes.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-08-31-longaniza-verde","name":"Longaniza en salsa verde","description":"Longaniza en salsa verde, con opción de huevo y la base del día.","price":60,"protein":27,"kcal":590,"tags":["Guisado del día"],"image":"/assets/meals/next-week/longaniza-verde.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-01', $$[
  {"id":"menu-2026-09-01-picadillo","name":"Picadillo","description":"Picadillo casero con verduras y la base del día: arroz, frijoles, huevo o pasta.","price":60,"protein":29,"kcal":540,"tags":["Guisado del día"],"image":"/assets/meals/next-week/picadillo.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-01-huevo-pasilla","name":"Huevo en pasilla","description":"Huevo en salsa de chile pasilla con tomates y la base del día.","price":60,"protein":21,"kcal":460,"tags":["Vegetariano"],"image":"/assets/meals/next-week/huevo-pasilla.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-02', $$[
  {"id":"menu-2026-09-02-albondigas","name":"Albóndigas","description":"Albóndigas caseras en salsa, servidas con la base y guarnición del día.","price":60,"protein":32,"kcal":570,"tags":["Guisado del día"],"image":"/assets/meals/next-week/albondigas.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-02-papas-rajas","name":"Papas con rajas","description":"Papas con rajas y crema, una opción vegetariana para acompañar la base del día.","price":60,"protein":12,"kcal":430,"tags":["Vegetariano"],"image":"/assets/meals/next-week/papas-rajas.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-03', $$[
  {"id":"menu-2026-09-03-alambre-puerco","name":"Alambre de puerco","description":"Alambre de puerco con verduras, preparado al momento.","price":60,"protein":30,"kcal":560,"tags":["Guisado del día"],"image":"/assets/meals/next-week/alambre-puerco-jueves.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-03-salchicha-mexicana","name":"Salchicha mexicana","description":"Salchicha a la mexicana con la base y guarnición del día.","price":60,"protein":24,"kcal":520,"tags":["Guisado del día"],"image":"/assets/meals/next-week/salchicha-mexicana.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-04', $$[
  {"id":"menu-2026-09-04-chuleta-morita","name":"Chuleta ahumada en salsa morita","description":"Chuleta ahumada en salsa morita, con la base y guarnición del día.","price":60,"protein":34,"kcal":610,"tags":["Guisado del día"],"image":"/assets/meals/next-week/chuleta-morita.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-04-calabacita-mexicana","name":"Calabacita mexicana","description":"Calabacita a la mexicana, opción ligera con la base del día.","price":60,"protein":10,"kcal":390,"tags":["Vegetariano"],"image":"/assets/meals/next-week/calabacita-mexicana.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb)
on conflict (menu_date) do update
set meals = excluded.meals,
    updated_at = timezone('utc', now());

-- ================================================================
-- 20260903120000_allow_terminal_payment_method.sql
-- ================================================================
alter table public.orders
  drop constraint if exists orders_payment_method_is_valid;

alter table public.orders
  add constraint orders_payment_method_is_valid check (payment_method in ('card', 'cash', 'transfer', 'terminal'));

-- ================================================================
-- 20260910120000_add_special_menu_days.sql
-- ================================================================
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

-- ================================================================
-- 20260910170500_add_image_to_special_menu_days.sql
-- ================================================================
alter table public.special_menu_days
  add column if not exists image text;

-- Backfill the pozole special-price days with their photo.
update public.special_menu_days
set image = '/assets/meals/special/pozole.jpg'
where menu_date in ('2026-09-14', '2026-09-15') and kind = 'special_package';

-- ================================================================
-- 20260911180000_pozole_monday_shares_normal_menu.sql
-- ================================================================
-- Monday 2026-09-14 now also has a normal curated menu (Mole con pollo) alongside the
-- pozole special, so its customer-facing reason text should no longer claim pozole is the
-- only option that day. Tuesday 2026-09-15 stays pozole-only; leave it untouched.
update public.special_menu_days
set reason = 'Pozole con precio único (+agua de sabor extra), además del menú normal del día.'
where menu_date = '2026-09-14' and kind = 'special_package';

-- ================================================================
-- 20260921120000_seed_week_21_25_menu.sql
-- ================================================================
-- Menú de la semana del lunes 21 al viernes 25 de septiembre de 2026.
insert into public.menu_days (menu_date, meals)
values
('2026-09-21', $$[
  {"id":"menu-2026-09-21-tortas-de-papa","name":"Tortas de papa","description":"Tortas caseras de papa, doradas y servidas con la base y guarnición del día.","price":60,"protein":12,"kcal":460,"tags":["Vegetariano"],"image":"/assets/meals/week-21-25/tortas-de-papa.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-21-salchicha-con-crema","name":"Salchicha con crema","description":"Salchicha en salsa cremosa, servida con la base y guarnición del día.","price":60,"protein":24,"kcal":540,"tags":["Guisado del día"],"image":"/assets/meals/week-21-25/salchicha-con-crema.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-22', $$[
  {"id":"menu-2026-09-22-pollo-al-guajillo","name":"Pollo al guajillo","description":"Pollo en salsa de chile guajillo, servido con la base y guarnición del día.","price":60,"protein":32,"kcal":560,"tags":["Guisado del día"],"image":"/assets/meals/week-21-25/pollo-al-guajillo.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-22-huevo-salsa-verde","name":"Huevo en salsa verde","description":"Huevo en salsa verde casera, servido con la base y guarnición del día.","price":60,"protein":21,"kcal":440,"tags":["Vegetariano"],"image":"/assets/meals/week-21-25/huevo-salsa-verde.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-23', $$[
  {"id":"menu-2026-09-23-carne-puerco-salsa-verde","name":"Carne de puerco en salsa verde","description":"Carne de puerco en salsa verde, servida con la base y guarnición del día.","price":60,"protein":31,"kcal":570,"tags":["Guisado del día"],"image":"/assets/meals/week-21-25/carne-puerco-salsa-verde.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-23-rajas-con-crema","name":"Rajas con crema","description":"Rajas con crema, una opción vegetariana servida con la base del día.","price":60,"protein":10,"kcal":420,"tags":["Vegetariano"],"image":"/assets/meals/week-21-25/rajas-con-crema.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-24', $$[
  {"id":"menu-2026-09-24-mole-verde","name":"Mole verde","description":"Mole verde casero, servido con la base y guarnición del día.","price":60,"protein":30,"kcal":550,"tags":["Guisado del día"],"image":"/assets/meals/week-21-25/mole-verde.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-24-papas-con-crema","name":"Papas con crema","description":"Papas con crema, una opción vegetariana servida con la base del día.","price":60,"protein":9,"kcal":430,"tags":["Vegetariano"],"image":"/assets/meals/week-21-25/papas-con-crema.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb),
('2026-09-25', $$[
  {"id":"menu-2026-09-25-chicharron-jitomate","name":"Chicharrón en salsa de jitomate","description":"Chicharrón en salsa de jitomate, servido con la base y guarnición del día.","price":60,"protein":28,"kcal":590,"tags":["Guisado del día"],"image":"/assets/meals/week-21-25/chicharron-jitomate.jpg","available":true,"packages":["economico","ejecutivo","completo"]},
  {"id":"menu-2026-09-25-calabacitas-mexicana","name":"Calabacitas a la mexicana","description":"Calabacitas a la mexicana, una opción vegetariana servida con la base del día.","price":60,"protein":10,"kcal":390,"tags":["Vegetariano"],"image":"/assets/meals/week-21-25/calabacitas-mexicana.jpg","available":true,"packages":["economico","ejecutivo","completo"]}
]$$::jsonb)
on conflict (menu_date) do update
set meals = excluded.meals,
    updated_at = timezone('utc', now());
