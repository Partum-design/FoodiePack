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
