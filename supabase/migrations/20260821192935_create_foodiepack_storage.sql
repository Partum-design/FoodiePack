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
