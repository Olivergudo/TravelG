# Configuración de Roomies

## 1. Supabase

Abre **SQL Editor → New query**, pega el contenido completo de
`supabase/roomies-schema.sql` y ejecútalo una sola vez.

La migración crea las tablas, funciones transaccionales, políticas RLS e incorpora
`household_messages` y `replacement_debts` a Supabase Realtime.

## 2. Claves VAPID

Genera un único par de claves desde la raíz del proyecto:

```bash
npx web-push generate-vapid-keys
```

En Vercel, abre **Project Settings → Environment Variables** y agrega en Production
y Preview:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<Public Key>
VAPID_PRIVATE_KEY=<Private Key>
VAPID_SUBJECT=mailto:tu-correo@dominio.com
```

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` es pública y el navegador la necesita para crear la suscripción.
- `VAPID_PRIVATE_KEY` es privada y solo se utiliza dentro de las rutas del servidor.
- `VAPID_SUBJECT` identifica al responsable del servicio; debe ser un `mailto:` o una URL HTTPS.

No pegues `VAPID_PRIVATE_KEY` en ninguna variable que comience con `NEXT_PUBLIC_`.

## 3. Despliegue

Después de guardar las variables, vuelve a desplegar el proyecto en Vercel. En iPhone,
las notificaciones Web Push requieren abrir la aplicación instalada en la pantalla de
inicio y pulsar **Activar notificaciones** dentro de Roomies.

## 4. Verificación con dos cuentas

1. La cuenta A crea un hogar y copia el código.
2. La cuenta B se une con el código.
3. A registra que tomó un producto de B y que debe reponerlo.
4. A pulsa **Ya lo repuse**; el estado debe quedar esperando a B.
5. B pulsa **Confirmar reposición** o **Aún no**.

Las operaciones críticas las validan funciones PostgreSQL; modificar botones o
peticiones desde el navegador no permite que el deudor confirme su propia reposición.

El menú del hogar también permite salir. Si sale el propietario y quedan participantes,
la propiedad se transfiere al miembro más antiguo; si no queda nadie, el hogar se elimina.
