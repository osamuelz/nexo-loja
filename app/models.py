"""
Modelos SQLAlchemy para a Loja Virtual Nexo.
Armazena Categorias, Produtos e Variantes no PostgreSQL.
Usa valores monetários exatos em centavos inteiros (sem ponto flutuante).
Preserva identificadores estáveis (slugs) compatíveis com o frontend e o carrinho.
"""
from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


def utc_now():
    return datetime.now(timezone.utc)


class Categoria(db.Model):
    """
    Categoria de produtos (ex: Celulares, Informática, Eletrodomésticos, Acessórios).
    """
    __tablename__ = 'categorias'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    nome = db.Column(db.String(100), nullable=False)
    subtitulo = db.Column(db.String(255), nullable=True)
    icone = db.Column(db.String(50), nullable=True)
    ordem = db.Column(db.Integer, default=0, nullable=False)
    ativo = db.Column(db.Boolean, default=True, nullable=False)
    criado_em = db.Column(db.DateTime, default=utc_now, nullable=False)
    atualizado_em = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    produtos = db.relationship('Produto', backref='categoria_rel', lazy='select')

    def to_dict(self):
        return {
            'id': self.slug,
            'slug': self.slug,
            'nome': self.nome,
            'subtitulo': self.subtitulo,
            'icone': self.icone,
            'ordem': self.ordem,
            'ativo': self.ativo
        }


class Produto(db.Model):
    """
    Produto base no catálogo.
    Armazena dados gerais, imagens, especificações e texto descritivo.
    """
    __tablename__ = 'produtos'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    nome = db.Column(db.String(255), nullable=False)
    subtitulo = db.Column(db.String(255), nullable=True)
    descricao = db.Column(db.Text, nullable=True)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id'), nullable=False, index=True)
    imagem = db.Column(db.String(1024), nullable=False)
    galeria = db.Column(db.JSON, nullable=True)
    destaques_cards = db.Column(db.JSON, nullable=True)
    destaque = db.Column(db.String(100), nullable=True)
    tipo_opcoes = db.Column(db.String(50), nullable=True)  # 'celular', 'informatica', 'eletrodomestico', 'acessorio'
    compatibilidade = db.Column(db.Text, nullable=True)
    nota_alimentacao = db.Column(db.Text, nullable=True)
    especificacoes = db.Column(db.JSON, nullable=True)
    preco_base_centavos = db.Column(db.Integer, nullable=False)  # Preço exato em centavos inteiros
    ativo = db.Column(db.Boolean, default=True, nullable=False)
    criado_em = db.Column(db.DateTime, default=utc_now, nullable=False)
    atualizado_em = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    variantes = db.relationship(
        'Variante',
        backref='produto_rel',
        lazy='select',
        cascade='all, delete-orphan'
    )

    def to_dict(self):
        """Resumo para vitrine/listagem de catálogo."""
        variantes_ativas = [v for v in self.variantes if v.ativo]
        menor_preco = min([v.preco_centavos for v in variantes_ativas]) if variantes_ativas else self.preco_base_centavos
        total_estoque = sum([v.estoque for v in variantes_ativas])
        tem_estoque = any(v.estoque > 0 for v in variantes_ativas)

        return {
            'id': self.slug,
            'slug': self.slug,
            'nome': self.nome,
            'subtitulo': self.subtitulo,
            'categoria': self.categoria_rel.nome if self.categoria_rel else '',
            'categoriaSlug': self.categoria_rel.slug if self.categoria_rel else '',
            'precoBaseCentavos': self.preco_base_centavos,
            'precoCentavos': menor_preco,
            'imagem': self.imagem,
            'destaque': self.destaque,
            'tipoOpcoes': self.tipo_opcoes,
            'ativo': self.ativo,
            'totalEstoque': total_estoque,
            'disponivel': tem_estoque and self.ativo
        }

    def to_dict_detalhado(self):
        """Detalhes completos com variantes, galeria e especificações."""
        data = self.to_dict()
        data['descricao'] = self.descricao
        data['galeria'] = self.galeria or []
        data['destaquesCards'] = self.destaques_cards or []
        data['compatibilidade'] = self.compatibilidade
        data['notaAlimentacao'] = self.nota_alimentacao
        data['especificacoes'] = self.especificacoes or []

        variantes_ativas = [v for v in self.variantes if v.ativo]
        data['variantes'] = [v.to_dict() for v in variantes_ativas]

        # Extrai agrupamentos auxiliares de cores e opções para o layout do frontend
        cores_vistas = {}
        opcoes_vistas = {}
        for v in variantes_ativas:
            if v.cor_nome and v.cor_nome not in cores_vistas:
                cores_vistas[v.cor_nome] = {
                    'nome': v.cor_nome,
                    'corHex': v.cor_hex or '#CCCCCC',
                    'estoque': v.estoque
                }
            if v.nome_opcao and v.nome_opcao not in opcoes_vistas:
                opcoes_vistas[v.nome_opcao] = {
                    'valor': v.nome_opcao,
                    'acrescimoCentavos': v.acrescimo_centavos,
                    'estoque': v.estoque
                }

        data['opcoesCores'] = list(cores_vistas.values()) if cores_vistas else None

        tipo = self.tipo_opcoes or ''
        lista_opcoes = list(opcoes_vistas.values()) if opcoes_vistas else None
        if tipo == 'celular':
            data['opcoesCapacidades'] = lista_opcoes
        elif tipo == 'eletrodomestico':
            data['opcoesVoltagem'] = lista_opcoes
        elif tipo == 'informatica':
            data['opcoesHardware'] = lista_opcoes

        return data


class Variante(db.Model):
    """
    Variante vendável com preço e estoque independentes.
    Cada combinação vendável tem seu próprio registro, preço e estoque.
    Preserva rigorosamente estoque 0 (itens esgotados não têm fallback de estoque fictício).
    """
    __tablename__ = 'variantes'

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(180), unique=True, nullable=False, index=True)
    produto_id = db.Column(db.Integer, db.ForeignKey('produtos.id'), nullable=False, index=True)
    nome_opcao = db.Column(db.String(100), nullable=True)  # Ex: '128 GB', 'Versão Box', '110V (127V)'
    cor_nome = db.Column(db.String(100), nullable=True)    # Ex: 'Titânio Natural', 'Preto Espacial'
    cor_hex = db.Column(db.String(20), nullable=True)      # Ex: '#A8A49F'
    atributos = db.Column(db.JSON, nullable=True)          # Dict flexível com atributos adicionais
    preco_centavos = db.Column(db.Integer, nullable=False) # Preço final exato em centavos inteiros
    acrescimo_centavos = db.Column(db.Integer, default=0, nullable=False)
    estoque = db.Column(db.Integer, default=0, nullable=False) # Preserva estoque zero!
    ativo = db.Column(db.Boolean, default=True, nullable=False)
    criado_em = db.Column(db.DateTime, default=utc_now, nullable=False)
    atualizado_em = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    def rotulo_exibicao(self):
        partes = []
        if self.cor_nome:
            partes.append(self.cor_nome)
        if self.nome_opcao:
            partes.append(self.nome_opcao)
        return ' • '.join(partes) if partes else 'Padrão'

    def to_dict(self):
        return {
            'id': self.slug,
            'slug': self.slug,
            'varianteId': self.slug,
            'produtoId': self.produto_rel.slug if self.produto_rel else None,
            'produtoNome': self.produto_rel.nome if self.produto_rel else None,
            'imagem': self.produto_rel.imagem if self.produto_rel else None,
            'nomeOpcao': self.nome_opcao,
            'corNome': self.cor_nome,
            'corHex': self.cor_hex,
            'rotuloVariante': self.rotulo_exibicao(),
            'atributos': self.atributos or {},
            'precoCentavos': self.preco_centavos,
            'acrescimoCentavos': self.acrescimo_centavos,
            'estoque': self.estoque,
            'disponivel': self.estoque > 0 and self.ativo,
            'ativo': self.ativo
        }


def gerar_numero_pedido() -> str:
    """Gera um identificador de pedido único e amigável (ex: NX-20261009-8F3A2B)."""
    import uuid
    agora = utc_now()
    sufixo = uuid.uuid4().hex[:6].upper()
    return f"NX-{agora.strftime('%Y%m%d')}-{sufixo}"


def gerar_token_acesso() -> str:
    """
    Gera uma chave de acesso segura e imprevisível para cada pedido (sem necessidade de login).
    Formato: nx_tok_<64 caracteres hexadecimais aleatórios>
    Impede que terceiros adivinhem pedidos de outros compradores enumerando identificadores.
    """
    import secrets
    return f"nx_tok_{secrets.token_hex(32)}"


class Pedido(db.Model):
    """
    Representa um pedido formalizado na Loja Virtual Nexo.
    Armazena os dados do comprador, endereço de entrega, modalidade de pagamento,
    status da compra e valor total consolidado em centavos inteiros.
    Possui suporte a chave de idempotência e chave de acesso segura e imprevisível (token_acesso).
    """
    __tablename__ = 'pedidos'

    id = db.Column(db.Integer, primary_key=True)
    numero_pedido = db.Column(db.String(32), unique=True, nullable=False, index=True)
    token_acesso = db.Column(db.String(80), unique=True, nullable=False, index=True, default=gerar_token_acesso)
    idempotency_key = db.Column(db.String(64), unique=True, nullable=True, index=True)

    # Dados do Comprador
    cliente_nome = db.Column(db.String(150), nullable=False)
    cliente_email = db.Column(db.String(150), nullable=False)
    cliente_telefone = db.Column(db.String(40), nullable=False)

    # Dados de Entrega / Retirada
    endereco_entrega = db.Column(db.Text, nullable=False)

    # Status e Pagamento
    status = db.Column(db.String(50), default='recebido', nullable=False)
    metodo_pagamento = db.Column(db.String(50), default='simulado_retirada', nullable=False)

    # Valores Monetários em Centavos Inteiros
    total_centavos = db.Column(db.Integer, nullable=False)
    observacoes = db.Column(db.Text, nullable=True)

    criado_em = db.Column(db.DateTime, default=utc_now, nullable=False)
    atualizado_em = db.Column(db.DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Relacionamento com itens do pedido
    itens = db.relationship('ItemPedido', backref='pedido_rel', cascade='all, delete-orphan', lazy=True)
    historico = db.relationship('HistoricoPedido', backref='pedido_rel', cascade='all, delete-orphan', lazy=True, order_by='HistoricoPedido.criado_em.asc()')

    def to_dict(self):
        return {
            'id': self.id,
            'numeroPedido': self.numero_pedido,
            'tokenAcesso': self.token_acesso,
            'idempotencyKey': self.idempotency_key,
            'clienteNome': self.cliente_nome,
            'clienteEmail': self.cliente_email,
            'clienteTelefone': self.cliente_telefone,
            'enderecoEntrega': self.endereco_entrega,
            'status': self.status,
            'metodoPagamento': self.metodo_pagamento,
            'totalCentavos': self.total_centavos,
            'observacoes': self.observacoes,
            'criadoEm': self.criado_em.isoformat() if self.criado_em else None,
            'itens': [item.to_dict() for item in self.itens],
            'historico': [h.to_dict() for h in self.historico]
        }


class ItemPedido(db.Model):
    """
    Representa cada item contido em um pedido formalizado.
    IMPORTANTE: Preserva uma cópia histórica estática do nome do produto,
    do rótulo da variante e do preço unitário exato no momento da compra.
    Mesmo que o catálogo seja atualizado futuramente, o pedido mantém os dados congelados.
    """
    __tablename__ = 'itens_pedido'

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id', ondelete='CASCADE'), nullable=False, index=True)

    # Vínculos relacionais com o catálogo (opcionais para preservar histórico mesmo se catálogo mudar)
    produto_id = db.Column(db.Integer, db.ForeignKey('produtos.id', ondelete='SET NULL'), nullable=True, index=True)
    variante_id = db.Column(db.Integer, db.ForeignKey('variantes.id', ondelete='SET NULL'), nullable=True, index=True)

    # Cópias históricas imutáveis da compra
    produto_slug = db.Column(db.String(150), nullable=False)
    variante_slug = db.Column(db.String(180), nullable=False)
    nome_produto = db.Column(db.String(200), nullable=False)
    rotulo_variante = db.Column(db.String(150), nullable=False)
    imagem_url = db.Column(db.Text, nullable=True)

    quantidade = db.Column(db.Integer, nullable=False)
    preco_unitario_centavos = db.Column(db.Integer, nullable=False)
    subtotal_centavos = db.Column(db.Integer, nullable=False)

    criado_em = db.Column(db.DateTime, default=utc_now, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'pedidoId': self.pedido_id,
            'produtoSlug': self.produto_slug,
            'varianteSlug': self.variante_slug,
            'nomeProduto': self.nome_produto,
            'rotuloVariante': self.rotulo_variante,
            'imagemUrl': self.imagem_url,
            'quantidade': self.quantidade,
            'precoUnitarioCentavos': self.preco_unitario_centavos,
            'subtotalCentavos': self.subtotal_centavos
        }


class UsuarioAdmin(db.Model):
    """
    Representa um operador ou administrador autorizado da Loja Virtual Nexo.
    Armazena credenciais protegidas exclusivamente por hash criptográfico seguro (PBKDF2/scrypt).
    Não permite cadastro público; o primeiro administrador é criado por comando CLI local.
    """
    __tablename__ = 'usuarios_admin'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    senha_hash = db.Column(db.String(255), nullable=False)
    cargo = db.Column(db.String(80), default='Administrador', nullable=False)
    ativo = db.Column(db.Boolean, default=True, nullable=False)
    criado_em = db.Column(db.DateTime, default=utc_now, nullable=False)
    ultimo_login = db.Column(db.DateTime, nullable=True)

    def definir_senha(self, senha: str):
        if not senha or len(senha.strip()) < 6:
            raise ValueError("A senha administrativa deve conter ao menos 6 caracteres.")
        self.senha_hash = generate_password_hash(senha)

    def verificar_senha(self, senha: str) -> bool:
        if not self.senha_hash or not senha:
            return False
        return check_password_hash(self.senha_hash, senha)

    def to_dict(self):
        return {
            'id': self.id,
            'nome': self.nome,
            'email': self.email,
            'cargo': self.cargo,
            'ativo': self.ativo,
            'criadoEm': self.criado_em.isoformat() if self.criado_em else None,
            'ultimoLogin': self.ultimo_login.isoformat() if self.ultimo_login else None
        }


class HistoricoPedido(db.Model):
    """
    Registro imutável de auditoria de cada alteração de status de um pedido.
    Armazena a data/hora, autor da alteração, status anterior, novo status e observações.
    """
    __tablename__ = 'historico_pedidos'

    id = db.Column(db.Integer, primary_key=True)
    pedido_id = db.Column(db.Integer, db.ForeignKey('pedidos.id', ondelete='CASCADE'), nullable=False, index=True)
    status_anterior = db.Column(db.String(50), nullable=True)
    status_novo = db.Column(db.String(50), nullable=False)
    autor = db.Column(db.String(120), default='Sistema', nullable=False)
    observacao = db.Column(db.Text, nullable=True)
    criado_em = db.Column(db.DateTime, default=utc_now, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'pedidoId': self.pedido_id,
            'statusAnterior': self.status_anterior,
            'statusNovo': self.status_novo,
            'autor': self.autor,
            'observacao': self.observacao,
            'criadoEm': self.criado_em.isoformat() if self.criado_em else None
        }

