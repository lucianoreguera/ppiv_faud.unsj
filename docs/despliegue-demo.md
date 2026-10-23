# Despliegue de demostración (planes gratuitos)

Despliegue temporal para que el producto pueda verse, probarse y evaluarse. No es un despliegue productivo.

| Pieza | Servicio | Carpeta del repo |
|---|---|---|
| Frontend (SPA Vite) | Vercel (Hobby) | `frontend/` |
| Backend (NestJS) | Render (Web Service free) | `backend/` |
| Base de datos | Neon (PostgreSQL free) | — |
| PDFs privados | Backblaze B2 (10 GB free, bucket privado) | — |
| Correo | Mailtrap Sandbox o Brevo (SMTP en puerto 2525) | — |

Es un monorepo: Render y Vercel se conectan al mismo repositorio de GitHub, cada uno con su **Root Directory**.

Orden recomendado: Neon → B2 → Render → Vercel → volver a Render para fijar `CORS_ORIGIN`.

---

## 1. Neon (PostgreSQL)

1. Crear un proyecto en la región **AWS US East (N. Virginia)**, la misma zona que el backend en Render.
2. Copiar la connection string **directa** (sin *pooling*). Ya incluye `sslmode=require`.
3. Cargar los datos iniciales una sola vez desde la máquina local, apuntando a Neon:

```bash
cd backend
DATABASE_URL="<connection string de Neon>" pnpm prisma migrate deploy
DATABASE_URL="<connection string de Neon>" pnpm prisma db seed
```

> El seed solo crea registros. Los PDFs de ejemplo los sube el Backend a B2 en su primer arranque.

## 2. Backblaze B2 (PDFs)

1. Crear un bucket **privado** (`Files in Bucket are: Private`), por ejemplo `faud-unsj-pdfs`.
2. En *Application Keys*, crear una key con acceso **Read and Write** restringido a ese bucket. Anotar `keyID` y `applicationKey` (esta última se muestra una sola vez).
3. En los detalles del bucket, copiar el **Endpoint** (por ejemplo `s3.us-east-005.backblazeb2.com`). La región es el segmento del medio (`us-east-005`).

El bucket nunca se expone: el Backend es el único que lee los PDFs y los entrega detrás de la validación DRM.

## 3. Correo (SMTP)

Render free bloquea la salida a los puertos 25, 465 y 587. Usar el puerto **2525**:

- **Mailtrap Sandbox** (recomendado para la demo): los correos quedan en una bandeja de prueba, como en Mailpit. Host `sandbox.smtp.mailtrap.io`, puerto `2525`.
- **Brevo**: los correos se envían de verdad (300 por día). Host `smtp-relay.brevo.com`, puerto `2525`. El remitente de `SMTP_FROM` debe estar verificado en Brevo.

## 4. Render (Backend)

*New → Web Service*, conectar el repo y configurar:

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Runtime | Node |
| Region | Virginia (US East) |
| Build Command | `npm install -g pnpm@10 && pnpm install --frozen-lockfile --prod=false && pnpm prisma generate && pnpm build` |
| Start Command | `npx prisma migrate deploy && node dist/main` |
| Health Check Path | `/api/v1/health` |
| Instance Type | Free |

Variables de entorno:

```bash
NODE_ENV=production
NODE_VERSION=22
CORS_ORIGIN=https://<proyecto>.vercel.app      # se completa después del paso 5
DATABASE_URL=<connection string directa de Neon>
JWT_SECRET=<aleatorio>                          # openssl rand -hex 32
LOAN_DRM_JWT_SECRET=<aleatorio, distinto>       # openssl rand -hex 32

STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
S3_REGION=us-east-005
S3_BUCKET=faud-unsj-pdfs
S3_ACCESS_KEY_ID=<keyID>
S3_SECRET_ACCESS_KEY=<applicationKey>

SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=<usuario SMTP>
SMTP_PASS=<contraseña SMTP>
SMTP_FROM="Biblioteca FAUD-UNSJ <biblioteca@faud.unsj.edu.ar>"
```

`PORT` lo define Render y el Backend lo toma automáticamente. `--prod=false` es necesario porque con `NODE_ENV=production` pnpm omitiría las devDependencies (Nest CLI y Prisma CLI) que se usan en el build y en las migraciones.

En *Settings → Build Filters* conviene limitar los deploys a cambios en `backend/**`.

## 5. Vercel (Frontend)

*Add New → Project*, importar el repo y configurar:

| Campo | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite (detectado) |

Variables de entorno (se inyectan en el build):

```bash
VITE_API_BASE_URL=https://<servicio>.onrender.com/api/v1
VITE_SHOW_DEMO_ACCOUNTS=true    # muestra las cuentas del seed en /login
```

`frontend/vercel.json` resuelve las rutas de la SPA (`/catalogo`, `/visor/:id`, `/admin/...`) y replica las cabeceras de seguridad del nginx. El CSP permite `connect-src https://*.onrender.com` porque la API está en otro dominio.

Después del primer deploy, volver a Render y fijar `CORS_ORIGIN` con la URL de producción de Vercel. Las URLs de *preview* de Vercel no quedan habilitadas en CORS; si hace falta, `CORS_ORIGIN` acepta varias separadas por coma.

## 6. Mantener el Backend despierto

Render free suspende el servicio tras 15 minutos sin tráfico, y el siguiente request tarda ~30–60 s. Para la demo, crear en [cron-job.org](https://cron-job.org) un job que haga `GET https://<servicio>.onrender.com/api/v1/health` cada 10 minutos. Así también corre el cron interno de vigencia de préstamos. Un único servicio encendido todo el mes entra en las 750 h gratuitas de Render.

---

## Limitaciones conocidas de la demo

- **Rate limiting:** el Backend identifica al cliente con la primera IP de `X-Forwarded-For`. Detrás de nginx eso es seguro porque nginx reescribe la cabecera, pero no está documentado si el proxy de Render la sanea, así que en Render un cliente podría eludir el límite de login enviando IPs falsas. Es aceptable para una demo con cuentas públicas de prueba.
- **Cuotas de B2 sin tarjeta:** cada apertura del visor hace una lectura `HEAD` y una `GET` (transacciones clase B, 2.500 gratis por día). Si se superan, B2 bloquea las lecturas hasta el día siguiente.
- **Base de datos:** Neon suspende el cómputo tras 5 minutos sin uso. El primer acceso posterior agrega menos de un segundo.

## Desarrollo local

Nada cambia: sin `STORAGE_DRIVER` (o con `STORAGE_DRIVER=local`) los PDFs se guardan en `backend/storage/pdfs`, y sin `SMTP_USER`/`SMTP_PASS` el correo sigue saliendo por Mailpit.
