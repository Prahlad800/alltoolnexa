"""Premium UI catalogs; free English/Hindi never require a session or network."""
import json
import os
import hmac
import threading
import time
from pathlib import Path
from flask import Blueprint, jsonify, request, current_app
from billing import entitlement
from sqlalchemy.exc import SQLAlchemyError
from translation_engine import ArgosEngine, TranslationUnavailable, TranslationBusy

PREMIUM_LOCALES={'es','fr','de','it','pt','ja','ru','ko','zh-CN','zh-TW','ar','bg','ca','nl','el','id','ms','pl','sv','th','tr','uk','vi','sw'}
FREE_LOCALES = ['en', 'hi']
ALL_LOCALES = FREE_LOCALES + sorted(PREMIUM_LOCALES)

def init_localization(app):
    routes=Blueprint('localization',__name__)
    engine = ArgosEngine()
    app.extensions['translation_engine'] = engine
    attempts = {}
    attempts_lock = threading.Lock()

    def language_access():
        record = current_app.extensions['site_auth']['current']('user')
        plan = entitlement(record['user']['id']) if record and app.config['AUTH_MODE'] != 'demo' else {'id': 'free'}
        premium = plan['id'] in {'premium', 'premium-plus'}
        return record, plan['id'], premium

    def rate_limited():
        # Per-process guard; deployment proxies should enforce a global request limit.
        now = time.monotonic()
        address = request.remote_addr or 'unknown'
        with attempts_lock:
            for key in list(attempts):
                if now - attempts[key][0] >= 60:
                    del attempts[key]
            start, count = attempts.get(address, (now, 0))
            if count >= 20 or (address not in attempts and len(attempts) >= 10000):
                return True
            attempts[address] = (start, count + 1)
        return False
    def fail(code,english,hindi,status):
        message=hindi if request.headers.get('Accept-Language','').lower().startswith('hi') else english
        return jsonify(success=False,code=code,message=message),status

    @routes.before_request
    def boundary():
        origin=request.headers.get('Origin')
        if (origin and origin not in app.config['AUTH_ALLOWED_ORIGINS']) or (request.method=='POST' and origin not in app.config['AUTH_ALLOWED_ORIGINS']):
            return fail('UNTRUSTED_ORIGIN','Untrusted origin.','अनुमति प्राप्त स्रोत से अनुरोध करें।',403)
        if request.method == 'OPTIONS':
            return '', 204

    @routes.after_request
    def cors(response):
        response.headers['Cache-Control']='private, no-store'
        if request.headers.get('Origin') in app.config['AUTH_ALLOWED_ORIGINS']:
            response.headers['Access-Control-Allow-Origin']=request.headers['Origin']
            response.headers['Access-Control-Allow-Credentials']='true'
            response.headers['Access-Control-Allow-Headers']='Accept-Language, Content-Type, X-CSRF-Token'
            response.headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS'
            response.vary.add('Origin')
        return response

    @routes.get('/api/me')
    def me():
        try:
            record, plan, premium = language_access()
        except SQLAlchemyError:
            return fail('ENTITLEMENT_UNAVAILABLE','Could not verify your plan. Please retry.','आपका प्लान सत्यापित नहीं हो सका। दोबारा कोशिश करें।',503)
        return jsonify(user_id=record['user']['id'] if record else None, plan=plan,
                       is_premium=premium, allowed_languages=ALL_LOCALES if premium else FREE_LOCALES)

    @routes.post('/api/i18n/translate')
    def translate_text():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return fail('INVALID_INPUT','Send a JSON object.','JSON अनुरोध भेजें।',400)
        text = payload.get('text')
        source, target = payload.get('source', 'en'), payload.get('target', 'hi')
        if not isinstance(text, str) or not text.strip() or len(text) > 2000:
            return fail('INVALID_INPUT','Enter between 1 and 2,000 characters.','1 से 2,000 अक्षर दर्ज करें।',400)
        if not isinstance(source, str) or not isinstance(target, str) or source not in ALL_LOCALES or target not in ALL_LOCALES:
            return fail('UNSUPPORTED_LOCALE','This language is not supported.','यह भाषा समर्थित नहीं है।',400)
        # A zh model cannot distinguish Simplified/Traditional; reject rather than mislabel.
        if 'zh-TW' in {source, target}:
            return fail('MODEL_UNAVAILABLE','Traditional Chinese translation needs a dedicated model.','इस भाषा का अनुवाद मॉडल उपलब्ध नहीं है।',503)
        try:
            record, _, premium = language_access()
        except SQLAlchemyError:
            return fail('ENTITLEMENT_UNAVAILABLE','Could not verify your plan. Please retry.','आपका प्लान सत्यापित नहीं हो सका। दोबारा कोशिश करें।',503)
        if not premium and (source not in FREE_LOCALES or target not in FREE_LOCALES):
            return fail('PREMIUM_REQUIRED','Additional languages require an active Premium or Premium Plus plan.','अन्य भाषाओं के लिए सक्रिय Premium प्लान चाहिए।',403)
        if record and not hmac.compare_digest(request.headers.get('X-CSRF-Token', ''), record['csrf']):
            return fail('INVALID_CSRF','Reload your session and try again.','पेज रीलोड करके दोबारा कोशिश करें।',403)
        if rate_limited():
            return fail('RATE_LIMITED','Too many requests. Please try again in a minute.','एक मिनट बाद दोबारा कोशिश करें।',429)
        try:
            translated = engine.translate(text, source, target)
        except TranslationBusy:
            return fail('TRANSLATION_BUSY','Translation is busy. Please retry shortly.','थोड़ी देर बाद दोबारा कोशिश करें।',429)
        except TranslationUnavailable:
            return fail('MODEL_UNAVAILABLE','Automatic translation is unavailable for this language pair. Please try again later.','इन भाषाओं का स्वचालित अनुवाद अभी उपलब्ध नहीं है।',503)
        return jsonify(success=True, engine='argos', source=source, target=target, translation=translated)

    @routes.get('/api/i18n/messages/<locale>')
    def messages(locale):
        if locale in {'en','hi'}:
            return jsonify(success=True,locale=locale,free=True,messages={})
        if locale not in PREMIUM_LOCALES:
            return fail('UNSUPPORTED_LOCALE','This language is not supported.','यह भाषा समर्थित नहीं है।',400)
        record=current_app.extensions['site_auth']['current']('user')
        if not record:
            return fail('LOGIN_REQUIRED','Sign in with an active Premium or Premium Plus plan for additional languages.','अन्य भाषाओं के लिए सक्रिय Premium या Premium Plus खाते से लॉग इन करें।',401)
        try:
            plan=entitlement(record['user']['id']) if app.config['AUTH_MODE']!='demo' else {'id':'free'}
        except Exception:
            return fail('ENTITLEMENT_UNAVAILABLE','Could not verify your plan. Please retry.','आपका प्लान सत्यापित नहीं हो सका। दोबारा कोशिश करें।',503)
        if plan['id'] not in {'premium','premium-plus'}:
            return fail('PREMIUM_REQUIRED','Additional languages require an active Premium or Premium Plus plan. English and Hindi remain free.','अन्य भाषाओं के लिए सक्रिय Premium या Premium Plus प्लान चाहिए। हिन्दी और अंग्रेज़ी मुफ़्त हैं।',403)
        root=Path(os.getenv('I18N_CATALOG_DIR',Path(__file__).with_name('data')/'locales'))
        path=root/(locale+'.json')  # Locale is allowlisted above; no client-supplied file paths.
        try:
            if path.stat().st_size>2_000_000:
                raise ValueError('Catalog too large')
            catalog=json.loads(path.read_text(encoding='utf-8'))
            if not isinstance(catalog,dict) or not catalog or any(not isinstance(k,str) or not isinstance(v,str) or len(k)>5000 or len(v)>20000 for k,v in catalog.items()):
                raise ValueError('Invalid catalog')
        except (OSError,ValueError):
            return fail('TRANSLATION_NOT_CONFIGURED','Translation for this language is not configured yet. English and Hindi are available free.','इस भाषा का अनुवाद अभी उपलब्ध नहीं है। हिन्दी और अंग्रेज़ी मुफ़्त उपलब्ध हैं।',503)
        return jsonify(success=True,locale=locale,free=False,messages=catalog)

    app.register_blueprint(routes)
