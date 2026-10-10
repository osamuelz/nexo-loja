"""
Testes automatizados completos para o Painel Administrativo da Loja Virtual Nexo.
Executa em banco de dados isolado (SQLite em memória).

Casos de teste cobertos:
1. Proteção de rotas: Visitante sem autenticação é bloqueado com 302/401 em todas as rotas e APIs /admin/*.
2. Hash criptográfico de senha: UsuarioAdmin armazena hash seguro sem expor senha em texto puro.
3. Login e Sessão: POST /admin/login rejeita credenciais inválidas (401) e autentica credenciais corretas.
4. Logout seguro: GET /admin/logout encerra a sessão e revoga o acesso.
5. Métricas e KPIs reais: GET /admin/api/metricas calcula totais monetários exatos e estoque crítico do banco.
6. Consulta e filtros de pedidos: GET /admin/api/pedidos suporta busca textual e filtro de status.
7. Detalhes e Auditoria: GET /admin/api/pedidos/<numero> traz histórico de alterações de status.
8. Transição de status pelo Admin: PATCH /admin/api/pedidos/<numero>/status atualiza status e adiciona auditoria.
9. Devolução de estoque no cancelamento: Ao cancelar um pedido, o estoque das variantes é restaurado atomicamente.
10. Sincronização com a área do cliente: O cliente enxerga o novo status atualizado pelo lojista em tempo real.
"""
import os
import unittest
from app import create_app
from app.config import normalizar_database_url
from app.extensions import db
from app.models import (
    UsuarioAdmin,
    Pedido,
    ItemPedido,
    HistoricoPedido,
    Produto,
    Variante,
    Categoria
)
from app.commands import popular_dados_demo


class TestAdminPainel(unittest.TestCase):
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

        # Cria administrador de teste
        self.admin = UsuarioAdmin(
            nome='Administrador Teste',
            email='admin.teste@nexo.com.br',
            cargo='Gerente Geral',
            ativo=True
        )
        self.admin.definir_senha('senhaSegura123')
        db.session.add(self.admin)
        db.session.commit()

    def tearDown(self):
        db_uri = self.app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if 'sqlite' not in db_uri and 'test' not in db_uri.lower():
            raise RuntimeError("Tentativa de executar drop_all em banco não-isolado de teste!")
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.app_context.pop()

    def _login_admin(self):
        """Helper para autenticar o cliente de teste na sessão administrativa."""
        resp = self.client.post('/admin/login', json={
            'email': 'admin.teste@nexo.com.br',
            'senha': 'senhaSegura123'
        })
        self.assertEqual(resp.status_code, 200)

    def _criar_pedido_teste(self, qtd=2):
        """Helper para criar um pedido real no banco."""
        variante = Variante.query.filter(Variante.estoque > 5).first()
        payload = {
            'idempotencyKey': f'teste-admin-{os.urandom(6).hex()}',
            'cliente': {
                'nome': 'Cliente Teste',
                'email': 'cliente@teste.com',
                'telefone': '(11) 98765-4321'
            },
            'endereco': {
                'cep': '01310-100',
                'logradouro': 'Av. Paulista',
                'numero': '1500',
                'cidade': 'São Paulo',
                'estado': 'SP'
            },
            'itens': [
                {
                    'produtoId': variante.produto_rel.id,
                    'varianteId': variante.id,
                    'nome': variante.produto_rel.nome,
                    'quantidade': qtd,
                    'precoUnitarioCentavos': variante.preco_centavos
                }
            ]
        }
        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        return data['pedido'], variante

    def test_01_bloqueio_visitante_sem_autenticacao(self):
        """Visitantes sem login não conseguem acessar telas nem APIs administrativas."""
        # 1. Telas HTML redirecionam para /admin/login
        resp_dash = self.client.get('/admin')
        self.assertEqual(resp_dash.status_code, 302)
        self.assertIn('/admin/login', resp_dash.headers.get('Location', ''))

        resp_pedidos = self.client.get('/admin/dashboard')
        self.assertEqual(resp_pedidos.status_code, 302)

        # 2. APIs JSON retornam 401 Unauthorized
        resp_api_metricas = self.client.get('/admin/api/metricas')
        self.assertEqual(resp_api_metricas.status_code, 401)
        self.assertFalse(resp_api_metricas.get_json()['sucesso'])

        resp_api_pedidos = self.client.get('/admin/api/pedidos')
        self.assertEqual(resp_api_pedidos.status_code, 401)

        resp_api_patch = self.client.patch('/admin/api/pedidos/NX-12345/status', json={'status': 'enviado'})
        self.assertEqual(resp_api_patch.status_code, 401)

    def test_02_hash_criptografico_de_senha(self):
        """Verifica que a senha é armazenada como hash seguro e nunca em texto puro."""
        self.assertNotEqual(self.admin.senha_hash, 'senhaSegura123')
        self.assertTrue(self.admin.senha_hash.startswith('scrypt:') or self.admin.senha_hash.startswith('pbkdf2:'))
        self.assertTrue(self.admin.verificar_senha('senhaSegura123'))
        self.assertFalse(self.admin.verificar_senha('senhaErrada'))
        self.assertFalse(self.admin.verificar_senha(''))

    def test_03_login_rejeita_credenciais_invalidas_e_aceita_validas(self):
        """Testa o fluxo de autenticação e criação de sessão segura, prevenindo Open Redirect."""
        # 1. E-mail inexistente
        resp1 = self.client.post('/admin/login', json={'email': 'inexistente@nexo.com', 'senha': '123'})
        self.assertEqual(resp1.status_code, 401)

        # 2. Senha errada
        resp2 = self.client.post('/admin/login', json={'email': 'admin.teste@nexo.com.br', 'senha': 'errada'})
        self.assertEqual(resp2.status_code, 401)

        # 3. Credenciais corretas com tentativa de Open Redirect
        resp3 = self.client.post('/admin/login?next=https://malicious.com', data={'email': 'admin.teste@nexo.com.br', 'senha': 'senhaSegura123'})
        self.assertEqual(resp3.status_code, 302)
        # Deve redirecionar para a rota local do dashboard e NÃO para https://malicious.com
        self.assertEqual(resp3.headers.get('Location'), '/admin/dashboard')

        # 4. Acesso autorizado ao dashboard
        resp_dash = self.client.get('/admin')
        self.assertEqual(resp_dash.status_code, 200)
        self.assertIn(b'Painel Operacional', resp_dash.data)

    def test_04_logout_encerra_sessao(self):
        """Verifica que o logout invalida a sessão administrativa."""
        self._login_admin()
        resp_ok = self.client.get('/admin')
        self.assertEqual(resp_ok.status_code, 200)

        # Executa logout
        resp_logout = self.client.get('/admin/logout')
        self.assertEqual(resp_logout.status_code, 302)

        # Tentativa subsequente de acesso deve ser bloqueada
        resp_pos = self.client.get('/admin')
        self.assertEqual(resp_pos.status_code, 302)
        self.assertIn('/admin/login', resp_pos.headers.get('Location', ''))

    def test_05_metricas_calculadas_com_dados_reais(self):
        """Verifica o cálculo de indicadores reais no PostgreSQL diferenciando vendas concluídas e pedidos ativos."""
        # Cria 2 pedidos de teste com status inicial 'recebido'
        p1, v1 = self._criar_pedido_teste(qtd=1)
        p2, v2 = self._criar_pedido_teste(qtd=2)

        self._login_admin()
        resp = self.client.get('/admin/api/metricas?periodo=tudo')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        m = data['metricas']

        total_esperado = p1['totalCentavos'] + p2['totalCentavos']
        self.assertEqual(m['faturamentoHojeCentavos'], total_esperado)
        self.assertEqual(m['pedidosAtivosQtd'], 2)
        # Pedidos recebidos NÃO são vendas concluídas (apenas pedidos 'entregue' contam como concluídos)
        self.assertEqual(m['vendasConcluidasQtd'], 0)
        self.assertEqual(m['pedidosEmAndamentoQtd'], 2)

        # Avança o pedido p1 até 'entregue'
        num1 = p1['numeroPedido']
        self.client.patch(f'/admin/api/pedidos/{num1}/status', json={'status': 'em_preparacao'})
        self.client.patch(f'/admin/api/pedidos/{num1}/status', json={'status': 'enviado'})
        self.client.patch(f'/admin/api/pedidos/{num1}/status', json={'status': 'entregue'})

        # Consulta métricas novamente: vendas concluídas agora é 1
        resp2 = self.client.get('/admin/api/metricas?periodo=tudo')
        m2 = resp2.get_json()['metricas']
        self.assertEqual(m2['vendasConcluidasQtd'], 1)
        self.assertEqual(m2['pedidosEmAndamentoQtd'], 1)
        self.assertGreater(m2['ticketMedioCentavos'], 0)
        self.assertGreater(m2['produtosAtivosQtd'], 0)
        self.assertGreater(m2['skusAtivosQtd'], 0)
        self.assertEqual(len(m2['graficoSemana']), 7)

    def test_06_consulta_pedidos_com_busca_e_filtros(self):
        """Testa listagem, busca e filtragem por status dos pedidos."""
        p1, _ = self._criar_pedido_teste()

        self._login_admin()
        # Listagem completa
        resp = self.client.get('/admin/api/pedidos')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        self.assertGreaterEqual(data['total'], 1)

        # Busca por número do pedido
        resp_busca = self.client.get(f'/admin/api/pedidos?busca={p1["numeroPedido"]}')
        self.assertEqual(resp_busca.status_code, 200)
        self.assertEqual(resp_busca.get_json()['total'], 1)

        # Filtro por status
        resp_status = self.client.get('/admin/api/pedidos?status=recebido')
        self.assertEqual(resp_status.status_code, 200)
        self.assertGreaterEqual(resp_status.get_json()['total'], 1)

        resp_status_vazio = self.client.get('/admin/api/pedidos?status=entregue')
        self.assertEqual(resp_status_vazio.status_code, 200)
        self.assertEqual(resp_status_vazio.get_json()['total'], 0)

    def test_07_atualizacao_de_status_pelo_administrador(self):
        """Administrador atualiza status com gravação no histórico de auditoria."""
        pedido, _ = self._criar_pedido_teste()
        num = pedido['numeroPedido']

        self._login_admin()

        # 1. Transição recebido -> em_preparacao
        resp1 = self.client.patch(
            f'/admin/api/pedidos/{num}/status',
            json={'status': 'em_preparacao', 'observacao': 'Em separação na doca 2.'}
        )
        self.assertEqual(resp1.status_code, 200)
        data1 = resp1.get_json()
        self.assertEqual(data1['pedido']['status'], 'em_preparacao')

        # 2. Transição em_preparacao -> enviado
        resp2 = self.client.patch(
            f'/admin/api/pedidos/{num}/status',
            json={'status': 'enviado', 'observacao': 'Coletado pela transportadora.'}
        )
        self.assertEqual(resp2.status_code, 200)
        self.assertEqual(resp2.get_json()['pedido']['status'], 'enviado')

        # 3. Verifica histórico de auditoria
        resp_det = self.client.get(f'/admin/api/pedidos/{num}')
        self.assertEqual(resp_det.status_code, 200)
        historico = resp_det.get_json()['pedido']['historico']
        self.assertGreaterEqual(len(historico), 3) # Inicial + 2 transições
        autores = [h['autor'] for h in historico]
        self.assertTrue(any('Administrador Teste' in a for a in autores))

    def test_08_devolucao_de_estoque_ao_cancelar_pedido(self):
        """Ao cancelar um pedido, o estoque das variantes é restaurado atomicamente no PostgreSQL."""
        # Verifica estoque inicial da variante
        variante = Variante.query.filter(Variante.estoque > 5).first()
        estoque_antes_compra = variante.estoque
        qtd_comprada = 3

        # Realiza a compra
        payload = {
            'idempotencyKey': 'teste-estorno-001',
            'cliente': {'nome': 'Comprador A', 'email': 'a@teste.com', 'telefone': '(11) 9999-8888'},
            'endereco': {'cep': '01310-100', 'logradouro': 'Rua Teste', 'numero': '10', 'cidade': 'SP', 'estado': 'SP'},
            'itens': [{'produtoId': variante.produto_rel.id, 'varianteId': variante.id, 'nome': variante.produto_rel.nome, 'quantidade': qtd_comprada, 'precoUnitarioCentavos': variante.preco_centavos}]
        }
        resp_compra = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp_compra.status_code, 201)
        num_pedido = resp_compra.get_json()['pedido']['numeroPedido']

        # Confere baixa de estoque
        db.session.expire_all()
        var_pos_compra = db.session.get(Variante, variante.id)
        self.assertEqual(var_pos_compra.estoque, estoque_antes_compra - qtd_comprada)

        # Administrador cancela o pedido
        self._login_admin()
        resp_cancel = self.client.patch(
            f'/admin/api/pedidos/{num_pedido}/status',
            json={'status': 'cancelado', 'observacao': 'Cliente desistiu antes do envio.'}
        )
        self.assertEqual(resp_cancel.status_code, 200)
        self.assertEqual(resp_cancel.get_json()['pedido']['status'], 'cancelado')

        # Comprova que o estoque foi 100% devolvido ao banco de dados
        db.session.expire_all()
        var_pos_cancel = db.session.get(Variante, variante.id)
        self.assertEqual(var_pos_cancel.estoque, estoque_antes_compra)

    def test_09_sincronizacao_com_area_meus_pedidos_do_cliente(self):
        """Quando o administrador altera o status, o cliente visualiza imediatamente em Meus Pedidos."""
        pedido, _ = self._criar_pedido_teste()
        num = pedido['numeroPedido']
        tok = pedido['tokenAcesso']

        # Cliente consulta e vê status inicial 'recebido'
        resp_cli_ini = self.client.get(f'/api/pedidos/{num}?token={tok}')
        self.assertEqual(resp_cli_ini.status_code, 200)
        self.assertEqual(resp_cli_ini.get_json()['pedido']['status'], 'recebido')

        # Administrador avança para 'em_preparacao'
        self._login_admin()
        resp_admin = self.client.patch(f'/admin/api/pedidos/{num}/status', json={'status': 'em_preparacao'})
        self.assertEqual(resp_admin.status_code, 200)

        # Cliente consulta novamente e vê 'em_preparacao' em tempo real
        resp_cli_pos = self.client.get(f'/api/pedidos/{num}?token={tok}')
        self.assertEqual(resp_cli_pos.status_code, 200)
        self.assertEqual(resp_cli_pos.get_json()['pedido']['status'], 'em_preparacao')


if __name__ == '__main__':
    unittest.main()
