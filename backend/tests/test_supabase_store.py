import io
import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch
import jwt
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from supabase_store import SupabaseStore


class SupabaseStoreTests(unittest.TestCase):
    def test_project_origin_and_backend_key_are_required(self):
        for url in ['http://project.supabase.co','https://project.supabase.co.evil.example','https://user:pass@project.supabase.co','https://project.supabase.co/path']:
            with self.assertRaises(ValueError):SupabaseStore(url,'sb_secret_test')
        for key in ['sb_publishable_test',jwt.encode({'role':'anon'},'test-only-key-with-at-least-32-bytes',algorithm='HS256')]:
            with self.assertRaises(ValueError):SupabaseStore('https://project.supabase.co',key)

    @patch('supabase_store.urlopen')
    def test_secret_key_remains_in_server_headers_and_rpc_body_is_fixed(self,open_url):
        open_url.return_value=io.BytesIO(b'{"connected":true}')
        client=SupabaseStore('https://project.supabase.co','sb_secret_test')
        self.assertTrue(client.call('ping')['connected'])
        req=open_url.call_args.args[0]
        self.assertNotIn('sb_secret',req.full_url)
        self.assertEqual(req.headers['Apikey'],'sb_secret_test')
        self.assertNotIn('Authorization',req.headers)
        self.assertEqual(json.loads(req.data),{'operation':'ping','arguments':{}})

    @patch('supabase_store.urlopen')
    def test_provider_errors_never_expose_response_secrets(self,open_url):
        open_url.side_effect=HTTPError('https://project.supabase.co',500,'error',{},io.BytesIO(b'{"message":"private details"}'))
        with self.assertRaises(SQLAlchemyError) as error:
            SupabaseStore('https://project.supabase.co','sb_secret_test').call('ping')
        self.assertNotIn('private details',str(error.exception))

    @patch('supabase_store.urlopen')
    def test_duplicate_user_is_mapped_to_existing_signup_conflict(self,open_url):
        open_url.side_effect=HTTPError('https://project.supabase.co',400,'error',{},io.BytesIO(b'{"code":"23505"}'))
        with self.assertRaises(IntegrityError):
            SupabaseStore('https://project.supabase.co','sb_secret_test').call('user_create')
