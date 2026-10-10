"""
Rotas de visualização (HTML) da Loja Virtual Nexo.
Renderiza os templates da pasta templates/ garantindo compatibilidade total
com as rotas anteriores (incluindo extensões .html e URLs amigáveis).
"""
from flask import Blueprint, render_template

views_bp = Blueprint('views', __name__)


@views_bp.route('/')
@views_bp.route('/index.html')
def index():
    """Página inicial com vitrine de produtos e filtros."""
    return render_template('index.html')


@views_bp.route('/produto')
@views_bp.route('/produto.html')
def produto():
    """Página de detalhes do produto reutilizável."""
    return render_template('produto.html')


@views_bp.route('/carrinho')
@views_bp.route('/carrinho.html')
def carrinho():
    """Página dedicada da sacola de compras."""
    return render_template('carrinho.html')


@views_bp.route('/checkout')
@views_bp.route('/checkout.html')
def checkout():
    """Página de finalização da compra (conferência e dados de entrega)."""
    return render_template('checkout.html')


@views_bp.route('/pedido/confirmacao')
@views_bp.route('/confirmacao')
@views_bp.route('/confirmacao.html')
def confirmacao():
    """Página de confirmação com resumo e número do pedido."""
    return render_template('confirmacao.html')


@views_bp.route('/pedidos')
@views_bp.route('/pedidos.html')
@views_bp.route('/meus-pedidos')
def pedidos():
    """Página da área 'Meus Pedidos' do cliente com histórico e acompanhamento."""
    return render_template('pedidos.html')
