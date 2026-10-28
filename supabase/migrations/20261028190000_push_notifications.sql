-- Web Push: one row per browser/device that allowed notifications.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  p256dh text not null,
  auth text not null,
  audience text not null default 'customer' check (audience in ('customer', 'admin')),
  order_ids jsonb not null default '[]'::jsonb,
  reminders boolean not null default true,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint push_subscriptions_order_ids_are_array check (jsonb_typeof(order_ids) = 'array')
);

create index if not exists push_subscriptions_audience_idx on public.push_subscriptions (audience);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

-- Log of reminders and campaigns sent from the server or the admin panel.
create table if not exists public.push_broadcasts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('lunch', 'evening', 'campaign', 'test')),
  title text not null,
  body text not null,
  url text not null default '/',
  sent integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists push_broadcasts_created_at_idx on public.push_broadcasts (created_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.push_broadcasts enable row level security;
revoke all on table public.push_subscriptions from anon, authenticated;
revoke all on table public.push_broadcasts from anon, authenticated;
grant all on table public.push_subscriptions to service_role;
grant all on table public.push_broadcasts to service_role;

comment on table public.push_subscriptions is 'FoodiePack Web Push subscriptions (customers and kitchen admins); server-only via service_role.';
comment on table public.push_broadcasts is 'FoodiePack push reminders and campaigns log; server-only via service_role.';

-- New orders now start as "pending" (recibido) until the kitchen accepts them.
alter table public.orders alter column status set default 'pending';
alter table public.orders drop constraint if exists orders_status_is_valid;
alter table public.orders add constraint orders_status_is_valid check (status in ('pending', 'accepted', 'cancelled'));
