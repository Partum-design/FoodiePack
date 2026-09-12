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
