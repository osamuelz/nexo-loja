"""
Testes automatizados completos para a Etapa 4 da Loja Virtual Nexo.
Executa em banco de dados isolado (SQLite em memória).
Verifica:
- Inicialização do Flask
- Migrações e tabelas
- Idempotência do cadastro de demonstração (sem duplicação)
- Listagem dos 12 produtos e detalhes
- Produto inexistente (404) e variantes com estoque
- Integridade monetária (centavos inteiros, sem ponto flutuante)
- Endpoint autoritativo de validação de carrinho (/api/carrinho/validar)
- Rotas de visualização e arquivos estáticos
"""
import os
import unittest
from unittest.mock import patch
from app import create_app
from app.config import normalizar_database_url
from app.extensions import db
from app.models import Categoria, Produto, Variante
from app.commands import popular_dados_demo


class TestEtapa4Backend(unittest.TestCase):
    def setUp(self):
        # Cria app isolada com TestingConfig (SQLite in-memory)
        self.app = create_app('testing')

        # TRAVA DE SEGURANÇA EXPLÍCITA:
        # Garante que os testes NUNCA executem operações destrutivas contra o banco de produção/desenvolvimento
        db_uri = self.app.config.get('SQLALCHEMY_DATABASE_URI', '')
        main_uri = os.getenv('DATABASE_URL')
        if main_uri and (db_uri == normalizar_database_url(main_uri) or 'nexo_db' in db_uri):
            raise RuntimeError(
                "VIOLAÇÃO CRÍTICA DE SEGURANÇA: Testes configurados para o banco principal! Operação abortada."
            )

        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()

        # Cria tabelas no banco de teste
        db.create_all()

    def tearDown(self):
        db_uri = self.app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if 'sqlite' not in db_uri and 'test' not in db_uri.lower():
            raise RuntimeError("Tentativa de executar drop_all em banco não-isolado de teste!")
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.app_context.pop()

    def test_01_seed_demo_e_idempotencia(self):
        """Testa o cadastro inicial dos 12 produtos e verifica se a repetição não duplica registros."""
        n_cat, n_prod, n_var = popular_dados_demo()
        self.assertEqual(n_cat, 4)
        self.assertEqual(n_prod, 12)
        self.assertEqual(n_var, 37)

        # Contagens no banco
        self.assertEqual(Categoria.query.count(), 4)
        self.assertEqual(Produto.query.count(), 12)
        self.assertEqual(Variante.query.count(), 37)

        # Executa novamente para comprovar idempotência
        n_cat2, n_prod2, n_var2 = popular_dados_demo()
        self.assertEqual(Categoria.query.count(), 4, "Categorias não devem ser duplicadas")
        self.assertEqual(Produto.query.count(), 12, "Produtos não devem ser duplicados")
        self.assertEqual(Variante.query.count(), 37, "Variantes não devem ser duplicadas")

    def test_02_integridade_monetaria_centavos_inteiros(self):
        """Verifica se todos os preços são rigorosamente inteiros (centavos), sem ponto flutuante."""
        popular_dados_demo()
        produtos = Produto.query.all()
        for p in produtos:
            self.assertIsInstance(p.preco_base_centavos, int)
            self.assertGreater(p.preco_base_centavos, 0)
            for v in p.variantes:
                self.assertIsInstance(v.preco_centavos, int)
                self.assertIsInstance(v.acrescimo_centavos, int)
                self.assertIsInstance(v.estoque, int)
                self.assertGreaterEqual(v.estoque, 0)

    def test_03_api_categorias(self):
        """Testa listagem de categorias via API RESTful."""
        popular_dados_demo()
        resp = self.client.get('/api/categorias')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        self.assertEqual(len(data['categorias']), 4)
        nomes = [c['nome'] for c in data['categorias']]
        self.assertIn('Celulares', nomes)
        self.assertIn('Informática', nomes)
        self.assertIn('Eletrodomésticos', nomes)
        self.assertIn('Acessórios', nomes)

    def test_04_api_produtos_listagem_e_filtros(self):
        """Testa listagem, busca e filtros na API de produtos."""
        popular_dados_demo()

        # Listagem completa dos 12 produtos
        resp = self.client.get('/api/produtos')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertEqual(data['total'], 12)
        self.assertEqual(len(data['produtos']), 12)

        # Filtro por categoria
        resp_cel = self.client.get('/api/produtos?categoria=Celulares')
        data_cel = resp_cel.get_json()
        self.assertEqual(data_cel['total'], 2)

        # Filtro por busca textual
        resp_busca = self.client.get('/api/produtos?busca=Frost')
        data_busca = resp_busca.get_json()
        self.assertEqual(data_busca['total'], 1)
        self.assertEqual(data_busca['produtos'][0]['id'], 'geladeira-frost-free-400l')

    def test_05_api_produto_detalhes_e_404(self):
        """Testa detalhes de um produto existente e resposta 404 para inexistente."""
        popular_dados_demo()

        # Produto existente
        resp = self.client.get('/api/produtos/smartphone-nexo-one')
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        prod = data['produto']
        self.assertEqual(prod['id'], 'smartphone-nexo-one')
        self.assertIn('variantes', prod)
        self.assertEqual(len(prod['variantes']), 9)  # 3 cores x 3 capacidades
        self.assertIn('opcoesCores', prod)
        self.assertEqual(len(prod['opcoesCores']), 3)

        # Produto inexistente deve retornar 404
        resp_404 = self.client.get('/api/produtos/produto-que-nao-existe-xyz')
        self.assertEqual(resp_404.status_code, 404)
        data_404 = resp_404.get_json()
        self.assertFalse(data_404['sucesso'])

    def test_06_api_carrinho_validacao_autoritativa(self):
        """Testa a validação autoritativa do carrinho contra o catálogo do PostgreSQL."""
        popular_dados_demo()

        # 1. Item perfeitamente válido
        payload_valido = {
            'itens': [
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb',
                    'quantidade': 2,
                    'precoUnitarioCentavos': 179900
                }
            ]
        }
        resp = self.client.post('/api/carrinho/validar', json=payload_valido)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['sucesso'])
        self.assertTrue(data['valido'])
        self.assertEqual(len(data['itens']), 1)
        self.assertEqual(data['itens'][0]['quantidade'], 2)
        self.assertEqual(data['itens'][0]['precoUnitarioCentavos'], 179900)

        # 2. Produto inexistente ou removido
        payload_removido = {
            'itens': [
                {
                    'produtoId': 'produto-inexistente-123',
                    'varianteId': 'qualquer',
                    'quantidade': 1,
                    'precoUnitarioCentavos': 1000
                }
            ]
        }
        resp_rem = self.client.post('/api/carrinho/validar', json=payload_removido)
        data_rem = resp_rem.get_json()
        self.assertFalse(data_rem['valido'])
        self.assertEqual(len(data_rem['itens']), 0)
        self.assertGreater(len(data_rem['avisos']), 0)

        # 3. Quantidade que excede o estoque disponível
        # smartphone-nexo-one com 512 GB tem estoque = 2
        payload_excesso = {
            'itens': [
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--512-gb',
                    'quantidade': 10,
                    'precoUnitarioCentavos': 249900
                }
            ]
        }
        resp_exc = self.client.post('/api/carrinho/validar', json=payload_excesso)
        data_exc = resp_exc.get_json()
        self.assertFalse(data_exc['valido'])
        self.assertEqual(data_exc['itens'][0]['quantidade'], 2, "Quantidade deve ser ajustada para o limite em estoque")
        self.assertIn("ajustada", data_exc['avisos'][0])

        # 4. Variante esgotada (estoque 0)
        var_esgotada = Variante.query.filter_by(slug='smartphone-nexo-one--titanio-natural--512-gb').first()
        var_esgotada.estoque = 0
        db.session.commit()

        payload_esgotado = {
            'itens': [
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--512-gb',
                    'quantidade': 1,
                    'precoUnitarioCentavos': 249900
                }
            ]
        }
        resp_esg = self.client.post('/api/carrinho/validar', json=payload_esgotado)
        data_esg = resp_esg.get_json()
        self.assertFalse(data_esg['valido'])
        self.assertEqual(len(data_esg['itens']), 0, "Item com estoque zero deve ser removido do carrinho")
        self.assertIn("esgotou", data_esg['avisos'][0])

        # 5. Preço desatualizado no cliente
        var_preco = Variante.query.filter_by(slug='smartphone-nexo-one--titanio-natural--128-gb').first()
        payload_preco_antigo = {
            'itens': [
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb',
                    'quantidade': 1,
                    'precoUnitarioCentavos': 100000  # R$ 1.000 em vez de R$ 1.799
                }
            ]
        }
        resp_prc = self.client.post('/api/carrinho/validar', json=payload_preco_antigo)
        data_prc = resp_prc.get_json()
        self.assertFalse(data_prc['valido'])
        self.assertEqual(data_prc['itens'][0]['precoUnitarioCentavos'], 179900)
        self.assertIn("atualizado", data_prc['avisos'][0])

    def test_07_rotas_templates_e_arquivos_estaticos(self):
        """Verifica se todas as páginas HTML e arquivos estáticos são servidos com sucesso."""
        # Páginas
        resp_home = self.client.get('/')
        self.assertEqual(resp_home.status_code, 200)

        resp_home_html = self.client.get('/index.html')
        self.assertEqual(resp_home_html.status_code, 200)

        resp_prod = self.client.get('/produto')
        self.assertEqual(resp_prod.status_code, 200)

        resp_prod_html = self.client.get('/produto.html')
        self.assertEqual(resp_prod_html.status_code, 200)

        resp_cart = self.client.get('/carrinho')
        self.assertEqual(resp_cart.status_code, 200)

        resp_cart_html = self.client.get('/carrinho.html')
        self.assertEqual(resp_cart_html.status_code, 200)

        # Estáticos em /static/
        resp_css = self.client.get('/static/css/styles.css')
        self.assertEqual(resp_css.status_code, 200)
        resp_css.close()

        resp_js_api = self.client.get('/static/js/api.js')
        self.assertEqual(resp_js_api.status_code, 200)
        resp_js_api.close()

        resp_js_cat = self.client.get('/static/js/catalogo.js')
        self.assertEqual(resp_js_cat.status_code, 200)
        resp_js_cat.close()

        # Fallback de compatibilidade em /assets/
        resp_assets_css = self.client.get('/assets/css/styles.css')
        self.assertEqual(resp_assets_css.status_code, 200)
        resp_assets_css.close()

    def test_08_protecao_e_isolamento_banco_testes(self):
        """Comprova isolamento estrito de testes e bloqueio quando TEST_DATABASE_URL espelha DATABASE_URL."""
        app_teste = create_app('testing')
        self.assertTrue(app_teste.config['TESTING'])
        self.assertIn('sqlite', app_teste.config['SQLALCHEMY_DATABASE_URI'])

        # Testa trava de segurança quando TEST_DATABASE_URL tenta espelhar DATABASE_URL
        main_url = os.getenv('DATABASE_URL')
        if main_url:
            with patch.dict(os.environ, {'TEST_DATABASE_URL': main_url}):
                with self.assertRaises(RuntimeError):
                    create_app('testing')

    def test_09_busca_sem_acentos(self):
        """Verifica que a busca textual no catálogo funciona com e sem acentos ('memoria' vs 'memória')."""
        popular_dados_demo()

        # Busca sem acento
        resp_sem_acento = self.client.get('/api/produtos?busca=memoria')
        self.assertEqual(resp_sem_acento.status_code, 200)
        data_sem = resp_sem_acento.get_json()
        nomes_sem = [p['nome'] for p in data_sem['produtos']]
        self.assertTrue(any('Memória RAM' in n for n in nomes_sem), "Busca por 'memoria' deve encontrar 'Memória RAM'")

        # Busca com acento
        resp_com_acento = self.client.get('/api/produtos?busca=memória')
        self.assertEqual(resp_com_acento.status_code, 200)
        data_com = resp_com_acento.get_json()
        nomes_com = [p['nome'] for p in data_com['produtos']]
        self.assertTrue(any('Memória RAM' in n for n in nomes_com), "Busca por 'memória' deve encontrar 'Memória RAM'")

        # Busca por 'nucleos' deve encontrar 'Processador de 6 núcleos'
        resp_nuc = self.client.get('/api/produtos?busca=nucleos')
        data_nuc = resp_nuc.get_json()
        nomes_nuc = [p['nome'] for p in data_nuc['produtos']]
        self.assertTrue(any('núcleos' in n for n in nomes_nuc), "Busca por 'nucleos' deve encontrar 'Processador de 6 núcleos'")

    def test_10_categoria_e_produtos_inativos(self):
        """Garante que produtos com categorias inativas retornam 404 em detalhes e são rejeitados no carrinho."""
        popular_dados_demo()
        cat_cel = Categoria.query.filter_by(slug='celulares').first()
        self.assertIsNotNone(cat_cel)

        # Desativa a categoria inteira
        cat_cel.ativo = False
        db.session.commit()

        # Detalhe do produto deve responder 404
        resp_detalhe = self.client.get('/api/produtos/smartphone-nexo-one')
        self.assertEqual(resp_detalhe.status_code, 404)

        # Validação do carrinho deve remover o produto com aviso
        payload = {
            'itens': [
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb',
                    'quantidade': 1
                }
            ]
        }
        resp_cart = self.client.post('/api/carrinho/validar', json=payload)
        self.assertEqual(resp_cart.status_code, 200)
        data_cart = resp_cart.get_json()
        self.assertFalse(data_cart['valido'])
        self.assertEqual(len(data_cart['itens']), 0)
        self.assertIn("não está mais disponível", data_cart['avisos'][0])

    def test_11_validacao_entradas_invalidas_carrinho(self):
        """Testa rejeição estrita (HTTP 400) para corpos não-objeto, quantidades inválidas ou tipos errados."""
        popular_dados_demo()

        # 1. Corpo não é um objeto JSON (ex: lista [1])
        resp1 = self.client.post('/api/carrinho/validar', data='[1]', content_type='application/json')
        self.assertEqual(resp1.status_code, 400)

        # 2. Quantidade negativa (-3)
        p_neg = {'itens': [{'produtoId': 'smartphone-nexo-one', 'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb', 'quantidade': -3}]}
        resp2 = self.client.post('/api/carrinho/validar', json=p_neg)
        self.assertEqual(resp2.status_code, 400)

        # 3. Quantidade zero (0)
        p_zero = {'itens': [{'produtoId': 'smartphone-nexo-one', 'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb', 'quantidade': 0}]}
        resp3 = self.client.post('/api/carrinho/validar', json=p_zero)
        self.assertEqual(resp3.status_code, 400)

        # 4. Quantidade fracionária (1.8)
        p_float = {'itens': [{'produtoId': 'smartphone-nexo-one', 'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb', 'quantidade': 1.8}]}
        resp4 = self.client.post('/api/carrinho/validar', json=p_float)
        self.assertEqual(resp4.status_code, 400)

        # 5. Quantidade booleana (True)
        p_bool = {'itens': [{'produtoId': 'smartphone-nexo-one', 'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb', 'quantidade': True}]}
        resp5 = self.client.post('/api/carrinho/validar', json=p_bool)
        self.assertEqual(resp5.status_code, 400)

        # 6. Quantidade string ('abc')
        p_str = {'itens': [{'produtoId': 'smartphone-nexo-one', 'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb', 'quantidade': 'abc'}]}
        resp6 = self.client.post('/api/carrinho/validar', json=p_str)
        self.assertEqual(resp6.status_code, 400)

        # 7. Preço anterior string ('abc')
        p_preco_str = {'itens': [{'produtoId': 'smartphone-nexo-one', 'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb', 'quantidade': 1, 'precoUnitarioCentavos': 'abc'}]}
        resp7 = self.client.post('/api/carrinho/validar', json=p_preco_str)
        self.assertEqual(resp7.status_code, 400)

    def test_12_consolidacao_variantes_e_estoque(self):
        """Verifica se itens duplicados da mesma variante são somados antes de checar o limite de estoque."""
        popular_dados_demo()
        # A variante 'smartphone-nexo-one--titanio-natural--128-gb' tem estoque = 8 no demo
        var = Variante.query.filter_by(slug='smartphone-nexo-one--titanio-natural--128-gb').first()
        self.assertEqual(var.estoque, 8)

        # Envia duas linhas com quantidade 5 cada (total = 10, excede o estoque 8)
        payload = {
            'itens': [
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb',
                    'quantidade': 5,
                    'precoUnitarioCentavos': 179900
                },
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb',
                    'quantidade': 5,
                    'precoUnitarioCentavos': 179900
                }
            ]
        }
        resp = self.client.post('/api/carrinho/validar', json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()

        # Deve consolidar em apenas 1 item
        self.assertEqual(len(data['itens']), 1, "Linhas duplicadas devem ser consolidadas")
        item_cons = data['itens'][0]
        # Quantidade deve ser limitada ao estoque real (8), não a 10
        self.assertEqual(item_cons['quantidade'], 8)
        self.assertFalse(data['valido'])
        self.assertTrue(any("ajustada de 10 para 8" in aviso for aviso in data['avisos']))

    def test_13_contrato_compatibilidade_carrinho(self):
        """Garante que o backend suporta 'id' legado ou 'produtoId', devolvendo ambos os campos e o estoque real."""
        popular_dados_demo()

        # Envia apenas com 'id' legado (formato anterior do produto.js)
        payload_legado = {
            'itens': [
                {
                    'id': 'smartphone-nexo-one',
                    'varianteId': 'smartphone-nexo-one--titanio-natural--128-gb',
                    'quantidade': 2,
                    'precoUnitarioCentavos': 179900
                }
            ]
        }
        resp = self.client.post('/api/carrinho/validar', json=payload_legado)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data['valido'])
        self.assertEqual(len(data['itens']), 1)

        item = data['itens'][0]
        self.assertEqual(item['id'], 'smartphone-nexo-one')
        self.assertEqual(item['produtoId'], 'smartphone-nexo-one')
        self.assertEqual(item['varianteId'], 'smartphone-nexo-one--titanio-natural--128-gb')
        self.assertEqual(item['quantidade'], 2)
        self.assertEqual(item['estoque'], 8)  # Estoque real enviado ao frontend


if __name__ == '__main__':
    unittest.main()
