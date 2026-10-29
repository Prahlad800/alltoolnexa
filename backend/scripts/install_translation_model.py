"""Explicit server-console provisioning; never run from a web request/deploy hook."""
import argparse
import os
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from translation_engine import ArgosEngine, TranslationUnavailable


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', default='en')
    parser.add_argument('--target', default='hi')
    parser.add_argument('--file', type=Path, help='Trusted official .argosmodel archive; skips index/download.')
    args = parser.parse_args()
    if not all(code.isalpha() and 2 <= len(code) <= 3 for code in [args.source, args.target]):
        parser.error('Use Argos language codes such as en, hi, fr or zh.')
    try:
        from argostranslate import package
        if args.file:
            package.install_from_path(args.file)
        else:
            package.update_package_index()
            matches = [item for item in package.get_available_packages()
                       if item.from_code == args.source and item.to_code == args.target]
            if not matches:
                parser.exit(1, 'No official model is available for this direction.\n')
            package.install_from_path(matches[0].download())
        os.environ['ARGOS_TRANSLATE_ENABLED'] = 'true'
        ArgosEngine().translate('Hello world.', args.source, args.target)
    except (ImportError, OSError, ValueError, TranslationUnavailable):
        parser.exit(1, 'Model setup failed. Check optional dependencies, writable model directories and network access.\n')
    print(f'Argos {args.source} → {args.target}: model installed and inference completed.')


if __name__ == '__main__':
    main()
