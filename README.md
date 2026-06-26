# Venezuela Solidaria — Directorio de ayuda

Directorio centralizado de recaudaciones, contactos de emergencia, páginas comunitarias y
jornadas solidarias tras los sismos en Venezuela.

Implementación full-stack del prototipo `Directorio Venezuela.dc.html`:

- **Frontend:** Next.js 14 (App Router, TypeScript)
- **Backend:** Flask (API REST)
- **Base de datos:** PostgreSQL

```
.
├── backend/    # API Flask + modelos SQLAlchemy
├── frontend/   # App Next.js
└── docker-compose.yml   # PostgreSQL
```

## Requisitos

- Python 3.10+
- Node.js 18+
- Docker (para Postgres) — o un Postgres propio

## 1. Base de datos

```bash
docker compose up -d db
```

Esto levanta Postgres en `localhost:5432` (usuario `vzla`, contraseña `vzla`, base
`venezuelasolidaria`). Si usas tu propio Postgres, ajusta `DATABASE_URL` en `backend/.env`.

> **Esquema:** en una BD vacía las tablas se crean solas al arrancar el backend. En una BD que ya
> existía hay que añadir la columna de fecha de fin una sola vez:
> `ALTER TABLE resources ADD COLUMN IF NOT EXISTS event_end_date varchar(60);`

## 2. Backend (Flask)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # ajusta si hace falta
python app.py
```

La API queda en `http://localhost:5001`. Al arrancar crea las tablas y, si están vacías,
inserta los datos de ejemplo (seed).

### Endpoints

**Públicos:**

| Método | Ruta                | Descripción                                              |
| ------ | ------------------- | ------------------------------------------------------- |
| GET    | `/api/health`       | Estado del servicio                                     |
| GET    | `/api/resources`    | Recursos publicados. Filtros: `?category=` y `?country=`|
| POST   | `/api/submissions`  | Envía un recurso nuevo (queda en estado `pending`)      |
| GET    | `/api/stream`       | SSE: señales de cambios en tiempo real (sin datos)      |

**Admin / moderación** (requieren `Authorization: Bearer <jwt>`):

| Método | Ruta                                      | Descripción                                  |
| ------ | ----------------------------------------- | -------------------------------------------- |
| POST   | `/api/admin/login`                        | `{email, password}` → `{token}`              |
| GET    | `/api/admin/submissions?status=pending`   | Lista por estado (def. `pending`)            |
| POST   | `/api/admin/submissions/<id>/approve`     | `{verified?}` → publica el recurso           |
| POST   | `/api/admin/submissions/<id>/reject`      | Descarta (elimina) el envío                  |
| POST   | `/api/admin/submissions/<id>/unpublish`   | Devuelve un publicado a `pending`            |
| PATCH  | `/api/admin/submissions/<id>`             | Edita campos / `verified` (pendiente o publicado) |

Un envío se guarda como recurso `pending` y no aparece en el directorio hasta que un moderador lo
aprueba (`published`).

## 3. Frontend (Next.js)

```bash
cd frontend
pnpm install
cp .env.local.example .env.local   # apunta a la API
pnpm dev
```

App en `http://localhost:3000`. La variable `NEXT_PUBLIC_API_BASE` define la URL del backend.

## Moderación / verificación

El panel de moderación vive en **`http://localhost:3000/admin`** (no enlazado desde la home).

1. El admin inicial se crea en el primer arranque del backend a partir de `ADMIN_EMAIL` y
   `ADMIN_PASSWORD` (ver `backend/.env`). La contraseña se guarda hasheada.
2. Entra a `/admin`, inicia sesión con ese correo y contraseña.
3. El panel tiene dos pestañas:
   - **Pendientes**: envíos por revisar (con el contacto de quien los envió). Por cada uno:
     **Aprobar** (lo publica, ✓ verificado por defecto; el toggle lo controla), **Editar** o **Rechazar**.
   - **Publicados**: lo que ya está en el directorio. Por cada uno: **Editar**, **Despublicar**
     (lo regresa a pendientes y lo quita de la home) o **Eliminar**, además de un toggle de
     verificación que se guarda al instante.
4. Lo aprobado aparece de inmediato en la home.

La autenticación usa **JWT** (`Authorization: Bearer`), no cookies, para funcionar entre dominios
cuando frontend y backend se despliegan por separado.

## Tiempo real (SSE)

La home y el panel admin se actualizan **en vivo** sin recargar, vía Server-Sent Events:

- El backend expone `GET /api/stream` y empuja **señales** ligeras cuando algo cambia, p. ej.
  `data: {"scopes":["pending"]}` o `{"scopes":["published"]}`. El stream **no transporta los
  registros**, solo avisa "esta lista cambió"; el cliente vuelve a pedir los datos por el GET que
  corresponda (público o autenticado). Por eso el endpoint puede ser público sin filtrar nada.
- El frontend escucha con `EventSource` (hook `frontend/app/lib/useEventStream.ts`, reconexión
  automática). La **home** refresca al cambiar `published`; el **panel admin** refresca la pestaña
  activa al cambiar su scope.

### Notas de producción para SSE
- Usar un worker de larga duración: con gunicorn, `-k gevent` (o `gthread` con varios `--threads`)
  para que las conexiones abiertas no agoten los workers `sync`.
- Con **varias instancias/procesos**, el broker en memoria (`backend/events.py`) no cruza procesos
  → cambiarlo por **Redis pub/sub** para que los eventos lleguen a todos.
- El proxy no debe bufferizar la respuesta (ya enviamos `X-Accel-Buffering: no`).
- `SSE_HEARTBEAT_SECONDS` (def. 20) controla el latido que mantiene viva la conexión.

## Protección contra abuso / DoS

El backend incluye varias capas (configurables por entorno, ver `backend/.env.example`):

- **Rate limiting por IP** (Flask-Limiter):
  - Global: `RATELIMIT_DEFAULT` (def. 240/hora) en todos los endpoints.
  - `POST /api/submissions`: 5/min y 20/hora (evita spam del formulario público).
  - `POST /api/admin/login`: 8/min y 40/hora (frena fuerza bruta de contraseñas).
  - Respuesta `429` cuando se supera el límite.
- **Límite de tamaño de body**: `MAX_CONTENT_LENGTH` (def. 64 KB) → `413` si se excede.
- **Topes de longitud** en los campos del envío (título, descripción, URL).
- **`PROXY_HOPS`**: detrás de un reverse proxy (nginx, Render, Fly…), ponlo en `1`+ para que el
  rate limiting use la IP real del cliente (`X-Forwarded-For`) y no la del proxy.

> En producción, apunta `RATELIMIT_STORAGE_URI` a Redis (`redis://…`) para que los límites sean
> consistentes entre varios procesos/instancias. En memoria (`memory://`) sirve para un solo proceso.

## Funcionalidades

- Búsqueda por nombre, ciudad o palabra clave
- Filtros por categoría (Donaciones, Directorios, Emergencia, Quedadas) con contadores
- Filtro por país dentro de Quedadas
- Filtro por **rango de fechas** (Desde / Hasta) en la vista pública (un evento coincide si su
  intervalo se solapa con el rango buscado)
- Campo de **fecha con selector** en el formulario: **inicio** y **fin (opcional)**. Se guardan en
  ISO (`YYYY-MM-DD`) y se muestran en formato corto en español (p. ej. "sáb 28 jun – dom 29 jun")
- Tarjetas con badge de verificación, acción principal (donar/visitar/llamar) y copiar al portapapeles
- Tres temas visuales (Esperanza, Sereno, Tricolor) con persistencia en `localStorage`
- Formulario "Agregar al directorio" con validación, detección de duplicados en el servidor y
  estado de confirmación
- Panel de moderación en `/admin` (login con usuario + contraseña) para aprobar/rechazar envíos
- Actualización en **tiempo real** (SSE): la home y el panel admin se refrescan solos al haber cambios
