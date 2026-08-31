-- Estados operativos del pedido (aceptado / completado / cancelado),
-- marca de tiempo de actualización y distancia detectada a la cocina.

alter table public.orders
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.orders
  add column if not exists distance_km numeric(6, 2);

alter table public.orders
  add constraint orders_distance_km_is_positive check (distance_km is null or distance_km >= 0)
  not valid;

alter table public.orders validate constraint orders_distance_km_is_positive;

update public.orders
set status = 'accepted'
where status not in ('accepted', 'completed', 'cancelled');

alter table public.orders
  drop constraint if exists orders_status_is_valid;

alter table public.orders
  add constraint orders_status_is_valid check (status in ('accepted', 'completed', 'cancelled'));

create index if not exists orders_status_idx on public.orders (status);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

comment on column public.orders.status is 'accepted | completed | cancelled, controlado desde la administración.';
comment on column public.orders.distance_km is 'Distancia detectada entre la cocina y la dirección de entrega, en kilómetros.';
