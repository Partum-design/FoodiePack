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
