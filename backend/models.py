import uuid
from sqlalchemy import CheckConstraint, UniqueConstraint, func
from werkzeug.security import check_password_hash, generate_password_hash
from database import SCHEMA, db


class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = (
        UniqueConstraint('email', name='uq_users_email'),
        CheckConstraint('email = lower(trim(email))', name='ck_users_email_normalized'),
        CheckConstraint("role IN ('user', 'admin')", name='ck_users_role'),
        {'schema': SCHEMA},
    )
    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(254), nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    role = db.Column(db.String(16), nullable=False, server_default='user')
    is_active = db.Column(db.Boolean, nullable=False, server_default=db.true())
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, server_default=func.now())

    def set_password(self, password):
        if not isinstance(password, str) or not 12 <= len(password) <= 256:
            raise ValueError('Password must contain 12 to 256 characters.')
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
