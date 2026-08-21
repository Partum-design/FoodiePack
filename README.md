# FoodiePack

Aplicación de pedidos para una dark kitchen:

- `web`: tienda React/Vite para clientes.
- `api`: servidor Express para menús, pedidos y acceso administrativo.
- Supabase: persistencia de menús y pedidos en PostgreSQL.

La tienda permite pedir para mañana o armar un plan semanal (hasta 5 días disponibles). El servidor únicamente acepta pedidos entre las 8:00 y las 18:00, usando siempre la zona horaria `America/Mexico_City`. Si el plan cubre los 5 días y el cliente elige pagar por adelantado, se aplica 12% de descuento sobre la comida; el envío se cobra por día entregado.

La entrega está limitada a Lindavista, CDMX. Antes de confirmar, el cliente debe escribir su dirección y oficina, revisar el pin en Google Maps, confirmar la ubicación y elegir método de pago (tarjeta o efectivo). La liga del pin queda guardada con el pedido y aparece en el panel de cocina.

## Desarrollo local

```bash
npm install
npm run dev:all
```

La tienda abre en `http://localhost:5173` y la API en `http://localhost:8787`. En desarrollo, si no existe `.env`, la contraseña administrativa temporal es `foodiepack-local`.

La administración no aparece enlazada en la tienda. El operador entra directamente en:

```text
http://localhost:5173/gestion-cocina
```

## Variables de entorno

Copia `.env.example` a `.env` y cambia todos los secretos antes de desplegar:

```env
VITE_API_URL=/api
PORT=8787
WEB_ORIGIN=https://tu-dominio.com
ADMIN_PASSWORD=una-contraseña-larga
JWT_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
SUPABASE_URL=https://icyjsedrzwruihrveyay.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role-de-supabase
```

`VITE_API_URL` se incorpora al compilar la web. `WEB_ORIGIN` limita qué dominio puede llamar directamente a la API. La clave `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor y nunca debe comenzar con `VITE_` ni llegar al navegador.

## Supabase

La migración en `supabase/migrations/` crea las tablas `menu_days` y `orders`, activa RLS y deja el acceso exclusivamente para `service_role`. Con la CLI de Supabase autenticada:

```bash
npx supabase@latest link --project-ref icyjsedrzwruihrveyay
npx supabase@latest db push
```

También puedes ejecutar el SQL de la migración desde el SQL Editor de Supabase si no tienes la CLI autenticada.

## Vercel

```bash
npx vercel link --yes --project foodiepack --scope partum-designs-projects
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production --sensitive
npx vercel env add ADMIN_PASSWORD production --sensitive
npx vercel env add JWT_SECRET production --sensitive
npx vercel --prod
```

`vercel.json` configura Vite con salida `dist`, sirve el API Express en `/api` y conserva la ruta SPA `/gestion-cocina`. Para previews, agrega las mismas variables en el entorno `preview`.

La web y el API se despliegan juntos en el proyecto Vercel `foodiepack`; no se debe usar `server/data/runtime.json` en producción.

## Seguridad y validación

- La contraseña solo se valida en el servidor.
- La administración usa tokens con vencimiento de ocho horas.
- Los endpoints de menú y pedidos administrativos requieren token.
- El inicio de sesión limita intentos por dirección IP.
- Los precios, disponibilidad, fecha y horario del pedido se vuelven a validar en la API.
- La API valida que la zona de entrega sea Lindavista y genera la liga de Google Maps en el servidor.
- El pago sigue siendo demostrativo y no realiza cargos reales.

```bash
npm run check
npm run lint
```
