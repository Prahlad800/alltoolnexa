"""Exercise the HTTPS adapter's RPC transactions on PostgreSQL, always rolled back."""
import base64
import hashlib
import hmac
import io
import json
import os
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from werkzeug.security import generate_password_hash
from app import create_app
from database import db, database_options
import models  # Register every table before creating the isolated PostgreSQL fixture.

ORIGIN = {'Origin':'http://localhost:3000'}
ADMIN_ORIGIN = {'Origin':'http://localhost:3001'}


class TransactionStore:
    def __init__(self, connection):
        self.connection = connection
    def call(self, operation, **arguments):
        return self.connection.execute(text('SELECT public.alltoolnexa_backend(:op,CAST(:args AS jsonb))'), {'op':operation,'args':json.dumps(arguments,default=str)}).scalar()


@unittest.skipUnless(os.getenv('TEST_SUPABASE_RPC_DATABASE_URL'), 'Set TEST_SUPABASE_RPC_DATABASE_URL for PostgreSQL RPC tests')
class SupabaseRPCTests(unittest.TestCase):
    def setUp(self):
        url=database_options(os.environ['TEST_SUPABASE_RPC_DATABASE_URL'])['SQLALCHEMY_DATABASE_URI']
        if url.host in {'127.0.0.1','localhost'}:
            url=url.update_query_dict({'sslmode':'disable'})
        self.engine = create_engine(url,hide_parameters=True)
        self.connection = self.engine.connect()
        self.transaction = self.connection.begin()
        self.addCleanup(self.engine.dispose)
        self.addCleanup(self.connection.close)
        self.addCleanup(self.transaction.rollback)
        self.connection.execute(text('CREATE SCHEMA IF NOT EXISTS alltoolnexa_private'))
        for role in ('anon','authenticated','service_role'):
            if not self.connection.execute(text('SELECT 1 FROM pg_roles WHERE rolname=:name'),{'name':role}).scalar():
                self.connection.execute(text('CREATE ROLE '+role))
        db.metadata.create_all(self.connection)
        sql=Path(__file__).parents[1].joinpath('migrations/supabase_backend.sql').read_text()
        self.connection.execute(text(sql))
        self.connection.execute(text("SELECT set_config('request.jwt.claims',:claims,true)"),{'claims':'{"role":"service_role"}'})
        self.store = TransactionStore(self.connection)
        with patch.dict(os.environ,{'DATABASE_URL':'','DATABASE_TRANSPORT':'supabase'}), patch('supabase_store.SupabaseStore',return_value=self.store):
            self.app=create_app({'TESTING':True,'AUTH_MODE':'database','JWT_SECRET_KEY':'test-only-secret-at-least-32-bytes-long','AUTH_COOKIE_SECURE':False,'AUTH_ALLOWED_ORIGINS':['http://localhost:3000','http://localhost:3001']})
        self.client=self.app.test_client()
        self.admin_id=str(uuid.uuid4())
        self.admin_email='rpc-admin-'+uuid.uuid4().hex+'@example.com'
        self.connection.execute(text("INSERT INTO alltoolnexa_private.users(id,email,password_hash,role) VALUES(CAST(:id AS uuid),:email,:hash,'admin')"),{'id':self.admin_id,'email':self.admin_email,'hash':generate_password_hash('Test-password!')})

    def signup(self,client=None):
        client=client or self.client
        result=client.post('/api/auth/signup',json={'email':'rpc-'+uuid.uuid4().hex+'@example.com','password':'Test-password!'},headers=ORIGIN)
        self.assertEqual(result.status_code,201,result.json)
        return {**ORIGIN,'X-CSRF-Token':result.json['csrfToken']}

    def admin(self):
        result=self.client.post('/api/admin/login',json={'email':self.admin_email,'password':'Test-password!'},headers=ADMIN_ORIGIN)
        self.assertEqual(result.status_code,200,result.json)
        return {**ADMIN_ORIGIN,'X-CSRF-Token':result.json['csrfToken']}

    def test_auth_storage_isolation_and_revocation(self):
        self.assertEqual(self.client.get('/api/health/database').json['transport'],'supabase-https')
        headers=self.signup()
        self.assertEqual(self.client.get('/api/auth/session').status_code,200)
        upload=self.client.post('/api/user/storage/upload',data={'file':(io.BytesIO(b'RPC private file'),'private.txt')},headers=headers)
        self.assertEqual(upload.status_code,201,upload.json)
        file_id=upload.json['id']
        self.assertEqual(self.client.get('/api/user/storage').json['usedBytes'],16)
        self.assertEqual(self.client.get('/api/user/storage/files/'+file_id).data,b'RPC private file')
        other=self.app.test_client();self.signup(other)
        self.assertEqual(other.get('/api/user/storage/files/'+file_id).status_code,404)
        self.assertEqual(self.client.post('/api/user/storage/files/'+file_id+'/delete',json={},headers=headers).status_code,200)
        self.assertEqual(self.client.post('/api/auth/logout',json={},headers=headers).status_code,200)
        self.assertEqual(self.client.get('/api/auth/session').status_code,401)

    def test_controls_analytics_and_recoverable_trash(self):
        self.signup();admin=self.admin()
        tools=self.client.get('/api/admin/controls').json['tools']
        result=self.client.post('/api/admin/controls',json={'kind':'tool','id':tools[0]['id'],'enabled':False},headers=admin)
        self.assertEqual(result.status_code,200,result.json)
        self.assertIn(tools[0]['id'],self.client.get('/api/public/availability').json['disabledTools'])
        started=self.client.post('/api/analytics/start',json={'path':'/rpc-test'},headers=ORIGIN)
        self.assertEqual(started.status_code,201,started.json)
        visit_id=started.json['visitId']
        heartbeat=self.client.post('/api/analytics/heartbeat',json={'visitId':visit_id,'activeSeconds':1},headers=ORIGIN)
        self.assertEqual(heartbeat.status_code,200,heartbeat.json)
        visitor=self.connection.execute(text('SELECT visitor_hash FROM alltoolnexa_private.page_visits WHERE id=CAST(:id AS uuid)'),{'id':visit_id}).scalar()
        report=self.client.get('/api/admin/analytics?visitor='+visitor)
        self.assertEqual(report.status_code,200,report.json)
        self.assertEqual(report.json['summary']['pageViews'],1)
        preview=self.client.post('/api/admin/analytics/delete-preview',json={'range':'1d','visitor':visitor},headers=admin)
        result=self.client.post('/api/admin/analytics/delete',json={'confirmationToken':preview.json['confirmationToken']},headers=admin)
        self.assertEqual(result.json['movedToTrash'],1)
        self.assertTrue(self.client.get('/api/admin/analytics/trash').json['visits'])
        restored=self.client.post('/api/admin/analytics/trash/restore',json={'id':visit_id},headers=admin)
        self.assertEqual(restored.json['restored'],1)

    def test_paid_quota_and_duplicate_capture(self):
        headers=self.signup();order_id='order_'+uuid.uuid4().hex;payment_id='pay_'+uuid.uuid4().hex
        with patch.dict(os.environ,{'RAZORPAY_KEY_ID':'rzp_test_rpc','RAZORPAY_KEY_SECRET':'test-secret'}):
            with patch('billing.gateway',return_value={'id':order_id}):
                created=self.client.post('/api/billing/orders',json={'planId':'basic'},headers=headers)
                self.assertEqual(created.status_code,200,created.json)
            signature=hmac.new(b'test-secret',(order_id+'|'+payment_id).encode(),hashlib.sha256).hexdigest()
            payload={'razorpay_order_id':order_id,'razorpay_payment_id':payment_id,'razorpay_signature':signature}
            with patch('billing.gateway',return_value={'order_id':order_id,'amount':3900,'currency':'INR','status':'captured'}):
                first=self.client.post('/api/billing/verify',json=payload,headers=headers)
                self.assertEqual(first.status_code,200,first.json)
                until=self.store.call('order_get',id=order_id)['paid_until']
                self.assertEqual(self.client.post('/api/billing/verify',json=payload,headers=headers).status_code,200)
                self.assertEqual(self.store.call('order_get',id=order_id)['paid_until'],until)
            self.assertEqual(self.client.get('/api/user/storage').json['quotaBytes'],200000000)
            self.admin()
            self.assertEqual(self.client.get('/api/admin/billing').status_code,200)

    def test_public_database_roles_cannot_execute_rpc(self):
        for role in ('anon','authenticated'):
            allowed=self.connection.execute(text("SELECT has_function_privilege(:role,'public.alltoolnexa_backend(text,jsonb)','EXECUTE')"),{'role':role}).scalar()
            self.assertFalse(allowed)
        savepoint=self.connection.begin_nested()
        try:
            self.connection.execute(text("SELECT set_config('request.jwt.claims',:claims,true)"),{'claims':'{"role":"anon"}'})
            with self.assertRaises(DBAPIError):
                self.store.call('ping')
        finally:
            savepoint.rollback()
