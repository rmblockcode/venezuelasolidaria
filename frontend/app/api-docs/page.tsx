import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API de federación · Venezuela Solidaria",
  description:
    "Documentación de la API pública de Venezuela Solidaria para la red de directorios de ayuda: consultar y aportar recursos (/api/v1).",
};

const API_BASE = "https://api.venezuelasolidaria.com";

function Method({ kind }: { kind: "GET" | "POST" }) {
  return <span className={`api-method ${kind.toLowerCase()}`}>{kind}</span>;
}

export default function ApiDocsPage() {
  return (
    <div data-theme="esperanza">
      <div className="flagbar">
        <div style={{ background: "#f6c945" }} />
        <div style={{ background: "#1f6fb0" }} />
        <div style={{ background: "#cf3a2e" }} />
      </div>

      <header className="legal-head wrap">
        <div className="brand">
          <div className="ticks">
            <span style={{ background: "#f6c945" }} />
            <span style={{ background: "#1f6fb0" }} />
            <span style={{ background: "#cf3a2e" }} />
          </div>
          <div className="names">
            <span className="n1">Venezuela Solidaria</span>
            <span className="n2">Directorio de ayuda · Sismos 2026</span>
          </div>
        </div>
        <Link href="/" className="legal-back">
          ← Volver al directorio
        </Link>
      </header>

      <article className="apidoc wrap">
        <h1>API de federación</h1>
        <p className="apidoc-lead">
          API pública y estable para que las apps de la <strong>red de directorios de ayuda</strong>{" "}
          consulten y aporten recursos. La <strong>lectura</strong> es pública; la{" "}
          <strong>creación</strong> requiere una clave (<code>X-API-Key</code>) y los recursos entran
          como <strong>pendientes</strong> de moderación antes de publicarse.
        </p>

        <div className="api-note">
          <div className="api-kv">
            <span>Base URL</span>
            <code>{API_BASE}</code>
          </div>
          <div className="api-kv">
            <span>Formato</span>
            <code>JSON</code>
          </div>
          <div className="api-kv">
            <span>CORS</span>
            <code>abierto en /api/v1/*</code>
          </div>
          <div className="api-kv">
            <span>Errores</span>
            <code>{`{ "error": "<mensaje>" }`}</code>
          </div>
        </div>

        {/* ---- Discovery ---- */}
        <h2>Descubrimiento</h2>
        <div className="api-ep">
          <div className="api-ep-head">
            <Method kind="GET" />
            <span className="api-path">/api/v1</span>
          </div>
          <p>Metadatos de la API (nombre, versión, categorías y endpoints).</p>
          <pre className="api-pre">
            <code>{`curl ${API_BASE}/api/v1`}</code>
          </pre>
          <pre className="api-pre">
            <code>{`{
  "name": "Venezuela Solidaria",
  "version": "1",
  "provider": "Venezuela Solidaria",
  "categories": ["donaciones", "paginas", "emergencia", "quedadas"],
  "endpoints": {
    "list": "GET /api/v1/resources",
    "detail": "GET /api/v1/resources/{id}",
    "create": "POST /api/v1/resources (header X-API-Key)"
  }
}`}</code>
          </pre>
        </div>

        {/* ---- List ---- */}
        <h2>Consultar recursos</h2>
        <div className="api-ep">
          <div className="api-ep-head">
            <Method kind="GET" />
            <span className="api-path">/api/v1/resources</span>
          </div>
          <p>Lista los recursos publicados, paginada.</p>

          <table className="api-table">
            <thead>
              <tr>
                <th>Parámetro</th>
                <th>Tipo</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>category</code></td>
                <td>string</td>
                <td>Filtra por categoría (ver vocabulario). Omite o <code>todos</code> para todas.</td>
              </tr>
              <tr>
                <td><code>country</code></td>
                <td>string</td>
                <td>Filtra por país (texto exacto como aparece en el recurso).</td>
              </tr>
              <tr>
                <td><code>q</code></td>
                <td>string</td>
                <td>Búsqueda de texto en título, descripción, ciudad y país.</td>
              </tr>
              <tr>
                <td><code>since</code></td>
                <td>ISO-8601</td>
                <td>Solo recursos con <code>updated_at &gt;= since</code> (sincronización incremental).</td>
              </tr>
              <tr>
                <td><code>limit</code></td>
                <td>int</td>
                <td>Máximo por página. Por defecto 50, máximo 200.</td>
              </tr>
              <tr>
                <td><code>offset</code></td>
                <td>int</td>
                <td>Desplazamiento para paginar. Por defecto 0.</td>
              </tr>
            </tbody>
          </table>

          <p className="api-sub">Respuesta</p>
          <pre className="api-pre">
            <code>{`{
  "items": [ /* recursos, ver esquema */ ],
  "pagination": {
    "limit": 50, "offset": 0, "total": 132,
    "returned": 50, "has_more": true
  }
}`}</code>
          </pre>

          <p className="api-sub">Ejemplos</p>
          <pre className="api-pre">
            <code>{`# Primeras 20 donaciones
curl "${API_BASE}/api/v1/resources?category=donaciones&limit=20"

# Sincronización incremental: solo lo cambiado desde la última vez
curl "${API_BASE}/api/v1/resources?since=2026-06-01T00:00:00Z"

# Paginar
curl "${API_BASE}/api/v1/resources?limit=50&offset=50"`}</code>
          </pre>
          <p className="api-hint">
            El <code>+</code> de un offset horario en ISO debe ir codificado como <code>%2B</code>, o
            usa el sufijo <code>Z</code> para UTC.
          </p>
        </div>

        <div className="api-ep">
          <div className="api-ep-head">
            <Method kind="GET" />
            <span className="api-path">/api/v1/resources/{"{id}"}</span>
          </div>
          <p>Un recurso publicado por su <code>id</code>. Devuelve <code>404</code> si no existe o no está publicado.</p>
        </div>

        {/* ---- Schema ---- */}
        <h2>Esquema de un recurso</h2>
        <pre className="api-pre">
          <code>{`{
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
  "source": "Venezuela Solidaria", // origen (o el socio que lo aportó)
  "link": "https://www.venezuelasolidaria.com/recurso/029ea6f2f4c75138",
  "created_at": "2026-06-26T12:35:38+00:00",
  "updated_at": "2026-06-26T13:41:16+00:00"
}`}</code>
        </pre>

        <p className="api-sub">Vocabulario de <code>category</code></p>
        <ul className="api-cats">
          <li><code>donaciones</code> — recaudaciones / donar</li>
          <li><code>paginas</code> — directorios / páginas comunitarias</li>
          <li><code>emergencia</code> — contactos de emergencia</li>
          <li><code>quedadas</code> — acopio / jornadas</li>
        </ul>

        {/* ---- Create ---- */}
        <h2>Crear un recurso</h2>
        <div className="api-ep">
          <div className="api-ep-head">
            <Method kind="POST" />
            <span className="api-path">/api/v1/resources</span>
            <span className="api-auth">requiere X-API-Key</span>
          </div>
          <p>
            Crea un recurso que entra como <strong>pendiente</strong> de revisión. Autenticación por
            header <code>X-API-Key</code> (la entrega el equipo de Venezuela Solidaria). Límite:{" "}
            <code>30/min · 300/hora</code>.
          </p>

          <table className="api-table">
            <thead>
              <tr>
                <th>Campo</th>
                <th>Req.</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              <tr><td><code>category</code></td><td>sí</td><td>Una de las categorías del vocabulario.</td></tr>
              <tr><td><code>title</code></td><td>sí</td><td>Nombre / título (máx. 280).</td></tr>
              <tr><td><code>url</code></td><td>*</td><td>Enlace http(s). *Obligatorio <code>url</code> <strong>o</strong> <code>phone</code>.</td></tr>
              <tr><td><code>phone</code></td><td>*</td><td>Teléfono de contacto. *Obligatorio <code>url</code> <strong>o</strong> <code>phone</code>.</td></tr>
              <tr><td><code>description</code></td><td>no</td><td>Texto (máx. 2000).</td></tr>
              <tr><td><code>city</code> / <code>country</code></td><td>no</td><td>Ubicación.</td></tr>
              <tr><td><code>start_date</code> / <code>end_date</code></td><td>no</td><td><code>YYYY-MM-DD</code> (fin &gt;= inicio).</td></tr>
              <tr><td><code>image</code></td><td>no</td><td>URL http(s) de una imagen.</td></tr>
              <tr><td><code>lat</code> / <code>lng</code></td><td>no</td><td>Coordenadas exactas; si no, se geocodifica.</td></tr>
            </tbody>
          </table>

          <p className="api-sub">Ejemplo</p>
          <pre className="api-pre">
            <code>{`curl -X POST ${API_BASE}/api/v1/resources \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: vs_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -d '{
    "category": "donaciones",
    "title": "Recaudación para El Tigre",
    "url": "https://ejemplo.org/campana",
    "description": "Campaña vecinal para reconstrucción de viviendas.",
    "city": "El Tigre",
    "country": "Venezuela"
  }'`}</code>
          </pre>

          <p className="api-sub">Respuestas</p>
          <ul className="api-status">
            <li><span className="api-code ok">201</span> {`{ "id": "...", "status": "pending", "message": "..." }`}</li>
            <li><span className="api-code warn">400</span> validación (categoría/fecha/imagen inválida, faltan campos).</li>
            <li><span className="api-code warn">401</span> falta o es inválida la <code>X-API-Key</code>.</li>
            <li><span className="api-code warn">409</span> duplicado (la URL o el teléfono ya existen).</li>
            <li><span className="api-code warn">429</span> límite de peticiones superado.</li>
          </ul>
        </div>

        {/* ---- Notes ---- */}
        <h2>Notas para integradores</h2>
        <ul className="api-notes-list">
          <li>
            <strong>Deduplicación:</strong> se rechazan (<code>409</code>) URLs/teléfonos ya
            existentes (normalizados). Reintentar el mismo recurso no crea duplicados.
          </li>
          <li>
            <strong>Sincronización:</strong> guarda el <code>updated_at</code> más alto que hayas
            visto y vuelve a pedir con <code>?since=</code> para traer solo lo nuevo o cambiado.
          </li>
          <li>
            <strong>Atribución:</strong> el campo <code>source</code> indica el origen; los recursos
            que aportes quedan con el nombre de tu app.
          </li>
          <li>
            <strong>Claves de API:</strong> se generan y revocan desde el panel de administración. Si
            necesitas una, <a href="mailto:info@betternfaster.com">contáctanos</a>.
          </li>
        </ul>

        <Link href="/" className="legal-back-btn">
          ← Volver al directorio
        </Link>
      </article>
    </div>
  );
}
