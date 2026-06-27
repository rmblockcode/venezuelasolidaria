# Venezuela Solidaria — Directorio de ayuda

Directorio comunitario para centralizar la ayuda tras los sismos en Venezuela: recaudaciones,
contactos de emergencia, páginas creadas por la comunidad y jornadas/puntos de acopio. Todo
verificado por un equipo de moderación, sin fines de lucro.

## Stack

| Capa | Tecnología | Despliegue |
| --- | --- | --- |
| Frontend | Next.js 14 (App Router, TypeScript) | Vercel |
| Backend | Flask (API REST) + SQLAlchemy | Render (gunicorn + gevent) |
| Base de datos | PostgreSQL | Neon |
| Imágenes | Cloudinary (subida firmada) | — |
| Mapa / geocodificación | OpenStreetMap (Leaflet, Nominatim) + Photon | — |

## Funcionalidades

**Directorio público**
- Búsqueda por nombre, ciudad o palabra clave.
- Filtros: **categoría** (Donaciones, Directorios, Emergencia, Acopio) con contadores, **país**
  (menú desplegable), y **fecha** con presets (Hoy / Esta semana / Este mes / Rango). El filtro de
  fecha solo acota eventos con fecha; los recursos sin fecha siempre se muestran.
- **Tres vistas** conmutables: **Tarjetas**, **Lista** (filas compactas) y **Mapa** (pines por
  ubicación, estilo Airbnb, con clústeres y popups).
- **Paginación** con selector de cantidad por página (10 / 50 / 100).
- Descripciones largas con **"Ver más / Ver menos"**; imágenes ampliables en **lightbox**.
- **Galería/carrusel** de fotos en la portada (autoplay + swipe), gestionable desde el admin.
- 3 temas visuales (Esperanza, Sereno, Tricolor) con persistencia en `localStorage`.
- Formulario "Agregar al directorio" con autocompletado de **ubicación**, fecha de inicio/fin,
  imagen opcional, validación y detección de duplicados.

**Moderación (panel `/admin`)**
- Login con usuario + contraseña (JWT). Pestañas: **Pendientes**, **Publicados**, **Rechazados**,
  **Galería**, **Administradores**.
- Aprobar / rechazar / editar / despublicar; **borrado lógico** (los rechazados se archivan y se
  pueden recuperar) y **borrado definitivo**.
- **Atribución por post**: cada registro muestra quién y cuándo lo aprobó/rechazó.
- **Auditoría** completa de todas las acciones de admin.
- Gestión de administradores, cambio de contraseña, y botón para rellenar ubicaciones del mapa.

**Infraestructura**
- Actualización en **tiempo real** (SSE) de la home y el panel.
- **Protección contra abuso/DoS** (rate limiting, límites de tamaño, etc.).
- Auto-migración del esquema al arrancar (no requiere migraciones manuales).
- Página de **política de privacidad** (`/privacidad`).

## Estructura

```
.
├── backend/    # API Flask, modelos SQLAlchemy, geocodificación, SSE
├── frontend/   # App Next.js (App Router)
└── docker-compose.yml   # PostgreSQL para desarrollo
```

## Desarrollo local

Requisitos: **Python 3.12+**, **Node.js 18+**, **pnpm**, y Docker (para Postgres) o un Postgres propio.

### 1. Base de datos

```bash
docker compose up -d db
```

Levanta Postgres en `localhost:5432` (usuario `vzla`, contraseña `vzla`, base `venezuelasolidaria`).
Si usas tu propio Postgres, ajusta `DATABASE_URL` en `backend/.env`.

### 2. Backend (Flask)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # ajusta si hace falta
python app.py
```

API en `http://localhost:5001`. Al arrancar crea/actualiza las tablas (ver *Esquema*) e inserta los
datos de ejemplo (seed) si la BD está vacía. Crea también el admin inicial desde `ADMIN_EMAIL` /
`ADMIN_PASSWORD`.

### 3. Frontend (Next.js)

```bash
cd frontend
pnpm install
cp .env.local.example .env.local   # apunta a la API
pnpm dev
```

App en `http://localhost:3000`. `NEXT_PUBLIC_API_BASE` define la URL del backend.

## Variables de entorno

**Backend (`backend/.env`)**

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | URL de Postgres. Acepta `postgres://`/`postgresql://`; se normaliza a psycopg3. |
| `CORS_ORIGINS` | Orígenes permitidos, separados por coma (la URL del frontend). |
| `PORT` | Puerto del backend (def. 5001). |
| `SECRET_KEY` | Firma de los JWT de admin (largo y aleatorio en producción). |
| `JWT_EXP_HOURS` | Vigencia del token de sesión (def. 12). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin inicial (se crea al primer arranque; clave hasheada). |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Credenciales de Cloudinary (el **secret vive solo aquí**). |
| `CLOUDINARY_FOLDER` | Carpeta donde se guardan las imágenes (p. ej. `VenezuelaSolidaria`). |
| `RATELIMIT_DEFAULT` | Límite por IP global (def. `240 per hour`). |
| `RATELIMIT_STORAGE_URI` | `memory://` (1 proceso) o `redis://…` (multi-proceso). |
| `MAX_CONTENT_LENGTH` | Tamaño máx. de body en bytes (def. 64 KB). |
| `PROXY_HOPS` | Saltos de proxy confiables (1+ detrás de Render/nginx para IP real). |
| `SSE_HEARTBEAT_SECONDS` | Latido del stream SSE (def. 20). |

**Frontend (`frontend/.env.local`)**

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_API_BASE` | URL pública del backend. |

> El frontend **no** necesita credenciales de Cloudinary: pide una firma al backend
> (`POST /api/cloudinary/signature`) y sube directo a Cloudinary con esa firma.

## Esquema y migraciones

No hay framework de migraciones. Al arrancar:
- `db.create_all()` crea las **tablas** que falten.
- `ensure_schema()` añade columnas nuevas con `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
  (idempotente). Cubre `event_end_date`, `image_url`, `lat`, `lng`, `moderated_by`, `moderated_at`,
  `moderation_action`. **Se auto-actualiza en cada deploy**, sin pasos manuales.

## Moderación / panel admin

`http://localhost:3000/admin` (no enlazado desde la home). Login con `ADMIN_EMAIL` /
`ADMIN_PASSWORD`. La autenticación usa **JWT** por header (no cookies), para funcionar entre dominios
cuando frontend y backend se despliegan por separado.

Pestañas:
- **Pendientes** — envíos por revisar (con el contacto de quien los envió). Aprobar / Editar / Rechazar.
- **Publicados** — lo que está en el directorio. Editar / Despublicar / Eliminar (archiva) + toggle de verificación.
- **Rechazados** — archivo (borrado lógico). Recuperar (Aprobar) / Editar / **Eliminar definitivamente**.
- **Galería** — subir/eliminar fotos del carrusel de la portada.
- **Administradores** — gestión de admins, cambio de contraseña, rellenar ubicaciones del mapa, y la **Auditoría**.

Al aprobar/rechazar/despublicar, el post guarda **quién y cuándo** lo moderó (visible en su fila). Un
envío rechazado se archiva como `rejected`; el dedup de envíos lo ignora (se puede reenviar).

## Endpoints

**Públicos**

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servicio |
| GET | `/api/resources` | Recursos publicados. Filtros: `?category=` y `?country=` |
| GET | `/api/gallery` | Fotos del carrusel de portada |
| POST | `/api/submissions` | Crea un envío (queda `pending`) |
| POST | `/api/cloudinary/signature` | Firma para subir imágenes a Cloudinary (rate-limitado) |
| GET | `/api/stream` | SSE: señales de cambios en tiempo real (sin datos) |

**Admin** (requieren `Authorization: Bearer <jwt>`)

| Método | Ruta | Descripción |
| --- | --- | --- |
| POST | `/api/admin/login` | `{email, password}` → `{token}` |
| GET | `/api/admin/submissions?status=` | Lista por estado: `pending` (def.) / `published` / `rejected` |
| POST | `/api/admin/submissions/<id>/approve` | `{verified?}` → publica |
| POST | `/api/admin/submissions/<id>/reject` | Archiva (borrado lógico → `rejected`) |
| POST | `/api/admin/submissions/<id>/unpublish` | Devuelve un publicado a `pending` |
| POST | `/api/admin/submissions/<id>/purge` | Borrado definitivo de la BD |
| PATCH | `/api/admin/submissions/<id>` | Edita campos / `verified` / ubicación |
| GET / POST | `/api/admin/admins` | Lista / crea administradores |
| POST | `/api/admin/admins/<id>/delete` | Elimina un administrador |
| POST | `/api/admin/change-password` | Cambia la contraseña propia |
| POST | `/api/admin/geocode-missing` | Rellena coordenadas faltantes (backfill) |
| GET | `/api/admin/activity` | Auditoría de acciones |
| POST | `/api/admin/gallery` / `/api/admin/gallery/<id>/delete` | Agrega / elimina foto de galería |

## Mapa y ubicaciones

- Vista de **mapa** con **Leaflet + OpenStreetMap** (gratis, sin API key), con clustering y popups.
- Al enviar/editar, la **ubicación** se elige con autocompletado (**Photon**, OSM) que devuelve
  ciudad/país + **coordenadas exactas**. Si no, el backend geocodifica con **Nominatim** (normaliza
  abreviaturas como "Rep. Dominicana" y cae al país si la ciudad no resuelve).
- Botón **"Rellenar ubicaciones faltantes"** (pestaña Administradores) para geocodificar registros
  antiguos sin coordenadas.

> Nominatim y los tiles de OSM son gratuitos pero piden uso moderado (User-Agent, ≤1 req/seg). Para
> mucho tráfico, usar un proveedor con key (Carto/Stadia/Mapbox).

## Imágenes (Cloudinary — subida firmada)

El navegador pide una firma a `POST /api/cloudinary/signature` y con ella sube el archivo directo a
Cloudinary; el **API Secret vive solo en el backend**. La app guarda solo la `secure_url`.

Configuración (una vez): en Cloudinary copia **Cloud name**, **API Key** y **API Secret** y ponlos
en el backend (`CLOUDINARY_*`). El control de subida acepta **arrastrar, pegar (Ctrl/Cmd+V) o elegir
archivo**; valida JPG/PNG y ≤ 3 MB en el cliente. La publicación sigue pasando por moderación.

## Galería de portada

Carrusel de fotos detrás del texto del hero (autoplay + swipe). Si no hay fotos, el hero se ve
normal. Se administra desde la pestaña **Galería** del panel (subir con Cloudinary + eliminar).

## Tiempo real (SSE)

La home y el panel se actualizan en vivo sin recargar:
- El backend (`GET /api/stream`) empuja **señales** ligeras (`{"scopes":["pending"]}`, …) cuando algo
  cambia. **No transporta los registros**; el cliente vuelve a pedir los datos por el GET que
  corresponda. Por eso el endpoint es público sin filtrar nada.
- El frontend escucha con `EventSource` (hook `frontend/app/lib/useEventStream.ts`, reconexión
  automática).

**Producción:** usar gunicorn con worker `-k gevent` (conexiones largas); con varias instancias, el
broker en memoria (`backend/events.py`) no cruza procesos → usar **Redis pub/sub**. El proxy no debe
bufferizar (ya enviamos `X-Accel-Buffering: no`).

## Protección contra abuso / DoS

- **Rate limiting por IP** (Flask-Limiter): global `RATELIMIT_DEFAULT`; `POST /api/submissions`
  5/min y 20/hora; `POST /api/admin/login` 8/min y 40/hora; `429` al exceder.
- **Límite de tamaño de body** (`MAX_CONTENT_LENGTH` → `413`) y topes de longitud en los campos.
- **`PROXY_HOPS`** para usar la IP real detrás de un proxy.
- En producción, `RATELIMIT_STORAGE_URI` → Redis para consistencia multi-proceso.

## Despliegue (Vercel + Render + Neon)

1. **Neon** — crea la BD y copia el connection string.
2. **Render** (backend) — Root `backend`, build `pip install -r requirements.txt`, start
   `gunicorn -k gevent -w 1 app:app --bind 0.0.0.0:$PORT --timeout 120`, health check `/api/health`.
   Variables: `DATABASE_URL`, `SECRET_KEY`, `ADMIN_EMAIL/PASSWORD`, `CLOUDINARY_*`, `CORS_ORIGINS`,
   `PROXY_HOPS=1`, `PYTHON_VERSION=3.12.x`. **1 worker** (el broker SSE es en memoria).
3. **Vercel** (frontend) — Root `frontend`, `NEXT_PUBLIC_API_BASE` = URL del backend.
4. Ajusta `CORS_ORIGINS` en Render con el dominio del frontend.
