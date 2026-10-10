# Nexo — Loja Virtual & Painel Operacional

Sistema completo de e-commerce e painel administrativo desenvolvido em **Python (Flask)** com banco de dados relacional **PostgreSQL**, arquitetura modular, persistência atômica, controle de concorrência com bloqueio pessimista (*SELECT FOR UPDATE*), congelamento imutável de pedidos e design Cupertino/Stitch.

---

## Destaques do Projeto

- **Arquitetura Application Factory:** Modularizada em blueprints (`views`, `api`, `admin`), separando catálogo público, checkout do cliente e gestão operacional.
- **Catálogo Relacional no PostgreSQL:** Categorias, produtos e variantes atômicas por SKU (ex: cor + capacidade, voltagem). Preços em centavos inteiros (`total_centavos`), eliminando imprecisões de ponto flutuante.
- **Checkout com Transação Atômica e Concorrência Segura:** Revalidação autoritativa de preços e estoque com bloqueio pessimista (`with_for_update()`) ordenado por ID da variante para prevenir *deadlocks* e vendas concorrentes da mesma unidade.
- **Prevenção de Duplicidade por Idempotência:** Chave de idempotência (`idempotencyKey`) para bloquear pedidos duplicados em duplo clique ou reconexões.
- **Área "Meus Pedidos" com Chave de Acesso Segura:** Comprador acompanha pedidos via token criptográfico imprevisível (`nx_tok_...`), impedindo enumeração de pedidos.
- **Painel Administrativo Operacional (Referência Stitch):** 
  - Métricas e KPIs reais calculados no PostgreSQL (faturamento por período, vendas concluídas, SKUs ativos, alerta de estoque $\le 5$ un).
  - Gráfico analítico de 7 dias com alternância Faturamento (R$) e Volume.
  - Tabela com filtros por busca textual, status, intervalo de datas e paginação segura.
  - Gaveta de inspeção, histórico de auditoria imutável (`HistoricoPedido`) e devolução atômica de estoque ao cancelar.
- **Autenticação Segura:** Senhas administrativas protegidas por hash PBKDF2/scrypt (`werkzeug.security`). Sem cadastro público de admins; criação exclusiva via terminal local (`flask criar-admin`). Proteção de rotas contra acesso não autorizado e prevenção de *Open Redirect*.
- **Prevenção Rigorosa de XSS:** Renderização no cliente orientada a `textContent` e construção DOM segura, sanitizando entradas de comprador.
- **Suíte de Testes com 100% de Aprovação:** Testes unitários, de regras de negócio, concorrência, idempotência e integração.

---

## Estrutura do Repositório

```text
stitch_nexo_sistema_de_estoque/
├── app/
│   ├── __init__.py                  # Fábrica da aplicação Flask (Application Factory)
│   ├── config.py                    # Configurações por ambiente (Dev, Test, Prod)
│   ├── extensions.py                # Instâncias globais de db (SQLAlchemy) e migrate
│   ├── models.py                    # Modelos: Categoria, Produto, Variante, Pedido, ItemPedido, HistoricoPedido, UsuarioAdmin
│   ├── commands.py                  # Comandos CLI: seed-demo e criar-admin
│   └── routes/
│       ├── views.py                 # Rotas de páginas da loja (/index, /produto, /carrinho, /checkout, /pedidos)
│       ├── api.py                   # API REST do catálogo, validação de sacola, checkout e pedidos
│       └── admin.py                 # Rotas do painel admin, autenticação, KPIs reais e gestão de status
│
├── templates/                       # Templates Jinja2 servidos pelo Flask
│   ├── index.html                   # Vitrine inicial com busca e filtros
│   ├── produto.html                 # Página de detalhes com variantes
│   ├── carrinho.html                # Sacola de compras dedicada
│   ├── checkout.html                # Formulário de finalização de compra
│   ├── confirmacao.html             # Comprovante oficial com itens congelados
│   ├── pedidos.html                 # Área "Meus Pedidos" do comprador
│   └── admin/
│       ├── login.html               # Tela de login do operador
│       └── dashboard.html           # Painel Operacional completo (Stitch)
│
├── static/                          # Arquivos estáticos (CSS, JS, imagens)
│   ├── css/styles.css               # Estilos com design tokens e tema Stitch
│   ├── js/
│   │   ├── api.js                   # Camada de comunicação com a API REST
│   │   ├── componentes.js           # Gerenciamento de carrinho, drawer e modais
│   │   ├── catalogo.js              # Vitrine, busca em tempo real e filtros
│   │   ├── produto.js               # Seleção de variantes e galeria
│   │   ├── checkout.js              # Envio de pedido com idempotência
│   │   ├── confirmacao.js           # Renderização segura do comprovante
│   │   ├── pedidos.js               # Linha do tempo de acompanhamento do cliente
│   │   └── admin_dashboard.js       # Gráficos, métricas e gestão de pedidos do admin
│   └── images/                      # Imagens do catálogo
│
├── migrations/                      # Migrações versionadas do banco (Alembic / Flask-Migrate)
├── tests/                           # Testes automatizados (catálogo, checkout, concorrência, admin, postgres)
├── docs/
│   ├── PROGRESS.md                  # Registro cronológico detalhado de desenvolvimento
│   └── scripts/
│       └── setup_banco.sql          # Script de criação de usuário e banco PostgreSQL
│
├── referencias/stitch/              # Telas e layouts originais de referência
├── wsgi.py                          # Ponto de entrada oficial para execução do servidor
├── requirements.txt                 # Dependências do projeto
└── README.md
```

---

## Requisitos de Ambiente

- **Python:** 3.10, 3.11, 3.12, 3.13 ou 3.14
- **PostgreSQL:** Versão 14, 15, 16 ou 17
- **Navegador Moderno:** Chrome, Firefox, Edge ou Safari com suporte a ES Modules

---

## Passo a Passo para Execução Local

### 1. Clonar o Repositório e Criar o Ambiente Virtual

No terminal (PowerShell no Windows ou Bash no Linux/macOS):

```bash
# Criar o ambiente virtual (.venv)
python -m venv .venv

# Ativar o ambiente virtual:
# No Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# No Linux/macOS:
source .venv/bin/activate

# Instalar as dependências
pip install --upgrade pip
pip install -r requirements.txt
```

---

### 2. Configurar o Banco de Dados PostgreSQL

Abra o script [setup_banco.sql](docs/scripts/setup_banco.sql) para criar o usuário e o banco de dados.

**No pgAdmin 4:**
1. Conecte-se com o usuário `postgres` e abra o **Query Tool** no banco padrão `postgres`.
2. Execute a criação do usuário e banco:
   ```sql
   CREATE USER nexo_user WITH PASSWORD 'sua_senha_aqui';
   CREATE DATABASE nexo_db OWNER nexo_user ENCODING 'UTF8';
   GRANT ALL PRIVILEGES ON DATABASE nexo_db TO nexo_user;
   ```
3. No menu lateral, clique com o botão direito sobre o novo banco `nexo_db` -> **Query Tool** e execute as permissões de schema:
   ```sql
   GRANT ALL ON SCHEMA public TO nexo_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nexo_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO nexo_user;
   ```

*(Instruções completas para terminal `psql` estão documentadas em [setup_banco.sql](docs/scripts/setup_banco.sql)).*

---

### 3. Configurar as Variáveis de Ambiente (`.env`)

Copie o arquivo de exemplo `.env.example` para `.env`:

```bash
cp .env.example .env
# No Windows:
Copy-Item .env.example .env
```

Edite o arquivo `.env` com a sua senha local do PostgreSQL:

```text
DATABASE_URL=postgresql+psycopg://nexo_user:sua_senha_aqui@localhost:5432/nexo_db
SECRET_KEY=sua-chave-secreta-de-sessao-local
FLASK_ENV=development
```

> **Segurança:** O arquivo `.env` está explicitamente ignorado no `.gitignore` para nunca vazar credenciais.

---

### 4. Aplicar as Migrações do Banco

Execute as migrações do Alembic para criar todas as tabelas no PostgreSQL:

```bash
flask db upgrade
```

---

### 5. Cadastrar os Dados de Demonstração (Catálogo)

Execute o comando para popular as 4 categorias, 12 produtos e 37 variantes de demonstração:

```bash
flask seed-demo
```

> **Idempotência:** Por padrão, `flask seed-demo` atualiza o catálogo sem sobrescrever os estoques de variantes já compradas. Para forçar um reset completo dos estoques de demonstração, utilize `flask seed-demo --reset`.

---

### 6. Criar o Primeiro Administrador

Cadastre um administrador pelo terminal local (a senha é digitada de forma oculta):

```bash
flask criar-admin --nome "Seu Nome" --email "admin@nexo.com.br" --cargo "Gerente"
```

---

### 7. Iniciar o Servidor

Inicie o servidor de desenvolvimento:

```bash
python wsgi.py
```

Ou através do CLI do Flask:

```bash
flask run --port 5000
```

Acesse no seu navegador:
- **Loja Virtual:** [http://127.0.0.1:5000](http://127.0.0.1:5000)
- **Painel Administrativo:** [http://127.0.0.1:5000/admin](http://127.0.0.1:5000/admin)

---

## Fluxo da Aplicação

### Experiência do Cliente
1. **Catálogo & Variantes:** Navegue pelos produtos, filtre por categoria, pesquise em tempo real e escolha atributos (cor, capacidade, voltagem).
2. **Sacola de Compras:** Adicione itens à sacola; os preços e estoques são autoritativamente revalidados antes do checkout.
3. **Checkout Atômico:** Preencha os dados do comprador e endereço. O sistema bloqueia os registros das variantes com *SELECT FOR UPDATE*, debita o estoque e grava o pedido e itens históricos congelados numa única transação.
4. **Meus Pedidos:** O cliente pode acompanhar a linha do tempo do pedido (`Recebido` → `Em preparação` → `Enviado` → `Entregue`). Cancelamento direto pelo cliente é permitido exclusivamente enquanto o status for `Recebido`.

### Gestão do Administrador
1. **Login Seguro:** Acesso restrito a `/admin` com proteção de sessão e prevenção de *Open Redirect*.
2. **Dashboard Operacional:** Visão geral de faturamento por período, contagem de vendas concluídas (`entregue`), SKUs ativos e alerta de estoque baixo ($\le 5$ unidades).
3. **Gerenciamento de Pedidos:** Busca textual, filtros de status, inspeção completa de comprador/endereço/itens e atualização do status.
4. **Devolução Atômica de Estoque:** Ao cancelar um pedido no painel, as variantes têm suas quantidades repostas no PostgreSQL e o evento é registrado na linha do tempo de auditoria permanente (`HistoricoPedido`).

---

## Testes Automatizados

O projeto conta com suíte abrangente de testes automatizados com banco isolado:

```bash
# Executar todos os testes da aplicação:
python -m unittest discover -s tests -p "test_*.py"
```

### Cobertura dos Testes:
- `tests/test_etapa4.py`: Catálogo, variantes, regras de estoque e API de leitura.
- `tests/test_etapa5_pedidos.py`: Checkout atômico, congelamento de itens, prevenção de duplicidade por chave de idempotência e rollback.
- `tests/test_meus_pedidos.py`: Segurança por token de acesso, bloqueio de enumeração, linha de acompanhamento e restrição de permissões do comprador.
- `tests/test_admin_painel.py`: Autenticação administrativa, bloqueio de rotas não autorizadas, métricas reais do PostgreSQL por período, devolução atômica de estoque e sincronização em tempo real.
- `tests/test_postgres_integration.py`: Testes de integração direta sobre o PostgreSQL.

> **Trava de Segurança contra Destruição de Dados:** O ambiente de testes (`TestingConfig`) utiliza SQLite em memória ou `TEST_DATABASE_URL`. Se `TEST_DATABASE_URL` for configurado apontando para o banco principal, a execução é abortada imediatamente para impedir a destruição acidental dos dados persistentes.

---

## Limitações e Escopo do Projeto

- **Pagamento Simulado:** O fluxo implementa modelo de pagamento presencial na retirada/balcão (sem necessidade de gateway de cartão real ou dados sensíveis de pagamento).
- **Persistência de Pedidos do Cliente:** Para compradores sem conta cadastrada, o acesso a pedidos no navegador do cliente é mantido via chave de acesso persistida no `localStorage`, além do link direto com token de acesso seguro.
- **Ambiente de Demonstração:** Desenvolvido para demonstração técnica e portfólio de engenharia de software com foco em boas práticas de backend, banco de dados relacional e padrões de desenvolvimento web.
