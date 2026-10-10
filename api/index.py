import os
import sys
from pathlib import Path

# Adiciona o diretório raiz ao sys.path para que os módulos 'app' e 'wsgi' sejam encontrados
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Importa a instância do Flask para que o runtime Serverless da Vercel execute as requisições
from wsgi import app

# Vercel espera 'app' como o callable WSGI
__all__ = ['app']
