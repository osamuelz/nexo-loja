# Progresso do Projeto — Loja Virtual Nexo

Documento de acompanhamento do desenvolvimento da loja virtual **Nexo** no Antigravity IDE, com base nas diretrizes visuais do Stitch e do arquivo `DESIGN.md`.

---

## 1. Status Geral por Etapa

| Etapa | Descrição | Status |
|---|---|---|
| **Etapa 1** | Página inicial responsiva, vitrine com 12 produtos, busca e filtros de categoria | Concluída e Aprovada |
| **Etapa 2** | Página de detalhes de produto reutilizável (galeria, variantes, especificações, estoque e acordeões) | Concluída e Aprovada |
| **Etapa 3** | Carrinho completo (persistência no localStorage, drawer lateral, página dedicada, alteração de quantidades e remoção) | Concluída e Aprovada |
| **Etapa 4** | **Servidor Python/Flask e catálogo conectado ao PostgreSQL (API REST, modelos, migrações, seed idempotente e sincronização do carrinho)** | **Concluída** |
| **Etapa 5** | Finalização e registro de pedidos no PostgreSQL (Checkout atômico, congelamento histórico, prevenção de duplicidade) | Concluída e Aprovada |
| **Etapa 6** | Área “Meus Pedidos” para o cliente (Acompanhamento em tempo real, tokens seguros contra enumeração, persistência local e histórico imutável) | Concluída e Aprovada |
| **Etapa 7** | **Painel Administrativo Operacional (Referência Stitch, KPIs PostgreSQL reais, gestão de status, reposição crítica, auditoria e devolução de estoque)** | **Concluída e Aprovada** |

---

## 2. O que foi feito na Etapa 5 e Etapa 6 (Checkout, Confirmação e Meus Pedidos)

### 2.1 Checkout e Transação Atômica no PostgreSQL (Etapa 5)
- **Modelos e Migrações:**
  - `Pedido`: Identificador único (`NX-YYYYMMDD-XXXXXX`), cliente, endereço, status, método de pagamento, total em centavos e chave de idempotência.
  - `ItemPedido`: Congelamento estático e imutável do nome do produto, variante e preço unitário no exato instante da compra.
- **Transação Atômica (`POST /api/pedidos`):**
  - Revalidação autoritativa de preços e estoque no PostgreSQL.
  - Débito de estoque e gravação do pedido na mesma transação.
  - Rollback integral em caso de falha ou conflito.
  - Prevenção de duplicidade por duplo clique via chave de idempotência.
- **Páginas e Telas:**
  - `/checkout`: Revisão da sacola, formulário de contato e endereço de entrega.
  - `/pedido/confirmacao`: Comprovante oficial com itens históricos congelados e ação "Acompanhar pedido".

### 2.2 Área “Meus Pedidos” e Linha de Acompanhamento (Etapa 6)
- **Segurança sem Login (Chave de Acesso Criptográfica):**
  - Cada pedido recebe um `token_acesso` único e imprevisível (`nx_tok_<64 caracteres hexadecimais>`).
  - `GET /api/pedidos/<numero_pedido>` exige token via query param ou header `X-Order-Token`, bloqueando enumeração de pedidos com `HTTP 403 Forbidden`.
- **Persistência no Navegador (`localStorage['nexo_meus_pedidos']`):**
  - Os pedidos finalizados pelo cliente são salvos localmente (`numeroPedido`, `tokenAcesso`, `criadoEm`).
  - O carrinho só é limpo após confirmação com código `201 Created` do servidor.
  - Ao fechar e reabrir o navegador, os pedidos continuam acessíveis.
- **Interface e Linha de Acompanhamento (`/pedidos`):**
  - Link "Meus Pedidos" com ícone `receipt_long` em todos os cabeçalhos do site.
  - Grade com histórico de pedidos recentes: número, data formatada (pt-BR), contagem de itens, total e status.
  - Acordeão expansível revelando comprovante com linha de acompanhamento (*stepper* visual):
    - `Recebido` → `Em preparação` → `Enviado` → `Entregue` (e alerta em caso de `Cancelado`).
- **Controle de Status com Ação Real:**
  - O status nunca se altera sozinho com o tempo.
  - Transições autorizadas via `PATCH /api/pedidos/<numero>/status`:
    - `recebido` → `em_preparacao` → `enviado` → `entregue` e `cancelado`.
  - Transições retrógradas ou sem chave de acesso são rejeitadas com erro 400/403.
- **Consulta em Lote (`POST /api/meus-pedidos/consultar`):**
  - Permite ao frontend consultar em uma única requisição a lista autenticada dos pedidos locais do usuário.

### 2.3 Painel Administrativo Operacional e Referência Stitch (Etapa 7)
- **Design Fiel ao Stitch (`vis_o_geral/code.html`):**
  - Layout profissional com sidebar de navegação, topbar com badge de notificações e perfil do operador logado.
  - Cartões de KPI com variação percentual calculada, gráfico analítico dos últimos 7 dias (alternância Faturamento R$ / Volume de pedidos) e fila de reposição crítica de estoque.
  - Tabela operacional de pedidos com filtros por busca textual (número, cliente, e-mail), status (`recebido`, `em_preparacao`, `enviado`, `entregue`, `cancelado`), período de datas e paginação.
- **Autenticação Segura e Criação de Administradores:**
  - Modelo `UsuarioAdmin` com senhas protegidas por hash criptográfico seguro (PBKDF2/scrypt via werkzeug). Sem senhas em texto puro.
  - Bloqueio de auto-cadastro público.
  - Comando CLI local seguro `flask criar-admin` com solicitação oculta de senha via terminal (`getpass`).
  - Proteção de todas as rotas `/admin/*` e `/admin/api/*` via decorador `@admin_required` (redirecionamento 302 para páginas HTML e 401 Unauthorized para APIs JSON).
- **Gestão de Pedidos e Auditoria Imutável:**
  - Modal/Drawer de inspeção e gestão operacional de cada pedido.
  - Transições formais de status: `recebido` → `em_preparacao` → `enviado` → `entregue` e `cancelado`.
  - **Devolução Atômica de Estoque:** Ao cancelar um pedido, as unidades de cada variante são automaticamente repostas no catálogo do PostgreSQL dentro da mesma transação.
  - Linha do tempo de auditoria permanente (`HistoricoPedido`), registrando autor (nome e cargo do admin), carimbo de data/hora UTC e observação da alteração.
- **Sincronização em Tempo Real com o Cliente:**
  - Ao alterar o status no painel administrativo, a tela "Meus Pedidos" do comprador reflete a mudança imediatamente.
  - Botões de simulação e avanço de status foram removidos da tela do cliente, permitindo apenas cancelamento caso o pedido ainda esteja no estado inicial `recebido`.

---

## 3. Relatório de Verificações e Testes Realizados

A suíte completa de testes automatizados conta com **42 testes aprovados** (100% de sucesso):
- `tests/test_etapa4.py`: 13 testes aprovados (Catálogo, categorias, variantes, estoque e regras de negócio).
- `tests/test_etapa5_pedidos.py`: 8 testes aprovados (Checkout atômico, prevenção de duplicidade, rollback e congelamento).
- `tests/test_meus_pedidos.py`: 8 testes aprovados (Segurança por token, bloqueio de enumeração, consulta em lote, stepper e transições de status).
- `tests/test_postgres_integration.py`: 4 testes aprovados (Conexão e validações diretas no PostgreSQL real `nexo_db`).
- `tests/test_admin_painel.py`: 9 testes aprovados (Autenticação admin, bloqueio de rotas não autorizadas, KPIs reais do PostgreSQL, busca/filtros, auditoria, devolução de estoque no cancelamento e sincronização com o cliente).

**Resultado da Suíte Total:** `Ran 42 tests in 4.770s - OK`

---

## 2. O que foi feito na Etapa 4 (Backend Flask e PostgreSQL)

### 2.1 Arquitetura da Aplicação e Servidor Flask
- **Padrão Application Factory (`create_app`):** Inicialização modular e desacoplada em `app/__init__.py`.
- **Organização por Módulos:**
  - `app/config.py`: Gestão de configurações para desenvolvimento, testes e produção com suporte a `.env` e driver `psycopg 3` (`postgresql+psycopg://`).
  - `app/extensions.py`: Instâncias globais de `SQLAlchemy` e `Flask-Migrate`.
  - `app/models.py`: Modelos relacionais `Categoria`, `Produto` e `Variante`.
  - `app/commands.py`: Comando CLI idempotente `flask seed-demo`.
  - `app/routes/api.py`: Endpoints RESTful para leitura do catálogo e validação da sacola.
  - `app/routes/views.py`: Rotas de renderização dos templates HTML (`/`, `/produto`, `/carrinho`).
  - `wsgi.py`: Ponto de entrada oficial para execução do servidor.
- **Convenções do Flask (`templates/` e `static/`):**
  - Templates em `templates/` utilizando `url_for('static', filename=...)`.
  - Arquivos estáticos organizados em `static/css/`, `static/js/` e `static/images/`.
  - Rota de fallback transparente `/assets/<path>` preservando retrocompatibilidade absoluta.

### 2.2 Modelagem de Dados Relacional (PostgreSQL)
- **Tabela `categorias`:** Categorias com identificador estável (`slug`), nome, subtítulo, ícone e ordenação.
- **Tabela `produtos`:** Identificador estável (`slug`), nome, descrição, categoria (FK), imagem, galeria (JSON), especificações (JSON), destaques (JSON), tipo de opções, notas elétricas e compatibilidade.
- **Tabela `variantes`:**
  - Identificador canônico estável (`slug`, ex: `smartphone-nexo-one--titanio-natural--128-gb`).
  - Cada combinação vendável possui seu próprio registro, preço e estoque.
  - **Eliminação de regras conflitantes:** Estoque e preço calculados por variante atômica.
  - **Valores monetários exatos:** Armazenamento em centavos inteiros (`preco_base_centavos`, `preco_centavos`), sem ponto flutuante.
  - **Preservação estrita de estoque 0:** Itens esgotados mantêm estoque 0 no banco, sem fallbacks fictícios.

### 2.3 Migrações (Flask-Migrate / Alembic) e Dados Iniciais
- **Migração Inicial Criada:** Arquivo `migrations/versions/676e24240d59_criacao_inicial_das_tabelas_categorias_.py` com criação de tabelas, chaves primárias, estrangeiras e índices.
- **Comando Explícito de Demonstração (`flask seed-demo`):**
  - Cadastra os 12 produtos e 37 variantes vendáveis de demonstração.
  - **Idempotência comprovada:** Pode ser executado repetidamente sem gerar registros duplicados.
  - Não é executado automaticamente na inicialização do servidor.
- **Script SQL de Configuração do Banco (`docs/scripts/setup_banco.sql`):**
  - Criação do banco `nexo_db` e do usuário `nexo_user` com permissões normais (sem privilégios de superusuário).

### 2.4 Endpoints da API RESTful e Integração Frontend
- **`GET /api/categorias`:** Retorna as categorias ativas do PostgreSQL.
- **`GET /api/produtos`:** Suporta busca textual em tempo real e filtro por categoria diretamente no catálogo ativo.
- **`GET /api/produtos/<id_ou_slug>`:** Retorna detalhes completos e variantes ativas do produto. Retorna 404 estruturado para produto inexistente ou inativo.
- **`POST /api/carrinho/validar`:** Validação autoritativa dos itens do cliente contra o banco:
  - Remove produtos ou variantes inativas ou inexistentes.
  - Remove itens com estoque zero (esgotados).
  - Ajusta quantidade se o estoque for inferior à quantidade solicitada.
  - Atualiza preços caso tenham mudado no banco e gera avisos claros para o usuário.
- **Cliente HTTP Desacoplado (`static/js/api.js`):**
  - Todas as requisições passam por um cliente centralizado.
  - **Sem dados fictícios silenciosos:** Se o servidor falhar, uma tela de erro clara com botão *"Tentar novamente"* é exibida.
- **Estados Visuais no Frontend:**
  - Carregamento (*loading* com animação suave).
  - Falha com botão de nova tentativa.
  - Catálogo vazio.
  - Produto inexistente ou inativo (página 404 amigável).
- **Limites de Escopo Respeitados:**
  - O carrinho continua como seleção local do cliente (sem reserva prematura de estoque).
  - Nenhum pedido é confirmado nesta etapa.
  - A interface mantém o aviso *"Finalização de pedidos em breve"*.

---

## 3. Relatório de Verificações e Testes Realizados

A suíte de testes foi amplamente reformulada para incluir travas de segurança contra operações destrutivas no banco principal, novos testes de integração e verificações ponta a ponta:

### 3.1 Testes Unitários e de Regras em Banco Isolado (`tests/test_etapa4.py`)
Executados estritamente em SQLite em memória (`sqlite:///:memory:`):

| Teste | Descrição | Resultado |
|---|---|---|
| `test_01_seed_demo_e_idempotencia` | Cadastro dos 12 produtos e repetição sem duplicação | **Aprovado (4 cat., 12 prod., 37 var.)** |
| `test_02_integridade_monetaria` | Preços em centavos inteiros (sem ponto flutuante) | **Aprovado (todos `int` > 0)** |
| `test_03_api_categorias` | Leitura das categorias ativas | **Aprovado (200 OK, JSON estruturado)** |
| `test_04_api_produtos_listagem_e_filtros` | Vitrine, filtros de categoria e busca textual | **Aprovado (200 OK, 12 produtos)** |
| `test_05_api_produto_detalhes_e_404` | Detalhes com variantes e 404 para produto inexistente | **Aprovado (200 OK e 404 para desconhecido)** |
| `test_06_api_carrinho_validacao` | Validação de estoque 0, limites e preços no servidor | **Aprovado (remoção de esgotados e avisos)** |
| `test_07_rotas_templates_e_estaticos` | Rotas HTML (`/`, `/produto`, `/carrinho`) e arquivos `/static/` | **Aprovado (todos retornam 200 OK)** |
| `test_08_protecao_e_isolamento_banco_testes` | Comprova trava que impede testes de rodar contra o banco principal | **Aprovado (bloqueia `DATABASE_URL`)** |
| `test_09_busca_sem_acentos` | Busca sem acentos (`memoria` e `memória` encontram 'Memória RAM') | **Aprovado (200 OK, produtos encontrados)** |
| `test_10_categoria_e_produtos_inativos` | Produtos de categorias inativas respondem 404 e saem do carrinho | **Aprovado (404 em detalhes, aviso na sacola)** |
| `test_11_validacao_entradas_invalidas_carrinho` | Rejeição HTTP 400 para quantidades negativas, zero, floats, bools ou strings | **Aprovado (HTTP 400 estruturado)** |
| `test_12_consolidacao_variantes_e_estoque` | Itens duplicados somam quantidades antes de checar limite de estoque | **Aprovado (consolidação e clamping correto)** |
| `test_13_contrato_compatibilidade_carrinho` | Suporte a `id` legado e `produtoId`, devolvendo estoque real e campos | **Aprovado (contrato completo validado)** |

**Resultado da Suíte Isolada:** `Ran 13 tests in 0.553s - OK`

### 3.2 Testes de Integração com o PostgreSQL Real (`tests/test_postgres_integration.py`)
Executados diretamente sobre o banco persistente `nexo_db` via `psycopg 3` em operações não-destrutivas:

| Teste | Descrição | Resultado |
|---|---|---|
| `test_01_conexao_e_contagens_postgresql` | Verifica persistência real das 4 categorias, 12 produtos e 37 variantes | **Aprovado** |
| `test_02_busca_sem_acentos_no_postgresql` | Comprova busca sem acento (`memoria`) sobre o PostgreSQL | **Aprovado** |
| `test_03_fluxo_adicionar_ao_carrinho_e_validar` | Simula adição de 'Smartphone Nexo One 256 GB' e valida persistência | **Aprovado (valido=True, estoque=5)** |
| `test_04_consolidacao_duplicados_no_postgresql` | Consolida linhas duplicadas contra estoque real do PostgreSQL | **Aprovado** |

**Resultado da Suíte PostgreSQL:** `Ran 4 tests in 0.197s - OK`

---

## 4. O que Ficou Pendente (Próxima Fase — Etapa 5)

Conforme estabelecido na revisão de 9 de outubro de 2026, com a integração do catálogo e carrinho 100% estabilizada, os próximos passos são:
1. Modelagem das tabelas de `pedidos` e `itens_pedido` no PostgreSQL.
2. Transação atômica de checkout no servidor com reserva de estoque e validação definitiva.
3. Prevenção de duplicidade de pedidos e idempotência na finalização.
4. Liberação/cancelamento de reserva de estoque em caso de desistência ou tempo limite.
5. Tela de confirmação de pedido vinculada ao registro persistido no banco.

2. Endpoint de fechamento de compra (`POST /api/pedidos`).
3. Revalidação definitiva e atômica de preços e baixa de estoque no momento da finalização do pedido.
4. Tela de confirmação e resumo de pedido recebido.
