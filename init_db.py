"""
Script utilitário para inicializar o banco de dados da Loja Nexo em produção/remoto (Neon, Supabase, etc).
Cria todas as tabelas, cadastra as categorias, produtos e variantes de demonstração,
e cria o usuário administrador inicial.
"""
import os
import sys
from pathlib import Path

# Adiciona o diretório raiz ao path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from app import create_app
from app.extensions import db
from app.models import UsuarioAdmin
from app.commands import popular_dados_demo


def main():
    print("=" * 65)
    print(" NEXO LOJA VIRTUAL — INICIALIZAÇÃO DO BANCO DE DADOS")
    print("=" * 65)

    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("\nAviso: Variável DATABASE_URL não encontrada no ambiente.")
        url_input = input("Cole a URL de conexão do PostgreSQL (ou Enter para usar .env): ").strip()
        if url_input:
            os.environ['DATABASE_URL'] = url_input

    # Configuração temporária de SECRET_KEY caso não definida
    if not os.getenv('SECRET_KEY'):
        os.environ['SECRET_KEY'] = 'nexo-setup-temp-secret-key-12345'

    app = create_app('development')

    with app.app_context():
        raw_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
        host_info = raw_uri.split('@')[-1] if '@' in raw_uri else 'configurado'
        print(f"\nConectando ao banco de dados ({host_info})...")

        # 1. Cria todas as tabelas
        print("Criando tabelas no banco de dados...")
        db.create_all()
        print("✓ Tabelas criadas/verificadas com sucesso!")

        # 2. Popula os dados demo
        print("\nPopulando catálogo e variantes de demonstração...")
        n_cat, n_prod, n_var = popular_dados_demo(reset_estoques=True)
        print(f"✓ {n_cat} categorias, {n_prod} produtos e {n_var} variantes cadastradas!")

        # 3. Verifica ou cria usuário administrador
        print("\nVerificando usuário administrador...")
        admin = UsuarioAdmin.query.filter_by(email='admin@nexo.com.br').first()
        if not admin:
            novo_admin = UsuarioAdmin(
                nome='Administrador Nexo',
                email='admin@nexo.com.br',
                cargo='Administrador',
                ativo=True
            )
            novo_admin.definir_senha('admin123')
            db.session.add(novo_admin)
            db.session.commit()
            print("✓ Usuário administrador inicial criado:")
            print("   E-mail: admin@nexo.com.br")
            print("   Senha:  admin123")
            print("   (Altere essa senha após o primeiro login no painel!)")
        else:
            print(f"✓ Administrador existente: {admin.email}")

        print("\n" + "=" * 65)
        print(" BANCO DE DADOS PRONTO PARA O DEPLOY NA VERCEL!")
        print("=" * 65)


if __name__ == '__main__':
    main()
