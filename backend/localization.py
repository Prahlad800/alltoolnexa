"""Premium UI catalogs; free English/Hindi never require a session or network."""
import json
import os
from pathlib import Path
from flask import Blueprint, jsonify, request, current_app
from billing import entitlement

PREMIUM_LOCALES={'es','fr','de','it','pt','ja','ru','ko','zh-CN','zh-TW','ar','bg','ca','nl','el','id','ms','pl','sv','th','tr','uk','vi','sw'}

def init_localization(app):
    routes=Blueprint('localization',__name__)
    def fail(code,english,hindi,status):
        message=hindi if request.headers.get('Accept-Language','').lower().startswith('hi') else english
        return jsonify(success=False,code=code,message=message),status

    @routes.before_request
    def boundary():
        origin=request.headers.get('Origin')
        if origin and origin not in app.config['AUTH_ALLOWED_ORIGINS']:
            return fail('UNTRUSTED_ORIGIN','Untrusted origin.','अनुमति प्राप्त स्रोत से अनुरोध करें।',403)

    @routes.after_request
    def cors(response):
        response.headers['Cache-Control']='private, no-store'
        if request.headers.get('Origin') in app.config['AUTH_ALLOWED_ORIGINS']:
            response.headers['Access-Control-Allow-Origin']=request.headers['Origin']
            response.headers['Access-Control-Allow-Credentials']='true'
            response.headers['Access-Control-Allow-Headers']='Accept-Language, Content-Type'
            response.vary.add('Origin')
        return response

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
