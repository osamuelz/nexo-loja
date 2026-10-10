/**
 * Nexo - Loja Virtual
 * Lógica da Página 'Meus Pedidos' (Acompanhamento e Histórico)
 *
 * - Lê as referências mínimas e seguras salvas no navegador (nexo_meus_pedidos).
 * - Consulta os pedidos oficiais autenticados por token via POST /api/meus-pedidos/consultar.
 * - Renderiza histórico, linha do tempo (Stepper) com 4 etapas:
 *   Recebido -> Em preparação -> Enviado -> Entregue (e Cancelado).
 * - O status só muda mediante ação real no sistema (PATCH /api/pedidos/<numero>/status).
 * - Totalmente protegido contra XSS (textContent e createElement).
 */

import {
  inicializarComponentesComuns,
  formatarPreco,
  notificar
} from './componentes.js';

export const STORAGE_PEDIDOS_KEY = 'nexo_meus_pedidos';

const ETAPAS_FLUXO = [
  { chave: 'recebido', rotulo: 'Recebido', icone: 'receipt_long' },
  { chave: 'em_preparacao', rotulo: 'Em preparação', icone: 'inventory_2' },
  { chave: 'enviado', rotulo: 'Enviado', icone: 'local_shipping' },
  { chave: 'entregue', rotulo: 'Entregue', icone: 'check_circle' }
];

let pedidosCarregados = [];
let numeroParaExpandir = null;

async function iniciarMeusPedidos() {
  inicializarComponentesComuns();

  const urlParams = new URLSearchParams(window.location.search);
  numeroParaExpandir = urlParams.get('numero');

  // Se veio token na URL para um pedido específico, registra nas referências locais
  const tokenUrl = urlParams.get('token');
  if (numeroParaExpandir && tokenUrl) {
    salvarReferenciaPedidoLocal(numeroParaExpandir, tokenUrl);
  }

  await carregarEConsultarPedidos();

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_PEDIDOS_KEY) {
      carregarEConsultarPedidos();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarMeusPedidos);
} else {
  iniciarMeusPedidos();
}

/**
 * Lê as referências salvas localmente
 * @returns {Array} [{ numeroPedido, tokenAcesso, criadoEm }]
 */
export function lerReferenciasPedidosLocais() {
  try {
    const raw = localStorage.getItem(STORAGE_PEDIDOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

/**
 * Salva uma nova referência segura de pedido no navegador
 */
export function salvarReferenciaPedidoLocal(numeroPedido, tokenAcesso) {
  if (!numeroPedido || !tokenAcesso) return;
  const lista = lerReferenciasPedidosLocais();
  const jaExiste = lista.some(it => it.numeroPedido === numeroPedido);
  if (!jaExiste) {
    lista.unshift({
      numeroPedido,
      tokenAcesso,
      criadoEm: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_PEDIDOS_KEY, JSON.stringify(lista));
  }
}

/**
 * Consulta a API com as referências do cliente e renderiza a tela
 */
async function carregarEConsultarPedidos() {
  const container = document.getElementById('meus-pedidos-conteudo');
  const countHeader = document.getElementById('pedidos-count-header');
  if (!container) return;

  const referencias = lerReferenciasPedidosLocais();

  if (referencias.length === 0) {
    if (countHeader) countHeader.textContent = '(0 compras)';
    renderizarEstadoVazio(container);
    return;
  }

  // Estado de carregamento
  renderizarCarregando(container);

  try {
    const resp = await fetch('/api/meus-pedidos/consultar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ referencias })
    });

    const data = await resp.json();

    if (!resp.ok || !data.sucesso) {
      throw new Error(data.erro || 'Falha ao consultar pedidos');
    }

    pedidosCarregados = data.pedidos || [];
    const total = pedidosCarregados.length;

    if (countHeader) {
      countHeader.textContent = `(${total} compra${total === 1 ? '' : 's'})`;
    }

    if (total === 0) {
      renderizarEstadoVazio(container);
    } else {
      renderizarListaPedidos(container, pedidosCarregados);
    }

  } catch (err) {
    renderizarEstadoErro(container, () => carregarEConsultarPedidos());
  }
}

/**
 * Renderiza o estado vazio
 */
function renderizarEstadoVazio(container) {
  container.replaceChildren();

  const emptyWrap = document.createElement('div');
  emptyWrap.className = 'cart-empty-state';
  emptyWrap.style.padding = '5rem 1rem';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'cart-empty-icon';
  iconDiv.style.cssText = 'width: 80px; height: 80px;';
  iconDiv.innerHTML = '<span class="material-symbols-outlined text-[40px]">receipt_long</span>';

  const title = document.createElement('h2');
  title.className = 'cart-empty-title';
  title.textContent = 'Você não possui pedidos recentes';

  const desc = document.createElement('p');
  desc.className = 'cart-empty-desc';
  desc.textContent = 'Nenhum pedido foi registrado neste dispositivo ainda. Explore nosso catálogo e faça sua primeira compra.';

  const btn = document.createElement('a');
  btn.href = '/#catalogo';
  btn.className = 'btn-primary';
  btn.style.marginTop = '1rem';
  btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">storefront</span><span>Explorar Produtos</span>';

  emptyWrap.append(iconDiv, title, desc, btn);
  container.appendChild(emptyWrap);
}

/**
 * Renderiza estado de carregamento
 */
function renderizarCarregando(container) {
  container.replaceChildren();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'padding: 5rem 1rem; text-align: center; color: var(--color-text-secondary);';
  wrap.innerHTML = `
    <div style="display: inline-block; width: 36px; height: 36px; border: 3px solid var(--color-divider); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem;"></div>
    <p>Carregando histórico e status dos seus pedidos...</p>
  `;
  container.appendChild(wrap);
}

/**
 * Renderiza estado de erro
 */
function renderizarEstadoErro(container, onRetry) {
  container.replaceChildren();
  const wrap = document.createElement('div');
  wrap.className = 'cart-empty-state';
  wrap.style.padding = '4rem 1rem';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'cart-empty-icon';
  iconDiv.style.color = 'var(--color-error)';
  iconDiv.innerHTML = '<span class="material-symbols-outlined text-[40px]">wifi_off</span>';

  const title = document.createElement('h2');
  title.className = 'cart-empty-title';
  title.textContent = 'Não foi possível carregar seus pedidos';

  const desc = document.createElement('p');
  desc.className = 'cart-empty-desc';
  desc.textContent = 'Verifique sua conexão com o servidor e tente novamente.';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-primary';
  btn.style.marginTop = '1rem';
  btn.textContent = 'Tentar Novamente';
  btn.addEventListener('click', onRetry);

  wrap.append(iconDiv, title, desc, btn);
  container.appendChild(wrap);
}

/**
 * Renderiza a lista de cartões de pedidos
 */
function renderizarListaPedidos(container, pedidos) {
  container.replaceChildren();

  const listEl = document.createElement('div');
  listEl.className = 'orders-list';

  pedidos.forEach(pedido => {
    const card = criarCardPedido(pedido);
    listEl.appendChild(card);
  });

  container.appendChild(listEl);
}

/**
 * Cria o card individual de um pedido
 */
function criarCardPedido(pedido) {
  const card = document.createElement('article');
  card.className = 'order-card';
  card.id = `card-pedido-${pedido.numeroPedido}`;

  const statusFormatado = normalizarStatus(pedido.status);
  const dataFormatada = formatarDataHora(pedido.criadoEm);

  // Cabeçalho do Card
  const header = document.createElement('div');
  header.className = 'order-card-header';

  const idGroup = document.createElement('div');
  idGroup.className = 'order-id-group';
  idGroup.innerHTML = `
    <span class="material-symbols-outlined text-[20px]" style="color: var(--color-primary);">receipt_long</span>
    <span>Pedido ${pedido.numeroPedido}</span>
    <span class="order-date-text">• ${dataFormatada}</span>
  `;

  const badge = document.createElement('span');
  badge.className = `status-pill status-${statusFormatado.chave}`;
  badge.textContent = statusFormatado.rotulo;

  header.append(idGroup, badge);

  // Corpo do Card (Resumo de Itens e Total)
  const body = document.createElement('div');
  body.className = 'order-card-body';

  const thumbsWrap = document.createElement('div');
  thumbsWrap.className = 'order-thumbs-preview';

  (pedido.itens || []).slice(0, 4).forEach(it => {
    const img = document.createElement('img');
    img.src = it.imagemUrl || '/static/images/placeholder.svg';
    img.alt = it.nomeProduto;
    img.title = `${it.nomeProduto} (${it.quantidade}x)`;
    img.className = 'order-thumb-mini';
    thumbsWrap.appendChild(img);
  });

  if ((pedido.itens || []).length > 4) {
    const moreSpan = document.createElement('span');
    moreSpan.style.cssText = 'font-size: 0.75rem; color: var(--color-text-secondary); font-weight: 600;';
    moreSpan.textContent = `+${pedido.itens.length - 4} outros`;
    thumbsWrap.appendChild(moreSpan);
  }

  const metaWrap = document.createElement('div');
  metaWrap.className = 'order-summary-meta';

  const countTxt = document.createElement('span');
  countTxt.className = 'order-items-count-text';
  const totalItens = (pedido.itens || []).reduce((acc, it) => acc + (it.quantidade || 1), 0);
  countTxt.textContent = `${totalItens} item${totalItens === 1 ? '' : 's'} no pedido`;

  const totalTxt = document.createElement('span');
  totalTxt.className = 'order-total-price tabular-nums';
  totalTxt.textContent = formatarPreco(pedido.totalCentavos);

  metaWrap.append(countTxt, totalTxt);

  const actionsWrap = document.createElement('div');
  actionsWrap.className = 'order-card-actions';

  const btnToggle = document.createElement('button');
  btnToggle.type = 'button';
  btnToggle.className = 'btn-track-order';
  btnToggle.setAttribute('aria-expanded', 'false');
  btnToggle.innerHTML = `
    <span class="material-symbols-outlined text-[18px]">timeline</span>
    <span class="btn-toggle-label">Acompanhar / Ver Detalhes</span>
    <span class="material-symbols-outlined text-[18px] arrow-icon">expand_more</span>
  `;

  actionsWrap.appendChild(btnToggle);
  body.append(thumbsWrap, metaWrap, actionsWrap);

  // Painel de Detalhes Expandidos (Inicialmente oculto)
  const detailsPane = document.createElement('div');
  detailsPane.className = 'order-details-pane';
  detailsPane.style.display = 'none';

  renderizarConteudoDetalhes(detailsPane, pedido);

  // Abertura/Fechamento
  const toggle = (abrir) => {
    const deveAbrir = abrir !== undefined ? abrir : (detailsPane.style.display === 'none');
    detailsPane.style.display = deveAbrir ? 'flex' : 'none';
    btnToggle.setAttribute('aria-expanded', String(deveAbrir));
    const label = btnToggle.querySelector('.btn-toggle-label');
    const arrow = btnToggle.querySelector('.arrow-icon');
    if (label) label.textContent = deveAbrir ? 'Ocultar Detalhes' : 'Acompanhar / Ver Detalhes';
    if (arrow) arrow.textContent = deveAbrir ? 'expand_less' : 'expand_more';
  };

  btnToggle.addEventListener('click', () => toggle());

  // Se o número foi requisitado na URL, expande automaticamente
  if (numeroParaExpandir && numeroParaExpandir === pedido.numeroPedido) {
    toggle(true);
    setTimeout(() => {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }

  card.append(header, body, detailsPane);
  return card;
}

/**
 * Renderiza o conteúdo detalhado com Stepper e Itens
 */
function renderizarConteudoDetalhes(pane, pedido) {
  pane.replaceChildren();

  const statusFormatado = normalizarStatus(pedido.status);

  // 1. Linha do Tempo de Acompanhamento (Stepper)
  const stepperCard = document.createElement('div');
  stepperCard.className = 'tracking-stepper-wrap';

  const stepHeader = document.createElement('div');
  stepHeader.className = 'stepper-header-title';
  stepHeader.innerHTML = `
    <span class="material-symbols-outlined text-[20px]" style="color: var(--color-primary);">local_shipping</span>
    <span>Linha de Acompanhamento da Entrega</span>
  `;

  if (statusFormatado.chave === 'cancelado') {
    const cancelBox = document.createElement('div');
    cancelBox.style.cssText = 'background: #FEF2F2; border: 1px solid #FCA5A5; color: #991B1B; padding: 1rem; border-radius: var(--radius-sm); font-size: 0.875rem; display: flex; align-items: center; gap: 0.5rem;';
    cancelBox.innerHTML = `
      <span class="material-symbols-outlined text-[22px]">cancel</span>
      <div>
        <strong>Pedido Cancelado</strong><br />
        Este pedido foi cancelado no sistema. Nenhuma cobrança ou movimentação adicional ocorrerá.
      </div>
    `;
    stepperCard.append(stepHeader, cancelBox);
  } else {
    const stepperTrack = document.createElement('div');
    stepperTrack.className = 'stepper-track';

    const lineBg = document.createElement('div');
    lineBg.className = 'stepper-line';

    const lineProgress = document.createElement('div');
    lineProgress.className = 'stepper-line-progress';

    // Calcula percentual de progresso
    const indiceAtual = ETAPAS_FLUXO.findIndex(e => e.chave === statusFormatado.chave);
    const perc = indiceAtual >= 0 ? (indiceAtual / (ETAPAS_FLUXO.length - 1)) * 100 : 0;
    lineProgress.style.width = `${perc}%`;
    lineBg.appendChild(lineProgress);
    stepperTrack.appendChild(lineBg);

    ETAPAS_FLUXO.forEach((etapa, idx) => {
      const stepItem = document.createElement('div');
      stepItem.className = 'stepper-step';

      if (idx < indiceAtual) {
        stepItem.classList.add('completed');
      } else if (idx === indiceAtual) {
        stepItem.classList.add('current');
      }

      const node = document.createElement('div');
      node.className = 'stepper-node';
      node.innerHTML = idx < indiceAtual
        ? '<span class="material-symbols-outlined text-[18px]">check</span>'
        : `<span class="material-symbols-outlined text-[18px]">${etapa.icone}</span>`;

      const lbl = document.createElement('span');
      lbl.className = 'stepper-label';
      lbl.textContent = etapa.rotulo;

      stepItem.append(node, lbl);
      stepperTrack.appendChild(stepItem);
    });

    stepperCard.append(stepHeader, stepperTrack);
  }

  // 2. Informações de Entrega e Comprador
  const infoGrid = document.createElement('div');
  infoGrid.className = 'confirmation-grid-info';

  const boxComprador = document.createElement('div');
  boxComprador.className = 'confirmation-info-box';
  boxComprador.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-weight: 600; color: var(--color-text-primary);">
      <span class="material-symbols-outlined text-[18px]">person</span>
      <span>Comprador</span>
    </div>
    <div style="font-size: 0.8125rem; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 0.2rem;">
      <div><strong>Nome:</strong> ${pedido.clienteNome}</div>
      <div><strong>E-mail:</strong> ${pedido.clienteEmail}</div>
      <div><strong>Telefone:</strong> ${pedido.clienteTelefone}</div>
    </div>
  `;

  const boxEntrega = document.createElement('div');
  boxEntrega.className = 'confirmation-info-box';
  boxEntrega.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-weight: 600; color: var(--color-text-primary);">
      <span class="material-symbols-outlined text-[18px]">place</span>
      <span>Endereço de Entrega</span>
    </div>
    <div style="font-size: 0.8125rem; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 0.2rem;">
      <div>${pedido.enderecoEntrega}</div>
      <div><strong>Modalidade:</strong> Retirada / Balcão Presencial</div>
    </div>
  `;

  infoGrid.append(boxComprador, boxEntrega);

  // 3. Tabela de Itens Congelados
  const itensCard = document.createElement('div');
  itensCard.style.cssText = 'background: var(--color-surface); border: 1px solid var(--color-divider); border-radius: var(--radius-sm); overflow: hidden;';

  const tblHeader = document.createElement('div');
  tblHeader.style.cssText = 'padding: 0.75rem 1rem; background: var(--color-surface-low); border-bottom: 1px solid var(--color-divider); font-weight: 600; font-size: 0.8125rem;';
  tblHeader.textContent = 'Itens Congelados no Momento da Compra';

  const table = document.createElement('table');
  table.className = 'confirmation-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Produto</th>
        <th style="text-align: center;">Qtd</th>
        <th style="text-align: right;">Unitário</th>
        <th style="text-align: right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${(pedido.itens || []).map(it => `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <img src="${it.imagemUrl || '/static/images/placeholder.svg'}" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; background: var(--color-surface-low);" />
              <div>
                <div style="font-weight: 600;">${it.nomeProduto}</div>
                <div style="font-size: 0.75rem; color: var(--color-text-secondary);">${it.rotuloVariante || 'Padrão'}</div>
              </div>
            </div>
          </td>
          <td style="text-align: center;" class="tabular-nums font-semibold">${it.quantidade}</td>
          <td style="text-align: right;" class="tabular-nums">${formatarPreco(it.precoUnitarioCentavos)}</td>
          <td style="text-align: right;" class="tabular-nums font-semibold">${formatarPreco(it.subtotalCentavos)}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  itensCard.append(tblHeader, table);

  // 4. Painel Informativo e Ação de Cancelamento pelo Cliente (apenas se recebido)
  if (statusFormatado.chave === 'recebido') {
    const actionBox = document.createElement('div');
    actionBox.className = 'action-status-box';

    const actionText = document.createElement('div');
    actionText.style.cssText = 'font-size: 0.8125rem; color: var(--color-text-secondary);';
    actionText.innerHTML = `
      <span>O pedido foi recebido e está aguardando separação pelo lojista.</span>
    `;

    const btnActionsGroup = document.createElement('div');
    btnActionsGroup.style.cssText = 'display: flex; gap: 0.5rem; flex-wrap: wrap;';

    const btnCancelar = document.createElement('button');
    btnCancelar.type = 'button';
    btnCancelar.style.cssText = 'padding: 0.45rem 0.85rem; font-size: 0.8125rem; border: 1px solid var(--color-error); color: var(--color-error); border-radius: var(--radius-sm); font-weight: 600; cursor: pointer;';
    btnCancelar.textContent = 'Cancelar Pedido';
    btnCancelar.addEventListener('click', async () => {
      if (confirm(`Tem certeza que deseja cancelar o pedido ${pedido.numeroPedido}? O estoque dos itens será liberado.`)) {
        btnCancelar.disabled = true;
        await executarTransicaoStatus(pedido.numeroPedido, pedido.tokenAcesso, 'cancelado');
      }
    });
    btnActionsGroup.appendChild(btnCancelar);

    actionBox.append(actionText, btnActionsGroup);
    pane.append(stepperCard, infoGrid, itensCard, actionBox);
  } else {
    pane.append(stepperCard, infoGrid, itensCard);
  }
}

/**
 * Normaliza o status do banco para rotulo amigavel e classe css
 */
function normalizarStatus(statusRaw) {
  const st = String(statusRaw || '').toLowerCase();
  switch (st) {
    case 'confirmado':
    case 'recebido':
      return { chave: 'recebido', rotulo: 'Recebido' };
    case 'em_preparacao':
    case 'preparacao':
      return { chave: 'em_preparacao', rotulo: 'Em preparação' };
    case 'enviado':
      return { chave: 'enviado', rotulo: 'Enviado' };
    case 'entregue':
      return { chave: 'entregue', rotulo: 'Entregue' };
    case 'cancelado':
      return { chave: 'cancelado', rotulo: 'Cancelado' };
    default:
      return { chave: 'recebido', rotulo: 'Recebido' };
  }
}

/**
 * Retorna a próxima etapa do fluxo
 */
function obterProximaEtapa(chaveAtual) {
  const ordem = ['recebido', 'em_preparacao', 'enviado', 'entregue'];
  const idx = ordem.indexOf(chaveAtual);
  if (idx >= 0 && idx < ordem.length - 1) {
    const proximaChave = ordem[idx + 1];
    return ETAPAS_FLUXO.find(e => e.chave === proximaChave);
  }
  return null;
}

/**
 * Dispara ação real para atualizar o status do pedido
 */
async function executarTransicaoStatus(numeroPedido, tokenAcesso, novoStatus) {
  try {
    const resp = await fetch(`/api/pedidos/${encodeURIComponent(numeroPedido)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        status: novoStatus,
        token: tokenAcesso
      })
    });

    const data = await resp.json();

    if (resp.ok && data.sucesso) {
      notificar(`Pedido atualizado para "${data.pedido.status}"!`, 'sucesso');
      await carregarEConsultarPedidos();
      // Garante que o card continua aberto
      const cardAtual = document.getElementById(`card-pedido-${numeroPedido}`);
      const btn = cardAtual?.querySelector('.btn-track-order');
      if (btn && btn.getAttribute('aria-expanded') !== 'true') {
        btn.click();
      }
    } else {
      notificar(data.erro || 'Não foi possível atualizar o status.', 'aviso');
    }
  } catch (err) {
    notificar('Erro de rede ao atualizar o status.', 'aviso');
  }
}

/**
 * Formata data/hora ISO para texto amigável
 */
function formatarDataHora(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return isoString;
  }
}
