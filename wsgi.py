"""
Ponto de entrada para execução da aplicação Flask da Loja Nexo.
Pode ser executado com:
  python wsgi.py
ou pelo Flask CLI:
  flask run
"""
import os
from app import create_app

app = create_app(os.getenv('FLASK_ENV', 'development'))
application = app

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    # Em desenvolvimento local usamos 127.0.0.1 por padrão; em containers/produção configure HOST='0.0.0.0'
    host = os.getenv('HOST', '127.0.0.1')
    # O modo debug respeita estritamente a configuração ativa (desativado em produção)
    debug_ativo = app.config.get('DEBUG', False)
    app.run(host=host, port=port, debug=debug_ativo)
