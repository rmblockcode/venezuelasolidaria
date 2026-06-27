# Venezuela Solidaria — API de federación (`/api/v1`)

API pública y estable para que las apps de la **red de directorios de ayuda** consulten y aporten
recursos. Pensada para interoperar con otras apps de la red (cada una abre sus endpoints).

- **Base URL (producción):** `https://api.venezuelasolidaria.com` *(ajusta al host real del backend)*
- **Base URL (local):** `http://localhost:5001`
- **Formato:** JSON. Errores: `{ "error": "<mensaje>" }` con el código HTTP correspondiente.
- **CORS:** las rutas `/api/v1/*` están abiertas a cualquier origen (sin cookies/credenciales).
- **Lectura:** pública, sin autenticación. **Creación:** requiere `X-API-Key` (ver más abajo).

> Los recursos creados vía API entran como **`pending`** y pasan por la moderación humana del equipo
> antes de publicarse. La API de lectura solo devuelve recursos **publicados**.

---

## Descubrimiento

### `GET /api/v1`
Documento de descubrimiento (nombre, versión, categorías y endpoints). Útil para registrar la app.

```bash
curl https://api.venezuelasolidaria.com/api/v1
```
```json
{
  "name": "Venezuela Solidaria",
  "version": "1",
  "provider": "Venezuela Solidaria",
  "categories": ["donaciones", "paginas", "emergencia", "quedadas"],
  "endpoints": {
    "list": "GET /api/v1/resources",
    "detail": "GET /api/v1/resources/{id}",
    "create": "POST /api/v1/resources (header X-API-Key)"
  },
  "docs": "https://www.venezuelasolidaria.com/API.md"
}
```

---

## Consultar recursos

### `GET /api/v1/resources`
Lista recursos **publicados**, paginada.

**Parámetros (query):**

| Parámetro  | Tipo    | Descripción                                                           |
|------------|---------|----------------------------------------------------------------------|
| `category` | string  | Filtra por categoría (ver vocabulario). Omite o `todos` para todas.  |
| `country`  | string  | Filtra por país (texto exacto como aparece en el recurso).           |
| `q`        | string  | Búsqueda de texto en título, descripción, ciudad y país.             |
| `since`    | ISO-8601| Solo recursos con `updated_at >= since` (sync incremental).           |
| `limit`    | int     | Máx. por página. Def. `50`, máximo `200`.                            |
| `offset`   | int     | Desplazamiento para paginar. Def. `0`.                               |

**Respuesta:**
```json
{
  "items": [ /* objetos recurso, ver esquema */ ],
  "pagination": { "limit": 50, "offset": 0, "total": 132, "returned": 50, "has_more": true }
}
```

**Ejemplos:**
```bash
# Primeras 20 donaciones
curl "https://api.venezuelasolidaria.com/api/v1/resources?category=donaciones&limit=20"

# Sincronización incremental: solo lo cambiado desde la última vez
curl "https://api.venezuelasolidaria.com/api/v1/resources?since=2026-06-01T00:00:00Z"

# Paginar
curl "https://api.venezuelasolidaria.com/api/v1/resources?limit=50&offset=50"
```
> El offset de la `+` en un valor ISO debe ir URL-encoded (`%2B`), o usa el sufijo `Z` para UTC.

### `GET /api/v1/resources/{id}`
Un recurso publicado por su `id`. `404` si no existe o no está publicado.

---

## Esquema de un recurso (feed)

```json
{
  "id": "029ea6f2f4c75138",
  "category": "donaciones",
  "title": "Cruz Roja Venezolana — Emergencia",
  "description": "Donaciones para atención médica y refugio.",
  "url": "https://...",            // null si es solo teléfono
  "phone": "+58...",               // null si es URL
  "city": "Caracas",
  "country": "Venezuela",
  "lat": 10.49, "lng": -66.87,     // pueden ser null
  "start_date": "2026-06-26",      // fecha del evento (o null)
  "end_date": null,                // fecha de fin (o null)
  "image": "https://...",          // o null
  "verified": true,                // revisado por el equipo
  "source": "Venezuela Solidaria", // origen (o el nombre del socio que lo aportó)
  "link": "https://www.venezuelasolidaria.com/recurso/029ea6f2f4c75138",
  "created_at": "2026-06-26T12:35:38+00:00",
  "updated_at": "2026-06-26T13:41:16+00:00"
}
```

**Vocabulario de `category`:** `donaciones` (recaudaciones/donar), `paginas` (directorios/páginas
comunitarias), `emergencia` (contactos de emergencia), `quedadas` (acopio/jornadas).

---

## Crear un recurso (requiere API key)

### `POST /api/v1/resources`
Crea un recurso que entra como **`pending`** para revisión.

- **Auth:** header `X-API-Key: <tu-clave>` (la entrega el equipo de Venezuela Solidaria).
- **Rate limit:** `30 por minuto; 300 por hora`.
- **Content-Type:** `application/json`.

**Body:**

| Campo         | Req. | Descripción                                                         |
|---------------|------|---------------------------------------------------------------------|
| `category`    | sí   | Una de las categorías del vocabulario.                              |
| `title`       | sí   | Nombre/título (máx. 280).                                           |
| `url`         | *    | Enlace http(s). \*Obligatorio `url` **o** `phone`.                 |
| `phone`       | *    | Teléfono de contacto. \*Obligatorio `url` **o** `phone`.           |
| `description` | no   | Texto (máx. 2000).                                                  |
| `city`        | no   | Ciudad.                                                             |
| `country`     | no   | País.                                                               |
| `start_date`  | no   | `YYYY-MM-DD`.                                                       |
| `end_date`    | no   | `YYYY-MM-DD` (>= `start_date`).                                     |
| `image`       | no   | URL http(s) de una imagen.                                          |
| `lat`, `lng`  | no   | Coordenadas exactas; si no, se geocodifica desde ciudad/país.      |

**Ejemplo:**
```bash
curl -X POST https://api.venezuelasolidaria.com/api/v1/resources \
  -H "Content-Type: application/json" \
  -H "X-API-Key: vs_xxxxxxxxxxxxxxxxxxxxxxxx" \
  -d '{
    "category": "donaciones",
    "title": "Recaudación para El Tigre",
    "url": "https://ejemplo.org/campana",
    "description": "Campaña vecinal para reconstrucción de viviendas.",
    "city": "El Tigre",
    "country": "Venezuela"
  }'
```

**Respuestas:**
- `201` → `{ "id": "...", "status": "pending", "message": "Recibido. Quedó pendiente de revisión." }`
- `400` → validación (categoría/fecha/imagen inválida, faltan campos).
- `401` → falta o es inválida la `X-API-Key`.
- `409` → duplicado (la URL o el teléfono ya existen en el directorio).
- `429` → límite de peticiones superado.

---

## Notas para integradores
- **Deduplicación:** se rechazan (`409`) URLs/teléfonos que ya existan (normalizados). Reintentar el
  mismo recurso no crea duplicados.
- **Sincronización:** guarda el `updated_at` más alto que hayas visto y vuelve a pedir con
  `?since=<ese valor>` para traer solo lo nuevo/cambiado.
- **Atribución:** el campo `source` indica el origen del recurso; los que tú aportes quedan con el
  nombre de tu app.
- **Claves de API:** se generan y revocan desde el panel de administración de Venezuela Solidaria.
  Si necesitas una, contáctanos.
