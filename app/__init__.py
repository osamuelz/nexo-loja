"""
Fábrica da aplicação Flask (Application Factory).
Organização modular e desacoplada com extensões e blueprints.
"""
import os
from flask import Flask, send_from_directory
from app.config import config_by_name, normalizar_database_url
from app.extensions import db, migrate
from app.routes.views import views_bp
from app.routes.api import api_bp
from app.routes.admin import admin_bp
from app.commands import seed_demo_command, criar_admin_command


def create_app(config_name=None):
    """Cria e configura a instância do Flask."""
    if config_name is None:
        config_name = os.getenv('FLASK_ENV', 'development')

    app_config = config_by_name.get(config_name, config_by_name['default'])

    # Diretórios estáticos e de templates na raiz do projeto
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    templates_path = os.path.join(base_dir, 'templates')
    static_path = os.path.join(base_dir, 'static')
    assets_path = os.path.join(base_dir, 'assets')

    app = Flask(
        __name__,
        template_folder=templates_path,
        static_folder=static_path,
        static_url_path='/static'
    )

    app.config.from_object(app_config)

    # Executa validações de inicialização do perfil (ex: segredos de produção)
    if hasattr(app_config, 'init_app'):
        app_config.init_app(app)

    # Configuração e proteção estrita de banco de dados
    if app.config.get('TESTING'):
        # Em modo de teste, utiliza EXCLUSIVAMENTE TEST_DATABASE_URL ou SQLite em memória
        test_db_url = os.getenv('TEST_DATABASE_URL', 'sqlite:///:memory:')
        app.config['SQLALCHEMY_DATABASE_URI'] = normalizar_database_url(test_db_url)

        # PROTEÇÃO CRÍTICA CONTRA DROP_ALL NO BANCO PRINCIPAL:
        # Se TEST_DATABASE_URL for idêntico ao DATABASE_URL principal, aborta imediatamente
        main_db_url = os.getenv('DATABASE_URL')
        if main_db_url:
            norm_main = normalizar_database_url(main_db_url)
            norm_test = app.config['SQLALCHEMY_DATABASE_URI']
            if norm_main == norm_test:
                raise RuntimeError(
                    "TRAVA DE SEGURANÇA ATIVADA: O banco configurado para testes (TEST_DATABASE_URL) "
                    "é idêntico ao banco de desenvolvimento/produção (DATABASE_URL). "
                    "Operação abortada para impedir a destruição acidental (drop_all) dos dados persistentes."
                )
    else:
        # Lê dinamicamente DATABASE_URL das variáveis de ambiente apenas para ambientes de não-teste
        db_env_url = os.getenv('DATABASE_URL')
        if db_env_url:
            app.config['SQLALCHEMY_DATABASE_URI'] = normalizar_database_url(db_env_url)

    # Inicializa extensões
    db.init_app(app)
    migrate.init_app(app, db)

    # Registra comandos CLI
    app.cli.add_command(seed_demo_command)
    app.cli.add_command(criar_admin_command)

    # Registra Blueprints
    app.register_blueprint(views_bp)
    app.register_blueprint(api_bp)
    app.register_blueprint(admin_bp)

    # Rota de compatibilidade para arquivos referenciados como /assets/
    @app.route('/assets/<path:filename>')
    def assets_fallback(filename):
        if os.path.exists(assets_path) and os.path.exists(os.path.join(assets_path, filename)):
            return send_from_directory(assets_path, filename)
        return send_from_directory(static_path, filename)

    return app
