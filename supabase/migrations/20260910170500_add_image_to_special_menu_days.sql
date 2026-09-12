alter table public.special_menu_days
  add column if not exists image text;

-- Backfill the pozole special-price days with their photo.
update public.special_menu_days
set image = '/assets/meals/special/pozole.jpg'
where menu_date in ('2026-09-14', '2026-09-15') and kind = 'special_package';
