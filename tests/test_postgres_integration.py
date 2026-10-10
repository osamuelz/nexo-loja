"""
Testes de integração específicos para o banco de dados PostgreSQL (nexo_db).
Executa transações de leitura e testes do fluxo real da API sobre a base real do PostgreSQL.
NÃO realiza operações destrutivas (drop_all é expressamente proibido aqui).
"""
import os
import unittest
from app import create_app
from app.extensions import db
from app.models import Categoria, Produto, Variante


@unittest.skipUnless(
    os.getenv('NEXO_TEST_POSTGRES') == '1',
    'Integração opcional: configure DATABASE_URL e NEXO_TEST_POSTGRES=1.'
)
class TestPostgresIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Utiliza o perfil de desenvolvimento que conecta ao PostgreSQL via psycopg
        cls.app = create_app('development')
        cls.app_context = cls.app.app_context()
        cls.app_context.push()
        cls.client = cls.app.test_client()

        # Garante que estamos de fato conectados ao PostgreSQL
        uri = cls.app.config.get('SQLALCHEMY_DATABASE_URI', '')
        if 'postgresql' not in uri and 'psycopg' not in uri:
            raise unittest.SkipTest("PostgreSQL não configurado em DATABASE_URL. Pulando teste de integração.")

    @classmethod
    def tearDownClass(cls):
        cls.app_context.pop()

    def test_01_conexao_e_contagens_postgresql(self):
        """Verifica a integridade do catálogo persistido no PostgreSQL (4 categorias, 12 produtos, 37 variantes)."""
        n_cat = Categoria.query.filter_by(ativo=True).count()
        n_prod = Produto.query.filter_by(ativo=True).count()
        n_var = Variante.query.filter_by(ativo=True).count()

        self.assertGreaterEqual(n_cat, 4, "PostgreSQL deve conter ao menos 4 categorias ativas")
        self.assertGreaterEqual(n_prod, 12, "PostgreSQL deve conter ao menos 12 produtos ativos")
        self.assertGreaterEqual(n_var, 37, "PostgreSQL deve conter ao menos 37 variantes ativas")

    def test_02_busca_sem_acentos_no_postgresql(self):
        """Comprova que 'memoria' e 'memória' localizam a memória RAM no PostgreSQL real."""
        resp1 = self.client.get('/api/produtos?busca=memoria')
        self.assertEqual(resp1.status_code, 200)
        data1 = resp1.get_json()
        nomes1 = [p['nome'] for p in data1['produtos']]
        self.assertTrue(any('Memória RAM' in n for n in nomes1), "Busca por 'memoria' falhou no PostgreSQL")

        resp2 = self.client.get('/api/produtos?busca=memória')
        self.assertEqual(resp2.status_code, 200)
        data2 = resp2.get_json()
        nomes2 = [p['nome'] for p in data2['produtos']]
        self.assertTrue(any('Memória RAM' in n for n in nomes2), "Busca por 'memória' falhou no PostgreSQL")

    def test_03_fluxo_adicionar_ao_carrinho_e_validar_postgresql(self):
        """
        Simula o fluxo exato executado pelo frontend no navegador:
        1. Consulta produto 'smartphone-nexo-one' e obtém suas variantes.
        2. Monta item com o novo contrato ('produtoId', 'varianteId', 'quantidade', 'precoUnitarioCentavos').
        3. Envia para /api/carrinho/validar no PostgreSQL real.
        4. Comprova que o item permanece na sacola (valido=True, total de itens = 1).
        """
        resp_prod = self.client.get('/api/produtos/smartphone-nexo-one')
        self.assertEqual(resp_prod.status_code, 200)
        prod = resp_prod.get_json()['produto']
        self.assertEqual(prod['id'], 'smartphone-nexo-one')

        # Seleciona variante de 256 GB (reproduzindo exatamente a ação do usuário na revisão)
        var_256 = next((v for v in prod['variantes'] if '256' in v.get('nomeOpcao', '')), prod['variantes'][0])

        payload_carrinho = {
            'itens': [
                {
                    'id': prod['id'],
                    'produtoId': prod['id'],
                    'varianteId': var_256['varianteId'],
                    'nome': prod['nome'],
                    'categoria': prod['categoria'],
                    'imagem': prod['imagem'],
                    'cor': var_256.get('corNome'),
                    'opcao': var_256.get('nomeOpcao'),
                    'rotuloVariante': var_256.get('rotuloVariante'),
                    'precoUnitarioCentavos': var_256['precoCentavos'],
                    'quantidade': 1
                }
            ]
        }

        resp_val = self.client.post('/api/carrinho/validar', json=payload_carrinho)
        self.assertEqual(resp_val.status_code, 200)
        data_val = resp_val.get_json()

        self.assertTrue(data_val['sucesso'])
        self.assertTrue(data_val['valido'], "O item adicionado não deve ser descartado!")
        self.assertEqual(len(data_val['itens']), 1, "A sacola NÃO pode ficar vazia ao adicionar o produto!")
        self.assertEqual(data_val['itens'][0]['varianteId'], var_256['varianteId'])
        self.assertEqual(data_val['itens'][0]['quantidade'], 1)
        self.assertGreater(data_val['itens'][0]['estoque'], 0, "Deve retornar estoque real positivo do PostgreSQL")

    def test_04_consolidacao_duplicados_no_postgresql(self):
        """Valida que linhas duplicadas para a mesma variante são consolidadas no PostgreSQL."""
        var = Variante.query.filter_by(slug='smartphone-nexo-one--titanio-natural--128-gb', ativo=True).first()
        self.assertIsNotNone(var)
        estoque_real = var.estoque

        payload = {
            'itens': [
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': var.slug,
                    'quantidade': 2,
                    'precoUnitarioCentavos': var.preco_centavos
                },
                {
                    'produtoId': 'smartphone-nexo-one',
                    'varianteId': var.slug,
                    'quantidade': 3,
                    'precoUnitarioCentavos': var.preco_centavos
                }
            ]
        }
        resp = self.client.post('/api/carrinho/validar', json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()

        self.assertEqual(len(data['itens']), 1, "Deve consolidar em 1 linha")
        self.assertEqual(data['itens'][0]['quantidade'], min(5, estoque_real))


if __name__ == '__main__':
    unittest.main()
