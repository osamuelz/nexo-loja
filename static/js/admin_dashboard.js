/**
 * Nexo - Loja Virtual
 * JavaScript Operacional do Dashboard Administrativo (Referência Stitch)
 *
 * Conectado 100% aos dados reais e autoritativos do PostgreSQL:
 * - KPIs reais de faturamento, pedidos e inventário
 * - Gráfico proporcional de 7 dias com alternância Faturamento/Volume
 * - Consulta, busca e filtros de pedidos por status e período
 * - Modal de inspeção e atualização de status com devolução de estoque
 * - Linha do tempo de auditoria (HistoricoPedido)
 */

let periodoAtual = 'hoje';
let modoGrafico = 'faturamento'; // 'faturamento' ou 'volume'
let paginaAtual = 1;
let pedidoSelecionadoAtual = null;
let dadosMetricasAtuais = null;

// =============================================================================
// INICIALIZAÇÃO
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
  inicializarDataHoje();
  configurarMenuMobile();
  configurarEventosFiltros();
  configurarBotoesPeriodo();
  configurarBotoesGrafico();
  configurarModal();

  // Carrega dados iniciais do PostgreSQL
  carregarTudo();
});

function configurarMenuMobile() {
  const btnMenu = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (btnMenu && sidebar) {
    btnMenu.addEventListener('click', () => {
      sidebar.classList.toggle('-translate-x-full');
      if (backdrop) backdrop.classList.toggle('hidden');
    });
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
        backdrop.classList.add('hidden');
      });
    }
  }
}

function inicializarDataHoje() {
  const el = document.getElementById('label-data-hoje');
  if (el) {
    const agora = new Date();
    const opcoes = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const strData = agora.toLocaleDateString('pt-BR', opcoes);
    el.textContent = `${strData.charAt(0).toUpperCase() + strData.slice(1)}`;
  }
}

async function carregarTudo() {
  await Promise.all([
    carregarMetricas(periodoAtual),
    carregarPedidos()
  ]);
}

// =============================================================================
// MÉTRICAS E KPIS REAIS (POSTGRESQL)
// =============================================================================

async function carregarMetricas(periodo = 'hoje') {
  try {
    const resp = await fetch(`/admin/api/metricas?periodo=${encodeURIComponent(periodo)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (resp.status === 401) {
      window.location.href = '/admin/login';
      return;
    }
    const data = await resp.json();
    if (!resp.ok || !data.sucesso) return;

    dadosMetricasAtuais = data.metricas;
    renderizarKPIs(dadosMetricasAtuais);
    renderizarGraficoSemana(dadosMetricasAtuais);
    renderizarReposicaoCritica(dadosMetricasAtuais.reposicaoCritica);

  } catch (err) {
    console.error('Falha ao carregar métricas:', err);
  }
}

function renderizarKPIs(m) {
  // 1. Faturamento
  const elFat = document.getElementById('kpi-faturamento');
  if (elFat) {
    const valorFat = periodoAtual === 'hoje' ? m.faturamentoHojeCentavos : (m.faturamentoPeriodoCentavos ?? m.faturamentoHojeCentavos);
    elFat.textContent = formatarMoedaCentavos(valorFat);
  }

  const elVar = document.getElementById('kpi-variacao');
  const elVarWrap = document.getElementById('kpi-variacao-wrap');
  if (elVar && elVarWrap) {
    const sinal = m.variacaoVsOntem >= 0 ? '+' : '';
    elVar.textContent = `${sinal}${m.variacaoVsOntem}%`;
    if (m.variacaoVsOntem >= 0) {
      elVar.className = 'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-success-container text-success text-[11px] font-semibold';
    } else {
      elVar.className = 'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-error-container text-error text-[11px] font-semibold';
    }
  }

  // 2. Vendas Concluídas
  const elVendas = document.getElementById('kpi-vendas-qtd');
  if (elVendas) {
    elVendas.innerHTML = `${m.vendasConcluidasQtd} <span class="text-xs font-normal text-secondary">concluídas (${m.pedidosAtivosQtd || 0} pedidos)</span>`;
  }
  const elTicket = document.getElementById('kpi-ticket-medio');
  if (elTicket) {
    elTicket.textContent = formatarMoedaCentavos(m.ticketMedioCentavos);
  }

  // 3. Produtos e SKUs
  const elSkus = document.getElementById('kpi-skus-qtd');
  if (elSkus) {
    elSkus.innerHTML = `${m.skusAtivosQtd} <span class="text-xs font-normal text-secondary">SKUs</span>`;
  }
  const elProdCat = document.getElementById('kpi-produtos-categorias');
  if (elProdCat) {
    elProdCat.textContent = `${m.produtosAtivosQtd} produtos em ${m.categoriasQtd} categorias`;
  }

  // 4. Atenção de Estoque
  const elAtencao = document.getElementById('kpi-atencao-estoque');
  if (elAtencao) {
    elAtencao.innerHTML = `${m.atencaoEstoqueQtd} <span class="text-xs font-normal text-secondary">itens</span>`;
  }
  const elEstZero = document.getElementById('kpi-estoque-zero');
  if (elEstZero) {
    elEstZero.textContent = `${m.estoqueZeroQtd} em nível zero`;
  }
}

// =============================================================================
// GRÁFICO 7 DIAS (ESTILO APPLE STOCKS / STITCH)
// =============================================================================

function renderizarGraficoSemana(m) {
  const container = document.getElementById('chart-bars-container');
  if (!container || !m.graficoSemana) return;

  const elTotal = document.getElementById('chart-total-semana');
  if (elTotal) {
    elTotal.textContent = `Total: ${formatarMoedaCentavos(m.totalSemanaCentavos)}`;
  }

  container.replaceChildren();

  const maxVal = modoGrafico === 'faturamento'
    ? Math.max(m.picoDiaCentavos, 1)
    : Math.max(...m.graficoSemana.map(d => d.volume), 1);

  m.graficoSemana.forEach(dia => {
    const val = modoGrafico === 'faturamento' ? dia.faturamentoCentavos : dia.volume;
    const alturaPercent = Math.max(Math.round((val / maxVal) * 100), 8);

    const barCol = document.createElement('div');
    barCol.className = 'flex-1 flex flex-col items-center gap-2 group cursor-pointer';

    // Rótulo de tooltip/valor
    const labelValor = modoGrafico === 'faturamento'
      ? (val > 0 ? `R$ ${(val / 100).toFixed(0)}` : 'R$ 0')
      : `${val} ped`;

    barCol.title = `${dia.diaSemana} (${dia.data}): ${labelValor}`;

    const barFrame = document.createElement('div');
    barFrame.className = 'relative w-full flex items-end justify-center h-44';

    const bar = document.createElement('div');
    if (dia.ehHoje) {
      bar.className = 'w-full max-w-[34px] rounded-t-lg bg-primary shadow-sm transition-all group-hover:brightness-110';
    } else {
      bar.className = 'w-full max-w-[34px] rounded-t-lg bg-surface-container transition-all group-hover:bg-primary/50';
    }
    bar.style.height = `${alturaPercent}%`;

    barFrame.appendChild(bar);

    const infoWrap = document.createElement('div');
    infoWrap.className = 'flex flex-col items-center';

    const diaSpan = document.createElement('span');
    diaSpan.className = dia.ehHoje
      ? 'text-[11px] font-bold text-primary'
      : 'text-[11px] font-medium text-outline group-hover:text-on-surface';
    diaSpan.textContent = dia.diaSemana;

    const valSpan = document.createElement('span');
    valSpan.className = 'text-[11px] tabular-nums text-secondary';
    valSpan.textContent = modoGrafico === 'faturamento'
      ? (val >= 100000 ? `${(val / 100000).toFixed(1)}k` : `R$${(val / 100).toFixed(0)}`)
      : String(val);

    infoWrap.append(diaSpan, valSpan);
    barCol.append(barFrame, infoWrap);
    container.appendChild(barCol);
  });
}

function configurarBotoesGrafico() {
  const btnFat = document.getElementById('btn-chart-fat');
  const btnVol = document.getElementById('btn-chart-vol');

  if (btnFat && btnVol) {
    btnFat.addEventListener('click', () => {
      modoGrafico = 'faturamento';
      btnFat.className = 'px-2.5 py-1 text-xs font-semibold rounded bg-surface-container-lowest text-on-surface shadow-sm';
      btnVol.className = 'px-2.5 py-1 text-xs font-medium rounded text-secondary hover:text-on-surface';
      if (dadosMetricasAtuais) renderizarGraficoSemana(dadosMetricasAtuais);
    });

    btnVol.addEventListener('click', () => {
      modoGrafico = 'volume';
      btnVol.className = 'px-2.5 py-1 text-xs font-semibold rounded bg-surface-container-lowest text-on-surface shadow-sm';
      btnFat.className = 'px-2.5 py-1 text-xs font-medium rounded text-secondary hover:text-on-surface';
      if (dadosMetricasAtuais) renderizarGraficoSemana(dadosMetricasAtuais);
    });
  }
}

// =============================================================================
// REPOSIÇÃO CRÍTICA DE ESTOQUE
// =============================================================================

function renderizarReposicaoCritica(itens) {
  const container = document.getElementById('lista-reposicao-container');
  const badgeTotal = document.getElementById('badge-itens-criticos');
  if (!container) return;

  if (badgeTotal) {
    badgeTotal.textContent = `${itens ? itens.length : 0} itens`;
  }

  container.replaceChildren();

  if (!itens || itens.length === 0) {
    container.innerHTML = '<div class="text-xs text-outline py-4 text-center">Nenhum item com estoque crítico no momento.</div>';
    return;
  }

  itens.forEach(item => {
    const card = document.createElement('div');
    card.className = 'flex items-center justify-between p-3 rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors';

    const info = document.createElement('div');
    info.className = 'flex items-center gap-3 overflow-hidden';

    const img = document.createElement('img');
    img.src = item.imagem || '/static/images/placeholder.svg';
    img.alt = item.produtoNome;
    img.className = 'w-9 h-9 rounded object-contain bg-surface-container-lowest p-0.5 flex-shrink-0';

    const text = document.createElement('div');
    text.className = 'flex flex-col truncate';

    const nome = document.createElement('span');
    nome.className = 'text-xs font-semibold text-on-surface truncate';
    nome.textContent = item.produtoNome;

    const sub = document.createElement('span');
    sub.className = 'text-[11px] text-secondary tabular-nums truncate';
    sub.textContent = `${item.rotulo} • Estoque: ${item.estoque} un`;

    text.append(nome, sub);
    info.append(img, text);

    const badge = document.createElement('span');
    if (item.nivel === 'CRÍTICO' || item.estoque === 0) {
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-error-container text-error flex-shrink-0';
      badge.textContent = item.estoque === 0 ? 'ZERADO' : 'CRÍTICO';
    } else {
      badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-tertiary-container text-tertiary flex-shrink-0';
      badge.textContent = 'BAIXO';
    }

    card.append(info, badge);
    container.appendChild(card);
  });
}

// =============================================================================
// CONSULTA, BUSCA E FILTROS DE PEDIDOS
// =============================================================================

async function carregarPedidos() {
  const busca = document.getElementById('filtro-busca-global')?.value || '';
  const status = document.getElementById('filtro-status')?.value || 'todos';
  const dataIni = document.getElementById('filtro-data-inicio')?.value || '';
  const dataFim = document.getElementById('filtro-data-fim')?.value || '';

  const params = new URLSearchParams({
    busca,
    status,
    data_inicio: dataIni,
    data_fim: dataFim,
    pagina: String(paginaAtual),
    limite: '25'
  });

  try {
    const resp = await fetch(`/admin/api/pedidos?${params.toString()}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (resp.status === 401) {
      window.location.href = '/admin/login';
      return;
    }
    const data = await resp.json();
    if (!resp.ok || !data.sucesso) return;

    renderizarTabelaPedidos(data.pedidos, data.total, data.pagina, data.limite);

  } catch (err) {
    console.error('Falha ao listar pedidos:', err);
  }
}

function renderizarTabelaPedidos(pedidos, total, pagina, limite) {
  const tbody = document.getElementById('tabela-pedidos-body');
  const labelInfo = document.getElementById('label-paginacao-info');
  const btnAnt = document.getElementById('btn-pag-anterior');
  const btnProx = document.getElementById('btn-pag-proxima');

  if (!tbody) return;
  tbody.replaceChildren();

  if (!pedidos || pedidos.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="py-8 text-center text-xs text-outline">Nenhum pedido encontrado com os filtros selecionados.</td>`;
    tbody.appendChild(tr);
    if (labelInfo) labelInfo.textContent = 'Exibindo 0 de 0 pedidos';
    return;
  }

  pedidos.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    // 1. ID / Data
    const tdId = document.createElement('td');
    tdId.className = 'py-3.5 px-6 whitespace-nowrap';
    const dataObj = new Date(p.criadoEm);
    const dataHoraStr = !isNaN(dataObj)
      ? `${dataObj.toLocaleDateString('pt-BR')} ${dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : 'Recente';
    tdId.innerHTML = `
      <div class="flex flex-col">
        <span class="font-semibold text-on-surface text-xs tabular-nums">${p.numeroPedido}</span>
        <span class="text-[11px] text-outline">${dataHoraStr}</span>
      </div>
    `;

    // 2. Cliente
    const tdCli = document.createElement('td');
    tdCli.className = 'py-3.5 px-6';
    tdCli.innerHTML = `
      <div class="flex flex-col">
        <span class="font-medium text-on-surface text-xs">${escapeHTML(p.clienteNome)}</span>
        <span class="text-[11px] text-outline truncate max-w-[180px]">${escapeHTML(p.clienteEmail)}</span>
      </div>
    `;

    // 3. Itens
    const tdItens = document.createElement('td');
    tdItens.className = 'py-3.5 px-6';
    const resumoItens = (p.itens || []).map(i => `${i.quantidade}x ${i.nomeProduto}`).join(', ');
    const totalItens = (p.itens || []).reduce((acc, i) => acc + i.quantidade, 0);
    tdItens.innerHTML = `
      <div class="flex flex-col max-w-xs">
        <span class="font-medium text-on-surface text-xs">${totalItens} ${totalItens === 1 ? 'item' : 'itens'}</span>
        <span class="text-[11px] text-outline truncate">${escapeHTML(resumoItens || 'Sem itens')}</span>
      </div>
    `;

    // 4. Pagamento
    const tdPag = document.createElement('td');
    tdPag.className = 'py-3.5 px-6 whitespace-nowrap';
    tdPag.innerHTML = renderizarBadgePagamento(p.metodoPagamento);

    // 5. Total
    const tdTot = document.createElement('td');
    tdTot.className = 'py-3.5 px-6 text-right whitespace-nowrap tabular-nums font-semibold text-xs text-on-surface';
    tdTot.textContent = formatarMoedaCentavos(p.totalCentavos);

    // 6. Status
    const tdSt = document.createElement('td');
    tdSt.className = 'py-3.5 px-6 text-center whitespace-nowrap';
    tdSt.innerHTML = renderizarBadgeStatus(p.status);

    // 7. Ação
    const tdAcao = document.createElement('td');
    tdAcao.className = 'py-3.5 px-6 text-right whitespace-nowrap';
    const btnVer = document.createElement('button');
    btnVer.type = 'button';
    btnVer.className = 'p-1.5 rounded-lg hover:bg-surface-container text-secondary hover:text-primary transition-all inline-flex items-center gap-1 text-xs font-semibold';
    btnVer.title = 'Inspecionar e gerenciar pedido';
    btnVer.innerHTML = '<span class="material-symbols-outlined text-[18px]">tune</span><span>Gerenciar</span>';
    btnVer.addEventListener('click', () => abrirDetalhesPedido(p.numeroPedido));
    tdAcao.appendChild(btnVer);

    tr.append(tdId, tdCli, tdItens, tdPag, tdTot, tdSt, tdAcao);
    tbody.appendChild(tr);
  });

  // Atualiza controles de paginação
  const inicio = (pagina - 1) * limite + 1;
  const fim = Math.min(pagina * limite, total);
  if (labelInfo) labelInfo.textContent = `Exibindo ${inicio} a ${fim} de ${total} pedidos`;

  if (btnAnt) {
    btnAnt.disabled = pagina <= 1;
    btnAnt.onclick = () => { paginaAtual--; carregarPedidos(); };
  }
  if (btnProx) {
    btnProx.disabled = fim >= total;
    btnProx.onclick = () => { paginaAtual++; carregarPedidos(); };
  }
}

// =============================================================================
// MODAL / DRAWER DE INSPEÇÃO E ATUALIZAÇÃO DO PEDIDO
// =============================================================================

async function abrirDetalhesPedido(numeroPedido) {
  try {
    const resp = await fetch(`/admin/api/pedidos/${encodeURIComponent(numeroPedido)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (resp.status === 401) {
      window.location.href = '/admin/login';
      return;
    }
    const data = await resp.json();
    if (!resp.ok || !data.sucesso || !data.pedido) {
      mostrarToast('Falha ao obter detalhes do pedido.', 'erro');
      return;
    }

    pedidoSelecionadoAtual = data.pedido;
    preencherModalPedido(pedidoSelecionadoAtual);

    const modal = document.getElementById('modal-pedido');
    if (modal) modal.classList.remove('hidden');

  } catch (err) {
    console.error('Erro ao abrir pedido:', err);
    mostrarToast('Erro de comunicação com o servidor.', 'erro');
  }
}

function preencherModalPedido(p) {
  document.getElementById('modal-pedido-numero').textContent = `Pedido ${p.numeroPedido}`;

  const dataObj = new Date(p.criadoEm);
  const dataFormatada = !isNaN(dataObj)
    ? dataObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Data não informada';
  document.getElementById('modal-pedido-data').textContent = `Registrado em ${dataFormatada}`;

  // Badge de Status
  const badgeSt = document.getElementById('modal-status-badge');
  if (badgeSt) {
    badgeSt.innerHTML = renderizarBadgeStatus(p.status);
  }

  // Stepper Visual
  renderizarModalStepper(p.status);

  // Comprador & Entrega
  document.getElementById('modal-cliente-nome').textContent = p.clienteNome || 'Consumidor';
  document.getElementById('modal-cliente-email').textContent = p.clienteEmail || 'Não informado';
  document.getElementById('modal-cliente-telefone').textContent = p.clienteTelefone || 'Não informado';
  document.getElementById('modal-cliente-endereco').textContent = p.enderecoEntrega || 'Retirada no balcão';
  document.getElementById('modal-pagamento-metodo').textContent = formatarMetodoPagamentoNome(p.metodoPagamento);

  // Tabela de Itens Congelados
  const tbodyItens = document.getElementById('modal-itens-tbody');
  tbodyItens.replaceChildren();

  (p.itens || []).forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-surface-container-low transition-colors';

    const tdProd = document.createElement('td');
    tdProd.className = 'py-2.5 px-3 flex items-center gap-2';
    tdProd.innerHTML = `
      <img src="${item.imagemUrl || '/static/images/placeholder.svg'}" class="w-8 h-8 rounded object-contain bg-surface-container-lowest p-0.5" />
      <div>
        <div class="font-semibold text-on-surface">${escapeHTML(item.nomeProduto)}</div>
        <div class="text-[11px] text-secondary">${escapeHTML(item.rotuloVariante || 'Padrão')}</div>
      </div>
    `;

    const tdQtd = document.createElement('td');
    tdQtd.className = 'py-2.5 px-3 text-center tabular-nums font-semibold';
    tdQtd.textContent = String(item.quantidade);

    const tdUnit = document.createElement('td');
    tdUnit.className = 'py-2.5 px-3 text-right tabular-nums';
    tdUnit.textContent = formatarMoedaCentavos(item.precoUnitarioCentavos);

    const tdSub = document.createElement('td');
    tdSub.className = 'py-2.5 px-3 text-right tabular-nums font-bold';
    tdSub.textContent = formatarMoedaCentavos(item.subtotalCentavos);

    tr.append(tdProd, tdQtd, tdUnit, tdSub);
    tbodyItens.appendChild(tr);
  });

  document.getElementById('modal-total-valor').textContent = formatarMoedaCentavos(p.totalCentavos);

  // Configuração das Opções de Transição de Status
  configurarSeletorTransicaoStatus(p.status);

  // Histórico de Auditoria
  renderizarTimelineAuditoria(p.historico || []);
}

function renderizarModalStepper(statusAtual) {
  const container = document.getElementById('modal-stepper-container');
  if (!container) return;
  container.replaceChildren();

  const etapas = [
    { chave: 'recebido', rotulo: 'Recebido', icone: 'inventory' },
    { chave: 'em_preparacao', rotulo: 'Preparação', icone: 'package_2' },
    { chave: 'enviado', rotulo: 'Enviado', icone: 'local_shipping' },
    { chave: 'entregue', rotulo: 'Entregue', icone: 'task_alt' }
  ];

  const ordem = ['recebido', 'em_preparacao', 'enviado', 'entregue'];
  const idxAtual = ordem.indexOf(statusAtual);
  const estaCancelado = statusAtual === 'cancelado';

  etapas.forEach((etapa, idx) => {
    const card = document.createElement('div');
    card.className = 'flex flex-col items-center p-2 rounded-lg text-center transition-all';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined text-[18px] mb-1';
    iconSpan.textContent = etapa.icone;

    const rotuloSpan = document.createElement('span');
    rotuloSpan.className = 'text-[11px] font-semibold';
    rotuloSpan.textContent = etapa.rotulo;

    if (estaCancelado) {
      card.className += ' bg-surface-container opacity-40 text-secondary';
    } else if (idx <= idxAtual) {
      card.className += ' bg-primary text-white shadow-sm';
    } else {
      card.className += ' bg-surface-container text-secondary';
    }

    card.append(iconSpan, rotuloSpan);
    container.appendChild(card);
  });

  if (estaCancelado) {
    const cancelBox = document.createElement('div');
    cancelBox.className = 'col-span-4 mt-2 p-2 rounded-lg bg-error-container text-error text-xs font-bold text-center flex items-center justify-center gap-1.5';
    cancelBox.innerHTML = '<span class="material-symbols-outlined text-[16px]">cancel</span><span>PEDIDO CANCELADO (ESTOQUE RESTITUÍDO)</span>';
    container.appendChild(cancelBox);
  }
}

function configurarSeletorTransicaoStatus(statusAtual) {
  const select = document.getElementById('modal-novo-status');
  const btnSalvar = document.getElementById('btn-salvar-novo-status');
  const alertaEstorno = document.getElementById('alerta-estorno-estoque');
  const inputMotivo = document.getElementById('modal-motivo-status');

  if (!select || !btnSalvar) return;
  select.replaceChildren();
  if (inputMotivo) inputMotivo.value = '';

  const transicoesPermitidas = {
    'recebido': [
      { valor: 'em_preparacao', texto: 'Avançar para: Em preparação' },
      { valor: 'cancelado', texto: 'Cancelar Pedido (Devolver Estoque)' }
    ],
    'em_preparacao': [
      { valor: 'enviado', texto: 'Avançar para: Enviado' },
      { valor: 'cancelado', texto: 'Cancelar Pedido (Devolver Estoque)' }
    ],
    'enviado': [
      { valor: 'entregue', texto: 'Concluir: Entregue ao Cliente' },
      { valor: 'cancelado', texto: 'Cancelar Pedido (Devolver Estoque)' }
    ],
    'entregue': [],
    'cancelado': []
  };

  const opcoes = transicoesPermitidas[statusAtual] || [];

  if (opcoes.length === 0) {
    select.disabled = true;
    btnSalvar.disabled = true;
    btnSalvar.classList.add('opacity-40', 'cursor-not-allowed');
    const opt = document.createElement('option');
    opt.textContent = `Status final (${statusAtual.toUpperCase()}) — Nenhuma alteração permitida`;
    select.appendChild(opt);
    if (alertaEstorno) alertaEstorno.classList.add('hidden');
    return;
  }

  select.disabled = false;
  btnSalvar.disabled = false;
  btnSalvar.classList.remove('opacity-40', 'cursor-not-allowed');

  opcoes.forEach(optData => {
    const opt = document.createElement('option');
    opt.value = optData.valor;
    opt.textContent = optData.texto;
    select.appendChild(opt);
  });

  // Mostra alerta caso 'cancelado' esteja selecionado
  const atualizarAlertaCancelamento = () => {
    if (select.value === 'cancelado') {
      alertaEstorno?.classList.remove('hidden');
    } else {
      alertaEstorno?.classList.add('hidden');
    }
  };

  select.onchange = atualizarAlertaCancelamento;
  atualizarAlertaCancelamento();
}

function renderizarTimelineAuditoria(historico) {
  const container = document.getElementById('modal-historico-timeline');
  if (!container) return;
  container.replaceChildren();

  if (!historico || historico.length === 0) {
    container.innerHTML = '<div class="text-xs text-outline italic">Nenhum evento registrado ainda.</div>';
    return;
  }

  historico.forEach(h => {
    const item = document.createElement('div');
    item.className = 'flex items-start gap-3 p-2.5 rounded-lg bg-surface-container-low text-xs border border-outline-variant/10';

    const dataObj = new Date(h.criadoEm);
    const dataStr = !isNaN(dataObj)
      ? `${dataObj.toLocaleDateString('pt-BR')} ${dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      : 'Data desconhecida';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-outlined text-[16px] text-primary mt-0.5';
    iconSpan.textContent = h.statusNovo === 'cancelado' ? 'cancel' : 'check_circle';

    const content = document.createElement('div');
    content.className = 'flex-1 flex flex-col';

    const topo = document.createElement('div');
    topo.className = 'flex items-center justify-between gap-2';
    topo.innerHTML = `
      <span class="font-semibold text-on-surface">Status: ${h.statusNovo.toUpperCase()}</span>
      <span class="text-[11px] text-outline tabular-nums">${dataStr}</span>
    `;

    const sub = document.createElement('div');
    sub.className = 'text-[11px] text-secondary mt-0.5';
    sub.textContent = `Por: ${h.autor || 'Sistema'}`;

    if (h.observacao) {
      const obs = document.createElement('div');
      obs.className = 'text-[11px] text-on-surface mt-1 bg-surface-container-lowest p-1.5 rounded border border-outline-variant/20';
      obs.textContent = h.observacao;
      content.append(topo, sub, obs);
    } else {
      content.append(topo, sub);
    }

    item.append(iconSpan, content);
    container.appendChild(item);
  });
}

function configurarModal() {
  const btnFechar = document.getElementById('btn-fechar-modal');
  const modal = document.getElementById('modal-pedido');

  if (btnFechar && modal) {
    btnFechar.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }

  // Ação de Salvar Novo Status
  const btnSalvar = document.getElementById('btn-salvar-novo-status');
  if (btnSalvar) {
    btnSalvar.addEventListener('click', async () => {
      if (!pedidoSelecionadoAtual) return;

      const select = document.getElementById('modal-novo-status');
      const inputMotivo = document.getElementById('modal-motivo-status');
      const novoStatus = select?.value;
      const motivo = inputMotivo?.value || '';

      if (!novoStatus) return;

      if (novoStatus === 'cancelado') {
        const confirmou = confirm(
          `Confirma o cancelamento do pedido ${pedidoSelecionadoAtual.numeroPedido}?\nO estoque dos itens será devolvido ao catálogo.`
        );
        if (!confirmou) return;
      }

      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Processando...';

      try {
        const resp = await fetch(`/admin/api/pedidos/${encodeURIComponent(pedidoSelecionadoAtual.numeroPedido)}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            status: novoStatus,
            observacao: motivo
          })
        });

        const data = await resp.json();

        if (resp.ok && data.sucesso) {
          mostrarToast(`Status alterado para "${novoStatus.toUpperCase()}" com sucesso!`, 'sucesso');
          // Recarrega o modal com o pedido atualizado
          await abrirDetalhesPedido(pedidoSelecionadoAtual.numeroPedido);
          // Recarrega lista e métricas
          await carregarTudo();
        } else {
          mostrarToast(data.erro || 'Não foi possível atualizar o status.', 'erro');
        }
      } catch (err) {
        console.error(err);
        mostrarToast('Erro de conexão ao salvar status.', 'erro');
      } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<span class="material-symbols-outlined text-[16px]">save</span><span>Confirmar Alteração de Status</span>';
      }
    });
  }
}

// =============================================================================
// EVENTOS DE FILTROS E PERÍODO
// =============================================================================

function configurarBotoesPeriodo() {
  const btns = document.querySelectorAll('.period-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.className = 'px-3 py-1.5 rounded text-xs font-medium text-secondary hover:text-on-surface transition-all period-btn');
      btn.className = 'px-3 py-1.5 rounded text-xs font-semibold bg-surface-container-lowest text-on-surface shadow-sm transition-all period-btn active';
      periodoAtual = btn.dataset.period || 'hoje';
      carregarMetricas(periodoAtual);
    });
  });

  const btnRecarregar = document.getElementById('btn-recarregar-tudo');
  if (btnRecarregar) {
    btnRecarregar.addEventListener('click', () => {
      mostrarToast('Atualizando dados do PostgreSQL...', 'sucesso');
      carregarTudo();
    });
  }
}

function configurarEventosFiltros() {
  const buscaInput = document.getElementById('filtro-busca-global');
  const statusSelect = document.getElementById('filtro-status');
  const dataIni = document.getElementById('filtro-data-inicio');
  const dataFim = document.getElementById('filtro-data-fim');
  const btnLimpar = document.getElementById('btn-limpar-filtros');

  let timerBusca = null;
  const dispararFiltro = () => {
    paginaAtual = 1;
    carregarPedidos();
  };

  if (buscaInput) {
    buscaInput.addEventListener('input', () => {
      clearTimeout(timerBusca);
      timerBusca = setTimeout(dispararFiltro, 350);
    });
  }

  if (statusSelect) statusSelect.addEventListener('change', dispararFiltro);
  if (dataIni) dataIni.addEventListener('change', dispararFiltro);
  if (dataFim) dataFim.addEventListener('change', dispararFiltro);

  if (btnLimpar) {
    btnLimpar.addEventListener('click', () => {
      if (buscaInput) buscaInput.value = '';
      if (statusSelect) statusSelect.value = 'todos';
      if (dataIni) dataIni.value = '';
      if (dataFim) dataFim.value = '';
      dispararFiltro();
    });
  }
}

// =============================================================================
// AUXILIARES DE FORMATAÇÃO E UI
// =============================================================================

function formatarMoedaCentavos(centavos) {
  const valor = (Number(centavos) || 0) / 100;
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderBadgeColor(status) {
  switch (status) {
    case 'recebido':
    case 'confirmado':
      return { dot: 'bg-primary', bg: 'bg-primary/10', text: 'text-primary', label: 'Recebido' };
    case 'em_preparacao':
      return { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-700', label: 'Em preparação' };
    case 'enviado':
      return { dot: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-700', label: 'Enviado' };
    case 'entregue':
      return { dot: 'bg-success', bg: 'bg-success/10', text: 'text-success', label: 'Entregue' };
    case 'cancelado':
      return { dot: 'bg-error', bg: 'bg-error/10', text: 'text-error', label: 'Cancelado' };
    default:
      return { dot: 'bg-secondary', bg: 'bg-surface-container', text: 'text-secondary', label: status || 'Indefinido' };
  }
}

function renderizarBadgeStatus(status) {
  const c = renderBadgeColor(status);
  return `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${c.bg} ${c.text} text-[11px] font-semibold">
      <span class="w-1.5 h-1.5 rounded-full ${c.dot}"></span>
      <span>${c.label}</span>
    </span>
  `;
}

function renderizarBadgePagamento(metodo) {
  const m = String(metodo || '').toLowerCase();
  if (m.includes('pix')) {
    return `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface text-[11px] font-medium">
        <span class="material-symbols-outlined text-[13px] text-primary">qr_code_2</span>
        <span>PIX</span>
      </span>
    `;
  }
  if (m.includes('credito') || m.includes('cartao')) {
    return `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface text-[11px] font-medium">
        <span class="material-symbols-outlined text-[13px] text-secondary">credit_card</span>
        <span>Crédito</span>
      </span>
    `;
  }
  return `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container text-on-surface text-[11px] font-medium">
      <span class="material-symbols-outlined text-[13px] text-secondary">payments</span>
      <span>Retirada / Balcão</span>
    </span>
  `;
}

function formatarMetodoPagamentoNome(metodo) {
  const m = String(metodo || '').toLowerCase();
  if (m.includes('pix')) return 'PIX (Instantâneo)';
  if (m.includes('credito')) return 'Cartão de Crédito';
  if (m.includes('debito')) return 'Cartão de Débito';
  return 'Pagamento Presencial / Retirada no Balcão';
}

function mostrarToast(msg, tipo = 'sucesso') {
  const toast = document.getElementById('toast-admin');
  const txt = document.getElementById('toast-msg');
  const icon = document.getElementById('toast-icon');
  if (!toast || !txt) return;

  txt.textContent = msg;

  if (tipo === 'sucesso') {
    toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold bg-on-surface text-surface transition-all duration-300';
    if (icon) icon.textContent = 'check_circle';
  } else {
    toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold bg-error text-white transition-all duration-300';
    if (icon) icon.textContent = 'error';
  }

  setTimeout(() => {
    toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-12 opacity-0 pointer-events-none transition-all duration-300 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold';
  }, 4000);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
