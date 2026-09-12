# Auditoría técnica y optimización — FoodiePack

Fecha: 2026-09-11. Alcance: auditoría completa del proyecto (Vite + React 19 + TypeScript, API Express + Supabase) y mejoras de rendimiento, SEO, accesibilidad, seguridad, analítica y arranque de la app Android. Ningún texto, precio, dato de contacto, URL de negocio o identidad visual fue modificado.

## 1. Problemas encontrados

- 16 errores de ESLint, todos falsos positivos: `eslint.config.js` no declaraba los globals de Service Worker para `public/sw.js`.
- El bundle inicial cargaba `leaflet` (~3.9 MB en `node_modules`, ~49 KB gzip) aunque el mapa solo se usa dentro del diálogo de checkout — nunca en la carga inicial.
- Sin `robots.txt`, `sitemap.xml`, `canonical`, Open Graph, Twitter Card ni datos estructurados.
- Dos `<h1>` renderizando al mismo tiempo en la tienda (el hero y el título del menú del día/semana), lo cual es inválido para SEO/accesibilidad.
- `--muted` (`#6c7973` sobre `--paper` `#f3f2ec`) daba 4.05:1 de contraste, por debajo del mínimo WCAG AA (4.5:1) para texto normal.
- Sin cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.) en las respuestas HTML/estáticas — `helmet()` solo protegía las respuestas JSON de la API.
- Una vulnerabilidad moderada en `qs` (dependencia transitiva de Express) con corrección disponible.
- Sin Google Analytics (se agregó en esta pasada, ver sección 10).
- La app no existía en formato móvil/Android.

Lo que **ya estaba bien hecho** y se dejó intacto: validación con Zod en la API, comparación de contraseña con `crypto.timingSafeEqual`, rate limiting del login admin, RLS en Supabase, Service Worker con exclusión correcta de `/admin` y `/api/*`, manifest PWA completo con set de íconos, y un `@media (prefers-reduced-motion: reduce)` ya bastante completo en `styles.css`.

## 2. Cambios realizados

- `eslint.config.js`: bloque nuevo para `public/sw.js` con `globals.serviceworker`.
- `src/App.tsx`: `DeliveryMap` (Leaflet) pasa de import estático a `lazy()` + `<Suspense>`, solo se descarga al abrir el checkout. Los dos `<h1>` de "Menú" (modo día y modo semana) cambian a `<h2>` — el hero sigue siendo el único `<h1>` de la página.
- `src/styles.css`: selector `.menu-title h1` → `.menu-title h2` (mismo estilo, mismo tamaño, cero cambio visual) en dos lugares (regla base y el breakpoint de 680px). `--muted` se oscureció ligeramente (`#6c7973` → `#616c67`, 10%) para pasar AA. Nuevo bloque `.boot-shell` (spinner mínimo mostrado antes de que React monte).
- `index.html`: `canonical`, Open Graph, Twitter Card, y JSON-LD `FoodEstablishment` (solo con datos que ya existían en el código: nombre, WhatsApp, zona de entrega, rango de precio de los paquetes — sin inventar dirección, rating ni reseñas).
- `src/lib/analytics.ts` (nuevo): carga Google Analytics (`G-1X9623HM16`) solo en producción, inyectando el script externo por JS (nunca inline), más un `trackEvent()` sin usar aún — listo para cuando definan qué eventos medir.
- `src/main.tsx`: llama `initAnalytics()` al arrancar.
- `vercel.json`: cabeceras de seguridad para todas las rutas (ver sección 6).
- `public/robots.txt`, `public/sitemap.xml` (nuevos).
- `package.json` / `package-lock.json`: `npm audit fix` (sube `qs` y `js-yaml` transitivos, sin cambios de comportamiento).
- Arranque de la app Android vía Capacitor (sección 12).

## 3. Qué se eliminó

Nada del código de producto/negocio. Solo se depuró temporalmente la dependencia de desarrollo `@capacitor/assets` (herramienta usada una única vez para generar íconos/splash, luego desinstalada — ver sección 12) para no dejar sus dependencias transitivas vulnerables instaladas permanentemente.

## 4. Optimizado / rendimiento

Antes → después del build de producción (`npm run build`):

| Recurso | Antes | Después |
|---|---|---|
| JS principal (gzip) | 124.28 KB | 72.63 KB |
| CSS principal (gzip) | 39.53 KB | 33.67 KB |
| Leaflet + su CSS | incluido siempre | chunk aparte, solo al abrir checkout (49.43 KB + 6.36 KB gzip) |

Eso es ~42% menos JavaScript y ~15% menos CSS en la carga inicial de cualquier visitante, sin tocar ninguna funcionalidad — verificado en navegador (ver sección "Verificación").

## 5. Cambios de rendimiento (detalle)

- Code-splitting del mapa de entrega (arriba).
- `boot-shell`: contenido estático mínimo dentro de `#root` para que haya algo en pantalla mientras el bundle de React se descarga/ejecuta (React lo reemplaza al montar; cero riesgo de mismatch porque no es SSR/hydration).
- No se tocó la estrategia de fuentes (`@fontsource`, autohospedadas, sin dominio externo) ni el Service Worker: ya estaban bien.

## 6. Cambios de seguridad

- `vercel.json` agrega, para todas las rutas:
  - `Content-Security-Policy` (sin `unsafe-inline` en `script-src`; permite `'self'`, Google Analytics para scripts, y para imágenes `'self' data:` más `*.supabase.co` —fotos de productos subidas desde `/admin`— y los tiles de OpenStreetMap del mapa de entrega).
  - `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (permite geolocalización solo a `self`, para "Usar mi ubicación"; bloquea cámara/micrófono/pagos, que la app no usa).
- `npm audit fix` corrigió la única vulnerabilidad en dependencias de producción (`qs`, moderada).
- **Importante — verificar tras el próximo deploy**: la CSP se armó leyendo todo el código real (qué dominios llama cada componente), pero no hay forma de probarla contra la Vercel real desde este entorno. Revisa la consola del navegador en producción después de este despliegue; si algo se bloquea, el directorio afectado se ve inmediatamente ahí.

## 7. Cambios SEO

- `robots.txt` permite todo excepto `/admin` y `/gestion-cocina`, y referencia el nuevo `sitemap.xml`.
- `sitemap.xml` con `/` y `/menu-semana` (las únicas rutas públicas indexables; `/admin` queda fuera).
- `canonical` a `https://www.foodiepack.com.mx/` (el host canónico real, según el propio README).
- Open Graph y Twitter Card usando el título/descripción ya existentes y una foto real ya usada en el sitio (`weekly-hero.jpg`).
- JSON-LD `FoodEstablishment`: nombre, URL, logo, imagen, zona de entrega, cocina, rango de precio ($60–$90, de `PACKAGES` real) y el WhatsApp real. **No se incluyó dirección** (la cocina no publica su dirección exacta al público, solo la usa internamente para calcular el radio de entrega) ni rating/reseñas (no existen).
- Un solo `<h1>` por vista en la tienda (sección 2).

## 8. Cambios de accesibilidad

- Contraste de `--muted` corregido a AA (4.86:1 sobre `--paper`, sección 2).
- `Permissions-Policy` no bloquea `geolocation` (usada por "Usar mi ubicación").
- Se revisó `prefers-reduced-motion`: ya estaba implementado de forma completa (`animation-duration`/`transition-duration` a 0 y las animaciones de entrada/decorativas desactivadas); no se necesitó tocar nada ahí.
- No se encontraron botones/enlaces sin rol accesible, inputs sin `label`, ni modales sin foco/cierre — ya estaba bien hecho.

## 9. Cambios visuales

Ninguno intencional más allá de lo listado (el 10% de oscurecimiento de `--muted` es imperceptible en uso normal). No se tocaron colores de marca (`--green`, `--lime`, `--orange`), tipografías, logo, fotografías ni layout. Verificado visualmente en navegador (sección "Verificación").

## 10. Google Analytics

- Tag `G-1X9623HM16` cargado desde `src/lib/analytics.ts`, llamado una sola vez desde `main.tsx`.
- Solo se activa en build de producción (`import.meta.env.PROD`) — en `npm run dev` no se carga, para no ensuciar los datos con tráfico local.
- El script se inyecta como `<script src=...>` externo (nunca inline), por eso no necesitó ninguna excepción `unsafe-inline` en la CSP.
- `trackEvent(nombre, params)` queda exportado y listo, pero **sin usar todavía en ningún botón** — así lo pidió el encargo ("no inventar eventos"). Cuando decidan qué medir, los candidatos obvios ya presentes en el código son: clic en WhatsApp (`WeekMenuApp.tsx`, `buildWhatsAppUrl`), envío del formulario de checkout (`App.tsx`, `placeOrder`), y clic en "Ver paquetes"/CTA principal.
- Recomendación a evaluar (no implementada): decidir si quieren que el tráfico de `/admin` cuente en las mismas métricas que la tienda, o excluirlo.

## 11. Cambios responsive

Se revisaron los tres breakpoints existentes (900px, 680px y el CSS base) contra el código real: ya cubren header, hero, grid de paquetes, checkout (bottom sheet en móvil), tabbar inferior, tabla de pedidos del admin, etc. No se encontró overflow horizontal, texto cortado ni elementos fuera de pantalla — no se modificó nada aquí.

## 12. Arquitectura Android seleccionada: Capacitor

**Decisión: Capacitor**, sobre React Native/Expo, Android nativo o TWA. Justificación:

- El proyecto ya es 100% React/TypeScript con toda la lógica de negocio (paquetes, checkout, mapa, panel de cocina) en `src/`. Capacitor reutiliza ese código sin cambios — es el mismo build de Vite (`dist/`) corriendo dentro de un WebView nativo.
- React Native/Expo exigiría reescribir cada pantalla (no hay reuso de JSX/CSS entre React-DOM y React Native) — va directamente en contra de "reutilizar la mayor cantidad posible del proyecto actual".
- Android nativo (Kotlin) sería una reescritura completa.
- Una TWA (Trusted Web Activity) es casi gratis, pero Capacitor da lo mismo *más* acceso real a plugins nativos (geolocalización, notificaciones push a futuro, cámara) sin salir del ecosistema web, que es justamente lo que el encargo pide dejar preparado para "futuras funciones nativas".
- El backend (Express + Supabase) no cambia: la app simplemente llama la misma API por HTTPS.

## 13. Estado actual de la app Android

Ya generado en este repo:

- `capacitor.config.ts` — `appId: com.foodiepack.app`, `appName: FoodiePack`, `webDir: dist`, color de fondo de marca (`#0b4b39`).
- `android/` — proyecto nativo completo (Gradle, `AndroidManifest.xml`, recursos), creado con `npx cap add android`.
- Permisos añadidos: `INTERNET` (ya venía), `ACCESS_COARSE_LOCATION` y `ACCESS_FINE_LOCATION` (para que "Usar mi ubicación" funcione dentro del WebView nativo, sin tocar el código de `App.tsx` — la misma API `navigator.geolocation` ya usada en la web funciona igual aquí).
- Ícono adaptativo y splash screen generados en todas las resoluciones (`mipmap-*`, `drawable-*`, con variante nocturna) a partir de arte de marca real: `Favicon.png` (isotipo, ya existente en la raíz del repo, sin usar hasta ahora) como ícono, y el logo blanco/naranja sobre el verde de marca como splash. Las fuentes quedaron en `assets/icon.png` y `assets/splash.png` para regenerarlos si el logo cambia.
- `applicationId com.foodiepack.app`, `versionCode 1`, `versionName "1.0"`, `minSdk 24`, `compileSdk`/`targetSdk 36` (valores por omisión de Capacitor 8, ya vigentes para Play Store).
- Script `npm run build:mobile`: compila con `.env.mobile` (`VITE_API_URL` apuntando a `https://www.foodiepack.com.mx/api`, porque la app empacada no tiene un `/api` del mismo origen) y sincroniza `android/`.
- Script `npm run android:open`: abre el proyecto en Android Studio.
- `android/.gitignore` excluye explícitamente `*.jks`, `*.keystore` y `key.properties` — ningún secreto de firma debe vivir en el repositorio.

**Lo que no se pudo verificar aquí**: este entorno no tiene Android SDK ni Java instalados (`ANDROID_HOME` vacío, `java` no encontrado), así que no se pudo compilar ni ejecutar el `.apk`/`.aab` real. Todo lo anterior es el andamiaje correcto y estándar de Capacitor, pero el primer build real debe hacerse en una máquina con Android Studio.

## 14. Pasos restantes para publicar en Google Play

1. Instalar Android Studio (incluye el SDK) y un JDK 21 en una máquina de desarrollo.
2. `git pull`, `npm install`, `npm run build:mobile`, `npm run android:open`.
3. **Antes de compilar**: agregar `https://localhost` a la variable `WEB_ORIGIN` del proyecto en Vercel (producción) — es el origen por omisión del WebView de Capacitor en Android, y sin él la API rechazará las llamadas de la app por CORS. (No se modificó esa variable desde aquí porque es configuración de producción compartida.)
4. Probar en un emulador o dispositivo real: pedido completo, mapa de entrega, geolocalización, y el panel de cocina si lo van a usar también desde el celular.
5. Generar el keystore de firma (`keytool` o desde Android Studio: Build → Generate Signed Bundle/APK) — **guardarlo fuera del repositorio**, en un gestor de contraseñas o similar.
6. Compilar el *Android App Bundle* (`.aab`) firmado en modo release.
7. Crear la ficha en Google Play Console: capturas de pantalla, ícono ya generado, descripción (reutilizar los textos ya existentes del sitio), política de privacidad (falta — la tienda no expone una hoy; Play la exige).
8. Completar el cuestionario de seguridad de datos de Play Console (qué datos recolecta: nombre, teléfono, dirección de entrega, ubicación — todos ya declarados y usados solo para el pedido, según el propio README).
9. Subir el `.aab` a un track interno/cerrado primero, probar, y luego promover a producción.

## 15. Variables de entorno requeridas

Las mismas de siempre para el sitio web (`.env.example`: `VITE_API_URL`, `PORT`, `WEB_ORIGIN`, `ADMIN_PASSWORD`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), más:

- `WEB_ORIGIN` en Vercel (producción) debe incluir `https://localhost` para que la app Android pueda llamar la API (sección 14, paso 3). Nueva, pendiente de aplicar por el equipo.
- `.env.mobile` (nuevo, ya en el repo, sin secretos): `VITE_API_URL=https://www.foodiepack.com.mx/api`, solo para `npm run build:mobile`.

## 16. Recomendaciones futuras

- Decidir y cablear 2–4 eventos de Analytics reales (WhatsApp, checkout, CTA principal) usando `trackEvent()` ya preparado.
- Si más adelante quieren dividir el CSS por ruta (hoy admin/semana comparten el mismo archivo con la tienda, ~34 KB gzip de más para quien nunca visita `/admin`), es una segunda optimización de rendimiento razonable, pero de mayor riesgo/esfuerzo que la de Leaflet ya hecha — no se tocó en esta pasada por eso.
- Considerar mover el `navigator.geolocation` de "Usar mi ubicación" al plugin oficial `@capacitor/geolocation` si en el dispositivo real (Android) el permiso nativo no se comporta bien solo con los permisos del manifiesto — quedó fuera de esta pasada por no poder probarse en un dispositivo real desde este entorno.
- `@capacitor/cli` trae una vulnerabilidad moderada transitiva (`uuid`/`xcode`, por su soporte a iOS, que no usamos) sin fix limpio disponible aún; es una dependencia de build, nunca se empaqueta en la app — revisar en unos meses si ya hay una versión sin ese arrastre.
- Antes de publicar en Play Store, redactar una política de privacidad pública (hoy no existe una) — Play la exige para cualquier app que pida ubicación o datos de contacto.

## Verificación realizada

- `npm run lint`, `npm run build`, `npm run check` — sin errores (el único warning restante, sobre fast-refresh en `main.tsx`, ya existía antes de esta pasada y es cosmético, solo de desarrollo).
- `npm audit` — 0 vulnerabilidades en dependencias de producción/web.
- Probado en navegador real (Chromium vía Playwright) contra `npm run dev:all`: consola sin errores, flujo completo de selección de paquete → comida → checkout, y el mapa de entrega (ahora cargado de forma diferida) renderiza correctamente sin salto de layout.
- Build móvil (`npm run build:mobile`) verificado: la URL de API absoluta de producción queda embebida solo ahí, y el build web normal (`npm run build`) sigue usando la ruta relativa `/api` como siempre.
