-- ============================================================================
-- NEXO LOJA VIRTUAL — CRIAÇÃO DE BANCO E USUÁRIO (POSTGRESQL)
-- ============================================================================
--
-- Este script orienta a criação do banco de dados 'nexo_db' e do usuário
-- 'nexo_user' sem privilégios de superusuário.
--
-- INSTRUÇÕES DE EXECUÇÃO:
--
-- ----------------------------------------------------------------------------
-- OPÇÃO A: VIA PGADMIN 4 (Interface Gráfica)
-- ----------------------------------------------------------------------------
-- 1. Abra o pgAdmin 4 e conecte-se ao seu servidor (com usuário 'postgres').
-- 2. Clique com botão direito no banco padrão 'postgres' -> 'Query Tool'.
-- 3. Execute cada instrução da PARTE 1 separadamente. CREATE DATABASE não
--    pode ser executado dentro de uma transação com as demais instruções.
-- 4. No menu lateral esquerdo do pgAdmin, expanda 'Databases', clique com o
--    botão direito no novo banco 'nexo_db' -> 'Query Tool' (para abrir uma
--    sessão diretamente conectada ao nexo_db).
-- 5. Execute a PARTE 2 abaixo (permissões de schema).
--
-- ----------------------------------------------------------------------------
-- OPÇÃO B: VIA TERMINAL PSQL (Linha de Comando)
-- ----------------------------------------------------------------------------
-- 1. Execute no terminal: psql -U postgres
-- 2. Execute a PARTE 1, o comando \connect nexo_db e em seguida a PARTE 2.
--
-- ============================================================================

-- ============================================================================
-- PARTE 1: Executar conectado ao banco principal/postgres
-- ============================================================================

-- 1. Cria o usuário com permissões normais (altere 'sua_senha_segura_aqui' pela senha de sua escolha)
CREATE USER nexo_user WITH PASSWORD 'sua_senha_segura_aqui';

-- 2. Cria o banco de dados dedicado à aplicação com charset UTF-8
CREATE DATABASE nexo_db OWNER nexo_user ENCODING 'UTF8';

-- 3. Concede todos os privilégios no banco de dados para o usuário da aplicação
GRANT ALL PRIVILEGES ON DATABASE nexo_db TO nexo_user;


-- ============================================================================
-- PARTE 2: Executar conectado ao banco 'nexo_db'
-- (No psql digite: \connect nexo_db | No pgAdmin: abra o Query Tool sobre nexo_db)
-- ============================================================================

-- Permissões de schema no PostgreSQL 15+:
GRANT ALL ON SCHEMA public TO nexo_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO nexo_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO nexo_user;

-- ============================================================================
-- Pronto! Agora configure o arquivo .env:
-- DATABASE_URL=postgresql+psycopg://nexo_user:sua_senha_segura_aqui@localhost:5432/nexo_db
-- ============================================================================
