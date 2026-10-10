"""
Rotas da API RESTful para a Loja Virtual Nexo.
Endpoints de leitura:
- GET  /api/categorias
- GET  /api/produtos (busca e filtros)
- GET  /api/produtos/<id_ou_slug> (detalhes e variantes)
- POST /api/carrinho/validar (validação autoritativa do carrinho contra o catálogo ativo)
"""
import unicodedata
from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import or_
from sqlalchemy.orm import joinedload
from sqlalchemy.exc import IntegrityError
from app.models import db, Categoria, Produto, Variante, Pedido, ItemPedido, HistoricoPedido, UsuarioAdmin, gerar_numero_pedido, gerar_token_acesso, utc_now
from app.commands import normalizar_chave

api_bp = Blueprint('api', __name__, url_prefix='/api')


def remover_acentos(texto: str) -> str:
    if not texto:
        return ''
    nfkd = unicodedata.normalize('NFD', texto)
    return ''.join([c for c in nfkd if not unicodedata.combining(c)]).lower().strip()


@api_bp.route('/categorias', methods=['GET'])
def listar_categorias():
    """Retorna todas as categorias ativas cadastradas no PostgreSQL."""
    categorias = (
        Categoria.query
        .filter_by(ativo=True)
        .order_by(Categoria.ordem.asc(), Categoria.nome.asc())
        .all()
    )
    resp = jsonify({
        'sucesso': True,
        'categorias': [c.to_dict() for c in categorias]
    })
    resp.headers['Cache-Control'] = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    return resp, 200


@api_bp.route('/produtos', methods=['GET'])
def listar_produtos():
    """
    Listagem de produtos ativos com suporte a filtro por categoria e busca sem diferenciação de acentos.
    Query params:
    - categoria: slug ou nome da categoria (ex: 'celulares' ou 'Celulares' ou 'all')
    - busca ou termo: termo de busca textual (ex: 'memoria' encontra 'Memória RAM')
    """
    categoria_param = request.args.get('categoria', '').strip()
    termo_busca = (request.args.get('busca') or request.args.get('termo') or '').strip()

    # Filtra produtos ativos cujas categorias também estejam ativas com Eager Loading
    query = (
        Produto.query
        .options(joinedload(Produto.variantes), joinedload(Produto.categoria_rel))
        .filter_by(ativo=True)
        .join(Categoria)
        .filter(Categoria.ativo == True)
    )

    if categoria_param and categoria_param.lower() != 'all':
        cat_norm = normalizar_chave(categoria_param)
        query = query.filter(
            or_(
                Categoria.slug == cat_norm,
                Categoria.nome.ilike(f"%{categoria_param}%")
            )
        )

    produtos = query.order_by(Produto.id.asc()).all()

    # Busca textual insensível a maiúsculas e sem acentos (compatível com SQLite e PostgreSQL)
    if termo_busca:
        termo_norm = remover_acentos(termo_busca)
        produtos = [
            p for p in produtos
            if termo_norm in remover_acentos(p.nome)
            or termo_norm in remover_acentos(p.subtitulo or '')
            or termo_norm in remover_acentos(p.destaque or '')
            or termo_norm in remover_acentos(p.descricao or '')
            or (p.categoria_rel and termo_norm in remover_acentos(p.categoria_rel.nome))
        ]

    resp = jsonify({
        'sucesso': True,
        'total': len(produtos),
        'produtos': [p.to_dict() for p in produtos]
    })
    resp.headers['Cache-Control'] = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
    return resp, 200


@api_bp.route('/produtos/<id_ou_slug>', methods=['GET'])
def detalhar_produto(id_ou_slug):
    """
    Retorna os detalhes completos de um produto e suas variantes ativas.
    Retorna 404 se o produto não existir, estiver inativo ou pertencer a categoria inativa.
    """
    query = (
        Produto.query
        .options(joinedload(Produto.variantes), joinedload(Produto.categoria_rel))
        .filter(Produto.ativo == True)
        .join(Categoria)
        .filter(Categoria.ativo == True)
    )

    if id_ou_slug.isdigit():
        produto = query.filter((Produto.id == int(id_ou_slug)) | (Produto.slug == id_ou_slug)).first()
    else:
        produto = query.filter(Produto.slug == id_ou_slug).first()

    if not produto:
        return jsonify({
            'sucesso': False,
            'erro': 'Produto não encontrado ou indisponível.'
        }), 404

    return jsonify({
        'sucesso': True,
        'produto': produto.to_dict_detalhado()
    }), 200


@api_bp.route('/carrinho/validar', methods=['POST'])
def validar_carrinho():
    """
    Validação autoritativa dos itens da sacola de compras contra o catálogo ativo.
    Regras estritas de integridade:
    - Rejeita com HTTP 400 corpos não-objeto, listas inválidas ou quantidades não-inteiras/negativas/booleanas.
    - Exige que o produto e sua categoria estejam ativos (caso contrário, remove com aviso).
    - Agrupa itens da mesma variante antes de verificar limites de estoque.
    - Preserva estoque zero (remove itens esgotados com aviso).
    - Ajusta quantidades consolidadas que excederem o estoque da variante.
    - Notifica alterações de preço sem confiar em valores enviados pelo cliente.
    - Padroniza o contrato retornando 'id', 'produtoId', 'varianteId' e 'estoque' real.
    """
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({
            'sucesso': False,
            'erro': 'Corpo da requisição inválido. Esperado um objeto JSON.'
        }), 400

    itens_recebidos = payload.get('itens')
    if not isinstance(itens_recebidos, list):
        return jsonify({
            'sucesso': False,
            'erro': 'Formato inválido. O campo "itens" deve ser uma lista.'
        }), 400

    # 1. Validação estrita de tipos e valores em cada linha
    itens_processados = []
    for idx, item in enumerate(itens_recebidos):
        if not isinstance(item, dict):
            return jsonify({
                'sucesso': False,
                'erro': f'Item na posição {idx} inválido. Deve ser um objeto JSON.'
            }), 400

        prod_id = item.get('produtoId')
        if prod_id is None:
            prod_id = item.get('id')

        if prod_id is not None and not isinstance(prod_id, (str, int)):
            return jsonify({
                'sucesso': False,
                'erro': f'Identificador de produto inválido no item {idx}.'
            }), 400

        var_id = item.get('varianteId')
        if var_id is None:
            var_id = item.get('idVariante')

        if var_id is not None and not isinstance(var_id, (str, int)):
            return jsonify({
                'sucesso': False,
                'erro': f'Identificador de variante inválido no item {idx}.'
            }), 400

        # Quantidade deve ser estritamente inteiro positivo (exclui bool)
        qtd = item.get('quantidade')
        if qtd is None or isinstance(qtd, bool) or not isinstance(qtd, int) or qtd <= 0:
            return jsonify({
                'sucesso': False,
                'erro': f'Quantidade inválida no item {idx}: {qtd}. Deve ser um número inteiro estritamente positivo (> 0).'
            }), 400

        # Preço unitário enviado pelo cliente (se informado, deve ser inteiro não-negativo)
        preco_ant = item.get('precoUnitarioCentavos')
        if preco_ant is not None:
            if isinstance(preco_ant, bool) or not isinstance(preco_ant, int) or preco_ant < 0:
                return jsonify({
                    'sucesso': False,
                    'erro': f'precoUnitarioCentavos inválido no item {idx}. Deve ser um inteiro não-negativo em centavos.'
                }), 400

        itens_processados.append({
            'prod_id': str(prod_id).strip() if prod_id is not None else None,
            'var_id': str(var_id).strip() if var_id is not None else None,
            'nome_cliente': item.get('nome') or '',
            'quantidade': qtd,
            'preco_anterior': preco_ant,
            'cor': item.get('cor'),
            'opcao': item.get('opcao')
        })

    # 2. Resolução dos produtos e variantes ativos no catálogo
    itens_validados = []
    avisos = []
    carrinho_modificado = False

    variantes_agrupadas = {}
    ordem_chaves = []

    for item in itens_processados:
        prod_id = item['prod_id']
        var_id = item['var_id']
        qtd = item['quantidade']

        if not prod_id:
            carrinho_modificado = True
            continue

        query_prod = (
            Produto.query
            .filter(Produto.ativo == True)
            .join(Categoria)
            .filter(Categoria.ativo == True)
        )
        if prod_id.isdigit():
            produto = query_prod.filter((Produto.id == int(prod_id)) | (Produto.slug == prod_id)).first()
        else:
            produto = query_prod.filter(Produto.slug == prod_id).first()

        if not produto:
            carrinho_modificado = True
            nome_prod = item['nome_cliente'] or prod_id
            avisos.append(f"O produto '{nome_prod}' não está mais disponível e foi removido da sacola.")
            continue

        variante = None
        if var_id:
            if var_id.isdigit():
                variante = Variante.query.filter_by(id=int(var_id), produto_id=produto.id, ativo=True).first()
            if not variante:
                variante = Variante.query.filter_by(slug=var_id, produto_id=produto.id, ativo=True).first()

            if not variante:
                carrinho_modificado = True
                avisos.append(f"A variante selecionada do produto '{produto.nome}' não está mais disponível.")
                continue
        else:
            variantes_ativas = [v for v in produto.variantes if v.ativo]
            if len(variantes_ativas) == 1:
                variante = variantes_ativas[0]
            elif item['cor'] or item['opcao']:
                q_var = Variante.query.filter_by(produto_id=produto.id, ativo=True)
                if item['cor']:
                    q_var = q_var.filter_by(cor_nome=item['cor'])
                if item['opcao']:
                    q_var = q_var.filter_by(nome_opcao=item['opcao'])
                variante = q_var.first()

            if not variante:
                carrinho_modificado = True
                avisos.append(f"A variante do produto '{produto.nome}' precisa ser selecionada novamente.")
                continue

        var_key = variante.id
        if var_key not in variantes_agrupadas:
            ordem_chaves.append(var_key)
            variantes_agrupadas[var_key] = {
                'produto': produto,
                'variante': variante,
                'quantidade_total': 0,
                'precos_anteriores': [],
                'contagem_linhas': 0
            }

        variantes_agrupadas[var_key]['quantidade_total'] += qtd
        variantes_agrupadas[var_key]['contagem_linhas'] += 1
        if item['preco_anterior'] is not None:
            variantes_agrupadas[var_key]['precos_anteriores'].append(item['preco_anterior'])

    # 3. Consolidação e verificação de estoque por variante
    for var_key in ordem_chaves:
        grupo = variantes_agrupadas[var_key]
        produto = grupo['produto']
        variante = grupo['variante']
        qtd_total = grupo['quantidade_total']

        if grupo['contagem_linhas'] > 1:
            carrinho_modificado = True

        # Verificação rigorosa de estoque zero (esgotado)
        if variante.estoque <= 0:
            carrinho_modificado = True
            avisos.append(f"O item '{produto.nome} ({variante.rotulo_exibicao()})' esgotou no estoque e foi removido da sacola.")
            continue

        qtd_ajustada = qtd_total
        if qtd_total > variante.estoque:
            qtd_ajustada = variante.estoque
            carrinho_modificado = True
            avisos.append(
                f"A quantidade de '{produto.nome} ({variante.rotulo_exibicao()})' foi ajustada de {qtd_total} para {qtd_ajustada} (limite disponível em estoque)."
            )

        preco_atual = variante.preco_centavos
        for p_ant in grupo['precos_anteriores']:
            if p_ant != preco_atual:
                carrinho_modificado = True
                avisos.append(
                    f"O valor de '{produto.nome} ({variante.rotulo_exibicao()})' foi atualizado no catálogo para R$ {preco_atual / 100:.2f}."
                )
                break

        itens_validados.append({
            'id': produto.slug,
            'produtoId': produto.slug,
            'varianteId': variante.slug,
            'nome': produto.nome,
            'categoria': produto.categoria_rel.nome if produto.categoria_rel else '',
            'imagem': produto.imagem,
            'cor': variante.cor_nome,
            'corHex': variante.cor_hex,
            'opcao': variante.nome_opcao,
            'rotuloVariante': variante.rotulo_exibicao(),
            'quantidade': qtd_ajustada,
            'precoUnitarioCentavos': preco_atual,
            'estoque': variante.estoque,
            'disponivel': True
        })

    return jsonify({
        'sucesso': True,
        'valido': not carrinho_modificado,
        'itens': itens_validados,
        'avisos': avisos,
        'notaFinalizacao': 'Finalização de pedidos pronta. A reserva e verificação definitiva ocorrem no servidor de forma atômica.'
    }), 200


@api_bp.route('/pedidos', methods=['POST'])
def criar_pedido():
    """
    Registra a finalização de uma compra de forma atômica no PostgreSQL.
    Requisitos cumpridos:
    1. Valida presença e formato de dados do comprador e endereço de entrega.
    2. Confere novamente o preço oficial e o estoque disponível no PostgreSQL.
    3. Abate o estoque das variantes adquiridas.
    4. Salva Pedido e ItensPedido com cópias estáticas e congeladas do catálogo.
    5. Executa tudo em uma única transação atômica (rollback completo se algo falhar).
    6. Suporta chave de idempotência (idempotencyKey) para evitar duplicação em clique duplo.
    """
    payload = request.get_json(silent=True)
    if not payload or not isinstance(payload, dict):
        return jsonify({'sucesso': False, 'erro': 'Corpo da requisição inválido.'}), 400

    # Idempotência preventiva contra cliques duplos
    idempotency_key = str(payload.get('idempotencyKey') or payload.get('chaveIdempotencia') or '').strip()

    # Extração e validação dos dados do comprador com proteção de tipos
    cliente_raw = payload.get('cliente') if isinstance(payload.get('cliente'), dict) else {}
    
    nome_raw = cliente_raw.get('nome') if isinstance(cliente_raw, dict) else None
    if nome_raw is None:
        nome_raw = payload.get('clienteNome') or payload.get('nome')
    nome = str(nome_raw or '').strip()
    if not nome or len(nome) < 2 or nome.isdigit() or len(nome) > 120:
        return jsonify({
            'sucesso': False,
            'erro': 'Nome do comprador inválido. Informe o nome completo (mínimo 2 caracteres, máximo 120).'
        }), 400

    email_raw = cliente_raw.get('email') if isinstance(cliente_raw, dict) else None
    if email_raw is None:
        email_raw = payload.get('clienteEmail') or payload.get('email')
    email = str(email_raw or '').strip().lower()
    if not email or '@' not in email or '.' not in email or len(email) > 150:
        return jsonify({
            'sucesso': False,
            'erro': 'Informe um e-mail válido para confirmação do pedido.'
        }), 400

    telefone_raw = cliente_raw.get('telefone') if isinstance(cliente_raw, dict) else None
    if telefone_raw is None:
        telefone_raw = payload.get('clienteTelefone') or payload.get('telefone')
    telefone = str(telefone_raw or '').strip()
    if not telefone or len(telefone) < 8 or len(telefone) > 40:
        return jsonify({
            'sucesso': False,
            'erro': 'Informe um telefone de contato válido com DDD (mínimo 8 caracteres).'
        }), 400

    # Extração e validação estrita do endereço de entrega
    endereco_raw = payload.get('endereco') or (cliente_raw.get('endereco') if isinstance(cliente_raw, dict) else None)
    if isinstance(endereco_raw, dict):
        logr = str(endereco_raw.get('logradouro') or '').strip()
        num = str(endereco_raw.get('numero') or '').strip()
        bairro = str(endereco_raw.get('bairro') or '').strip()
        cid = str(endereco_raw.get('cidade') or '').strip()
        uf = str(endereco_raw.get('estado') or '').strip()
        cep = str(endereco_raw.get('cep') or '').strip()
        comp = str(endereco_raw.get('complemento') or '').strip()

        if not logr or not num or not cid or not uf or not cep:
            return jsonify({
                'sucesso': False,
                'erro': 'Endereço incompleto. Os campos rua/logradouro, número, cidade, estado e CEP são obrigatórios.'
            }), 400

        if len(logr) > 150 or len(num) > 30 or len(bairro) > 80 or len(cid) > 80 or len(uf) > 30 or len(cep) > 20:
            return jsonify({
                'sucesso': False,
                'erro': 'Campos do endereço de entrega excedem o tamanho máximo permitido.'
            }), 400

        complemento_str = f" ({comp})" if comp else ""
        bairro_str = f" • {bairro}" if bairro else ""
        endereco_str = f"{logr}, {num}{complemento_str}{bairro_str} • {cid} - {uf} • CEP {cep}"
    else:
        endereco_str = str(
            payload.get('enderecoEntrega') or 
            payload.get('endereco') or 
            (cliente_raw.get('endereco') if isinstance(cliente_raw, dict) else '') or 
            ''
        ).strip()
        if not endereco_str or len(endereco_str) < 5 or len(endereco_str) > 255:
            return jsonify({
                'sucesso': False,
                'erro': 'O endereço de entrega é obrigatório e deve ser detalhado (mínimo 5 caracteres).'
            }), 400

    itens_raw = payload.get('itens')
    if not itens_raw or not isinstance(itens_raw, list) or len(itens_raw) == 0:
        return jsonify({'sucesso': False, 'erro': 'A sacola de compras está vazia. Adicione itens antes de finalizar.'}), 400

    metodo_pagamento = str(payload.get('metodoPagamento') or 'simulado_retirada').strip()
    observacoes = str(payload.get('observacoes') or '').strip() or None

    # Validação e resolução rigorosa de itens da sacola
    # Verifica incompatibilidade entre produtoId e varianteId
    itens_resolvidos = []
    for it in itens_raw:
        if not isinstance(it, dict):
            return jsonify({'sucesso': False, 'erro': 'Item da sacola com formato inválido.'}), 400

        qtd_raw = it.get('quantidade')
        if isinstance(qtd_raw, bool) or isinstance(qtd_raw, float):
            return jsonify({'sucesso': False, 'erro': 'A quantidade de cada item deve ser um número inteiro positivo.'}), 400
        
        if isinstance(qtd_raw, int):
            qtd = qtd_raw
        elif isinstance(qtd_raw, str) and qtd_raw.strip().isdigit():
            qtd = int(qtd_raw.strip())
        else:
            return jsonify({'sucesso': False, 'erro': 'A quantidade informada para cada item deve ser um número inteiro positivo.'}), 400

        if qtd <= 0:
            return jsonify({'sucesso': False, 'erro': 'A quantidade de cada item deve ser maior que zero.'}), 400

        prod_id = str(it.get('produtoId') or it.get('id') or '').strip()
        var_id = str(it.get('varianteId') or '').strip()
        nome_cliente = str(it.get('nome') or it.get('nomeProduto') or '').strip()

        preco_informado = it.get('precoUnitarioCentavos')
        if preco_informado is None:
            preco_informado = it.get('precoCentavos')
        try:
            preco_informado = int(preco_informado) if (preco_informado is not None and not isinstance(preco_informado, bool)) else None
        except (ValueError, TypeError):
            preco_informado = None

        if not prod_id and not var_id:
            return jsonify({'sucesso': False, 'erro': 'Identificador do produto ou variante não informado.'}), 400

        # Resolução da variante
        variante = None
        if var_id:
            if var_id.isdigit():
                variante = Variante.query.filter_by(id=int(var_id), ativo=True).first()
            if not variante:
                variante = Variante.query.filter_by(slug=var_id, ativo=True).first()
            if not variante:
                return jsonify({'sucesso': False, 'erro': f"A variante '{var_id}' não está disponível ou foi desativada."}), 400

        # Resolução do produto
        produto = None
        if prod_id:
            query_prod = (
                Produto.query
                .filter(Produto.ativo == True)
                .join(Categoria)
                .filter(Categoria.ativo == True)
            )
            if prod_id.isdigit():
                produto = query_prod.filter((Produto.id == int(prod_id)) | (Produto.slug == prod_id)).first()
            else:
                produto = query_prod.filter(Produto.slug == prod_id).first()

            if not produto:
                return jsonify({'sucesso': False, 'erro': f"O produto '{prod_id}' não está disponível ou foi desativado."}), 400
        else:
            # Se produtoId não foi fornecido, infere através da variante ativa
            if variante and variante.produto_rel and variante.produto_rel.ativo:
                produto = variante.produto_rel
            else:
                return jsonify({'sucesso': False, 'erro': 'Não foi possível identificar o produto da variante.'}), 400

        # Validação estrita do vínculo Produto-Variante:
        # Se ambos produtoId e varianteId foram informados, a variante DEVE pertencer àquele produto
        if var_id and prod_id:
            if variante.produto_id != produto.id:
                return jsonify({
                    'sucesso': False,
                    'erro': f"Inconsistência de catálogo: a variante '{variante.rotulo_exibicao()}' não pertence ao produto '{produto.nome}'."
                }), 400

        # Se apenas produtoId foi informado sem variante, exige ou infere variante única
        if not variante:
            variantes_ativas = [v for v in produto.variantes if v.ativo]
            if len(variantes_ativas) == 1:
                variante = variantes_ativas[0]
            else:
                return jsonify({
                    'sucesso': False,
                    'erro': f"Por favor, selecione uma opção/variante para o produto '{produto.nome}'."
                }), 400

        itens_resolvidos.append({
            'variante_id': variante.id,
            'produto': produto,
            'variante': variante,
            'quantidade': qtd,
            'preco_informado': preco_informado,
            'nome_cliente': nome_cliente
        })

    # Consolidação dos itens por ID real da variante
    itens_consolidados = {}
    for item_res in itens_resolvidos:
        v_id = item_res['variante_id']
        if v_id not in itens_consolidados:
            itens_consolidados[v_id] = {
                'produto': item_res['produto'],
                'variante': item_res['variante'],
                'quantidade': 0,
                'preco_informado': item_res['preco_informado']
            }
        itens_consolidados[v_id]['quantidade'] += item_res['quantidade']

    # Transação atômica única no banco de dados com bloqueio pessimista (SELECT FOR UPDATE)
    try:
        # Ordenação consistente dos IDs das variantes para evitar deadlocks entre requisições concorrentes
        v_ids_ordenados = sorted(itens_consolidados.keys())
        variantes_travadas = {
            v.id: v for v in db.session.query(Variante)
            .filter(Variante.id.in_(v_ids_ordenados))
            .order_by(Variante.id.asc())
            .with_for_update()
            .all()
        }

        itens_pedido_para_salvar = []
        total_pedido_centavos = 0

        for v_id in v_ids_ordenados:
            dados_item = itens_consolidados[v_id]
            variante = variantes_travadas[v_id]
            produto = dados_item['produto']
            qtd_solicitada = dados_item['quantidade']
            preco_solicitado = dados_item['preco_informado']

            # Conferência autoritativa de preço
            if preco_solicitado is not None and variante.preco_centavos != preco_solicitado:
                db.session.rollback()
                return jsonify({
                    'sucesso': False,
                    'erro': f"O preço de '{produto.nome} ({variante.rotulo_exibicao()})' foi alterado no catálogo para R$ {variante.preco_centavos / 100:.2f}. Por favor, revise a sacola.",
                    'precoAtualizado': True,
                    'varianteId': variante.slug,
                    'precoCentavosNovo': variante.preco_centavos
                }), 409

            # Conferência autoritativa de estoque
            if variante.estoque < qtd_solicitada:
                db.session.rollback()
                return jsonify({
                    'sucesso': False,
                    'erro': f"Estoque insuficiente para '{produto.nome} ({variante.rotulo_exibicao()})'. Disponível no momento: {variante.estoque} unidade(s).",
                    'estoqueInsuficiente': True,
                    'varianteId': variante.slug,
                    'estoqueDisponivel': variante.estoque
                }), 409

            # Abatimento autoritativo do estoque
            variante.estoque -= qtd_solicitada

            subtotal_item = variante.preco_centavos * qtd_solicitada
            total_pedido_centavos += subtotal_item

            item_pedido = ItemPedido(
                produto_id=produto.id,
                variante_id=variante.id,
                produto_slug=produto.slug,
                variante_slug=variante.slug,
                nome_produto=produto.nome,
                rotulo_variante=variante.rotulo_exibicao(),
                imagem_url=produto.imagem,
                quantidade=qtd_solicitada,
                preco_unitario_centavos=variante.preco_centavos,
                subtotal_centavos=subtotal_item
            )
            itens_pedido_para_salvar.append(item_pedido)

        # Verificação de idempotência se a chave já existia
        if idempotency_key:
            pedido_dupl = Pedido.query.filter_by(idempotency_key=idempotency_key).first()
            if pedido_dupl:
                db.session.rollback()
                # Se for o mesmo cliente e total, retorna o pedido existente
                if pedido_dupl.cliente_email == email and pedido_dupl.total_centavos == total_pedido_centavos:
                    return jsonify({
                        'sucesso': True,
                        'duplicado': True,
                        'mensagem': 'Pedido já confirmado anteriormente.',
                        'pedido': pedido_dupl.to_dict()
                    }), 200
                else:
                    return jsonify({
                        'sucesso': False,
                        'erro': 'Chave de idempotência em conflito com outro pedido registrado anteriormente.'
                    }), 409

        # Criação do pedido
        token_acesso_gerado = gerar_token_acesso()
        novo_pedido = Pedido(
            numero_pedido=gerar_numero_pedido(),
            token_acesso=token_acesso_gerado,
            idempotency_key=idempotency_key or None,
            cliente_nome=nome,
            cliente_email=email,
            cliente_telefone=telefone,
            endereco_entrega=endereco_str,
            status='recebido',
            metodo_pagamento=metodo_pagamento,
            total_centavos=total_pedido_centavos,
            observacoes=observacoes,
            itens=itens_pedido_para_salvar
        )

        historico_inicial = HistoricoPedido(
            status_anterior=None,
            status_novo='recebido',
            autor='Cliente / Checkout',
            observacao='Pedido formalizado com sucesso na loja virtual.'
        )
        novo_pedido.historico.append(historico_inicial)

        db.session.add(novo_pedido)
        db.session.commit()

        return jsonify({
            'sucesso': True,
            'pedido': novo_pedido.to_dict()
        }), 201

    except IntegrityError:
        db.session.rollback()
        if idempotency_key:
            pedido_dupl = Pedido.query.filter_by(idempotency_key=idempotency_key).first()
            if pedido_dupl:
                return jsonify({
                    'sucesso': True,
                    'duplicado': True,
                    'mensagem': 'Pedido já confirmado anteriormente.',
                    'pedido': pedido_dupl.to_dict()
                }), 200
        return jsonify({
            'sucesso': False,
            'erro': 'Conflito de integridade ao registrar pedido.'
        }), 409

    except Exception as ex:
        db.session.rollback()
        current_app.logger.exception(f"Erro inesperado durante a finalização do pedido: {ex}")
        return jsonify({
            'sucesso': False,
            'erro': 'Ocorreu um erro interno ao processar seu pedido. Por favor, tente novamente.'
        }), 500


@api_bp.route('/pedidos/<numero_pedido>', methods=['GET'])
def obter_pedido(numero_pedido):
    """
    Retorna os detalhes completos de um pedido registrado no PostgreSQL.
    Exige chave de acesso (token) imprevisível para proteger a privacidade dos dados do comprador.
    """
    numero = str(numero_pedido).strip()
    token = (request.args.get('token') or request.headers.get('X-Order-Token') or '').strip()

    pedido = Pedido.query.filter_by(numero_pedido=numero).first()
    if not pedido:
        return jsonify({'sucesso': False, 'erro': 'Pedido não encontrado.'}), 404

    # Segurança: não permite consultar dados de outros compradores apenas pelo número sequencial
    if not token or pedido.token_acesso != token:
        return jsonify({
            'sucesso': False,
            'erro': 'Acesso não autorizado ao pedido. Chave de acesso ausente ou inválida.'
        }), 403

    return jsonify({
        'sucesso': True,
        'pedido': pedido.to_dict()
    }), 200


@api_bp.route('/meus-pedidos/consultar', methods=['POST'])
def consultar_meus_pedidos():
    """
    Permite ao navegador consultar a lista dos seus próprios pedidos
    mediante a apresentação dos pares (numeroPedido, tokenAcesso) salvos localmente.
    Garante privacidade total sem expor dados pessoais de outros compradores.
    """
    payload = request.get_json(silent=True) or {}
    referencias = payload.get('referencias') or []
    if not isinstance(referencias, list):
        return jsonify({'sucesso': False, 'erro': 'Formato inválido de referências de pedidos.'}), 400

    if not referencias:
        return jsonify({'sucesso': True, 'total': 0, 'pedidos': []}), 200

    # Limite preventivo de 50 pedidos por consulta
    referencias_limitadas = referencias[:50]
    pedidos_encontrados = []

    for ref in referencias_limitadas:
        if not isinstance(ref, dict):
            continue
        num = str(ref.get('numeroPedido') or ref.get('numero') or '').strip()
        tok = str(ref.get('tokenAcesso') or ref.get('token') or '').strip()
        if not num or not tok:
            continue

        pedido = Pedido.query.filter_by(numero_pedido=num, token_acesso=tok).first()
        if pedido and pedido not in pedidos_encontrados:
            pedidos_encontrados.append(pedido)

    # Ordena os pedidos do mais recente para o mais antigo
    pedidos_encontrados.sort(key=lambda p: p.criado_em, reverse=True)

    return jsonify({
        'sucesso': True,
        'total': len(pedidos_encontrados),
        'pedidos': [p.to_dict() for p in pedidos_encontrados]
    }), 200


@api_bp.route('/pedidos/<numero_pedido>/status', methods=['PATCH', 'POST'])
def atualizar_status_pedido(numero_pedido):
    """
    Atualiza o status de um pedido mediante ação real no sistema.
    Fluxo suportado:
    recebido -> em_preparacao -> enviado -> entregue | cancelado
    O status só muda quando houver uma ação real, nunca apenas pelo relógio.
    """
    payload = request.get_json(silent=True) or {}
    novo_status = (payload.get('status') or '').strip().lower()
    token = (payload.get('token') or request.args.get('token') or request.headers.get('X-Order-Token') or '').strip()

    STATUS_PERMITIDOS = ['recebido', 'em_preparacao', 'enviado', 'entregue', 'cancelado']
    # Compatibilidade com status inicial legado
    if novo_status == 'confirmado':
        novo_status = 'recebido'

    if novo_status not in STATUS_PERMITIDOS:
        return jsonify({
            'sucesso': False,
            'erro': f"Status inválido. Status aceitos: {', '.join(STATUS_PERMITIDOS)}."
        }), 400

    numero = str(numero_pedido).strip()
    pedido = Pedido.query.filter_by(numero_pedido=numero).first()
    if not pedido:
        return jsonify({'sucesso': False, 'erro': 'Pedido não encontrado.'}), 404

    # Exige chave de acesso do pedido para autorizar a modificação
    if not token or pedido.token_acesso != token:
        return jsonify({
            'sucesso': False,
            'erro': 'Chave de acesso ausente ou inválida para atualizar o status do pedido.'
        }), 403

    # Segurança: Comprador só tem autorização para solicitar CANCELAMENTO de seu próprio pedido.
    # Avanços operacionais (em_preparacao, enviado, entregue) são exclusivos do painel administrativo.
    if novo_status != 'cancelado':
        return jsonify({
            'sucesso': False,
            'erro': 'A alteração operacional de status (em preparação, enviado, entregue) é restrita a administradores autenticados da loja.'
        }), 403

    status_atual = pedido.status

    if status_atual == 'cancelado':
        return jsonify({
            'sucesso': True,
            'mensagem': 'O pedido já se encontra cancelado.',
            'pedido': pedido.to_dict()
        }), 200

    if status_atual != 'recebido':
        return jsonify({
            'sucesso': False,
            'erro': f"Não é possível cancelar o pedido diretamente pelo cliente pois ele já se encontra no status '{status_atual}'. Entre em contato com o suporte."
        }), 400

    # Devolução atômica e serializada de estoque
    itens_com_variante = [it for it in pedido.itens if it.variante_id]
    var_ids = sorted(list(set(it.variante_id for it in itens_com_variante)))
    if var_ids:
        variantes_bloqueadas = {
            v.id: v for v in db.session.query(Variante)
            .filter(Variante.id.in_(var_ids))
            .order_by(Variante.id.asc())
            .with_for_update()
            .all()
        }
        for item in itens_com_variante:
            v = variantes_bloqueadas.get(item.variante_id)
            if v:
                v.estoque += item.quantidade

    pedido.status = 'cancelado'
    pedido.atualizado_em = utc_now()

    # Registra no histórico de auditoria
    historico_entry = HistoricoPedido(
        pedido_id=pedido.id,
        status_anterior=status_atual,
        status_novo='cancelado',
        autor="Cliente / Token",
        observacao="Cancelamento pelo comprador na área Meus Pedidos. Estoque dos itens liberado."
    )
    db.session.add(historico_entry)
    db.session.commit()

    return jsonify({
        'sucesso': True,
        'mensagem': "Pedido cancelado com sucesso e estoque liberado.",
        'pedido': pedido.to_dict()
    }), 200


@api_bp.app_errorhandler(404)
def handle_404(err):
    if request.path.startswith('/api/'):
        return jsonify({'sucesso': False, 'erro': 'Recurso não encontrado.'}), 404
    return err


@api_bp.app_errorhandler(500)
def handle_500(err):
    if request.path.startswith('/api/'):
        return jsonify({'sucesso': False, 'erro': 'Erro interno ao processar a requisição.'}), 500
    return err
