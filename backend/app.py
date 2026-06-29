import hashlib
import json
import os
import queue
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import Flask, Response, g, jsonify, request, stream_with_context
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
from sqlalchemy import text
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

import humanitarian
from events import broker
from geocode import geocode
from models import db, Resource, AdminUser, ModerationLog, GalleryPhoto, PartnerKey
from seed_data import SEED

load_dotenv()

DEFAULT_DB = "postgresql+psycopg://vzla:vzla@localhost:5432/venezuelasolidaria"

# Public site URL used to build absolute share links in the federation feed.
PUBLIC_SITE_URL = os.environ.get("PUBLIC_SITE_URL", "https://www.venezuelasolidaria.com")


ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def valid_iso_date(value):
    """True for an empty value or a YYYY-MM-DD string (the date picker's format)."""
    if not value:
        return True
    return bool(ISO_DATE_RE.match(value.strip()))


def parse_iso_datetime(value):
    """Parse an ISO-8601 datetime for the federation ?since= filter. Returns an
    aware datetime (assumes UTC if no offset given) or None when absent/invalid."""
    value = (value or "").strip()
    if not value:
        return None
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(value)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def valid_email(value):
    return bool(EMAIL_RE.match((value or "").strip()))


def record_log(action, entry):
    """Queue an audit entry for a moderation action on a resource. Reads the
    resource's fields now (so it works even right before a delete); caller commits."""
    db.session.add(
        ModerationLog(
            admin_email=getattr(g, "admin_email", None),
            action=action,
            target_id=entry.id,
            target_title=entry.title,
            target_category=entry.category,
        )
    )


def stamp_moderation(entry, action):
    """Record who moderated this resource and when, for per-post attribution."""
    entry.moderated_by = getattr(g, "admin_email", None)
    entry.moderated_at = datetime.now(timezone.utc)
    entry.moderation_action = action


def record_action(action, label=None, category=None):
    """Queue an audit entry for a non-resource admin action (admins, gallery, etc.)."""
    db.session.add(
        ModerationLog(
            admin_email=getattr(g, "admin_email", None),
            action=action,
            target_title=label,
            target_category=category,
        )
    )


def valid_coords(lat, lng):
    """Return (lat, lng) as floats if both are valid map coordinates, else None."""
    try:
        lat = float(lat)
        lng = float(lng)
    except (TypeError, ValueError):
        return None
    if -90 <= lat <= 90 and -180 <= lng <= 180:
        return (lat, lng)
    return None


def valid_image_url(value):
    """Empty is fine; otherwise an http(s) URL no longer than the column allows."""
    if not value:
        return True
    value = value.strip()
    return len(value) <= 2048 and bool(re.match(r"^https?://", value, re.IGNORECASE))


def valid_date_range(start, end):
    """End is optional; when both are ISO dates, end must be >= start."""
    start = (start or "").strip()
    end = (end or "").strip()
    if start and end and ISO_DATE_RE.match(start) and ISO_DATE_RE.match(end):
        return end >= start
    return True


def normalize_url(u):
    u = (u or "").strip().lower()
    u = re.sub(r"^https?://", "", u)
    u = re.sub(r"^www\.", "", u)
    u = re.sub(r"/+$", "", u)
    return u


def only_digits(s):
    return re.sub(r"\D", "", s or "")


def clamp_int(value, default, lo, hi):
    """Parse a query-string int, falling back to `default`, and clamp to [lo, hi].
    Keeps a bogus ?limit=abc from 500-ing and an absurd ?limit=999999 from hurting."""
    try:
        n = int(value)
    except (TypeError, ValueError):
        return default
    return max(lo, min(n, hi))


def build_pending_resource(data, source=None):
    """Shared create flow behind both the internal form (POST /api/submissions) and
    the federation API (POST /api/v1/resources). Validates, detects url-vs-phone,
    rejects duplicates, geocodes, and adds a `pending` Resource to the session
    (the caller commits + publishes). Accepts federation field names
    (description/start_date/end_date) and the internal ones (desc/date/dateEnd).
    Returns (entry, None) on success or (None, (response, status)) on error."""
    data = data or {}
    category = (data.get("category") or "donaciones").strip()
    title = (data.get("title") or "").strip()
    raw_url = (data.get("url") or "").strip() or (data.get("phone") or "").strip()
    desc = (data.get("description") if data.get("description") is not None else data.get("desc")) or ""
    date = data.get("start_date") if data.get("start_date") is not None else data.get("date")
    date_end = data.get("end_date") if data.get("end_date") is not None else data.get("dateEnd")
    image = data.get("image")

    if category not in Resource.CATEGORIES:
        return None, (jsonify({"error": "Categoría no válida."}), 400)
    if not title:
        return None, (jsonify({"error": "Agrega un nombre o título para el enlace."}), 400)
    if not raw_url:
        return None, (jsonify({"error": "Agrega el enlace (URL) o un teléfono de contacto."}), 400)
    if len(title) > 280:
        return None, (jsonify({"error": "El título es demasiado largo (máx. 280 caracteres)."}), 400)
    if len(desc) > 2000:
        return None, (jsonify({"error": "La descripción es demasiado larga (máx. 2000 caracteres)."}), 400)
    if len(raw_url) > 2048:
        return None, (jsonify({"error": "El enlace es demasiado largo."}), 400)
    if not valid_iso_date(date) or not valid_iso_date(date_end):
        return None, (jsonify({"error": "Fecha no válida."}), 400)
    if not valid_date_range(date, date_end):
        return None, (jsonify({"error": "La fecha de fin no puede ser anterior a la de inicio."}), 400)
    if not valid_image_url(image):
        return None, (jsonify({"error": "La imagen debe ser un enlace http(s) válido."}), 400)

    looks_like_phone = bool(re.match(r"^[\d\s()+\-]+$", raw_url)) and not raw_url.lower().startswith("http")
    url = None if looks_like_phone else raw_url
    phone = raw_url if looks_like_phone else None

    n = normalize_url(raw_url)
    digits = only_digits(raw_url)
    if n:
        dup = Resource.query.filter(
            Resource.status != "rejected", Resource.url_norm == n
        ).first()
        if dup:
            if dup.status == "pending":
                return None, (jsonify({"error": "Este enlace ya fue enviado y está en revisión."}), 409)
            return None, (jsonify({"error": "Este enlace o contacto ya está publicado en el directorio."}), 409)
    if digits:
        if Resource.query.filter(
            Resource.status != "rejected", Resource.phone_digits == digits
        ).first():
            return None, (jsonify({"error": "Este enlace o contacto ya está publicado en el directorio."}), 409)

    entry = Resource(
        id=secrets.token_hex(8),
        category=category,
        title=title,
        description=(desc or "").strip(),
        url=url,
        phone=phone,
        city=(data.get("city") or "").strip() or None,
        country=(data.get("country") or "").strip() or None,
        event_date=(date or "").strip() or None,
        event_end_date=(date_end or "").strip() or None,
        image_url=(image or "").strip() or None,
        contact=(data.get("contact") or "").strip() or None,
        url_norm=normalize_url(url) or None,
        phone_digits=only_digits(phone) or None,
        verified=False,
        status="pending",
        source=(source or "").strip() or None,
    )
    # Prefer exact coordinates from the caller; otherwise geocode.
    picked = valid_coords(data.get("lat"), data.get("lng"))
    if picked:
        entry.lat, entry.lng = picked
    else:
        coords = geocode(entry.city, entry.country)
        if coords:
            entry.lat, entry.lng = coords
    db.session.add(entry)
    return entry, None


def hash_api_key(raw):
    return hashlib.sha256((raw or "").strip().encode()).hexdigest()


def generate_partner_key():
    """Returns (plaintext, sha256, prefix). The plaintext is shown to the admin once."""
    raw = "vs_" + secrets.token_urlsafe(24)
    return raw, hash_api_key(raw), raw[:10]


def require_api_key(fn):
    """Gate for the federation create endpoint: validates the X-API-Key header
    against the active PartnerKeys and stamps `g.partner`."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        provided = (request.headers.get("X-API-Key") or "").strip()
        if not provided:
            return jsonify({"error": "Falta la API key (header X-API-Key)."}), 401
        key = PartnerKey.query.filter_by(key_sha256=hash_api_key(provided), active=True).first()
        if not key:
            return jsonify({"error": "API key inválida o revocada."}), 401
        g.partner = key
        key.last_used_at = datetime.now(timezone.utc)
        db.session.commit()
        return fn(*args, **kwargs)

    return wrapper


def seed_if_empty():
    if Resource.query.count() > 0:
        return
    for row in SEED:
        db.session.add(Resource(status="published", **row))
    db.session.commit()


def ensure_schema():
    """Lightweight idempotent migration: add columns that were introduced after a
    table may already have been created. `db.create_all()` never alters existing
    tables, so without this a redeploy keeps the old schema. Postgres-only syntax."""
    stmts = [
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS event_end_date varchar(60)",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS image_url varchar(2048)",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS lat double precision",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS lng double precision",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS moderated_by varchar(255)",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS moderated_at timestamptz",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS moderation_action varchar(20)",
        # Indexes for the hot read paths. create_all() never adds indexes to an
        # already-existing table, so they're declared idempotently here too.
        "CREATE INDEX IF NOT EXISTS ix_resources_status_created ON resources (status, created_at)",
        "CREATE INDEX IF NOT EXISTS ix_resources_country ON resources (country)",
        # Normalized duplicate-check columns (+ indexes) introduced after launch.
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS url_norm varchar(2048)",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS phone_digits varchar(64)",
        "CREATE INDEX IF NOT EXISTS ix_resources_url_norm ON resources (url_norm)",
        "CREATE INDEX IF NOT EXISTS ix_resources_phone_digits ON resources (phone_digits)",
        # Federation API: origin attribution + incremental-sync timestamp.
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS source varchar(120)",
        "ALTER TABLE resources ADD COLUMN IF NOT EXISTS updated_at timestamptz",
        "UPDATE resources SET updated_at = created_at WHERE updated_at IS NULL",
        "CREATE INDEX IF NOT EXISTS ix_resources_updated ON resources (updated_at)",
    ]
    for s in stmts:
        db.session.execute(text(s))
    db.session.commit()
    backfill_normalized()


def backfill_normalized():
    """One-time fill of url_norm/phone_digits for rows created before those columns
    existed. Normalization lives in Python (normalize_url/only_digits), so it can't
    be done in pure SQL. Idempotent: only touches rows where the value is missing."""
    rows = Resource.query.filter(
        db.or_(
            db.and_(Resource.url.isnot(None), Resource.url_norm.is_(None)),
            db.and_(Resource.phone.isnot(None), Resource.phone_digits.is_(None)),
        )
    ).all()
    if not rows:
        return
    for r in rows:
        r.url_norm = normalize_url(r.url) or None if r.url else None
        r.phone_digits = only_digits(r.phone) or None if r.phone else None
    db.session.commit()


def seed_admin():
    """Create the initial moderator from env vars if no admin exists yet."""
    email = (os.environ.get("ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD") or ""
    if not email or not password:
        return
    if AdminUser.query.filter_by(email=email).first():
        return
    db.session.add(AdminUser(email=email, password_hash=generate_password_hash(password)))
    db.session.commit()


def resolve_db_url():
    """Managed providers (Neon, Render, Heroku) hand out postgres:// or
    postgresql:// URLs; SQLAlchemy + psycopg3 needs the postgresql+psycopg:// dialect."""
    url = os.environ.get("DATABASE_URL", DEFAULT_DB)
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def create_app():
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = resolve_db_url()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    # Managed/serverless Postgres (Neon) drops idle connections; validate each
    # pooled connection before use and recycle stale ones so requests don't hit
    # "SSL connection has been closed unexpectedly".
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-insecure-change-me")
    app.config["JWT_EXP_HOURS"] = int(os.environ.get("JWT_EXP_HOURS", "12"))
    # Reject oversized request bodies outright (anti-abuse). Default 64 KB.
    app.config["MAX_CONTENT_LENGTH"] = int(os.environ.get("MAX_CONTENT_LENGTH", str(64 * 1024)))

    # Trust the reverse proxy's X-Forwarded-For so rate limiting keys on the real
    # client IP instead of the proxy. Configurable for the deployment topology.
    proxy_hops = int(os.environ.get("PROXY_HOPS", "0"))
    if proxy_hops > 0:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=proxy_hops, x_proto=proxy_hops)

    # Allow the Next.js dev server (and any configured origins) to call the API.
    # Authorization header + POST/PATCH are needed for the admin panel.
    origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
    CORS(
        app,
        resources={
            # Public federation API is open to any origin (no cookies/credentials,
            # so `*` is safe). Must be listed first so it wins over /api/*.
            r"/api/v1/*": {"origins": "*"},
            r"/api/*": {"origins": [o.strip() for o in origins.split(",")]},
        },
        allow_headers=["Content-Type", "Authorization", "X-API-Key"],
        methods=["GET", "POST", "PATCH", "OPTIONS"],
    )

    # Rate limiting (anti-DoS / brute force). In-memory by default; point
    # RATELIMIT_STORAGE_URI at Redis in production for multi-process correctness.
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=[os.environ.get("RATELIMIT_DEFAULT", "240 per hour")],
        storage_uri=os.environ.get("RATELIMIT_STORAGE_URI", "memory://"),
        strategy="fixed-window",
    )

    @app.errorhandler(429)
    def ratelimit_handler(_e):
        return jsonify({"error": "Demasiadas solicitudes. Intenta de nuevo más tarde."}), 429

    @app.errorhandler(413)
    def too_large_handler(_e):
        return jsonify({"error": "La solicitud es demasiado grande."}), 413

    db.init_app(app)

    with app.app_context():
        db.create_all()
        ensure_schema()
        seed_if_empty()
        seed_admin()

    # ---- auth helpers ----
    def make_token(user):
        now = datetime.now(timezone.utc)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "iat": now,
            "exp": now + timedelta(hours=app.config["JWT_EXP_HOURS"]),
        }
        return jwt.encode(payload, app.config["SECRET_KEY"], algorithm="HS256")

    def require_admin(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            header = request.headers.get("Authorization", "")
            if not header.startswith("Bearer "):
                return jsonify({"error": "No autorizado."}), 401
            token = header[len("Bearer "):].strip()
            try:
                payload = jwt.decode(token, app.config["SECRET_KEY"], algorithms=["HS256"])
            except jwt.PyJWTError:
                return jsonify({"error": "Sesión inválida o expirada."}), 401
            g.admin_id = payload.get("sub")
            g.admin_email = payload.get("email")
            return fn(*args, **kwargs)

        return wrapper

    @app.get("/api/health")
    @limiter.exempt
    def health():
        return jsonify({"status": "ok"})

    heartbeat = int(os.environ.get("SSE_HEARTBEAT_SECONDS", "20"))

    @app.get("/api/stream")
    @limiter.exempt
    def stream():
        """Server-Sent Events: lightweight 'which list changed' signals only.

        Carries no record data, so it's safe to expose publicly; clients refetch
        through the existing (authenticated, where needed) GET endpoints.
        """

        @stream_with_context
        def gen():
            q = broker.subscribe()
            try:
                yield ": connected\n\n"
                while True:
                    try:
                        payload = q.get(timeout=heartbeat)
                        yield f"data: {json.dumps(payload)}\n\n"
                    except queue.Empty:
                        yield ": ping\n\n"
            finally:
                broker.unsubscribe(q)

        return Response(
            gen(),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    @app.get("/api/resources")
    def list_resources():
        """Published directory entries. Optional ?category= and ?country= filters."""
        q = Resource.query.filter_by(status="published")
        category = request.args.get("category")
        if category and category != "todos":
            q = q.filter_by(category=category)
        country = request.args.get("country")
        if country and country != "todos":
            q = q.filter_by(country=country)
        # Defensive cap, NOT pagination: the home filters/counts/searches client-side
        # over the full set, so we still return everything — but never an unbounded
        # number of rows. Raise the default if the directory legitimately outgrows it.
        cap = clamp_int(request.args.get("limit"), default=500, lo=1, hi=1000)
        items = q.order_by(Resource.created_at.desc()).limit(cap).all()
        return jsonify({"items": [r.to_dict() for r in items]})

    @app.get("/api/resources/<sid>")
    def get_resource(sid):
        """A single published resource — for shareable direct links."""
        entry = db.session.get(Resource, sid)
        if not entry or entry.status != "published":
            return jsonify({"error": "No encontrado."}), 404
        return jsonify(entry.to_dict())

    # ---- Red Humanitaria de Datos: proxy de lectura (índice común externo) ----
    # La API externa no manda CORS; la consultamos desde el servidor, cacheada y
    # normalizada (sin cédula completa). El frontend solo habla con nosotros.
    @app.get("/api/network/search")
    @limiter.limit("60 per minute")
    def network_search():
        limit = clamp_int(request.args.get("limit"), default=24, lo=1, hi=50)
        offset = clamp_int(request.args.get("offset"), default=0, lo=0, hi=5000)
        result = humanitarian.search(
            q=(request.args.get("q") or "").strip(),
            record_type=(request.args.get("record_type") or "").strip(),
            city=(request.args.get("city") or "").strip(),
            source_id=(request.args.get("source_id") or "").strip(),
            limit=limit,
            offset=offset,
        )
        if result is None:
            return jsonify({"error": "La red no está disponible ahora."}), 502
        items = result["items"]
        total = result["total_matches"]
        return jsonify(
            {
                "items": items,
                "total_matches": total,
                "source_count": result["source_count"],
                "record_types": result["record_types"],
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "returned": len(items),
                    "has_more": offset + len(items) < total,
                },
            }
        )

    @app.get("/api/network/recent")
    @limiter.limit("60 per minute")
    def network_recent():
        limit = clamp_int(request.args.get("limit"), default=24, lo=1, hi=50)
        since = clamp_int(request.args.get("since"), default=0, lo=0, hi=10**12)
        result = humanitarian.recent(limit=limit, since=since)
        if result is None:
            return jsonify({"error": "La red no está disponible ahora."}), 502
        return jsonify(result)

    @app.get("/api/network/record/<path:rid>")
    @limiter.limit("60 per minute")
    def network_record(rid):
        rec = humanitarian.record(rid)
        if rec is None:
            return jsonify({"error": "No encontrado."}), 404
        return jsonify(rec)

    @app.get("/api/network/sources")
    @limiter.limit("60 per minute")
    def network_sources():
        srcs = humanitarian.sources()
        if srcs is None:
            return jsonify({"error": "La red no está disponible ahora."}), 502
        return jsonify({"items": srcs, "count": len(srcs)})

    @app.get("/api/gallery")
    def list_gallery():
        """Public hero-carousel photos, oldest first."""
        photos = GalleryPhoto.query.order_by(GalleryPhoto.created_at.asc()).all()
        return jsonify({"items": [p.to_dict() for p in photos]})

    # ---- Federation API (v1): stable, documented contract for the partner network.
    # Reads are public + CORS-open; create requires a partner X-API-Key. ----
    @app.get("/api/v1")
    def federation_root():
        """Discovery document — also handy to fill the network registration form."""
        return jsonify({
            "name": Resource.PROVIDER,
            "version": "1",
            "provider": Resource.PROVIDER,
            "categories": list(Resource.CATEGORIES),
            "endpoints": {
                "list": "GET /api/v1/resources",
                "detail": "GET /api/v1/resources/{id}",
                "create": "POST /api/v1/resources (header X-API-Key)",
            },
            "docs": f"{PUBLIC_SITE_URL.rstrip('/')}/api-docs",
        })

    @app.get("/api/v1/resources")
    @limiter.limit("120 per minute")
    def federation_list():
        """Published resources for partners. Filters: category, country, q (text),
        since (ISO datetime → updated_at >=). Paginated with limit/offset."""
        q = Resource.query.filter_by(status="published")
        category = request.args.get("category")
        if category and category != "todos":
            q = q.filter_by(category=category)
        country = request.args.get("country")
        if country and country != "todos":
            q = q.filter_by(country=country)
        term = (request.args.get("q") or "").strip()
        if term:
            like = f"%{term}%"
            q = q.filter(
                db.or_(
                    Resource.title.ilike(like),
                    Resource.description.ilike(like),
                    Resource.city.ilike(like),
                    Resource.country.ilike(like),
                )
            )
        since = parse_iso_datetime(request.args.get("since"))
        if since is not None:
            q = q.filter(Resource.updated_at >= since)
        total = q.count()
        limit = clamp_int(request.args.get("limit"), default=50, lo=1, hi=200)
        offset = clamp_int(request.args.get("offset"), default=0, lo=0, hi=10_000_000)
        rows = q.order_by(Resource.updated_at.desc()).limit(limit).offset(offset).all()
        items = [r.to_feed_dict(PUBLIC_SITE_URL) for r in rows]
        return jsonify({
            "items": items,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": total,
                "returned": len(items),
                "has_more": offset + len(items) < total,
            },
        })

    @app.get("/api/v1/resources/<sid>")
    @limiter.limit("120 per minute")
    def federation_detail(sid):
        entry = db.session.get(Resource, sid)
        if not entry or entry.status != "published":
            return jsonify({"error": "No encontrado."}), 404
        return jsonify(entry.to_feed_dict(PUBLIC_SITE_URL))

    @app.post("/api/v1/resources")
    @require_api_key
    @limiter.limit("30 per minute; 300 per hour")
    def federation_create():
        """Create a resource from a partner app — enters as `pending` for review."""
        data = request.get_json(silent=True) or {}
        entry, err = build_pending_resource(data, source=g.partner.name)
        if err:
            return err
        db.session.commit()
        broker.publish({"scopes": ["pending"]})
        return jsonify({
            "id": entry.id,
            "status": "pending",
            "message": "Recibido. Quedó pendiente de revisión.",
        }), 201

    @app.post("/api/submissions")
    @limiter.limit("5 per minute; 20 per hour")
    def create_submission():
        """Public submission from the site form. Stored as a pending resource."""
        data = request.get_json(silent=True) or {}
        entry, err = build_pending_resource(data, source=None)
        if err:
            return err
        db.session.commit()
        broker.publish({"scopes": ["pending"]})
        return jsonify({"ok": True, "id": entry.id}), 201

    # ---- Cloudinary signed upload ----
    @app.post("/api/cloudinary/signature")
    @limiter.limit("20 per minute; 120 per hour")
    def cloudinary_signature():
        """Issue a short-lived signature so the browser can upload to Cloudinary
        without ever seeing the API secret. The folder is signed server-side so it
        can't be tampered with. Public (the submit form is public) but rate-limited."""
        cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME", "").strip()
        api_key = os.environ.get("CLOUDINARY_API_KEY", "").strip()
        api_secret = os.environ.get("CLOUDINARY_API_SECRET", "").strip()
        folder = os.environ.get("CLOUDINARY_FOLDER", "VenezuelaSolidaria").strip()
        if not (cloud_name and api_key and api_secret):
            return jsonify({"error": "Cloudinary no está configurado en el servidor."}), 503

        timestamp = int(time.time())
        # Params to sign (everything except file, api_key, cloud_name, signature).
        params = {"timestamp": timestamp}
        if folder:
            params["folder"] = folder
        to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
        signature = hashlib.sha1((to_sign + api_secret).encode("utf-8")).hexdigest()

        return jsonify({
            "cloudName": cloud_name,
            "apiKey": api_key,
            "timestamp": timestamp,
            "signature": signature,
            "folder": folder or None,
        })

    # ---- admin / moderation ----
    @app.post("/api/admin/login")
    @limiter.limit("8 per minute; 40 per hour")
    def admin_login():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        user = AdminUser.query.filter_by(email=email).first()
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Correo o contraseña incorrectos."}), 401
        return jsonify({"token": make_token(user), "email": user.email})

    @app.get("/api/admin/submissions")
    @require_admin
    def admin_submissions():
        """List entries by status (default: pending submissions awaiting review).

        Bounded by a generous default cap so one status can't pull an unbounded
        result set; optional ?limit/?offset let a future panel page through it
        without changing today's behavior."""
        status = request.args.get("status", "pending")
        limit = clamp_int(request.args.get("limit"), default=500, lo=1, hi=1000)
        offset = clamp_int(request.args.get("offset"), default=0, lo=0, hi=10_000_000)
        items = (
            Resource.query.filter_by(status=status)
            .order_by(Resource.created_at.desc())
            .limit(limit)
            .offset(offset)
            .all()
        )
        return jsonify({"items": [r.to_admin_dict() for r in items]})

    @app.post("/api/admin/submissions/<sid>/approve")
    @require_admin
    def admin_approve(sid):
        entry = db.session.get(Resource, sid)
        if not entry:
            return jsonify({"error": "No encontrado."}), 404
        data = request.get_json(silent=True) or {}
        verified = data.get("verified", True)
        entry.status = "published"
        entry.verified = bool(verified)
        stamp_moderation(entry, "approve")
        record_log("approve", entry)
        db.session.commit()
        broker.publish({"scopes": ["pending", "published", "rejected"]})
        return jsonify({"ok": True, "item": entry.to_admin_dict()})

    @app.post("/api/admin/submissions/<sid>/reject")
    @require_admin
    def admin_reject(sid):
        """Soft delete: archive the entry as 'rejected' (recoverable)."""
        entry = db.session.get(Resource, sid)
        if not entry:
            return jsonify({"error": "No encontrado."}), 404
        prev = entry.status
        entry.status = "rejected"
        stamp_moderation(entry, "reject")
        record_log("reject", entry)
        db.session.commit()
        broker.publish({"scopes": [prev, "rejected"]})
        return jsonify({"ok": True})

    @app.post("/api/admin/submissions/<sid>/purge")
    @require_admin
    def admin_purge(sid):
        """Hard delete: permanently remove the entry from the database."""
        entry = db.session.get(Resource, sid)
        if not entry:
            return jsonify({"error": "No encontrado."}), 404
        record_log("delete", entry)
        db.session.delete(entry)
        db.session.commit()
        broker.publish({"scopes": ["rejected"]})
        return jsonify({"ok": True})

    @app.post("/api/admin/submissions/<sid>/unpublish")
    @require_admin
    def admin_unpublish(sid):
        """Pull a published entry back to pending (removes it from the public list)."""
        entry = db.session.get(Resource, sid)
        if not entry:
            return jsonify({"error": "No encontrado."}), 404
        entry.status = "pending"
        stamp_moderation(entry, "unpublish")
        record_log("unpublish", entry)
        db.session.commit()
        broker.publish({"scopes": ["pending", "published"]})
        return jsonify({"ok": True, "item": entry.to_admin_dict()})

    @app.patch("/api/admin/submissions/<sid>")
    @require_admin
    def admin_edit(sid):
        """Edit fields (works on pending or published). Only provided keys change."""
        entry = db.session.get(Resource, sid)
        if not entry:
            return jsonify({"error": "No encontrado."}), 404
        data = request.get_json(silent=True) or {}
        if "category" in data:
            if data["category"] not in Resource.CATEGORIES:
                return jsonify({"error": "Categoría no válida."}), 400
            entry.category = data["category"]
        if "verified" in data:
            entry.verified = bool(data["verified"])
        if ("date" in data and not valid_iso_date(data.get("date"))) or (
            "dateEnd" in data and not valid_iso_date(data.get("dateEnd"))
        ):
            return jsonify({"error": "Fecha no válida."}), 400
        new_start = data["date"] if "date" in data else entry.event_date
        new_end = data["dateEnd"] if "dateEnd" in data else entry.event_end_date
        if not valid_date_range(new_start, new_end):
            return jsonify({"error": "La fecha de fin no puede ser anterior a la de inicio."}), 400
        if "image" in data and not valid_image_url(data.get("image")):
            return jsonify({"error": "La imagen debe ser un enlace http(s) válido."}), 400
        field_map = {
            "title": "title",
            "desc": "description",
            "url": "url",
            "phone": "phone",
            "city": "city",
            "country": "country",
            "date": "event_date",
            "dateEnd": "event_end_date",
            "image": "image_url",
            "contact": "contact",
        }
        loc_changed = "city" in data or "country" in data
        for key, attr in field_map.items():
            if key in data:
                value = (data[key] or "").strip()
                setattr(entry, attr, value or None)
        # Keep the normalized duplicate-check columns in sync with their source field.
        if "url" in data:
            entry.url_norm = normalize_url(entry.url) or None
        if "phone" in data:
            entry.phone_digits = only_digits(entry.phone) or None
        if "lat" in data or "lng" in data:
            entry.lat, entry.lng = valid_coords(data.get("lat"), data.get("lng")) or (None, None)
        elif loc_changed:
            coords = geocode(entry.city, entry.country)
            entry.lat, entry.lng = coords if coords else (None, None)
        record_log("edit", entry)
        db.session.commit()
        broker.publish({"scopes": [entry.status]})
        return jsonify({"ok": True, "item": entry.to_admin_dict()})

    # ---- admin user management ----
    @app.get("/api/admin/admins")
    @require_admin
    def list_admins():
        admins = AdminUser.query.order_by(AdminUser.created_at.asc()).all()
        return jsonify({
            "items": [
                {
                    "id": a.id,
                    "email": a.email,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                    "isSelf": a.email == g.admin_email,
                }
                for a in admins
            ]
        })

    @app.post("/api/admin/admins")
    @require_admin
    def create_admin():
        data = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""
        if not valid_email(email):
            return jsonify({"error": "Correo no válido."}), 400
        if len(password) < 8:
            return jsonify({"error": "La contraseña debe tener al menos 8 caracteres."}), 400
        if AdminUser.query.filter_by(email=email).first():
            return jsonify({"error": "Ya existe un administrador con ese correo."}), 409
        admin = AdminUser(email=email, password_hash=generate_password_hash(password))
        db.session.add(admin)
        record_action("admin_add", label=email, category="admin")
        db.session.commit()
        return jsonify({"ok": True, "id": admin.id, "email": admin.email}), 201

    @app.post("/api/admin/admins/<int:aid>/delete")
    @require_admin
    def delete_admin(aid):
        admin = db.session.get(AdminUser, aid)
        if not admin:
            return jsonify({"error": "No encontrado."}), 404
        if admin.email == g.admin_email:
            return jsonify({"error": "No puedes eliminar tu propia cuenta."}), 400
        if AdminUser.query.count() <= 1:
            return jsonify({"error": "Debe quedar al menos un administrador."}), 400
        record_action("admin_remove", label=admin.email, category="admin")
        db.session.delete(admin)
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/admin/change-password")
    @require_admin
    @limiter.limit("10 per minute")
    def change_password():
        data = request.get_json(silent=True) or {}
        current = data.get("current_password") or ""
        new = data.get("new_password") or ""
        user = AdminUser.query.filter_by(email=g.admin_email).first()
        if not user:
            return jsonify({"error": "Sesión inválida."}), 401
        if not check_password_hash(user.password_hash, current):
            return jsonify({"error": "La contraseña actual es incorrecta."}), 400
        if len(new) < 8:
            return jsonify({"error": "La nueva contraseña debe tener al menos 8 caracteres."}), 400
        user.password_hash = generate_password_hash(new)
        record_action("password", label=g.admin_email, category="cuenta")
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/admin/geocode-missing")
    @require_admin
    def geocode_missing():
        """Backfill coordinates for published entries that have a place but no
        lat/lng yet. Throttled to respect Nominatim's ~1 req/sec policy."""
        rows = Resource.query.filter(
            Resource.status == "published",
            Resource.lat.is_(None),
            db.or_(Resource.city.isnot(None), Resource.country.isnot(None)),
        ).all()
        updated = 0
        for r in rows:
            coords = geocode(r.city, r.country)
            if coords:
                r.lat, r.lng = coords
                updated += 1
                db.session.commit()
            time.sleep(1)
        if updated:
            record_action("geocode", label=f"{updated} ubicaciones", category="mapa")
            db.session.commit()
        return jsonify({"ok": True, "updated": updated, "scanned": len(rows)})

    @app.post("/api/admin/gallery")
    @require_admin
    def add_gallery_photo():
        data = request.get_json(silent=True) or {}
        image = (data.get("image") or "").strip()
        if not valid_image_url(image) or not image:
            return jsonify({"error": "La imagen debe ser un enlace http(s) válido."}), 400
        caption = (data.get("caption") or "").strip()[:280] or None
        photo = GalleryPhoto(image_url=image, caption=caption)
        db.session.add(photo)
        record_action("gallery_add", label=caption or "Foto de galería", category="galeria")
        db.session.commit()
        return jsonify({"ok": True, "item": photo.to_dict()}), 201

    @app.post("/api/admin/gallery/<int:pid>/delete")
    @require_admin
    def delete_gallery_photo(pid):
        photo = db.session.get(GalleryPhoto, pid)
        if not photo:
            return jsonify({"error": "No encontrado."}), 404
        record_action("gallery_remove", label=photo.caption or "Foto de galería", category="galeria")
        db.session.delete(photo)
        db.session.commit()
        return jsonify({"ok": True})

    @app.get("/api/admin/activity")
    @require_admin
    def admin_activity():
        logs = (
            ModerationLog.query.order_by(ModerationLog.created_at.desc()).limit(100).all()
        )
        return jsonify({"items": [l.to_dict() for l in logs]})

    # ---- Federation partner API keys (managed from the admin panel) ----
    @app.get("/api/admin/partner-keys")
    @require_admin
    def list_partner_keys():
        keys = PartnerKey.query.order_by(PartnerKey.created_at.desc()).all()
        return jsonify({"items": [k.to_dict() for k in keys]})

    @app.post("/api/admin/partner-keys")
    @require_admin
    def create_partner_key():
        data = request.get_json(silent=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Ponle un nombre a la app/socio."}), 400
        if len(name) > 120:
            return jsonify({"error": "El nombre es demasiado largo (máx. 120 caracteres)."}), 400
        raw, sha, prefix = generate_partner_key()
        key = PartnerKey(name=name, key_sha256=sha, key_prefix=prefix, active=True)
        db.session.add(key)
        record_action("apikey-create", label=name, category="red")
        db.session.commit()
        # The plaintext key is returned exactly once and never stored.
        return jsonify({"ok": True, "key": raw, "item": key.to_dict()}), 201

    @app.post("/api/admin/partner-keys/<int:kid>/revoke")
    @require_admin
    def revoke_partner_key(kid):
        key = db.session.get(PartnerKey, kid)
        if not key:
            return jsonify({"error": "No encontrado."}), 404
        key.active = False
        record_action("apikey-revoke", label=key.name, category="red")
        db.session.commit()
        return jsonify({"ok": True, "item": key.to_dict()})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5001)),
        debug=True,
        threaded=True,
    )
