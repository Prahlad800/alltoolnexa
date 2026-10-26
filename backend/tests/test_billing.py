import hashlib
import hmac
import os
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from database import db
from models import BillingOrder
import test_jwt_auth as auth_tests

class BillingTests(unittest.TestCase):
    setUp = auth_tests.JWTDatabaseTests.setUp
    tearDown = auth_tests.JWTDatabaseTests.tearDown

    def test_captured_payment_activates_quota_idempotently_and_expires(self):
        signup = self.client.post('/api/auth/signup',json={'email':'billing@example.com','password':'Abc123!x'},headers=auth_tests.ORIGIN)
        headers = {**auth_tests.ORIGIN,'X-CSRF-Token':signup.json['csrfToken']}
        with patch.dict(os.environ, {'RAZORPAY_KEY_ID':'rzp_test_example','RAZORPAY_KEY_SECRET':'secret','RAZORPAY_WEBHOOK_SECRET':'hook'}):
            self.assertEqual(self.client.post('/api/billing/orders',json={'planId':'basic'},headers=auth_tests.ORIGIN).status_code,403)
            with patch('billing.gateway',return_value={'id':'order_123'}) as gateway:
                response = self.client.post('/api/billing/orders',json={'planId':'basic','amount':1},headers=headers)
                self.assertEqual(response.json['amount'],3900)
                self.assertEqual(gateway.call_args.args[1]['amount'],3900)
            payload = {'razorpay_order_id':'order_123','razorpay_payment_id':'pay_123','razorpay_signature':'bad'}
            self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,400)
            payload['razorpay_signature'] = hmac.new(b'secret',b'order_123|pay_123',hashlib.sha256).hexdigest()
            payment = {'order_id':'order_123','amount':3900,'currency':'INR','status':'authorized'}
            with patch('billing.gateway',return_value=payment):
                self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,409)
                self.assertEqual(self.client.get('/api/user/storage').json['plan'],'Free')
                payment['status']='captured'
                self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,200)
                order = db.session.get(BillingOrder,'order_123')
                until = order.paid_until
                self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,200)
                self.assertEqual(db.session.get(BillingOrder,'order_123').paid_until,until)
            self.assertEqual(self.client.get('/api/user/storage').json['quotaBytes'],200_000_000)
            other = self.app.test_client()
            account = other.post('/api/auth/signup',json={'email':'otherbilling@example.com','password':'Abc123!x'},headers=auth_tests.ORIGIN)
            other_headers = {**auth_tests.ORIGIN,'X-CSRF-Token':account.json['csrfToken']}
            self.assertEqual(other.post('/api/billing/verify',json=payload,headers=other_headers).status_code,404)
            order.paid_until=datetime.now(timezone.utc)-timedelta(days=1)
            db.session.commit()
            self.assertEqual(self.client.get('/api/user/storage').json['plan'],'Free')
            self.assertEqual(self.client.post('/api/billing/webhook',json={'event':'payment.captured'}).status_code,400)

    def test_catalog_and_admin_are_protected(self):
        self.assertEqual([p['price'] for p in self.client.get('/api/billing/plans').json['plans']],[0,39,89,149,199])
        self.assertEqual(self.client.get('/api/admin/billing').status_code,401)
