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

from events import broker
from geocode import geocode
from models import db, Resource, AdminUser, ModerationLog, GalleryPhoto
from seed_data import SEED

load_dotenv()

DEFAULT_DB = "postgresql+psycopg://vzla:vzla@localhost:5432/venezuelasolidaria"


ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def valid_iso_date(value):
    """True for an empty value or a YYYY-MM-DD string (the date picker's format)."""
    if not value:
        return True
    return bool(ISO_DATE_RE.match(value.strip()))


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
    ]
    for s in stmts:
        db.session.execute(text(s))
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
        resources={r"/api/*": {"origins": [o.strip() for o in origins.split(",")]}},
        allow_headers=["Content-Type", "Authorization"],
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
        items = q.order_by(Resource.created_at.desc()).all()
        return jsonify({"items": [r.to_dict() for r in items]})

    @app.get("/api/resources/<sid>")
    def get_resource(sid):
        """A single published resource — for shareable direct links."""
        entry = db.session.get(Resource, sid)
        if not entry or entry.status != "published":
            return jsonify({"error": "No encontrado."}), 404
        return jsonify(entry.to_dict())

    @app.get("/api/gallery")
    def list_gallery():
        """Public hero-carousel photos, oldest first."""
        photos = GalleryPhoto.query.order_by(GalleryPhoto.created_at.asc()).all()
        return jsonify({"items": [p.to_dict() for p in photos]})

    @app.post("/api/submissions")
    @limiter.limit("5 per minute; 20 per hour")
    def create_submission():
        """Public submission. Stored as a pending resource pending review."""
        data = request.get_json(silent=True) or {}
        category = (data.get("category") or "donaciones").strip()
        title = (data.get("title") or "").strip()
        raw_url = (data.get("url") or "").strip()

        if category not in Resource.CATEGORIES:
            return jsonify({"error": "Categoría no válida."}), 400
        if not title:
            return jsonify({"error": "Agrega un nombre o título para el enlace."}), 400
        if not raw_url:
            return jsonify({"error": "Agrega el enlace (URL) o un teléfono de contacto."}), 400
        # Length caps so a single submission can't store abusive amounts of text.
        if len(title) > 280:
            return jsonify({"error": "El título es demasiado largo (máx. 280 caracteres)."}), 400
        if len(data.get("desc") or "") > 2000:
            return jsonify({"error": "La descripción es demasiado larga (máx. 2000 caracteres)."}), 400
        if len(raw_url) > 2048:
            return jsonify({"error": "El enlace es demasiado largo."}), 400
        if not valid_iso_date(data.get("date")) or not valid_iso_date(data.get("dateEnd")):
            return jsonify({"error": "Fecha no válida."}), 400
        if not valid_date_range(data.get("date"), data.get("dateEnd")):
            return jsonify({"error": "La fecha de fin no puede ser anterior a la de inicio."}), 400
        if not valid_image_url(data.get("image")):
            return jsonify({"error": "La imagen debe ser un enlace http(s) válido."}), 400

        looks_like_phone = bool(re.match(r"^[\d\s()+\-]+$", raw_url)) and not raw_url.lower().startswith("http")
        url = None if looks_like_phone else raw_url
        phone = raw_url if looks_like_phone else None

        n = normalize_url(raw_url)
        digits = only_digits(raw_url)

        # Reject duplicates — but ignore archived (rejected) entries so a rejected
        # link can be resubmitted.
        for r in Resource.query.filter(Resource.status != "rejected").all():
            if r.url and normalize_url(r.url) == n and n:
                if r.status == "pending":
                    return jsonify({"error": "Este enlace ya fue enviado y está en revisión."}), 409
                return jsonify({"error": "Este enlace o contacto ya está publicado en el directorio."}), 409
            if r.phone and digits and only_digits(r.phone) == digits:
                return jsonify({"error": "Este enlace o contacto ya está publicado en el directorio."}), 409

        entry = Resource(
            id=secrets.token_hex(8),
            category=category,
            title=title,
            description=(data.get("desc") or "").strip(),
            url=url,
            phone=phone,
            city=(data.get("city") or "").strip() or None,
            country=(data.get("country") or "").strip() or None,
            event_date=(data.get("date") or "").strip() or None,
            event_end_date=(data.get("dateEnd") or "").strip() or None,
            image_url=(data.get("image") or "").strip() or None,
            contact=(data.get("contact") or "").strip() or None,
            verified=False,
            status="pending",
        )
        # Prefer exact coordinates from the location picker; otherwise geocode.
        picked = valid_coords(data.get("lat"), data.get("lng"))
        if picked:
            entry.lat, entry.lng = picked
        else:
            coords = geocode(entry.city, entry.country)
            if coords:
                entry.lat, entry.lng = coords
        db.session.add(entry)
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
        """List entries by status (default: pending submissions awaiting review)."""
        status = request.args.get("status", "pending")
        items = (
            Resource.query.filter_by(status=status)
            .order_by(Resource.created_at.desc())
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

    return app


app = create_app()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5001)),
        debug=True,
        threaded=True,
    )
