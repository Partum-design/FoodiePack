alter table public.orders
  drop constraint if exists orders_payment_method_is_valid;

alter table public.orders
  add constraint orders_payment_method_is_valid check (payment_method in ('card', 'cash', 'transfer'));
