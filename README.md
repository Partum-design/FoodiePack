# FoodiePack

Aplicación de pedidos para una dark kitchen con dos procesos independientes:

- `web`: tienda React/Vite para clientes.
- `api`: servidor Express para menús, pedidos y acceso administrativo.

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
VITE_API_URL=https://api.tu-dominio.com/api
PORT=8787
WEB_ORIGIN=https://tu-dominio.com
ADMIN_PASSWORD=una-contraseña-larga
JWT_SECRET=un-secreto-aleatorio-de-al-menos-32-caracteres
```

`VITE_API_URL` se incorpora al compilar la web. `WEB_ORIGIN` limita qué dominio puede llamar directamente a la API.

## Despliegue separado

Web:

```bash
VITE_API_URL=https://api.tu-dominio.com/api npm run build
```

Publica la carpeta `dist` en el hosting web.

Servidor:

```bash
NODE_ENV=production npm run start:api
```

El servidor guarda menús y pedidos en `server/data/runtime.json`. En producción debes montar `server/data` en un volumen persistente o sustituir este almacenamiento por una base de datos antes de usar múltiples instancias.

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
```
