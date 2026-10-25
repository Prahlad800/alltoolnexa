import io
import unittest
from unittest.mock import patch
from database import db
from models import UserFile
import test_jwt_auth as auth_tests
from user_storage import QUOTA_BYTES, MAX_FILE_BYTES

class UserStorageTests(unittest.TestCase):
    setUp=auth_tests.JWTDatabaseTests.setUp
    tearDown=auth_tests.JWTDatabaseTests.tearDown
    def signup(self,email='storage@example.com'):
        result=self.client.post('/api/auth/signup',json={'email':email,'password':'Abc123!x'},headers=auth_tests.ORIGIN)
        self.assertEqual(result.status_code,201)
        self.user_id=result.json['user']['id']
        return {**auth_tests.ORIGIN,'X-CSRF-Token':result.json['csrfToken']}
    def upload(self,headers,content=b'private file',name='test.txt'):
        return self.client.post('/api/user/storage/upload',data={'file':(io.BytesIO(content),name)},headers=headers)
    def test_private_lifecycle_csrf_and_account_isolation(self):
        self.assertEqual(self.client.get('/api/user/storage').status_code,401)
        headers=self.signup()
        self.assertEqual(self.upload(auth_tests.ORIGIN).status_code,403)
        result=self.upload(headers,name='../../private.txt')
        self.assertEqual(result.status_code,201)
        file_id=result.json['id']
        listing=self.client.get('/api/user/storage').json
        self.assertEqual(listing['quotaBytes'],50_000_000)
        self.assertEqual(listing['maxFileBytes'],2_000_000)
        self.assertEqual(listing['usedBytes'],12)
        self.assertEqual(listing['files'][0]['name'],'private.txt')
        self.assertNotIn('content',listing['files'][0])
        response=self.client.get('/api/user/storage/files/'+file_id)
        self.assertEqual(response.data,b'private file')
        self.assertIn('attachment',response.headers['Content-Disposition'])
        self.assertEqual(response.headers['Cache-Control'],'no-store')
        self.assertEqual(response.headers['X-Content-Type-Options'],'nosniff')
        other=self.app.test_client()
        signup=other.post('/api/auth/signup',json={'email':'other@example.com','password':'Abc123!y'},headers=auth_tests.ORIGIN)
        other_headers={**auth_tests.ORIGIN,'X-CSRF-Token':signup.json['csrfToken']}
        self.assertEqual(other.get('/api/user/storage').json['fileCount'],0)
        self.assertEqual(other.get('/api/user/storage/files/'+file_id).status_code,404)
        self.assertEqual(other.post('/api/user/storage/files/'+file_id+'/delete',json={},headers=other_headers).status_code,404)
        self.assertEqual(self.client.post('/api/user/storage/files/'+file_id+'/delete',json={},headers=auth_tests.ORIGIN).status_code,403)
        self.assertEqual(self.client.post('/api/user/storage/files/'+file_id+'/delete',json={},headers=headers).status_code,200)
        self.assertEqual(self.client.get('/api/user/storage').json['usedBytes'],0)
        self.assertEqual(self.client.get('/api/user/storage/files/'+file_id).status_code,404)
    def test_file_and_request_limits(self):
        headers=self.signup()
        self.assertEqual(self.upload(headers,content=b'').status_code,400)
        self.assertEqual(self.upload(headers,content=b'x'*(MAX_FILE_BYTES+1)).status_code,413)
        self.assertEqual(self.upload(headers,content=b'x'*(MAX_FILE_BYTES+100000)).status_code,413)
        self.assertEqual(self.client.get('/api/user/storage').json['fileCount'],0)
        self.assertEqual(self.upload(headers,content=b'x'*MAX_FILE_BYTES).status_code,201)
        self.assertEqual(self.client.get('/api/user/storage').json['usedBytes'],MAX_FILE_BYTES)
    def test_quota_boundary_and_reclaimed_space(self):
        headers=self.signup()
        # A smaller quota exercises exact boundary behavior without a 50 MB fixture.
        with patch('user_storage.QUOTA_BYTES',20):
            first=self.upload(headers,content=b'x'*12).json['id']
            self.assertEqual(self.upload(headers,content=b'y'*8).status_code,201)
            self.assertEqual(self.upload(headers,content=b'z').status_code,409)
            self.assertEqual(self.client.get('/api/user/storage').json['usedBytes'],20)
            self.client.post('/api/user/storage/files/'+first+'/delete',json={},headers=headers)
            self.assertEqual(self.upload(headers,content=b'z'*12).status_code,201)
        self.assertEqual(QUOTA_BYTES,50_000_000)
    def test_block_untrusted_origin_and_malformed_page(self):
        headers=self.signup()
        self.assertEqual(self.upload({**headers,'Origin':'https://evil.example'}).status_code,403)
        self.assertEqual(self.client.get('/api/user/storage?page=nope').status_code,400)
        self.assertEqual(db.session.query(UserFile).count(),0)
