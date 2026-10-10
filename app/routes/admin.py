"""
Rotas administrativas da Loja Virtual Nexo.
Módulo de gestão restrita com autenticação no servidor, hash de senhas e sessão segura.

Recursos:
- Autenticação e sessão: /admin/login, /admin/logout
- Dashboard operacional Stitch: /admin e /admin/dashboard
- Métricas e KPIs reais calculadas no PostgreSQL: /admin/api/metricas
- Consulta e auditoria de pedidos: /admin/api/pedidos e /admin/api/pedidos/<numero>
- Atualização autorizada de status e devolução de estoque no cancelamento: PATCH /admin/api/pedidos/<numero>/status
"""
from datetime import datetime, date, timedelta, timezone
from functools import wraps
import unicodedata
from flask import (
    Blueprint,
    render_template,
    request,
    jsonify,
    session,
    redirect,
    url_for,
    g
)
from sqlalchemy import func, or_
from app.extensions import db
from app.models import (
    UsuarioAdmin,
    Pedido,
    ItemPedido,
    HistoricoPedido,
    Produto,
    Variante,
    Categoria,
    utc_now
)

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


def admin_required(f):
    """
    Decorator que protege estritamente as páginas e APIs administrativas no backend.
    Visitantes não autenticados são redirecionados para a tela de login ou recebem 401.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        admin_id = session.get('admin_id')
        if not admin_id:
            if request.path.startswith('/admin/api') or request.is_json:
                return jsonify({
                    'sucesso': False,
                    'erro': 'Acesso negado. Faça login como administrador para continuar.'
                }), 401
            return redirect(url_for('admin.login_view', next=request.path))

        admin = db.session.get(UsuarioAdmin, admin_id)
        if not admin or not admin.ativo:
            session.pop('admin_id', None)
            if request.path.startswith('/admin/api') or request.is_json:
                return jsonify({
                    'sucesso': False,
                    'erro': 'Sessão administrativa expirada ou inativa.'
                }), 401
            return redirect(url_for('admin.login_view'))

        g.admin_atual = admin
        return f(*args, **kwargs)
    return decorated_function


# ==============================================================================
# AUTENTICAÇÃO E SESSÃO
# ==============================================================================

@admin_bp.route('/login', methods=['GET', 'POST'])
def login_view():
    """
    Página e endpoint de login de operadores e administradores.
    Armazena e verifica senhas com hash criptográfico seguro (PBKDF2/scrypt).
    """
    # Se já estiver autenticado, redireciona diretamente ao dashboard
    if session.get('admin_id'):
        admin = db.session.get(UsuarioAdmin, session['admin_id'])
        if admin and admin.ativo:
            return redirect(url_for('admin.dashboard_view'))

    if request.method == 'GET':
        return render_template('admin/login.html')

    # Trata tanto requisições JSON quanto envio de formulário tradicional
    data = request.get_json(silent=True) or request.form
    email = str(data.get('email') or '').strip().lower()
    senha = str(data.get('senha') or '')

    if not email or not senha:
        msg_erro = 'Por favor, informe seu e-mail e senha institucional.'
        if request.is_json:
            return jsonify({'sucesso': False, 'erro': msg_erro}), 400
        return render_template('admin/login.html', erro=msg_erro, email=email), 400

    admin = UsuarioAdmin.query.filter_by(email=email).first()

    # Validação segura com tempo constante (sem enumeração de usuários)
    if not admin or not admin.verificar_senha(senha):
        msg_erro = 'Credenciais incorretas. Verifique seu e-mail e senha.'
        if request.is_json:
            return jsonify({'sucesso': False, 'erro': msg_erro}), 401
        return render_template('admin/login.html', erro=msg_erro, email=email), 401

    if not admin.ativo:
        msg_erro = 'Este perfil administrativo está inativo. Contate o suporte técnico.'
        if request.is_json:
            return jsonify({'sucesso': False, 'erro': msg_erro}), 403
        return render_template('admin/login.html', erro=msg_erro, email=email), 403

    # Registra sessão segura no servidor
    session.permanent = True
    session['admin_id'] = admin.id

    # Atualiza timestamp de último login
    admin.ultimo_login = utc_now()
    db.session.commit()

    next_raw = request.args.get('next') or ''
    # Previne vulnerabilidade de Open Redirect: só aceita URLs relativas locais começando com / e não com //
    if next_raw.startswith('/') and not next_raw.startswith('//'):
        next_url = next_raw
    else:
        next_url = url_for('admin.dashboard_view')

    if request.is_json:
        return jsonify({
            'sucesso': True,
            'mensagem': f'Bem-vindo, {admin.nome}!',
            'redirecionarPara': next_url,
            'admin': admin.to_dict()
        }), 200

    return redirect(next_url)


@admin_bp.route('/logout', methods=['GET', 'POST'])
def logout_view():
    """Encerra a sessão administrativa com segurança."""
    session.pop('admin_id', None)
    return redirect(url_for('admin.login_view'))


@admin_bp.route('/api/me', methods=['GET'])
@admin_required
def obter_dados_me():
    """Retorna os dados do administrador atualmente autenticado."""
    return jsonify({
        'sucesso': True,
        'admin': g.admin_atual.to_dict()
    }), 200


# ==============================================================================
# VISUALIZAÇÃO DO DASHBOARD (STITCH DESIGN)
# ==============================================================================

@admin_bp.route('', methods=['GET'])
@admin_bp.route('/dashboard', methods=['GET'])
@admin_required
def dashboard_view():
    """Renderiza a interface do painel operacional Nexo inspirada no Stitch."""
    return render_template('admin/dashboard.html', admin=g.admin_atual)


# ==============================================================================
# API: MÉTRICAS E INDICADORES REAIS (POSTGRESQL)
# ==============================================================================

@admin_bp.route('/api/metricas', methods=['GET'])
@admin_required
def obter_metricas():
    """
    Calcula indicadores reais no PostgreSQL:
    - Faturamento do dia e do período
    - Vendas concluídas e ticket médio real
    - Produtos e SKUs ativos no catálogo
    - Alerta de reposição crítica de estoque
    - Gráfico dos últimos 7 dias de faturamento real
    """
    periodo = (request.args.get('periodo') or 'hoje').strip().lower()
    agora = utc_now()
    hoje_inicio = datetime(agora.year, agora.month, agora.day, 0, 0, 0, tzinfo=timezone.utc)
    ontem_inicio = hoje_inicio - timedelta(days=1)

    # Limites reais do período selecionado
    if periodo == 'hoje':
        dt_inicio = hoje_inicio
        dt_fim = agora
    elif periodo in ['7dias', '7_dias']:
        dt_inicio = hoje_inicio - timedelta(days=6)
        dt_fim = agora
    elif periodo in ['mes', 'este_mes']:
        dt_inicio = datetime(agora.year, agora.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        dt_fim = agora
    else: # 'tudo' ou 'historico'
        dt_inicio = None
        dt_fim = None

    # 1. Faturamento de Hoje
    query_hoje = Pedido.query.filter(
        Pedido.criado_em >= hoje_inicio,
        Pedido.status != 'cancelado'
    )
    faturamento_hoje_centavos = db.session.query(func.coalesce(func.sum(Pedido.total_centavos), 0)).filter(
        Pedido.criado_em >= hoje_inicio,
        Pedido.status != 'cancelado'
    ).scalar() or 0

    pedidos_hoje_qtd = query_hoje.count()

    # Faturamento de Ontem (para comparar variação percentual)
    faturamento_ontem_centavos = db.session.query(func.coalesce(func.sum(Pedido.total_centavos), 0)).filter(
        Pedido.criado_em >= ontem_inicio,
        Pedido.criado_em < hoje_inicio,
        Pedido.status != 'cancelado'
    ).scalar() or 0

    if faturamento_ontem_centavos > 0:
        variacao_vs_ontem = ((faturamento_hoje_centavos - faturamento_ontem_centavos) / faturamento_ontem_centavos) * 100.0
    else:
        variacao_vs_ontem = 100.0 if faturamento_hoje_centavos > 0 else 0.0

    # 2. Métricas no Período Selecionado
    query_periodo = Pedido.query.filter(Pedido.status != 'cancelado')
    filtros_data = []
    if dt_inicio:
        query_periodo = query_periodo.filter(Pedido.criado_em >= dt_inicio)
        filtros_data.append(Pedido.criado_em >= dt_inicio)
    if dt_fim:
        query_periodo = query_periodo.filter(Pedido.criado_em <= dt_fim)
        filtros_data.append(Pedido.criado_em <= dt_fim)

    faturamento_periodo_centavos = db.session.query(func.coalesce(func.sum(Pedido.total_centavos), 0)).filter(
        Pedido.status != 'cancelado',
        *filtros_data
    ).scalar() or 0

    total_pedidos_periodo = query_periodo.count()

    # Vendas Concluídas no período: rigorosamente pedidos que já foram ENTREGUES
    vendas_concluidas_qtd = query_periodo.filter(Pedido.status == 'entregue').count()

    # Pedidos em andamento no período
    pedidos_em_andamento_qtd = query_periodo.filter(Pedido.status.in_(['recebido', 'em_preparacao', 'enviado'])).count()

    # Ticket médio coerente com os pedidos ativos do período selecionado
    ticket_medio_centavos = int(faturamento_periodo_centavos / total_pedidos_periodo) if total_pedidos_periodo > 0 else 0

    # 3. Produtos e SKUs Ativos
    total_produtos_ativos = Produto.query.filter_by(ativo=True).count()
    total_skus_ativos = Variante.query.filter_by(ativo=True).count()
    total_categorias = Categoria.query.filter_by(ativo=True).count()

    # 4. Atenção de Estoque (SKUs com estoque <= 5 ou esgotados)
    variantes_atencao = Variante.query.filter(Variante.ativo == True, Variante.estoque <= 5).all()
    qtd_atencao_estoque = len(variantes_atencao)
    qtd_estoque_zero = sum(1 for v in variantes_atencao if v.estoque == 0)

    # 5. Lista de Reposição Crítica (Itens com menor estoque)
    variantes_criticas = (
        Variante.query
        .filter(Variante.ativo == True)
        .order_by(Variante.estoque.asc())
        .limit(6)
        .all()
    )
    lista_reposicao = []
    for v in variantes_criticas:
        nivel = 'CRÍTICO' if v.estoque <= 2 else ('BAIXO' if v.estoque <= 5 else 'NORMAL')
        lista_reposicao.append({
            'varianteId': v.id,
            'produtoNome': v.produto_rel.nome,
            'rotulo': v.rotulo_exibicao(),
            'estoque': v.estoque,
            'minimoSugerido': 10,
            'nivel': nivel,
            'imagem': v.produto_rel.imagem
        })

    # 6. Gráfico de Desempenho dos Últimos 7 Dias (Segunda a Domingo)
    # Gera os últimos 7 dias cronológicos até hoje
    grafico_dias = []
    nomes_dias = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
    total_semana_centavos = 0
    pico_dia_centavos = 0

    for i in range(6, -1, -1):
        dia_alvo = agora.date() - timedelta(days=i)
        dt_ini = datetime(dia_alvo.year, dia_alvo.month, dia_alvo.day, 0, 0, 0, tzinfo=timezone.utc)
        dt_fim = dt_ini + timedelta(days=1)

        fat_dia = db.session.query(func.coalesce(func.sum(Pedido.total_centavos), 0)).filter(
            Pedido.criado_em >= dt_ini,
            Pedido.criado_em < dt_fim,
            Pedido.status != 'cancelado'
        ).scalar() or 0

        vol_dia = Pedido.query.filter(
            Pedido.criado_em >= dt_ini,
            Pedido.criado_em < dt_fim,
            Pedido.status != 'cancelado'
        ).count()

        total_semana_centavos += fat_dia
        if fat_dia > pico_dia_centavos:
            pico_dia_centavos = fat_dia

        grafico_dias.append({
            'data': dia_alvo.isoformat(),
            'diaSemana': nomes_dias[dia_alvo.weekday()],
            'faturamentoCentavos': fat_dia,
            'volume': vol_dia,
            'ehHoje': (dia_alvo == agora.date())
        })

    return jsonify({
        'sucesso': True,
        'metricas': {
            'periodo': periodo,
            'faturamentoHojeCentavos': faturamento_hoje_centavos,
            'faturamentoPeriodoCentavos': faturamento_periodo_centavos,
            'faturamentoOntemCentavos': faturamento_ontem_centavos,
            'variacaoVsOntem': round(variacao_vs_ontem, 1),
            'vendasConcluidasQtd': vendas_concluidas_qtd,
            'pedidosAtivosQtd': total_pedidos_periodo,
            'pedidosEmAndamentoQtd': pedidos_em_andamento_qtd,
            'pedidosHojeQtd': pedidos_hoje_qtd,
            'ticketMedioCentavos': ticket_medio_centavos,
            'produtosAtivosQtd': total_produtos_ativos,
            'skusAtivosQtd': total_skus_ativos,
            'categoriasQtd': total_categorias,
            'atencaoEstoqueQtd': qtd_atencao_estoque,
            'estoqueZeroQtd': qtd_estoque_zero,
            'totalSemanaCentavos': total_semana_centavos,
            'picoDiaCentavos': pico_dia_centavos,
            'graficoSemana': grafico_dias,
            'reposicaoCritica': lista_reposicao
        }
    }), 200


# ==============================================================================
# API: CONSULTA, FILTROS E AUDITORIA DE PEDIDOS
# ==============================================================================

@admin_bp.route('/api/pedidos', methods=['GET'])
@admin_required
def listar_pedidos_admin():
    """
    Lista todos os pedidos registrados no PostgreSQL com suporte a:
    - Busca textual (número, cliente, e-mail, telefone)
    - Filtro por status (recebido, em_preparacao, enviado, entregue, cancelado)
    - Filtro por intervalo de datas (data_inicio, data_fim)
    - Paginação
    """
    termo = (request.args.get('busca') or '').strip()
    status_filtro = (request.args.get('status') or '').strip().lower()
    data_ini = request.args.get('data_inicio')
    data_fim = request.args.get('data_fim')

    try:
        limite = min(max(int(request.args.get('limite', 50)), 1), 100)
    except (ValueError, TypeError):
        limite = 50

    try:
        pagina = max(int(request.args.get('pagina', 1)), 1)
    except (ValueError, TypeError):
        pagina = 1

    query = Pedido.query

    # Filtro de status
    if status_filtro and status_filtro != 'todos':
        query = query.filter(Pedido.status == status_filtro)

    # Busca textual
    if termo:
        termo_like = f"%{termo}%"
        query = query.filter(
            or_(
                Pedido.numero_pedido.ilike(termo_like),
                Pedido.cliente_nome.ilike(termo_like),
                Pedido.cliente_email.ilike(termo_like),
                Pedido.cliente_telefone.ilike(termo_like)
            )
        )

    # Filtro de data de início
    if data_ini:
        try:
            d_ini = datetime.strptime(data_ini, '%Y-%m-%d').replace(tzinfo=timezone.utc)
            query = query.filter(Pedido.criado_em >= d_ini)
        except ValueError:
            pass

    # Filtro de data de fim
    if data_fim:
        try:
            d_fim = datetime.strptime(data_fim, '%Y-%m-%d').replace(
                hour=23, minute=59, second=59, tzinfo=timezone.utc
            )
            query = query.filter(Pedido.criado_em <= d_fim)
        except ValueError:
            pass

    total_encontrados = query.count()
    pedidos = (
        query
        .order_by(Pedido.criado_em.desc())
        .offset((pagina - 1) * limite)
        .limit(limite)
        .all()
    )

    return jsonify({
        'sucesso': True,
        'total': total_encontrados,
        'pagina': pagina,
        'limite': limite,
        'pedidos': [p.to_dict() for p in pedidos]
    }), 200


@admin_bp.route('/api/pedidos/<numero_pedido>', methods=['GET'])
@admin_required
def obter_detalhes_pedido_admin(numero_pedido):
    """
    Retorna os detalhes completos de um pedido para exibição no modal/drawer,
    incluindo dados do comprador, endereço, itens congelados e o histórico de auditoria.
    """
    numero = str(numero_pedido).strip()
    pedido = Pedido.query.filter_by(numero_pedido=numero).first()

    if not pedido:
        return jsonify({'sucesso': False, 'erro': f"Pedido '{numero}' não encontrado."}), 404

    return jsonify({
        'sucesso': True,
        'pedido': pedido.to_dict()
    }), 200


# ==============================================================================
# API: ATUALIZAÇÃO DE STATUS E DEVOLUÇÃO ATÔMICA DE ESTOQUE
# ==============================================================================

@admin_bp.route('/api/pedidos/<numero_pedido>/status', methods=['PATCH'])
@admin_required
def atualizar_status_pedido_admin(numero_pedido):
    """
    Atualiza o status do pedido exclusivamente mediante ação do administrador.
    Regras de transição de status autorizadas:
    - recebido -> em_preparacao | cancelado
    - em_preparacao -> enviado | cancelado
    - enviado -> entregue | cancelado
    - entregue -> (terminal)
    - cancelado -> (terminal)

    DEVOLUÇÃO DE ESTOQUE NO CANCELAMENTO:
    Se o status for alterado para 'cancelado', o estoque de cada variante dos itens
    do pedido é atomicamente restaurado no PostgreSQL e o evento é registrado no histórico.
    """
    numero = str(numero_pedido).strip()
    pedido = Pedido.query.filter_by(numero_pedido=numero).first()

    if not pedido:
        return jsonify({'sucesso': False, 'erro': 'Pedido não encontrado.'}), 404

    data = request.get_json(silent=True) or {}
    novo_status = (data.get('status') or '').strip().lower()
    observacao = (data.get('observacao') or '').strip()

    STATUS_PERMITIDOS = ['recebido', 'em_preparacao', 'enviado', 'entregue', 'cancelado']
    if novo_status not in STATUS_PERMITIDOS:
        return jsonify({
            'sucesso': False,
            'erro': f"Status inválido. Escolha entre: {', '.join(STATUS_PERMITIDOS)}."
        }), 400

    status_anterior = pedido.status

    if status_anterior == novo_status:
        return jsonify({
            'sucesso': True,
            'mensagem': f"O pedido já se encontra no status '{novo_status}'.",
            'pedido': pedido.to_dict()
        }), 200

    TRANSIÇÕES_PERMITIDAS = {
        'recebido': ['em_preparacao', 'cancelado'],
        'em_preparacao': ['enviado', 'cancelado'],
        'enviado': ['entregue', 'cancelado'],
        'entregue': [],  # terminal
        'cancelado': [], # terminal
        'confirmado': ['em_preparacao', 'cancelado']
    }

    if novo_status not in TRANSIÇÕES_PERMITIDAS.get(status_anterior, []):
        return jsonify({
            'sucesso': False,
            'erro': f"Transição não permitida: não é possível alterar de '{status_anterior}' para '{novo_status}'."
        }), 400

    # ==========================================================================
    # DEVOLUÇÃO ATÔMICA DE ESTOQUE EM CASO DE CANCELAMENTO
    # ==========================================================================
    estoque_devolvido_resumo = []
    if novo_status == 'cancelado' and status_anterior != 'cancelado':
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
                variante = variantes_bloqueadas.get(item.variante_id)
                if variante:
                    variante.estoque += item.quantidade
                    estoque_devolvido_resumo.append(
                        f"{item.nome_produto} ({item.rotulo_variante}): +{item.quantidade} un"
                    )

    # Atualiza o status do pedido
    pedido.status = novo_status
    pedido.atualizado_em = utc_now()

    # Registra no histórico de auditoria
    obs_registro = observacao
    if estoque_devolvido_resumo:
        detalhes_estorno = f" Estoque devolvido: {', '.join(estoque_devolvido_resumo)}."
        obs_registro = (obs_registro + detalhes_estorno).strip()

    historico_entry = HistoricoPedido(
        pedido_id=pedido.id,
        status_anterior=status_anterior,
        status_novo=novo_status,
        autor=f"{g.admin_atual.nome} ({g.admin_atual.cargo})",
        observacao=obs_registro or f"Status atualizado via painel administrativo para '{novo_status}'."
    )
    db.session.add(historico_entry)
    db.session.commit()

    return jsonify({
        'sucesso': True,
        'mensagem': f"Status do pedido atualizado com sucesso para '{novo_status}'.",
        'pedido': pedido.to_dict()
    }), 200
