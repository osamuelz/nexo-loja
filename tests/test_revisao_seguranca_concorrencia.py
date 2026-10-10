"""
Nexo - Loja Virtual
Suíte de Testes de Regressão e Concorrência (Revisão para GitHub)

Cobre os casos identificados na auditoria de segurança e consistência:
1. Permissões de cliente vs administrador (403 para avanço operacional de status pelo cliente)
2. Cancelamento de pedido pelo cliente restrito estritamente ao estado 'recebido'
3. Rejeição de incompatibilidade entre produtoId e varianteId (variante de outro produto)
4. Validação estrita de tipos e campos no checkout (booleanos, decimais, nome numérico, endereço)
5. Paginação administrativa resiliente contra entradas inválidas (sem erro 500)
6. Idempotência do comando seed-demo preservando estoques após compras ativas
7. Métricas por período no painel administrativo e diferenciação de vendas concluídas
8. Prevenção de vulnerabilidade Open Redirect no login administrativo
9. Teste de concorrência com estoque unitário (evitando venda dupla da mesma unidade)
"""
import unittest
from datetime import datetime, timezone, timedelta
from app import create_app
from app.models import db, Categoria, Produto, Variante, Pedido, ItemPedido, UsuarioAdmin
from app.commands import popular_dados_demo


class TestRevisaoSegurancaConcorrencia(unittest.TestCase):

    def setUp(self):
        self.app = create_app('testing')
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()

        db.create_all()
        popular_dados_demo(reset_estoques=True)

        # Cria operador administrativo para testes
        self.admin = UsuarioAdmin(
            nome="Admin Auditor",
            email="auditor@nexo.com.br",
            cargo="Auditor de Qualidade",
            ativo=True
        )
        self.admin.definir_senha("SenhaAuditor123")
        db.session.add(self.admin)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def _login_admin(self):
        return self.client.post('/admin/login', data={
            'email': 'auditor@nexo.com.br',
            'senha': 'SenhaAuditor123'
        })

    def _criar_pedido_exemplo(self, variante, quantidade=1):
        payload = {
            'cliente': {
                'nome': 'João da Silva',
                'email': 'joao.silva@exemplo.com',
                'telefone': '11987654321',
                'endereco': {
                    'cep': '01310-100',
                    'logradouro': 'Av. Paulista',
                    'numero': '1500',
                    'cidade': 'São Paulo',
                    'estado': 'SP'
                }
            },
            'itens': [
                {
                    'produtoId': variante.produto_rel.id,
                    'varianteId': variante.id,
                    'nome': variante.produto_rel.nome,
                    'quantidade': quantidade,
                    'precoUnitarioCentavos': variante.preco_centavos
                }
            ]
        }
        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 201)
        return resp.get_json()['pedido']

    def test_01_bloqueio_comprador_avancar_status(self):
        """Cliente com token não consegue mudar status para em_preparacao, enviado ou entregue (403)."""
        variante = Variante.query.filter(Variante.estoque >= 5).first()
        pedido = self._criar_pedido_exemplo(variante)
        num = pedido['numeroPedido']
        tok = pedido['tokenAcesso']

        for status_proibido in ['em_preparacao', 'enviado', 'entregue']:
            resp = self.client.patch(
                f'/api/pedidos/{num}/status?token={tok}',
                json={'status': status_proibido}
            )
            self.assertEqual(resp.status_code, 403)
            self.assertFalse(resp.get_json()['sucesso'])
            self.assertIn('restrita a administradores', resp.get_json()['erro'])

    def test_02_cancelamento_comprador_restrito_ao_status_recebido(self):
        """Comprador pode cancelar pedido em 'recebido', mas recebe 400 se já estiver em processamento."""
        variante = Variante.query.filter(Variante.estoque >= 5).first()
        estoque_original = variante.estoque
        pedido = self._criar_pedido_exemplo(variante, quantidade=2)
        num = pedido['numeroPedido']
        tok = pedido['tokenAcesso']

        # Confere baixa de estoque para estoque_original - 2
        var_db = db.session.get(Variante, variante.id)
        self.assertEqual(var_db.estoque, estoque_original - 2)

        # Cancelamento pelo cliente no estado inicial 'recebido' tem sucesso
        resp_canc = self.client.patch(
            f'/api/pedidos/{num}/status?token={tok}',
            json={'status': 'cancelado'}
        )
        self.assertEqual(resp_canc.status_code, 200)
        self.assertEqual(resp_canc.get_json()['pedido']['status'], 'cancelado')

        # Comprova restituição do estoque
        db.session.expire_all()
        var_devolvido = db.session.get(Variante, variante.id)
        self.assertEqual(var_devolvido.estoque, estoque_original)

        # Cria outro pedido e avança via admin para 'em_preparacao'
        pedido2 = self._criar_pedido_exemplo(variante, quantidade=1)
        num2 = pedido2['numeroPedido']
        tok2 = pedido2['tokenAcesso']

        self._login_admin()
        self.client.patch(f'/admin/api/pedidos/{num2}/status', json={'status': 'em_preparacao'})

        # Agora o cliente tenta cancelar: deve ser rejeitado com 400
        resp_rejeita = self.client.patch(
            f'/api/pedidos/{num2}/status?token={tok2}',
            json={'status': 'cancelado'}
        )
        self.assertEqual(resp_rejeita.status_code, 400)
        self.assertIn('Não é possível cancelar o pedido diretamente pelo cliente', resp_rejeita.get_json()['erro'])

    def test_03_checkout_rejeita_variante_pertencente_a_outro_produto(self):
        """Checkout rejeita com 400 quando o varianteId não pertence ao produtoId informado."""
        produtos = Produto.query.filter(Produto.ativo == True).all()
        prod_a = produtos[0]
        prod_b = produtos[1]
        var_b = prod_b.variantes[0]

        payload = {
            'cliente': {
                'nome': 'Carlos Silva',
                'email': 'carlos@exemplo.com',
                'telefone': '11987654321',
                'endereco': {
                    'cep': '01310-100',
                    'logradouro': 'Av. Paulista',
                    'numero': '1500',
                    'cidade': 'São Paulo',
                    'estado': 'SP'
                }
            },
            'itens': [
                {
                    'produtoId': prod_a.id,       # Produto A informado
                    'varianteId': var_b.id,       # Variante pertencente ao Produto B
                    'quantidade': 1
                }
            ]
        }
        resp = self.client.post('/api/pedidos', json=payload)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('não pertence ao produto', resp.get_json()['erro'])

    def test_04_checkout_validacao_estrita_de_tipos(self):
        """Valida que quantidades booleanas, decimais ou nomes puramente numéricos são rejeitados com 400."""
        variante = Variante.query.filter(Variante.estoque >= 5).first()

        base_payload = {
            'cliente': {
                'nome': 'Maria Santos',
                'email': 'maria@exemplo.com',
                'telefone': '11987654321',
                'endereco': {
                    'cep': '01310-100',
                    'logradouro': 'Av. Paulista',
                    'numero': '1500',
                    'cidade': 'São Paulo',
                    'estado': 'SP'
                }
            },
            'itens': [
                {
                    'produtoId': variante.produto_rel.id,
                    'varianteId': variante.id,
                    'quantidade': 1
                }
            ]
        }

        # 1. Quantidade booleana (True)
        p1 = dict(base_payload)
        p1['itens'] = [{'produtoId': variante.produto_rel.id, 'varianteId': variante.id, 'quantidade': True}]
        r1 = self.client.post('/api/pedidos', json=p1)
        self.assertEqual(r1.status_code, 400)

        # 2. Quantidade decimal (1.7)
        p2 = dict(base_payload)
        p2['itens'] = [{'produtoId': variante.produto_rel.id, 'varianteId': variante.id, 'quantidade': 1.7}]
        r2 = self.client.post('/api/pedidos', json=p2)
        self.assertEqual(r2.status_code, 400)

        # 3. Nome numérico (123)
        p3 = dict(base_payload)
        p3['cliente'] = dict(base_payload['cliente'])
        p3['cliente']['nome'] = 123
        r3 = self.client.post('/api/pedidos', json=p3)
        self.assertEqual(r3.status_code, 400)

        # 4. Endereço incompleto (sem CEP e sem rua)
        p4 = dict(base_payload)
        p4['cliente'] = dict(base_payload['cliente'])
        p4['cliente']['endereco'] = {'cep': '', 'logradouro': ''}
        r4 = self.client.post('/api/pedidos', json=p4)
        self.assertEqual(r4.status_code, 400)

    def test_05_admin_paginacao_entradas_invalidas_sem_erro_500(self):
        """Parâmetros de paginação inválidos como limite=abc e pagina=xyz não produzem erro 500."""
        self._login_admin()
        resp = self.client.get('/admin/api/pedidos?limite=abc&pagina=xyz')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        self.assertEqual(data['limite'], 50)
        self.assertEqual(data['pagina'], 1)

    def test_06_seed_demo_preserva_estoque_apos_compras(self):
        """Executar o seed normal preserva os estoques ativos; passar reset_estoques=True restaura."""
        variante = Variante.query.filter(Variante.estoque == 10).first()
        estoque_inicial = variante.estoque

        # Compra 3 unidades
        self._criar_pedido_exemplo(variante, quantidade=3)
        db.session.expire_all()
        var_pos = db.session.get(Variante, variante.id)
        self.assertEqual(var_pos.estoque, estoque_inicial - 3)

        # Executa seed idempotente normal: estoque NÃO é sobrescrito
        popular_dados_demo(reset_estoques=False)
        db.session.expire_all()
        var_apos_seed = db.session.get(Variante, variante.id)
        self.assertEqual(var_apos_seed.estoque, estoque_inicial - 3)

        # Executa seed forçado com reset: restaura o estoque inicial de demonstração
        popular_dados_demo(reset_estoques=True)
        db.session.expire_all()
        var_apos_reset = db.session.get(Variante, variante.id)
        self.assertEqual(var_apos_reset.estoque, estoque_inicial)

    def test_07_metricas_admin_filtro_por_periodo(self):
        """API de métricas administrativas aplica filtros de período (hoje, 7dias, mes, tudo)."""
        variante = Variante.query.filter(Variante.estoque >= 5).first()
        self._criar_pedido_exemplo(variante, quantidade=1)

        self._login_admin()
        for p in ['hoje', '7dias', 'mes', 'tudo']:
            resp = self.client.get(f'/admin/api/metricas?periodo={p}')
            self.assertEqual(resp.status_code, 200)
            data = resp.get_json()
            self.assertTrue(data['sucesso'])
            self.assertIn('faturamentoPeriodoCentavos', data['metricas'])
            self.assertIn('pedidosAtivosQtd', data['metricas'])
            self.assertIn('vendasConcluidasQtd', data['metricas'])

    def test_08_admin_login_previne_open_redirect(self):
        """Tentativa de login com next=https://malicious.com redireciona para rota interna segura."""
        resp = self.client.post(
            '/admin/login?next=https://malicious.com',
            data={'email': 'auditor@nexo.com.br', 'senha': 'SenhaAuditor123'}
        )
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(resp.headers.get('Location'), '/admin/dashboard')

    def test_09_concorrencia_simulada_ultima_unidade(self):
        """Quando o estoque é 1, a primeira compra vence e a segunda falha com 409 (sem estoque negativo)."""
        variante = Variante.query.filter(Variante.ativo == True).first()
        variante.estoque = 1
        db.session.commit()

        payload_1 = {
            'idempotencyKey': 'req-concorrente-1',
            'cliente': {
                'nome': 'Comprador 1',
                'email': 'comp1@teste.com',
                'telefone': '11988887777',
                'endereco': 'Av. Paulista, 100 • SP'
            },
            'itens': [{'produtoId': variante.produto_rel.id, 'varianteId': variante.id, 'quantidade': 1}]
        }

        payload_2 = {
            'idempotencyKey': 'req-concorrente-2',
            'cliente': {
                'nome': 'Comprador 2',
                'email': 'comp2@teste.com',
                'telefone': '11977776666',
                'endereco': 'Av. Paulista, 200 • SP'
            },
            'itens': [{'produtoId': variante.produto_rel.id, 'varianteId': variante.id, 'quantidade': 1}]
        }

        # Primeira compra adquire a única unidade disponível
        resp1 = self.client.post('/api/pedidos', json=payload_1)
        self.assertEqual(resp1.status_code, 201)

        # Segunda compra tenta a mesma unidade: rejeitada com 409
        resp2 = self.client.post('/api/pedidos', json=payload_2)
        self.assertEqual(resp2.status_code, 409)
        self.assertTrue(resp2.get_json()['estoqueInsuficiente'])

        # Estoque final permanece estritamente em 0
        db.session.expire_all()
        var_final = db.session.get(Variante, variante.id)
        self.assertEqual(var_final.estoque, 0)


if __name__ == '__main__':
    unittest.main()
