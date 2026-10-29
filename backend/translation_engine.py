"""Optional, offline Argos inference. Never download models during a web request."""
import importlib
import os
import threading


class TranslationUnavailable(Exception):
    pass


class TranslationBusy(Exception):
    pass


# Argos uses zh for both Chinese UI variants. Do not claim script conversion.
def model_code(locale):
    return 'zh' if locale in {'zh-CN', 'zh-TW'} else locale


class ArgosEngine:
    def __init__(self):
        self._worker = threading.BoundedSemaphore(1)

    def translate(self, text, source, target):
        if source == target:
            return text
        if os.getenv('ARGOS_TRANSLATE_ENABLED', '').lower() not in {'1', 'true'}:
            raise TranslationUnavailable('Argos is not enabled.')
        if not self._worker.acquire(blocking=False):
            raise TranslationBusy()
        try:
            # Optional imports keep the existing lightweight deployment operational.
            translate = importlib.import_module('argostranslate.translate')
            languages = {language.code: language for language in translate.get_installed_languages()}
            source_language = languages.get(model_code(source))
            target_language = languages.get(model_code(target))
            if not source_language or not target_language:
                raise TranslationUnavailable('Install the requested language models first.')
            translation = source_language.get_translation(target_language)
            if translation is None:
                raise TranslationUnavailable('No installed translation path.')
            return translation.translate(text)
        except TranslationUnavailable:
            raise
        except Exception:
            # Model paths, user input and library exceptions never reach clients/logs.
            raise TranslationUnavailable('Argos or its language model is unavailable.') from None
        finally:
            self._worker.release()
