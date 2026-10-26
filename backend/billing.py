"""Server-owned prices and captured-payment entitlements (manual monthly renewal)."""
import base64
import calendar
import hashlib
import hmac
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from flask import Blueprint, jsonify, request, current_app
from database import db
from models import BillingOrder, User

PLANS = json.loads(Path(__file__).with_name('data').joinpath('plans.json').read_text())
BY_ID = {p['id']: p for p in PLANS}

def entitlement(user_id):
    store = current_app.extensions.get('supabase_store')
    if store:
        return BY_ID[store.call('entitlement',user_id=user_id)['plan']]
    order = db.session.query(BillingOrder).filter(BillingOrder.user_id == user_id, BillingOrder.paid_until > datetime.now(timezone.utc)).order_by(BillingOrder.created_at.desc()).first()
    return BY_ID[order.plan_id] if order else BY_ID['free']

def gateway(path, payload=None):
    token = base64.b64encode((os.environ['RAZORPAY_KEY_ID']+':'+os.environ['RAZORPAY_KEY_SECRET']).encode()).decode()
    req = Request('https://api.razorpay.com/v1/'+path, data=json.dumps(payload).encode() if payload is not None else None, headers={'Authorization':'Basic '+token,'Content-Type':'application/json'})
    with urlopen(req, timeout=20) as response:
        return json.load(response)

def init_billing(app):
    routes = Blueprint('billing', __name__)
    auth = app.extensions['site_auth']
    store = app.extensions.get('supabase_store')
    origins = app.config['AUTH_ALLOWED_ORIGINS']
    def ready():
        return bool(os.getenv('RAZORPAY_KEY_ID') and os.getenv('RAZORPAY_KEY_SECRET') and ('sqlalchemy' in app.extensions or store) and app.config['AUTH_MODE'] != 'demo')

    @routes.before_request
    def boundary():
        if request.path.endswith('/webhook'):
            return None
        origin = request.headers.get('Origin')
        if (origin and origin not in origins) or (request.method == 'POST' and origin not in origins):
            return jsonify(message='Untrusted origin.'), 403
        if request.method == 'OPTIONS':
            return '', 204

    @routes.after_request
    def cors(response):
        response.headers['Cache-Control'] = 'no-store'
        if request.headers.get('Origin') in origins:
            response.headers['Access-Control-Allow-Origin'] = request.headers['Origin']
            response.headers['Access-Control-Allow-Credentials'] = 'true'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-CSRF-Token'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.vary.add('Origin')
        return response

    @routes.get('/api/billing/plans')
    def plans():
        return jsonify(plans=PLANS, checkoutEnabled=ready(), renewal='manual-monthly')

    @routes.get('/api/admin/billing')
    @auth['authenticated']('admin')
    def admin(record):
        if store:
            rows = store.call('orders')
            return jsonify(plans=PLANS,checkoutEnabled=ready(),orders=[{'id':o['id'],'plan':o['plan_id'],'amount':o['amount'],'status':'paid' if o['payment_id'] else 'pending','paidUntil':o['paid_until']} for o in rows])
        rows = db.session.query(BillingOrder).order_by(BillingOrder.created_at.desc()).limit(100).all() if 'sqlalchemy' in app.extensions else []
        return jsonify(plans=PLANS, checkoutEnabled=ready(), orders=[{'id':o.id,'plan':o.plan_id,'amount':o.amount,'status':'paid' if o.payment_id else 'pending','paidUntil':o.paid_until.isoformat() if o.paid_until else None} for o in rows])

    @routes.post('/api/billing/orders')
    @auth['authenticated']('user')
    def create(record):
        if not ready():
            return jsonify(message='Payments are not configured yet.'), 503
        payload = request.get_json(silent=True)
        plan = BY_ID.get(payload.get('planId')) if isinstance(payload, dict) and isinstance(payload.get('planId'), str) else None
        if not plan or not plan['price']:
            return jsonify(message='Choose a paid plan.'), 400
        try:
            order = gateway('orders', {'amount':plan['price']*100,'currency':'INR','receipt':uuid.uuid4().hex})
        except (OSError, ValueError):
            return jsonify(message='Payment gateway is unavailable. Please retry.'), 502
        if store:
            store.call('order_create',id=order['id'],user_id=record['user']['id'],plan_id=plan['id'],amount=plan['price']*100)
        else:
            db.session.add(BillingOrder(id=order['id'],user_id=uuid.UUID(record['user']['id']),plan_id=plan['id'],amount=plan['price']*100))
            db.session.commit()
        return jsonify(orderId=order['id'],amount=plan['price']*100,currency='INR',keyId=os.environ['RAZORPAY_KEY_ID'])

    def activate(order_id, payment_id, user_id=None):
        if store:
            order = store.call('order_get',id=order_id)
            if not order or (user_id and order['user_id'] != user_id):
                return jsonify(message='Order not found.'),404
            if order['payment_id']:
                return (jsonify(success=True,plan=order['plan_id']) if order['payment_id']==payment_id else (jsonify(message='Order already settled.'),409))
            try:
                payment = gateway('payments/'+payment_id)
            except (OSError,ValueError):
                return jsonify(message='Payment verification unavailable. Retry verification.'),502
            if payment.get('order_id') != order['id'] or payment.get('amount') != order['amount'] or payment.get('currency') != 'INR' or payment.get('status') != 'captured':
                return jsonify(message='Payment is not captured. Your plan has not changed.'),409
            value = store.call('order_activate',id=order_id,payment_id=payment_id)
            return (jsonify(message=value['error']),value['status']) if value.get('error') else jsonify(success=True,**value)
        order = db.session.get(BillingOrder, order_id)
        if not order or (user_id and str(order.user_id) != user_id):
            return jsonify(message='Order not found.'), 404
        db.session.query(User).filter_by(id=order.user_id).with_for_update().one()
        db.session.refresh(order)
        if order.payment_id:
            if order.payment_id != payment_id:
                return jsonify(message='Order already settled.'), 409
            return jsonify(success=True, plan=order.plan_id)
        try:
            payment = gateway('payments/'+payment_id)
        except (OSError, ValueError):
            return jsonify(message='Payment verification unavailable. Retry verification.'), 502
        if payment.get('order_id') != order.id or payment.get('amount') != order.amount or payment.get('currency') != 'INR' or payment.get('status') != 'captured':
            return jsonify(message='Payment is not captured. Your plan has not changed.'), 409
        now = datetime.now(timezone.utc)
        previous = db.session.query(BillingOrder).filter_by(user_id=order.user_id, plan_id=order.plan_id).filter(BillingOrder.paid_until > now).order_by(BillingOrder.paid_until.desc()).first()
        start = previous.paid_until.replace(tzinfo=timezone.utc) if previous else now
        year, month = (start.year+1, 1) if start.month == 12 else (start.year, start.month+1)
        order.paid_until = start.replace(year=year, month=month, day=min(start.day, calendar.monthrange(year, month)[1]))
        order.payment_id = payment_id
        db.session.commit()
        return jsonify(success=True, plan=order.plan_id, paidUntil=order.paid_until.isoformat())

    @routes.post('/api/billing/verify')
    @auth['authenticated']('user')
    def verify(record):
        if not ready():
            return jsonify(message='Payments are not configured.'), 503
        data = request.get_json(silent=True)
        if not isinstance(data, dict) or not all(isinstance(data.get(k),str) for k in ('razorpay_order_id','razorpay_payment_id','razorpay_signature')):
            return jsonify(message='Invalid payment response.'), 400
        oid, pid = data['razorpay_order_id'], data['razorpay_payment_id']
        if not re.fullmatch(r'order_[A-Za-z0-9]+',oid) or not re.fullmatch(r'pay_[A-Za-z0-9]+',pid) or not re.fullmatch(r'[0-9a-f]{64}', data['razorpay_signature']):
            return jsonify(message='Invalid payment identifiers.'), 400
        expected = hmac.new(os.environ['RAZORPAY_KEY_SECRET'].encode(), (oid+'|'+pid).encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, data['razorpay_signature']):
            return jsonify(message='Invalid payment signature.'), 400
        return activate(oid,pid,record['user']['id'])

    @routes.post('/api/billing/webhook')
    def webhook():
        secret = os.getenv('RAZORPAY_WEBHOOK_SECRET')
        if not ready() or not secret:
            return jsonify(message='Webhook is not configured.'), 503
        expected = hmac.new(secret.encode(),request.get_data(),hashlib.sha256).hexdigest()
        supplied = request.headers.get('X-Razorpay-Signature','')
        if not re.fullmatch(r'[0-9a-f]{64}', supplied) or not hmac.compare_digest(expected,supplied):
            return jsonify(message='Invalid signature.'), 400
        data = request.get_json(silent=True) or {}
        if data.get('event') == 'payment.captured':
            entity = data.get('payload',{}).get('payment',{}).get('entity',{})
            if not entity.get('order_id') or not (store.call('order_get',id=entity['order_id']) if store else db.session.get(BillingOrder, entity['order_id'])):
                return jsonify(success=True, ignored=True)
            return activate(entity.get('order_id'),entity.get('id'))
        return jsonify(success=True)

    app.register_blueprint(routes)
