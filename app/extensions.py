"""
Extensões do Flask inicializadas sem vincular a uma instância de aplicação específica.
Permite o uso do padrão Application Factory (create_app).
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()
