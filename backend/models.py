from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _utcnow():
    return datetime.now(timezone.utc)


class Resource(db.Model):
    """A directory entry. Published rows are visible; pending rows await review."""

    __tablename__ = "resources"

    id = db.Column(db.String(64), primary_key=True)
    category = db.Column(db.String(32), nullable=False, index=True)
    title = db.Column(db.String(280), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    url = db.Column(db.String(2048))
    phone = db.Column(db.String(64))
    city = db.Column(db.String(120))
    country = db.Column(db.String(120))
    event_date = db.Column(db.String(60))
    event_end_date = db.Column(db.String(60))
    image_url = db.Column(db.String(2048))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    moderated_by = db.Column(db.String(255))
    moderated_at = db.Column(db.DateTime(timezone=True))
    moderation_action = db.Column(db.String(20))
    verified = db.Column(db.Boolean, nullable=False, default=False)
    status = db.Column(db.String(20), nullable=False, default="published", index=True)
    contact = db.Column(db.String(280))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow)

    # categories allowed in the directory
    CATEGORIES = ("donaciones", "paginas", "emergencia", "quedadas")

    def to_dict(self):
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "desc": self.description,
            "url": self.url,
            "phone": self.phone,
            "city": self.city,
            "country": self.country,
            "date": self.event_date,
            "dateEnd": self.event_end_date,
            "image": self.image_url,
            "lat": self.lat,
            "lng": self.lng,
            "verified": self.verified,
            "status": self.status,
        }

    def to_admin_dict(self):
        """Adds moderation-only fields the public view never exposes."""
        data = self.to_dict()
        data["contact"] = self.contact
        data["created_at"] = self.created_at.isoformat() if self.created_at else None
        data["moderatedBy"] = self.moderated_by
        data["moderatedAt"] = self.moderated_at.isoformat() if self.moderated_at else None
        data["moderationAction"] = self.moderation_action
        return data


class AdminUser(db.Model):
    """A moderator who can review and publish submissions."""

    __tablename__ = "admin_users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow)


class GalleryPhoto(db.Model):
    """A photo shown in the home hero carousel."""

    __tablename__ = "gallery_photos"

    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(2048), nullable=False)
    caption = db.Column(db.String(280))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow)

    def to_dict(self):
        return {"id": self.id, "image": self.image_url, "caption": self.caption}


class ModerationLog(db.Model):
    """Audit trail: which admin moderated what, and when. Title/category are
    denormalized so the entry survives even if the resource is later deleted."""

    __tablename__ = "moderation_logs"

    id = db.Column(db.Integer, primary_key=True)
    admin_email = db.Column(db.String(255))
    action = db.Column(db.String(20), nullable=False)  # approve | reject | unpublish
    target_id = db.Column(db.String(64))
    target_title = db.Column(db.String(280))
    target_category = db.Column(db.String(32))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=_utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "admin": self.admin_email,
            "action": self.action,
            "title": self.target_title,
            "category": self.target_category,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
