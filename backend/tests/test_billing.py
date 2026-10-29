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

class AnnualBillingTests(unittest.TestCase):
    setUp = auth_tests.JWTDatabaseTests.setUp
    tearDown = auth_tests.JWTDatabaseTests.tearDown

    def signup(self):
        result=self.client.post('/api/auth/signup',json={'email':'annual@example.com','password':auth_tests.PASSWORD},headers=auth_tests.ORIGIN)
        return {**auth_tests.ORIGIN,'X-CSRF-Token':result.json['csrfToken']}

    def test_annual_amounts_are_server_owned_and_cycle_is_validated(self):
        headers=self.signup()
        with patch.dict(os.environ,{'RAZORPAY_KEY_ID':'rzp_test_annual','RAZORPAY_KEY_SECRET':'test-secret'}):
            for i,(plan,price) in enumerate([('basic',349),('pro',949),('premium',1599),('premium-plus',2000)]):
                with patch('billing.gateway',return_value={'id':'order_annual'+str(i)}) as gateway:
                    result=self.client.post('/api/billing/orders',json={'planId':plan,'billingCycle':'yearly','amount':1,'paidUntil':'2099-01-01'},headers=headers)
                    self.assertEqual(result.status_code,200,result.json);self.assertEqual(result.json['amount'],price*100);self.assertEqual(result.json['billingCycle'],'yearly')
                    self.assertEqual(gateway.call_args.args[1]['amount'],price*100);self.assertEqual(db.session.get(BillingOrder,result.json['orderId']).amount,price*100)
            with patch('billing.gateway') as gateway:
                for cycle in ['annual','invalid',None,[],12]:
                    self.assertEqual(self.client.post('/api/billing/orders',json={'planId':'basic','billingCycle':cycle},headers=headers).status_code,400)
                gateway.assert_not_called()

    def test_annual_capture_webhook_idempotency_and_mixed_cycle_renewal(self):
        import json
        from billing import add_calendar_months
        headers=self.signup()
        with patch.dict(os.environ,{'RAZORPAY_KEY_ID':'rzp_test_annual','RAZORPAY_KEY_SECRET':'test-secret','RAZORPAY_WEBHOOK_SECRET':'test-hook'}):
            for cycle,oid,pid,amount in [('yearly','order_annual','pay_annual',34900),('monthly','order_month','pay_month',3900)]:
                with patch('billing.gateway',return_value={'id':oid}):
                    self.assertEqual(self.client.post('/api/billing/orders',json={'planId':'basic','billingCycle':cycle},headers=headers).status_code,200)
                payload={'razorpay_order_id':oid,'razorpay_payment_id':pid,'razorpay_signature':hmac.new(b'test-secret',(oid+'|'+pid).encode(),hashlib.sha256).hexdigest()}
                captured={'order_id':oid,'amount':amount,'currency':'INR','status':'captured'}
                with patch('billing.gateway',return_value={**captured,'amount':1}):
                    self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,409)
                with patch('billing.gateway',return_value=captured):
                    self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,200)
                    until=db.session.get(BillingOrder,oid).paid_until
                    if cycle=='yearly':
                        self.assertGreater((until.replace(tzinfo=timezone.utc)-datetime.now(timezone.utc)).days,363);annual_until=until
                    else:self.assertEqual(until,add_calendar_months(annual_until,1))
                    self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,200);self.assertEqual(db.session.get(BillingOrder,oid).paid_until,until)
                    body=json.dumps({'event':'payment.captured','payload':{'payment':{'entity':{'order_id':oid,'id':pid}}}}).encode()
                    sig=hmac.new(b'test-hook',body,hashlib.sha256).hexdigest()
                    self.assertEqual(self.client.post('/api/billing/webhook',data=body,content_type='application/json',headers={'X-Razorpay-Signature':sig}).status_code,200);self.assertEqual(db.session.get(BillingOrder,oid).paid_until,until)

    def test_calendar_boundaries_include_leap_years(self):
        from billing import add_calendar_months
        self.assertEqual(add_calendar_months(datetime(2024,2,29,tzinfo=timezone.utc),12),datetime(2025,2,28,tzinfo=timezone.utc))
        self.assertEqual(add_calendar_months(datetime(2024,1,31,tzinfo=timezone.utc),1),datetime(2024,2,29,tzinfo=timezone.utc))
        self.assertEqual(add_calendar_months(datetime(2025,12,31,tzinfo=timezone.utc),12),datetime(2026,12,31,tzinfo=timezone.utc))

class LegacyBillingTransportTests(unittest.TestCase):
    def test_legacy_rpc_blocks_yearly_before_payment_and_preserves_monthly(self):
        from flask import Flask
        from functools import wraps
        from unittest.mock import Mock
        from billing import init_billing
        app=Flask(__name__);app.config.update(AUTH_MODE='database',AUTH_ALLOWED_ORIGINS=['http://localhost:3000'])
        def authenticated(scope):
            def decorate(fn):
                @wraps(fn)
                def wrapped(*args,**kwargs):return fn({'user':{'id':'11111111-1111-1111-1111-111111111111'}},*args,**kwargs)
                return wrapped
            return decorate
        app.extensions['site_auth']={'authenticated':authenticated};store=Mock();store.call.side_effect=lambda op,**args:{'connected':True} if op=='ping' else {};app.extensions['supabase_store']=store;init_billing(app);client=app.test_client()
        with patch.dict(os.environ,{'RAZORPAY_KEY_ID':'rzp_test_legacy','RAZORPAY_KEY_SECRET':'test-secret'}):
            self.assertEqual(client.get('/api/billing/plans').json['billingCycles'],['monthly'])
            with patch('billing.gateway') as gateway:
                self.assertEqual(client.post('/api/billing/orders',json={'planId':'basic','billingCycle':'yearly'},headers=auth_tests.ORIGIN).status_code,503);gateway.assert_not_called()
                # A yearly-capable RPC with stale prices must not charge either.
                store.call.side_effect=lambda op,**args:{'connected':True,'billingCycles':['monthly','yearly'],'annualPrices':{'basic':300}} if op=='ping' else {}
                self.assertEqual(client.get('/api/billing/plans').json['billingCycles'],['monthly'])
                self.assertEqual(client.post('/api/billing/orders',json={'planId':'basic','billingCycle':'yearly'},headers=auth_tests.ORIGIN).status_code,503);gateway.assert_not_called()
            with patch('billing.gateway',return_value={'id':'order_monthly'}):
                result=client.post('/api/billing/orders',json={'planId':'basic'},headers=auth_tests.ORIGIN);self.assertEqual(result.status_code,200);self.assertEqual(result.json['amount'],3900)
