import os
import sys
import urllib.parse
from pathlib import Path

# Adiciona o diretório raiz ao sys.path para importações
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from wsgi import app as flask_app


def app(environ, start_response):
    """
    Ponto de entrada WSGI para a Vercel.
    Restaura o caminho original da requisição reescrita pela Vercel através
    do parâmetro __path injetado nas regras de rewrite do vercel.json.
    """
    query_string = environ.get('QUERY_STRING', '')
    if '__path=' in query_string:
        params = urllib.parse.parse_qs(query_string)
        if '__path' in params:
            raw_path = params.pop('__path', ['/'])[0]
            if not raw_path.startswith('/'):
                raw_path = '/' + raw_path
            environ['PATH_INFO'] = raw_path
            new_qs = urllib.parse.urlencode(params, doseq=True)
            environ['QUERY_STRING'] = new_qs
            environ['REQUEST_URI'] = raw_path + ('?' + new_qs if new_qs else '')
            environ['RAW_URI'] = environ['REQUEST_URI']
    elif environ.get('PATH_INFO') in ('/api/index.py', '/api/index', '/api'):
        environ['PATH_INFO'] = '/'

    return flask_app(environ, start_response)


__all__ = ['app']
