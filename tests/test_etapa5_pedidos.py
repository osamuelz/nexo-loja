"""
Testes automatizados completos para a Etapa 5 (Checkout e Pedidos) da Loja Virtual Nexo.
Executa em banco de dados estritamente isolado (SQLite em memória).

Casos de teste cobertos (Item 6 da especificação):
1. Finalização de compra bem-sucedida com reserva atômica de estoque e congelamento de preços históricos.
2. Rejeição de pedido por estoque insuficiente com garantia de rollback (estoque permanece intacto).
3. Rejeição de pedido por alteração/divergência de preço com garantia de rollback.
4. Prevenção de pedidos duplicados via chave de idempotência (clique duplo não debita estoque duas vezes).
5. Falha inesperada durante a transação garantindo rollback atômico integral.
6. Validação rigorosa dos campos obrigatórios do comprador, endereço e itens.
7. Disponibilidade das rotas de visualização /checkout e /pedido/confirmacao.
"""
import os
import unittest
from unittest.mock import patch
from app import create_app
from app.config import normalizar_database_url
from app.extensions import db
from app.models import Categoria, Produto, Variante, Pedido, ItemPedido
from app.commands import popular_dados_demo


class TestEtapa5Pedidos(unittest.TestCase):
    def setUp(self):
        # 1. Cria app isolada com TestingConfig (SQLite em memória)
        self.app = create_app('testing')

        # TRAVA DE SEGURANÇA EXPLÍCITA:
        # Garante que os testes NUNCA executem operações contra o PostgreSQL principal
        db_uri = self.app.config.get('SQLALCHEMY_DATABASE_URI', '')
        main_uri = os.getenv('DATABASE_URL')
        if main_uri and (db_uri == normalizar_database_url(main_uri) or 'nexo_db' in db_uri):
            raise RuntimeError(
                "VIOLAÇÃO CRÍTICA DE SEGURANÇA: Testes configurados para o banco principal! Operação abortada."
            )

        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()

        # Cria tabelas no banco de teste SQLite em memória
        db.create_all()

        # Popula catálogo com os dados oficiais da loja
        popular_dados_demo()

    def tearDown(self):
        db_uri = self.app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if 'sqlite' not in db_uri and 'test' not in db_uri.lower():
            raise RuntimeError("Tentativa de executar drop_all em banco não-isolado de teste!")
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.app_context.pop()

    def test_01_finalizacao_sucesso_e_congelamento_historico(self):
        """
        Testa o fluxo positivo completo:
        - Estoque é reduzido de forma atômica no banco.
        - Pedido recebe número NX-..., status confirmado e dados do comprador.
        - Itens guardam cópia imutável e estática de nome, rótulo e preço unitário.
        """
        # Seleciona uma variante conhecida com estoque
        variante = Variante.query.filter(Variante.estoque > 5).first()
        produto = variante.produto_rel
        estoque_inicial = variante.estoque
        preco_unitario = variante.preco_centavos
        qtd_comprada = 2

        payload = {
            'idempotencyKey': 'test-idem-sucesso-001',
            'cliente': {
                'nome': 'Lucas Teste',
                'email': 'lucas.teste@exemplo.com',
                'telefone': '(11) 99999-8888'
            },
            'endereco': {
                'cep': '01310-100',
                'logradouro': 'Avenida Paulista',
                'numero': '1578',
                'complemento': 'Conj 10',
                'bairro': 'Bela Vista',
                'cidade': 'São Paulo',
                'estado': 'SP'
            },
            'metodoPagamento': 'simulado_retirada',
            'observacoes': 'Retirar no período da tarde',
            'itens': [
                {
                    'produtoId': produto.slug,
                    'varianteId': variante.slug,
                    'quantidade': qtd_comprada,
                    'precoUnitarioCentavos': preco_unitario
                }
            ]
        }

        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        pedido_data = data['pedido']

        # Valida número do pedido
        num_pedido = pedido_data['numeroPedido']
        self.assertTrue(num_pedido.startswith('NX-'))

        # Valida redução de estoque no banco
        db.session.expire_all()
        var_atualizada = db.session.get(Variante, variante.id)
        self.assertEqual(var_atualizada.estoque, estoque_inicial - qtd_comprada)

        # Valida cópia histórica estática e total congelado
        self.assertEqual(pedido_data['totalCentavos'], preco_unitario * qtd_comprada)
        self.assertEqual(len(pedido_data['itens']), 1)
        item_salvo = pedido_data['itens'][0]
        self.assertEqual(item_salvo['nomeProduto'], produto.nome)
        self.assertEqual(item_salvo['rotuloVariante'], variante.rotulo_exibicao())
        self.assertEqual(item_salvo['precoUnitarioCentavos'], preco_unitario)
        self.assertEqual(item_salvo['quantidade'], qtd_comprada)
        self.assertEqual(item_salvo['subtotalCentavos'], preco_unitario * qtd_comprada)

        # Consulta autoritativa via endpoint GET /api/pedidos/<numero_pedido>?token=...
        token_acesso = pedido_data['tokenAcesso']
        resp_get = self.client.get(f'/api/pedidos/{num_pedido}?token={token_acesso}')
        self.assertEqual(resp_get.status_code, 200)
        data_get = resp_get.get_json()
        self.assertTrue(data_get['sucesso'])
        self.assertEqual(data_get['pedido']['numeroPedido'], num_pedido)
        self.assertEqual(data_get['pedido']['clienteNome'], 'Lucas Teste')

    def test_02_estoque_insuficiente_com_rollback(self):
        """
        Testa a rejeição quando a quantidade solicitada excede o estoque.
        Garante que o banco faz rollback e o estoque original NÃO é alterado.
        """
        variante = Variante.query.filter(Variante.estoque > 0).first()
        produto = variante.produto_rel
        estoque_original = variante.estoque
        qtd_excessiva = estoque_original + 10

        payload = {
            'cliente': {
                'nome': 'Cliente Sem Estoque',
                'email': 'semestoque@teste.com',
                'telefone': '(11) 91111-2222'
            },
            'endereco': {
                'cep': '01001-000',
                'logradouro': 'Praça da Sé',
                'numero': '1',
                'bairro': 'Sé',
                'cidade': 'São Paulo',
                'estado': 'SP'
            },
            'itens': [
                {
                    'produtoId': produto.slug,
                    'varianteId': variante.slug,
                    'quantidade': qtd_excessiva,
                    'precoUnitarioCentavos': variante.preco_centavos
                }
            ]
        }

        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 409)
        data = resp.get_json()
        self.assertFalse(data['sucesso'])
        self.assertTrue(data.get('estoqueInsuficiente'))

        # Confere que o estoque permaneceu estritamente inalterado
        db.session.expire_all()
        var_db = db.session.get(Variante, variante.id)
        self.assertEqual(var_db.estoque, estoque_original)

        # Confere que nenhum pedido foi gravado
        pedidos_count = Pedido.query.count()
        self.assertEqual(pedidos_count, 0)

    def test_03_preco_alterado_com_rollback(self):
        """
        Testa a rejeição quando o preço informado pelo cliente difere do catálogo.
        Garante que o banco rejeita e não grava pedido nem altera estoque.
        """
        variante = Variante.query.filter(Variante.estoque > 0).first()
        produto = variante.produto_rel
        estoque_original = variante.estoque
        preco_divergente = variante.preco_centavos - 50000  # R$ 500,00 mais barato

        payload = {
            'cliente': {
                'nome': 'Preço Desatualizado',
                'email': 'preco@teste.com',
                'telefone': '(11) 92222-3333'
            },
            'endereco': {
                'cep': '01001-000',
                'logradouro': 'Rua Direita',
                'numero': '10',
                'bairro': 'Centro',
                'cidade': 'São Paulo',
                'estado': 'SP'
            },
            'itens': [
                {
                    'produtoId': produto.slug,
                    'varianteId': variante.slug,
                    'quantidade': 1,
                    'precoUnitarioCentavos': preco_divergente
                }
            ]
        }

        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 409)
        data = resp.get_json()
        self.assertFalse(data['sucesso'])
        self.assertTrue(data.get('precoAtualizado'))

        # Confere que o estoque não foi debitado
        db.session.expire_all()
        var_db = db.session.get(Variante, variante.id)
        self.assertEqual(var_db.estoque, estoque_original)

        # Nenhum pedido criado
        self.assertEqual(Pedido.query.count(), 0)

    def test_04_prevencao_pedido_duplicado_idempotencia(self):
        """
        Testa a prevenção contra cliques duplos:
        - A primeira requisição registra o pedido e debita o estoque.
        - A segunda requisição com a mesma idempotencyKey retorna HTTP 200 com o pedido já existente.
        - O estoque NÃO é debitado uma segunda vez.
        """
        variante = Variante.query.filter(Variante.estoque >= 10).first()
        produto = variante.produto_rel
        estoque_inicial = variante.estoque
        chave_unica = 'nx-idem-clique-duplo-test-42'

        payload = {
            'idempotencyKey': chave_unica,
            'cliente': {
                'nome': 'Cliente Rápido',
                'email': 'rapido@teste.com',
                'telefone': '(11) 93333-4444'
            },
            'endereco': {
                'cep': '04538-132',
                'logradouro': 'Av. Brigadeiro Faria Lima',
                'numero': '3477',
                'bairro': 'Itaim Bibi',
                'cidade': 'São Paulo',
                'estado': 'SP'
            },
            'itens': [
                {
                    'produtoId': produto.slug,
                    'varianteId': variante.slug,
                    'quantidade': 2,
                    'precoUnitarioCentavos': variante.preco_centavos
                }
            ]
        }

        # 1. Primeiro envio (clique 1)
        resp1 = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp1.status_code, 201)
        data1 = resp1.get_json()
        num_pedido_original = data1['pedido']['numeroPedido']

        db.session.expire_all()
        var_db1 = db.session.get(Variante, variante.id)
        self.assertEqual(var_db1.estoque, estoque_inicial - 2)

        # 2. Segundo envio simultâneo/imediato com a mesma chave (clique 2)
        resp2 = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.get_json()
        self.assertTrue(data2['sucesso'])
        self.assertTrue(data2['duplicado'])
        self.assertEqual(data2['pedido']['numeroPedido'], num_pedido_original)

        # Confere que o estoque NÃO foi debitado de novo (continua estoque_inicial - 2)
        db.session.expire_all()
        var_db2 = db.session.get(Variante, variante.id)
        self.assertEqual(var_db2.estoque, estoque_inicial - 2)

        # Confere que existe exatamente 1 pedido gravado no banco
        self.assertEqual(Pedido.query.count(), 1)

    def test_05_falha_durante_transacao_rollback_completo(self):
        """
        Simula uma falha inesperada no meio da transação do banco de dados (ex: exceção ao salvar).
        Garante que o rollback é executado, nenhum pedido fica no banco e o estoque é preservado.
        """
        variante = Variante.query.filter(Variante.estoque >= 5).first()
        produto = variante.produto_rel
        estoque_inicial = variante.estoque

        payload = {
            'cliente': {
                'nome': 'Falha Transacional',
                'email': 'falha@teste.com',
                'telefone': '(11) 94444-5555'
            },
            'endereco': {
                'cep': '01000-000',
                'logradouro': 'Rua do Teste',
                'numero': '99',
                'bairro': 'Centro',
                'cidade': 'São Paulo',
                'estado': 'SP'
            },
            'itens': [
                {
                    'produtoId': produto.slug,
                    'varianteId': variante.slug,
                    'quantidade': 1,
                    'precoUnitarioCentavos': variante.preco_centavos
                }
            ]
        }

        # Simula erro forçado no commit do banco de dados
        with patch.object(db.session, 'commit', side_effect=RuntimeError("Simulação de falha catastrófica de conexão no commit")):
            resp = self.client.post('/api/pedidos', json=payload)
            self.assertEqual(resp.status_code, 500)
            data = resp.get_json()
            self.assertFalse(data['sucesso'])

        # Confere que o rollback reverteu o decremento do estoque
        db.session.expire_all()
        var_db = db.session.get(Variante, variante.id)
        self.assertEqual(var_db.estoque, estoque_inicial)

        # Nenhum pedido persiste no banco
        self.assertEqual(Pedido.query.count(), 0)
        self.assertEqual(ItemPedido.query.count(), 0)

    def test_06_validacao_campos_obrigatorios(self):
        """Verifica se o backend retorna 400 ao receber dados incompletos ou inválidos."""
        # Sem nome
        resp = self.client.post('/api/pedidos', json={
            'cliente': {'email': 'a@a.com', 'telefone': '123'},
            'endereco': {'cep': '123'},
            'itens': [{'produtoId': 'x', 'varianteId': 'y', 'quantidade': 1}]
        })
        self.assertEqual(resp.status_code, 400)

        # E-mail sem @
        resp = self.client.post('/api/pedidos', json={
            'cliente': {'nome': 'Nome', 'email': 'invalido', 'telefone': '123'},
            'endereco': {'cep': '123'},
            'itens': [{'produtoId': 'x', 'varianteId': 'y', 'quantidade': 1}]
        })
        self.assertEqual(resp.status_code, 400)

        # Sem itens
        resp = self.client.post('/api/pedidos', json={
            'cliente': {'nome': 'Nome', 'email': 'a@a.com', 'telefone': '123'},
            'endereco': 'Rua A, 10',
            'itens': []
        })
        self.assertEqual(resp.status_code, 400)

        # Quantidade <= 0
        resp = self.client.post('/api/pedidos', json={
            'cliente': {'nome': 'Nome', 'email': 'a@a.com', 'telefone': '123'},
            'endereco': 'Rua A, 10',
            'itens': [{'produtoId': 'x', 'varianteId': 'y', 'quantidade': 0}]
        })
        self.assertEqual(resp.status_code, 400)

    def test_07_disponibilidade_rotas_view(self):
        """Verifica se as novas páginas de checkout e confirmação renderizam com status 200."""
        resp_checkout = self.client.get('/checkout')
        self.assertEqual(resp_checkout.status_code, 200)
        self.assertIn(b'checkout.js', resp_checkout.data)

        resp_conf = self.client.get('/pedido/confirmacao')
        self.assertEqual(resp_conf.status_code, 200)
        self.assertIn(b'confirmacao.js', resp_conf.data)

    def test_08_resolucao_tolerante_produto_por_variante(self):
        """
        Garante que o backend resolve com sucesso o produto a partir de varianteId
        mesmo se produtoId vier vazio ou ausente no payload do frontend.
        """
        variante = Variante.query.filter(Variante.estoque >= 5).first()
        estoque_antes = variante.estoque

        payload = {
            'cliente': {
                'nome': 'Cliente Tolerante',
                'email': 'tolerante@teste.com',
                'telefone': '(11) 97777-6666'
            },
            'endereco': 'Av. Paulista, 1000 - São Paulo, SP',
            'itens': [
                {
                    'produtoId': '',  # vazio propositalmente
                    'varianteId': variante.slug,
                    'quantidade': 1,
                    'precoUnitarioCentavos': variante.preco_centavos
                }
            ]
        }

        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        self.assertEqual(data['pedido']['itens'][0]['nomeProduto'], variante.produto_rel.nome)

        db.session.expire_all()
        var_depois = db.session.get(Variante, variante.id)
        self.assertEqual(var_depois.estoque, estoque_antes - 1)


if __name__ == '__main__':
    unittest.main()
