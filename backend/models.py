import uuid
from sqlalchemy.orm import deferred
from sqlalchemy import CheckConstraint, UniqueConstraint, func
from werkzeug.security import check_password_hash, generate_password_hash
from database import SCHEMA, db


class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = (
        UniqueConstraint('email', name='uq_users_email'),
        UniqueConstraint('username', name='uq_users_username'),
        CheckConstraint('username IS NULL OR username = lower(trim(username))', name='ck_users_username_normalized'),
        CheckConstraint('email = lower(trim(email))', name='ck_users_email_normalized'),
        CheckConstraint("role IN ('user', 'admin')", name='ck_users_role'),
        {'schema': SCHEMA},
    )
    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(254), nullable=False)
    username = db.Column(db.String(40), nullable=True)
    password_hash = db.Column(db.Text, nullable=False)
    role = db.Column(db.String(16), nullable=False, server_default='user')
    is_active = db.Column(db.Boolean, nullable=False, server_default=db.true())
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    def set_password(self, password):
        minimum = 8
        if not isinstance(password, str) or not minimum <= len(password) <= 256:
            raise ValueError(f'Password must contain {minimum} to 256 characters.')
        self.password_hash = generate_password_hash(password, method='scrypt')

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class AuthSession(db.Model):
    __tablename__ = 'auth_sessions'
    __table_args__ = (
        CheckConstraint('length(token_hash) = 64', name='ck_sessions_hash_length'),
        CheckConstraint('expires_at > created_at', name='ck_sessions_expiry'),
        {'schema': SCHEMA},
    )
    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey(f'{SCHEMA}.users.id', ondelete='CASCADE'), nullable=False, index=True)
    # Store only a SHA-256 digest of a cryptographically random token.
    token_hash = db.Column(db.String(64), nullable=False, unique=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, index=True)


class SiteControl(db.Model):
    __tablename__ = 'site_controls'
    __table_args__ = ({'schema': SCHEMA},)
    key = db.Column(db.String(140), primary_key=True)
    enabled = db.Column(db.Boolean, nullable=False, default=True)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
    updated_by = db.Column(db.Uuid, db.ForeignKey(f'{SCHEMA}.users.id', ondelete='SET NULL'), nullable=True)


class PageVisit(db.Model):
    __tablename__ = 'page_visits'
    __table_args__ = (CheckConstraint('active_seconds >= 0', name='ck_visit_seconds'), {'schema': SCHEMA})
    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    visitor_hash = db.Column(db.String(64), nullable=False, index=True)
    user_id = db.Column(db.Uuid, db.ForeignKey(f'{SCHEMA}.users.id', ondelete='SET NULL'), nullable=True)
    path = db.Column(db.String(240), nullable=False, index=True)
    ip_address = db.Column(db.String(45), nullable=False)
    country = db.Column(db.String(100), nullable=True)
    region = db.Column(db.String(100), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    location_status = db.Column(db.String(20), nullable=False)
    device = db.Column(db.String(20), nullable=False)
    referrer_host = db.Column(db.String(253), nullable=True)
    active_seconds = db.Column(db.Integer, nullable=False, default=0)
    started_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now(), index=True)
    last_seen_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True, index=True)
    restored_at = db.Column(db.DateTime(timezone=True), nullable=True)


class UserFile(db.Model):
    __tablename__ = 'user_files'
    __table_args__ = (CheckConstraint('size_bytes > 0 AND size_bytes <= 1000000000', name='ck_file_size'), {'schema': SCHEMA})
    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    user_id = db.Column(db.Uuid, db.ForeignKey(f'{SCHEMA}.users.id', ondelete='CASCADE'), nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    size_bytes = db.Column(db.Integer, nullable=False)
    content = deferred(db.Column(db.LargeBinary, nullable=False))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())


class BillingOrder(db.Model):
    __tablename__ = 'billing_orders'
    __table_args__ = ({'schema': SCHEMA},)
    id = db.Column(db.String(80), primary_key=True)
    user_id = db.Column(db.Uuid, db.ForeignKey(f'{SCHEMA}.users.id'), nullable=False, index=True)
    plan_id = db.Column(db.String(30), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    payment_id = db.Column(db.String(80), unique=True)
    paid_until = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now(), nullable=False)
