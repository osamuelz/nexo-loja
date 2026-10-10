import os
import sys
from pathlib import Path

# Adiciona o diretório raiz ao sys.path para que os módulos 'app' e 'wsgi' sejam encontrados
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from wsgi import app


class VercelPathMiddleware:
    """
    Middleware WSGI para a Vercel.
    Quando a Vercel reescreve todas as rotas (/(.*)) para /api/index.py,
    o PATH_INFO original recebido pelo WSGI pode vir como '/api/index.py'.
    Este middleware recupera o caminho real requisitado pelo usuário a partir
    do cabeçalho HTTP_X_MATCHED_PATH da Vercel e o restaura no PATH_INFO.
    """
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        matched_path = (
            environ.get('HTTP_X_MATCHED_PATH') or
            environ.get('HTTP_X_VERCEL_MATCHED_PATH') or
            environ.get('HTTP_X_ORIGINAL_URI') or
            environ.get('HTTP_X_REWRITE_URL')
        )
        if matched_path:
            # Separa query string caso venha anexada ao matched_path
            if '?' in matched_path:
                path_part, query_part = matched_path.split('?', 1)
                environ['PATH_INFO'] = path_part
                if not environ.get('QUERY_STRING'):
                    environ['QUERY_STRING'] = query_part
            else:
                environ['PATH_INFO'] = matched_path
        elif environ.get('PATH_INFO') in ('/api/index.py', '/api/index', '/api'):
            environ['PATH_INFO'] = '/'

        return self.wsgi_app(environ, start_response)


# Aplica o middleware WSGI à aplicação
app.wsgi_app = VercelPathMiddleware(app.wsgi_app)

__all__ = ['app']
