"""Remove only the isolated browser-test identity and its visitor activity."""
import json
import re
import sys
import uuid
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from app import create_app
from database import db
from models import PageVisit, User

fixture = json.loads((root.parent / 'frontend/logs/site-operations-fixture.json').read_text(encoding='utf-8'))
assert re.fullmatch(r'ops-browser-\d+@example\.com', fixture['email'])
ids = [uuid.UUID(value) for value in fixture['visitIds']]
app = create_app()
with app.app_context():
    user = db.session.query(User).filter_by(email=fixture['email'], role='user').one_or_none()
    if user:
        assert user.check_password('Browser-only-long-password!2026')
    rows = db.session.query(PageVisit).filter(PageVisit.id.in_(ids)).all() if ids else []
    if user:
        rows += db.session.query(PageVisit).filter_by(user_id=user.id).all()
    hashes = {row.visitor_hash for row in rows}
    count = db.session.query(PageVisit).filter(PageVisit.visitor_hash.in_(hashes)).delete(synchronize_session=False) if hashes else 0
    if user:
        db.session.delete(user)
    db.session.commit()
    print(f'Cleaned {count} isolated browser-test visits and its test account. Administrator and other visitors unchanged.')
