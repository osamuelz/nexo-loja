"""
Configuração do Flask e conexões de banco de dados.
Lê variáveis de ambiente (.env) de forma segura sem expor senhas.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Carrega variáveis do arquivo .env na raiz do projeto (se existir)
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def normalizar_database_url(url: str) -> str:
    """
    Garante que URLs do PostgreSQL utilizem o driver psycopg 3 ('postgresql+psycopg://').
    """
    if not url:
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    return url


class Config:
    """Configurações base."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'nexo-dev-secret-key-mude-em-producao')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_AS_ASCII = False
    TEMPLATES_AUTO_RELOAD = True


class DevelopmentConfig(Config):
    """Configuração para ambiente de desenvolvimento local."""
    DEBUG = True
    raw_db_url = os.getenv(
        'DATABASE_URL',
        'postgresql+psycopg://nexo_user:sua_senha_aqui@localhost:5432/nexo_db'
    )
    SQLALCHEMY_DATABASE_URI = normalizar_database_url(raw_db_url)


class TestingConfig(Config):
    """Configuração para execução de testes automatizados com banco isolado."""
    TESTING = True
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = normalizar_database_url(
        os.getenv('TEST_DATABASE_URL', 'sqlite:///:memory:')
    )


class ProductionConfig(Config):
    """Configuração para produção com validações estritas de segurança."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = normalizar_database_url(os.getenv('DATABASE_URL', ''))

    @classmethod
    def init_app(cls, app):
        secret = os.getenv('SECRET_KEY')
        if not secret or secret == 'nexo-dev-secret-key-mude-em-producao':
            raise ValueError(
                "ERRO DE SEGURANÇA: A variável de ambiente SECRET_KEY não foi configurada para produção. "
                "No painel da Vercel, acesse Settings -> Environment Variables e configure SECRET_KEY com uma chave secreta segura."
            )
        if not app.config.get('SQLALCHEMY_DATABASE_URI'):
            raise ValueError(
                "ERRO DE CONFIGURAÇÃO: A variável de ambiente DATABASE_URL não foi definida para produção. "
                "No painel da Vercel, acesse Settings -> Environment Variables e configure DATABASE_URL com a URL do seu PostgreSQL (ex: Neon ou Supabase)."
            )


config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
