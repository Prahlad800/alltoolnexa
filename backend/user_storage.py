"""Authenticated private file storage; quota changes serialize on the owner row."""
import io
import re
import uuid
from flask import Blueprint, jsonify, request, send_file
from sqlalchemy import func
from werkzeug.exceptions import RequestEntityTooLarge
from database import db
from models import User, UserFile

QUOTA_BYTES = 50_000_000
MAX_FILE_BYTES = 2_000_000

def init_user_storage(app):
    routes = Blueprint('user_storage', __name__)
    auth = app.extensions['site_auth']
    origins = set(app.config['AUTH_ALLOWED_ORIGINS'])
    def fail(message, status):
        return jsonify(success=False, message=message), status

    @routes.before_request
    def boundary():
        if 'sqlalchemy' not in app.extensions or app.config['AUTH_MODE'] == 'demo':
            return fail('Cloud storage requires database accounts.', 503)
        origin = request.headers.get('Origin')
        if origin and origin not in origins:
            return fail('Origin is not allowed.', 403)
        if request.method == 'OPTIONS':
            return '', 204
        if request.method != 'GET' and origin not in origins:
            return fail('A trusted application origin is required.', 403)
        # Keep the smaller global auth limit; enlarge only the authenticated upload route.
        if request.endpoint == 'user_storage.upload':
            request.max_content_length = MAX_FILE_BYTES + 65536

    @routes.after_request
    def headers(response):
        response.headers['Cache-Control'] = 'no-store'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        origin = request.headers.get('Origin')
        if origin in origins:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.vary.add('Origin')
        return response

    @routes.errorhandler(RequestEntityTooLarge)
    def too_large(error):
        return fail('Each file must be no larger than 2 MB.', 413)

    def owner_id(record):
        return uuid.UUID(record['user']['id'])

    def used(user_id):
        return db.session.query(func.coalesce(func.sum(UserFile.size_bytes), 0)).filter(UserFile.user_id == user_id).scalar()

    @routes.get('/api/user/storage')
    @auth['authenticated']('user')
    def listing(record):
        user_id = owner_id(record)
        try:
            page = max(1, int(request.args.get('page', '1')))
        except ValueError:
            return fail('Invalid page.', 400)
        base = db.session.query(UserFile).filter_by(user_id=user_id)
        count = base.count()
        files = base.order_by(UserFile.created_at.desc(), UserFile.id).offset((page-1)*25).limit(25).all()
        return jsonify(success=True, plan='Free', quotaBytes=QUOTA_BYTES, maxFileBytes=MAX_FILE_BYTES, usedBytes=used(user_id), fileCount=count,
                       files=[{'id':str(f.id), 'name':f.name, 'sizeBytes':f.size_bytes, 'createdAt':f.created_at.isoformat()} for f in files],
                       pagination={'page':page,'hasMore':page*25<count})

    @routes.post('/api/user/storage/upload')
    @auth['authenticated']('user')
    def upload(record):
        files = request.files.getlist('file')
        if len(files) != 1 or len(request.files) != 1:
            return fail('Choose one file to upload.', 400)
        incoming = files[0]
        name = re.sub(r'[\x00-\x1f\x7f]', '', (incoming.filename or '').replace('\\', '/').rsplit('/', 1)[-1]).strip()[:255]
        if not name:
            return fail('A filename is required.', 400)
        content = incoming.stream.read(MAX_FILE_BYTES+1)
        if not content:
            return fail('Empty files cannot be uploaded.', 400)
        if len(content) > MAX_FILE_BYTES:
            return fail('Each file must be no larger than 2 MB.', 413)
        user_id = owner_id(record)
        # PostgreSQL row lock prevents concurrent uploads from exceeding the quota.
        db.session.query(User).filter_by(id=user_id).with_for_update().one()
        if used(user_id)+len(content) > QUOTA_BYTES:
            return fail('Your 50 MB storage is full. Delete a file to free space.', 409)
        file = UserFile(user_id=user_id, name=name, size_bytes=len(content), content=content)
        db.session.add(file)
        db.session.commit()
        return jsonify(success=True, id=str(file.id)), 201

    @routes.get('/api/user/storage/files/<uuid:file_id>')
    @auth['authenticated']('user')
    def download(record, file_id):
        file = db.session.query(UserFile).filter_by(id=file_id, user_id=owner_id(record)).first()
        if not file:
            return fail('File not found.', 404)
        return send_file(io.BytesIO(file.content), mimetype='application/octet-stream', as_attachment=True, download_name=file.name, max_age=0)

    @routes.post('/api/user/storage/files/<uuid:file_id>/delete')
    @auth['authenticated']('user')
    def delete(record, file_id):
        user_id = owner_id(record)
        db.session.query(User).filter_by(id=user_id).with_for_update().one()
        count = db.session.query(UserFile).filter_by(id=file_id, user_id=user_id).delete(synchronize_session=False)
        if not count:
            return fail('File not found.', 404)
        db.session.commit()
        return jsonify(success=True)

    app.register_blueprint(routes)
