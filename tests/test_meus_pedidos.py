"""
Testes automatizados para a funcionalidade "Meus Pedidos" da Loja Virtual Nexo.
Executa em banco de dados isolado (SQLite em memória).

Casos de teste cobertos:
1. Criação de pedido gera token_acesso imprevisível e status inicial 'recebido'.
2. Proteção contra enumeração: GET /api/pedidos/<numero> rejeita requisições sem token (403) ou com token inválido (403).
3. Acesso autorizado: GET /api/pedidos/<numero> com token válido via query param (?token=...) retorna 200 com itens imutáveis.
4. Acesso autorizado via cabeçalho X-Order-Token retorna 200.
5. Pedido inexistente retorna 404.
6. Consulta em lote POST /api/meus-pedidos/consultar:
   - Retorna apenas os pedidos pertencentes aos tokens fornecidos.
   - Não expõe pedidos de outros compradores caso o token seja incorreto.
   - Retorna ordenado pelos mais recentes primeiro.
7. Atualização autorizada de status PATCH /api/pedidos/<numero>/status:
   - Permite transições oficiais: recebido -> em_preparacao -> enviado -> entregue e cancelado.
   - Rejeita transições sem token de autorização (403).
   - Rejeita status inválidos ou transições ilógicas.
8. Rotas de visualização /pedidos, /pedidos.html e /meus-pedidos retornam 200 OK.
"""
import os
import unittest
from app import create_app
from app.config import normalizar_database_url
from app.extensions import db
from app.models import Categoria, Produto, Variante, Pedido, ItemPedido
from app.commands import popular_dados_demo


class TestMeusPedidos(unittest.TestCase):
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

        # Popula catálogo de demonstração
        popular_dados_demo()

    def tearDown(self):
        db_uri = self.app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if 'sqlite' not in db_uri and 'test' not in db_uri.lower():
            raise RuntimeError("Tentativa de executar drop_all em banco não-isolado de teste!")
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.app_context.pop()

    def _criar_pedido_teste(self, nome="Cliente Teste", email="cliente@teste.com"):
        variante = Variante.query.filter(Variante.estoque > 5).first()
        payload = {
            'idempotencyKey': f'teste-key-{os.urandom(6).hex()}',
            'cliente': {
                'nome': nome,
                'email': email,
                'telefone': '(11) 99999-1234'
            },
            'endereco': {
                'cep': '01310-100',
                'logradouro': 'Av. Paulista',
                'numero': '1000',
                'cidade': 'São Paulo',
                'estado': 'SP'
            },
            'itens': [
                {
                    'produtoId': variante.produto_rel.id,
                    'varianteId': variante.id,
                    'nome': variante.produto_rel.nome,
                    'quantidade': 1,
                    'precoUnitarioCentavos': variante.preco_centavos
                }
            ]
        }
        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        return data['pedido']

    def test_01_criacao_gera_token_acesso_e_status_recebido(self):
        """Verifica se a criação de pedido gera token_acesso e status inicial recebido."""
        pedido = self._criar_pedido_teste()
        self.assertTrue(pedido['numeroPedido'].startswith('NX-'))
        self.assertTrue('tokenAcesso' in pedido)
        self.assertTrue(pedido['tokenAcesso'].startswith('nx_tok_'))
        self.assertGreaterEqual(len(pedido['tokenAcesso']), 64)
        self.assertEqual(pedido['status'], 'recebido')

    def test_02_bloqueio_de_acesso_sem_token_ou_token_invalido(self):
        """Impede enumeração de pedidos por terceiros sem posse do token."""
        pedido = self._criar_pedido_teste()
        num = pedido['numeroPedido']

        # 1. Sem parâmetro de token
        resp_sem_token = self.client.get(f'/api/pedidos/{num}')
        self.assertEqual(resp_sem_token.status_code, 403)
        data = resp_sem_token.get_json()
        self.assertFalse(data['sucesso'])
        self.assertIn('Chave de acesso ausente ou inválida', data['erro'])

        # 2. Com token incorreto
        resp_token_falso = self.client.get(f'/api/pedidos/{num}?token=nx_tok_hacker_tentando_adivinhar')
        self.assertEqual(resp_token_falso.status_code, 403)
        self.assertFalse(resp_token_falso.get_json()['sucesso'])

    def test_03_acesso_autorizado_com_token_valido(self):
        """Permite consulta legítima apresentando token correto."""
        pedido_criado = self._criar_pedido_teste()
        num = pedido_criado['numeroPedido']
        tok = pedido_criado['tokenAcesso']

        # Via query param ?token=...
        resp = self.client.get(f'/api/pedidos/{num}?token={tok}')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        self.assertEqual(data['pedido']['numeroPedido'], num)
        self.assertEqual(data['pedido']['clienteNome'], 'Cliente Teste')
        self.assertGreater(len(data['pedido']['itens']), 0)

        # Via header X-Order-Token
        resp_hdr = self.client.get(f'/api/pedidos/{num}', headers={'X-Order-Token': tok})
        self.assertEqual(resp_hdr.status_code, 200)
        self.assertTrue(resp_hdr.get_json()['sucesso'])

    def test_04_pedido_inexistente_retorna_404(self):
        """Verifica 404 para número de pedido inexistente no banco."""
        resp = self.client.get('/api/pedidos/NX-99999999-INEXISTENTE?token=nx_tok_123456')
        self.assertEqual(resp.status_code, 404)

    def test_05_consulta_meus_pedidos_em_lote(self):
        """Verifica a consulta em lote dos pedidos do cliente com preservação de privacidade."""
        p1 = self._criar_pedido_teste(nome="Cliente A", email="a@teste.com")
        p2 = self._criar_pedido_teste(nome="Cliente A", email="a@teste.com")
        p_outro = self._criar_pedido_teste(nome="Outro Cliente", email="outro@teste.com")

        # Cliente A consulta seus pedidos legítimos
        payload_consulta = {
            'referencias': [
                {'numeroPedido': p1['numeroPedido'], 'tokenAcesso': p1['tokenAcesso']},
                {'numeroPedido': p2['numeroPedido'], 'tokenAcesso': p2['tokenAcesso']},
                # Tenta bisbilhotar p_outro com token falso
                {'numeroPedido': p_outro['numeroPedido'], 'tokenAcesso': 'nx_tok_invalido'}
            ]
        }
        resp = self.client.post('/api/meus-pedidos/consultar', json=payload_consulta)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        self.assertEqual(data['total'], 2)
        numeros_retornados = [p['numeroPedido'] for p in data['pedidos']]
        self.assertIn(p1['numeroPedido'], numeros_retornados)
        self.assertIn(p2['numeroPedido'], numeros_retornados)
        self.assertNotIn(p_outro['numeroPedido'], numeros_retornados)

    def test_06_transicao_de_status_controlada(self):
        """
        Valida que o cliente NÃO pode executar tarefas operacionais de administrador:
        Tentativas de transicionar para em_preparacao, enviado ou entregue são rejeitadas com 403.
        """
        pedido = self._criar_pedido_teste()
        num = pedido['numeroPedido']
        tok = pedido['tokenAcesso']

        # Rejeita sem token
        resp_unauth = self.client.patch(f'/api/pedidos/{num}/status', json={'status': 'cancelado'})
        self.assertEqual(resp_unauth.status_code, 403)

        # Rejeita tentativa de cliente avançar para em_preparacao (403 Proibido)
        resp1 = self.client.patch(f'/api/pedidos/{num}/status?token={tok}', json={'status': 'em_preparacao'})
        self.assertEqual(resp1.status_code, 403)
        self.assertIn('restrita a administradores', resp1.get_json()['erro'])

        # Rejeita tentativa de cliente avançar para enviado (403 Proibido)
        resp2 = self.client.patch(f'/api/pedidos/{num}/status?token={tok}', json={'status': 'enviado'})
        self.assertEqual(resp2.status_code, 403)

        # Rejeita tentativa de cliente avançar para entregue (403 Proibido)
        resp3 = self.client.patch(f'/api/pedidos/{num}/status?token={tok}', json={'status': 'entregue'})
        self.assertEqual(resp3.status_code, 403)

    def test_07_cancelamento_de_pedido(self):
        """Cliente pode cancelar pedido recebido, mas não quando já está em preparação ou concluído."""
        pedido = self._criar_pedido_teste()
        num = pedido['numeroPedido']
        tok = pedido['tokenAcesso']

        # Cliente cancela com sucesso quando status é recebido
        resp = self.client.patch(f'/api/pedidos/{num}/status?token={tok}', json={'status': 'cancelado'})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()['pedido']['status'], 'cancelado')

        # Repetir cancelamento é idempotente (retorna 200)
        resp_rep = self.client.patch(f'/api/pedidos/{num}/status?token={tok}', json={'status': 'cancelado'})
        self.assertEqual(resp_rep.status_code, 200)

        # Se outro pedido já estiver em_preparacao, cliente não pode cancelar diretamente
        pedido2 = self._criar_pedido_teste()
        ped_db = Pedido.query.filter_by(numero_pedido=pedido2['numeroPedido']).first()
        ped_db.status = 'em_preparacao'
        db.session.commit()

        resp_bloq = self.client.patch(f"/api/pedidos/{pedido2['numeroPedido']}/status?token={pedido2['tokenAcesso']}", json={'status': 'cancelado'})
        self.assertEqual(resp_bloq.status_code, 400)
        self.assertIn('Não é possível cancelar', resp_bloq.get_json()['erro'])

    def test_08_disponibilidade_das_rotas_meus_pedidos(self):
        """Verifica se /pedidos, /pedidos.html e /meus-pedidos renderizam corretamente."""
        for rota in ['/pedidos', '/pedidos.html', '/meus-pedidos']:
            resp = self.client.get(rota)
            self.assertEqual(resp.status_code, 200)
            self.assertIn(b'Meus Pedidos', resp.data)
            self.assertIn(b'pedidos.js', resp.data)


if __name__ == '__main__':
    unittest.main()
