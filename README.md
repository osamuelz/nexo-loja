# Nexo — Loja virtual

![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-222222?logo=flask&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
[![Testes](https://github.com/osamuelz/nexo-loja/actions/workflows/tests.yml/badge.svg)](https://github.com/osamuelz/nexo-loja/actions/workflows/tests.yml)

Projeto de estudo e portfólio: uma loja de tecnologia e eletrodomésticos com catálogo, sacola, finalização de compra, acompanhamento de pedidos e painel administrativo. Interface construída com HTML, CSS e JavaScript, a partir de referências visuais criadas no Stitch, com backend em Python e persistência no PostgreSQL.

## Referência visual

![Design de referência da página inicial da Nexo](docs/design/loja-stitch.png)

Layout original criado no Stitch e usado como base visual. A imagem mostra a referência de design; a implementação inclui o fluxo de pedidos e o painel administrativo descritos abaixo.

## Funcionalidades

- Catálogo de demonstração com 12 produtos, busca e filtros por categoria.
- Detalhes de produto e escolha de variantes, como cor, capacidade ou voltagem.
- Sacola com validação de preços, quantidades e estoque no servidor.
- Registro de pedidos, resumo da compra e acompanhamento em **Meus pedidos**.
- Painel administrativo com login, indicadores, filtros, detalhes e atualização do status dos pedidos.
- Migrações do banco e comandos para cadastrar produtos de demonstração e criar administradores.

Os valores monetários são armazenados em centavos inteiros. O checkout utiliza transação e bloqueio das variantes no PostgreSQL; os testes isolados verificam as regras de negócio, mas não substituem um teste de concorrência nesse banco.

## Executar localmente

Requisitos: Python com suporte às dependências de [requirements.txt](requirements.txt), PostgreSQL e Git. Os testes locais desta preparação foram executados com Python 3.14; não foi validada uma matriz de versões do PostgreSQL.

### 1. Clonar e instalar

No PowerShell:

```powershell
git clone https://github.com/osamuelz/nexo-loja.git
cd nexo-loja
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Os comandos abaixo usam o Python do ambiente virtual diretamente, sem exigir a ativação do ambiente. No Linux/macOS, use `python3 -m venv .venv`, `cp .env.example .env` e substitua `.\.venv\Scripts\python.exe` por `.venv/bin/python`.

### 2. Preparar o PostgreSQL e o ambiente

Siga [setup_banco.sql](docs/scripts/setup_banco.sql) para criar o usuário `nexo_user` e o banco `nexo_db`. No pgAdmin, execute **cada instrução da Parte 1 separadamente**, pois `CREATE DATABASE` não pode rodar dentro de uma transação. Depois, abra o Query Tool no novo banco e execute a Parte 2.

Edite o arquivo `.env` com a conexão local e uma chave de sessão própria:

```dotenv
DATABASE_URL=postgresql+psycopg://nexo_user:SUA_SENHA@localhost:5432/nexo_db
SECRET_KEY=SUA_CHAVE_ALEATORIA
FLASK_ENV=development
FLASK_DEBUG=1
```

Para gerar a chave, execute:

```powershell
.\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
```

Se a senha do banco contiver caracteres especiais, como `@`, `#` ou `/`, codifique esses caracteres para uso na URL. O `.env` é local e está excluído do Git; o arquivo publicado contém somente valores de exemplo.

### 3. Criar as tabelas e o catálogo

```powershell
.\.venv\Scripts\python.exe -m flask --app wsgi db upgrade
.\.venv\Scripts\python.exe -m flask --app wsgi seed-demo
.\.venv\Scripts\python.exe -m flask --app wsgi criar-admin
```

O último comando solicita nome, e-mail e senha do administrador. `seed-demo` preserva os estoques das variantes existentes; a opção `--reset` restaura os estoques de demonstração e deve ser usada apenas quando essa redefinição for desejada.

### 4. Iniciar a aplicação

```powershell
.\.venv\Scripts\python.exe wsgi.py
```

Acesse a loja em **http://127.0.0.1:5000/** e o administrador em **http://127.0.0.1:5000/admin/login**. As páginas são servidas pelo Flask; abrir os HTMLs diretamente ou usar apenas um servidor estático não executa a API.

## Testes

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py' -v
```

Por padrão, os testes utilizam SQLite em memória. Não é necessário configurar um banco PostgreSQL para executar essa suíte. O GitHub Actions executa o mesmo comando a cada push e pull request.

Há também quatro testes opcionais de integração com PostgreSQL. Eles consultam o catálogo de demonstração e precisam de um banco com migrações aplicadas e `seed-demo` executado:

```powershell
$env:NEXO_TEST_POSTGRES = "1"
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_postgres_integration.py' -v
Remove-Item Env:NEXO_TEST_POSTGRES
```

Eles usam `DATABASE_URL` do ambiente ou do `.env`. Não habilite essa opção para o comando geral se quiser executar somente os testes isolados. Mantenha `TEST_DATABASE_URL` ausente para usar SQLite em memória; testes isolados criam e removem suas tabelas.

## Organização

```text
nexo-loja/
├── app/                 # Configuração, modelos, comandos e rotas
├── templates/           # Páginas da loja e do administrador
├── static/              # CSS e JavaScript
├── migrations/          # Evolução das tabelas do banco
├── tests/               # Testes automatizados
├── docs/                # Referência visual e configuração do banco
├── .github/workflows/   # Validação automática no GitHub
├── .env.example         # Configuração sem credenciais reais
├── requirements.txt
└── wsgi.py              # Entrada da aplicação
```

A referência visual está em [DESIGN.md](docs/design/DESIGN.md). Ambientes virtuais, credenciais, bancos locais e backups do Stitch ficam fora do repositório.

## Escopo do projeto

O checkout registra um pedido de demonstração: não processa pagamentos, não emite nota fiscal e não integra transportadoras. O cliente acompanha seus pedidos por referências e tokens guardados no navegador, sem conta de cliente; limpar os dados do navegador remove esse acesso local. Imagens e algumas fontes/ícones dependem de serviços externos.

O servidor de desenvolvimento é destinado à execução local. Uma publicação real da loja exigiria uma etapa própria de implantação, testes com PostgreSQL e revisão de segurança. Publicar este repositório no GitHub não coloca o backend no ar; GitHub Pages não executa Python nem PostgreSQL.

## Histórico

A versão atual foi organizada em commits por assunto: configuração, backend, loja, pedidos, administração, testes e documentação. Eles representam a preparação inicial para publicação, sem reconstruir artificialmente datas ou etapas anteriores do desenvolvimento.

