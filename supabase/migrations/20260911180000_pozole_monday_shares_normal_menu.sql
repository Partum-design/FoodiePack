-- Monday 2026-09-14 now also has a normal curated menu (Mole con pollo) alongside the
-- pozole special, so its customer-facing reason text should no longer claim pozole is the
-- only option that day. Tuesday 2026-09-15 stays pozole-only; leave it untouched.
update public.special_menu_days
set reason = 'Pozole con precio único (+agua de sabor extra), además del menú normal del día.'
where menu_date = '2026-09-14' and kind = 'special_package';
