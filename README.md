# FoodiePack

Aplicación de pedidos para una dark kitchen:

- `web`: tienda React/Vite para clientes.
- `api`: servidor Express para menús, pedidos y acceso administrativo.
- Supabase: persistencia de menús y pedidos en PostgreSQL.

La tienda permite pedir para mañana o armar un plan semanal (hasta 5 días disponibles). El servidor únicamente acepta pedidos entre las 8:00 y las 18:00, usando siempre la zona horaria `America/Mexico_City`. Si el plan cubre los 5 días y el cliente elige pagar por adelantado, se aplica 12% de descuento sobre la comida; el envío se cobra por día entregado.

La entrega está limitada a Lindavista, CDMX. Antes de confirmar, el cliente debe escribir su dirección y oficina, revisar el pin en Google Maps, confirmar la ubicación y elegir método de pago (transferencia, tarjeta o efectivo). La liga del pin queda guardada con el pedido y aparece en el panel de cocina.

## Radio de entrega automático

En cuanto el cliente escribe su dirección, la app mide sola la distancia hasta la cocina y muestra el resultado en el mismo formulario:

- Dentro del radio: confirma el envío gratis y deja continuar.
- Fuera del radio: muestra los kilómetros reales y bloquea el botón de confirmar.
- Sin poder ubicar la dirección: pide corregirla o usar la ubicación del dispositivo.

La medición usa las coordenadas del pin cuando el cliente pulsa «Usar mi ubicación» y, si no, resuelve la dirección escrita con Nominatim (OpenStreetMap). El servidor vuelve a medir antes de guardar el pedido, así que la regla no se puede saltar desde el navegador. Los kilómetros quedan guardados en el pedido y se ven en la administración.

La cocina y el radio se configuran con `KITCHEN_LATITUDE`, `KITCHEN_LONGITUDE` y `FREE_DELIVERY_RADIUS_KM`. Por omisión la cocina es Pernambuco 734, Lindavista (`19.49198, -99.12515`), una coincidencia a nivel calle: si quieres el punto exacto, coloca el pin en Google Maps y pega las coordenadas en esas variables, sin tocar el código.

Desde ahí, un radio de 3 km cubre Lindavista y Lindavista Sur, pero **San Felipe de Jesús queda a unos 5 km y se rechazaría**. Si quieres seguir sirviendo esa colonia, sube `FREE_DELIVERY_RADIUS_KM` a `6`; si no, conviene quitarla de los textos de la tienda (`ORDER_KEY_POINTS` y la tarjeta de zona en `src/App.tsx`).

Si Nominatim no responde, el pedido se acepta y aparece marcado como «distancia sin verificar» para que la cocina lo revise.

## Administración de pedidos

En `/admin` → pestaña **Pedidos**, cada pedido se puede marcar como completado, cancelar, reabrir o eliminar. Las pestañas de arriba filtran por estado y los totales de ingresos dejan fuera los cancelados. Cada tarjeta muestra la dirección completa, la oficina, el teléfono del cliente, la liga al pin de Google Maps, la distancia detectada y las indicaciones que dejó el cliente.

## Desarrollo local

```bash
npm install
npm run dev:all
```

La tienda abre en `http://localhost:5173` y la API en `http://localhost:8787`. En desarrollo, si no existe `.env`, la contraseña administrativa temporal es `foodiepack-local`.

La administración no aparece enlazada en la tienda. El operador entra directamente en:

```text
http://localhost:5173/admin
```

(el alias `/gestion-cocina` se mantiene por compatibilidad).

## Variables de entorno

Copia `.env.example` a `.env` y cambia todos los secretos antes de desplegar:

```env
VITE_API_URL=/api
PORT=8787
WEB_ORIGIN=https://tu-dominio.com
ADMIN_PASSWORD=una-contraseña-larga
JWT_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
KITCHEN_LATITUDE=19.49198
KITCHEN_LONGITUDE=-99.12515
FREE_DELIVERY_RADIUS_KM=3
SUPABASE_URL=https://icyjsedrzwruihrveyay.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-clave-service-role-de-supabase
```

`VITE_API_URL` se incorpora al compilar la web. `WEB_ORIGIN` limita qué dominio puede llamar directamente a la API. La clave `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor y nunca debe comenzar con `VITE_` ni llegar al navegador.

## Supabase

Las migraciones en `supabase/migrations/` crean las tablas `menu_days`, `orders` y `products`, activan RLS y dejan el acceso exclusivamente para `service_role`. La última agrega el ciclo de vida del pedido (`accepted`, `completed`, `cancelled`), su `updated_at` y la columna `distance_km` con la distancia detectada. Con la CLI de Supabase autenticada:

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
- La API valida que la zona de entrega sea Lindavista, mide la distancia a la cocina y rechaza los pedidos fuera del radio.
- La API genera la liga de Google Maps en el servidor.
- Cambiar el estado o eliminar un pedido requiere token de administración.
- El pago sigue siendo demostrativo y no realiza cargos reales.

```bash
npm run check
npm run lint
```
