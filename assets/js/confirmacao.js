/**
 * Nexo - Loja Virtual
 * Lógica da Página de Confirmação do Pedido (Etapa 5 / Revisão de Segurança)
 *
 * Consulta autoritativa via GET /api/pedidos/<numero_pedido>.
 * Renderiza os dados históricos congelados no momento da compra (imutáveis).
 * Previne XSS rigorosamente utilizando textContent e createElement para todos os dados do comprador.
 */

import {
  inicializarComponentesComuns,
  formatarPreco
} from './componentes.js';

async function iniciarConfirmacao() {
  inicializarComponentesComuns();

  const container = document.getElementById('confirmacao-container');
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const numeroPedido = urlParams.get('numero');
  let tokenAcesso = urlParams.get('token');

  // Recupera token do histórico local caso não venha explicitamente na URL
  if (!tokenAcesso && numeroPedido) {
    try {
      const historico = JSON.parse(localStorage.getItem('nexo_meus_pedidos') || '[]');
      const itemEncontrado = historico.find(p => p.numeroPedido === numeroPedido);
      if (itemEncontrado && itemEncontrado.tokenAcesso) {
        tokenAcesso = itemEncontrado.tokenAcesso;
      }
    } catch (_) {}
  }

  if (!numeroPedido) {
    container.replaceChildren();
    const erroBox = document.createElement('div');
    erroBox.className = 'cart-empty-state';
    erroBox.style.padding = '4rem 1rem';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'cart-empty-icon';
    iconDiv.style.color = 'var(--color-warning)';
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-[40px]">help_outline</span>';

    const h2 = document.createElement('h2');
    h2.className = 'cart-empty-title';
    h2.textContent = 'Nenhum pedido especificado';

    const p = document.createElement('p');
    p.className = 'cart-empty-desc';
    p.textContent = 'Para visualizar o comprovante, acesse a partir da conclusão da sua compra.';

    const divBtn = document.createElement('div');
    divBtn.style.marginTop = '1rem';
    const aVitrine = document.createElement('a');
    aVitrine.href = '/';
    aVitrine.className = 'btn-primary';
    aVitrine.textContent = 'Ir para a Vitrine';
    divBtn.appendChild(aVitrine);

    erroBox.append(iconDiv, h2, p, divBtn);
    container.appendChild(erroBox);
    return;
  }

  try {
    let urlApi = `/api/pedidos/${encodeURIComponent(numeroPedido)}`;
    if (tokenAcesso) {
      urlApi += `?token=${encodeURIComponent(tokenAcesso)}`;
    }

    const headers = { 'Accept': 'application/json' };
    if (tokenAcesso) {
      headers['X-Order-Token'] = tokenAcesso;
    }

    const resposta = await fetch(urlApi, { headers });
    const data = await resposta.json();

    if (!resposta.ok || !data.sucesso || !data.pedido) {
      container.replaceChildren();
      const erroBox = document.createElement('div');
      erroBox.className = 'cart-empty-state';
      erroBox.style.padding = '4rem 1rem';

      const iconDiv = document.createElement('div');
      iconDiv.className = 'cart-empty-icon';
      iconDiv.style.color = 'var(--color-error)';
      iconDiv.innerHTML = '<span class="material-symbols-outlined text-[40px]">error_outline</span>';

      const h2 = document.createElement('h2');
      h2.className = 'cart-empty-title';
      h2.textContent = 'Pedido não encontrado ou não autorizado';

      const pDesc = document.createElement('p');
      pDesc.className = 'cart-empty-desc';
      pDesc.textContent = `O pedido ${numeroPedido} não foi localizado ou requer a chave de acesso do comprador.`;

      const divAcoes = document.createElement('div');
      divAcoes.style.cssText = 'margin-top: 1rem; display: flex; gap: 0.75rem; justify-content: center;';

      const aMeusPed = document.createElement('a');
      aMeusPed.href = '/pedidos';
      aMeusPed.className = 'btn-primary';
      aMeusPed.textContent = 'Ver Meus Pedidos';

      const aInicio = document.createElement('a');
      aInicio.href = '/';
      aInicio.className = 'btn-drawer-close-action';
      aInicio.style.cssText = 'padding: 0.65rem 1rem; border: 1px solid var(--color-divider); border-radius: var(--radius-sm); text-decoration: none;';
      aInicio.textContent = 'Voltar para o Início';

      divAcoes.append(aMeusPed, aInicio);
      erroBox.append(iconDiv, h2, pDesc, divAcoes);
      container.appendChild(erroBox);
      return;
    }

    renderizarComprovantePedido(container, data.pedido);

  } catch (err) {
    container.replaceChildren();
    const erroBox = document.createElement('div');
    erroBox.className = 'cart-empty-state';
    erroBox.style.padding = '4rem 1rem';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'cart-empty-icon';
    iconDiv.style.color = 'var(--color-error)';
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-[40px]">wifi_off</span>';

    const h2 = document.createElement('h2');
    h2.className = 'cart-empty-title';
    h2.textContent = 'Falha de Comunicação';

    const p = document.createElement('p');
    p.className = 'cart-empty-desc';
    p.textContent = 'Não foi possível carregar os detalhes do pedido no momento.';

    const divBtn = document.createElement('div');
    divBtn.style.marginTop = '1rem';
    const aVitrine = document.createElement('a');
    aVitrine.href = '/';
    aVitrine.className = 'btn-primary';
    aVitrine.textContent = 'Voltar para a Vitrine';
    divBtn.appendChild(aVitrine);

    erroBox.append(iconDiv, h2, p, divBtn);
    container.appendChild(erroBox);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarConfirmacao);
} else {
  iniciarConfirmacao();
}

/**
 * Renderiza o comprovante oficial completo do pedido com total proteção contra XSS
 */
function renderizarComprovantePedido(container, pedido) {
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'confirmation-wrapper';

  // Cabeçalho de Sucesso
  const header = document.createElement('div');
  header.className = 'confirmation-header';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'confirmation-badge-icon';
  iconDiv.innerHTML = '<span class="material-symbols-outlined text-[36px]">check</span>';

  const h1 = document.createElement('h1');
  h1.style.cssText = 'font-size: 1.75rem; font-weight: 700; color: #14532D; margin-bottom: 0.25rem;';
  h1.textContent = 'Pedido Confirmado com Sucesso!';

  const subP = document.createElement('p');
  subP.style.cssText = 'color: #166534; font-size: 0.9375rem; max-width: 480px; margin: 0 auto;';
  subP.textContent = 'A reserva dos seus itens foi realizada de forma atômica no PostgreSQL.';

  const tagDiv = document.createElement('div');
  tagDiv.className = 'confirmation-order-tag';
  const iconReceipt = document.createElement('span');
  iconReceipt.className = 'material-symbols-outlined text-[18px]';
  iconReceipt.style.color = 'var(--color-primary)';
  iconReceipt.textContent = 'receipt_long';
  const spanNum = document.createElement('span');
  spanNum.textContent = `Pedido: ${pedido.numeroPedido}`;
  tagDiv.append(iconReceipt, spanNum);

  header.append(iconDiv, h1, subP, tagDiv);

  // Corpo com Detalhes
  const body = document.createElement('div');
  body.className = 'confirmation-body';

  // Grade de Informações (Comprador + Entrega)
  const gridInfo = document.createElement('div');
  gridInfo.className = 'confirmation-grid-info';

  const criarLinhaInfo = (rotulo, valor, corDestaque = null) => {
    const row = document.createElement('div');
    const strong = document.createElement('strong');
    strong.style.color = 'var(--color-text-primary)';
    strong.textContent = `${rotulo}: `;
    const span = document.createElement('span');
    if (corDestaque) {
      span.style.color = corDestaque;
      span.style.fontWeight = '600';
      span.style.textTransform = 'uppercase';
    }
    span.textContent = valor || '—';
    row.append(strong, span);
    return row;
  };

  // Card Comprador
  const boxComprador = document.createElement('div');
  boxComprador.className = 'confirmation-info-box';
  const titleComprador = document.createElement('div');
  titleComprador.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; color: var(--color-text-primary); font-weight: 600;';
  titleComprador.innerHTML = '<span class="material-symbols-outlined text-[18px]">person</span><span>Dados do Comprador</span>';
  const listComprador = document.createElement('div');
  listComprador.style.cssText = 'font-size: 0.875rem; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 0.25rem;';
  listComprador.append(
    criarLinhaInfo('Nome', pedido.clienteNome),
    criarLinhaInfo('E-mail', pedido.clienteEmail),
    criarLinhaInfo('Telefone', pedido.clienteTelefone),
    criarLinhaInfo('Status', pedido.status, 'var(--color-success)')
  );
  boxComprador.append(titleComprador, listComprador);

  // Card Entrega & Pagamento
  const boxEntrega = document.createElement('div');
  boxEntrega.className = 'confirmation-info-box';
  const titleEntrega = document.createElement('div');
  titleEntrega.style.cssText = 'display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; color: var(--color-text-primary); font-weight: 600;';
  titleEntrega.innerHTML = '<span class="material-symbols-outlined text-[18px]">local_shipping</span><span>Entrega e Pagamento</span>';
  const listEntrega = document.createElement('div');
  listEntrega.style.cssText = 'font-size: 0.875rem; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 0.25rem;';
  listEntrega.append(
    criarLinhaInfo('Endereço', pedido.enderecoEntrega),
    criarLinhaInfo('Pagamento', 'Presencial na Retirada / Balcão (Simulado)')
  );
  if (pedido.observacoes) {
    listEntrega.append(criarLinhaInfo('Obs', pedido.observacoes));
  }
  boxEntrega.append(titleEntrega, listEntrega);

  gridInfo.append(boxComprador, boxEntrega);

  // Tabela de Itens Congelados
  const itensSection = document.createElement('div');
  itensSection.style.cssText = 'border: 1px solid var(--color-divider); border-radius: var(--radius-sm); overflow: hidden;';

  const tableHeader = document.createElement('div');
  tableHeader.style.cssText = 'padding: 0.75rem 1rem; background-color: var(--color-surface-low); border-bottom: 1px solid var(--color-divider); font-weight: 600; font-size: 0.875rem; display: flex; justify-content: space-between; align-items: center;';
  
  const spanCount = document.createElement('span');
  spanCount.textContent = `Itens Adquiridos (${pedido.itens?.length || 0})`;
  const spanSubDesc = document.createElement('span');
  spanSubDesc.style.cssText = 'font-size: 0.75rem; color: var(--color-text-secondary); font-weight: 400;';
  spanSubDesc.textContent = 'Preços e nomes congelados na compra';
  tableHeader.append(spanCount, spanSubDesc);

  const table = document.createElement('table');
  table.className = 'confirmation-table';

  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>Produto</th>
      <th style="text-align: center;">Qtd</th>
      <th style="text-align: right;">Preço Unit.</th>
      <th style="text-align: right;">Subtotal</th>
    </tr>
  `;

  const tbody = document.createElement('tbody');

  (pedido.itens || []).forEach(item => {
    const tr = document.createElement('tr');

    const tdProd = document.createElement('td');
    tdProd.style.cssText = 'display: flex; align-items: center; gap: 0.75rem;';
    
    const img = document.createElement('img');
    img.src = item.imagemUrl || '/static/images/placeholder.svg';
    img.alt = item.nomeProduto || 'Produto';
    img.style.cssText = 'width: 40px; height: 40px; border-radius: 4px; object-fit: contain; background: var(--color-surface-low); flex-shrink: 0;';

    const pWrap = document.createElement('div');
    const nomeDiv = document.createElement('div');
    nomeDiv.style.fontWeight = '600';
    nomeDiv.textContent = item.nomeProduto || 'Produto';

    const varDiv = document.createElement('div');
    varDiv.style.cssText = 'font-size: 0.75rem; color: var(--color-text-secondary);';
    varDiv.textContent = item.rotuloVariante || 'Padrão';

    pWrap.append(nomeDiv, varDiv);
    tdProd.append(img, pWrap);

    const tdQtd = document.createElement('td');
    tdQtd.style.textAlign = 'center';
    tdQtd.className = 'tabular-nums font-semibold';
    tdQtd.textContent = String(item.quantidade);

    const tdUnit = document.createElement('td');
    tdUnit.style.textAlign = 'right';
    tdUnit.className = 'tabular-nums';
    tdUnit.textContent = formatarPreco(item.precoUnitarioCentavos);

    const tdSub = document.createElement('td');
    tdSub.style.textAlign = 'right';
    tdSub.className = 'tabular-nums font-semibold';
    tdSub.textContent = formatarPreco(item.subtotalCentavos);

    tr.append(tdProd, tdQtd, tdUnit, tdSub);
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  itensSection.append(tableHeader, table);

  // Rodapé do Comprovante (Totais e Ações)
  const footerCard = document.createElement('div');
  footerCard.style.cssText = 'display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-divider);';

  const totalWrap = document.createElement('div');
  const spanRotuloTotal = document.createElement('span');
  spanRotuloTotal.style.cssText = 'font-size: 0.875rem; color: var(--color-text-secondary); display: block;';
  spanRotuloTotal.textContent = 'Total do pedido:';

  const spanValorTotal = document.createElement('span');
  spanValorTotal.style.cssText = 'font-size: 1.5rem; font-weight: 700; color: var(--color-text-primary);';
  spanValorTotal.className = 'tabular-nums';
  spanValorTotal.textContent = formatarPreco(pedido.totalCentavos);
  totalWrap.append(spanRotuloTotal, spanValorTotal);

  const actionsWrap = document.createElement('div');
  actionsWrap.style.cssText = 'display: flex; gap: 0.75rem; flex-wrap: wrap;';

  const btnPrint = document.createElement('button');
  btnPrint.type = 'button';
  btnPrint.className = 'btn-drawer-close-action';
  btnPrint.style.cssText = 'display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.65rem 1rem; border: 1px solid var(--color-divider); border-radius: var(--radius-sm); font-weight: 600; cursor: pointer;';
  btnPrint.innerHTML = '<span class="material-symbols-outlined text-[18px]">print</span><span>Imprimir</span>';
  btnPrint.addEventListener('click', () => window.print());

  const btnContinuar = document.createElement('a');
  btnContinuar.href = '/#catalogo';
  btnContinuar.className = 'btn-drawer-close-action';
  btnContinuar.style.cssText = 'display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.65rem 1rem; border: 1px solid var(--color-divider); border-radius: var(--radius-sm); font-weight: 600; text-decoration: none;';
  btnContinuar.innerHTML = '<span class="material-symbols-outlined text-[18px]">storefront</span><span>Voltar ao Catálogo</span>';

  const btnAcompanhar = document.createElement('a');
  const tokenQuery = pedido.tokenAcesso ? `&token=${encodeURIComponent(pedido.tokenAcesso)}` : '';
  btnAcompanhar.href = `/pedidos?numero=${encodeURIComponent(pedido.numeroPedido)}${tokenQuery}`;
  btnAcompanhar.className = 'btn-primary';
  btnAcompanhar.id = 'btn-acompanhar-pedido';
  btnAcompanhar.style.cssText = 'display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.65rem 1.25rem; font-weight: 600; text-decoration: none;';
  btnAcompanhar.innerHTML = '<span class="material-symbols-outlined text-[18px]">timeline</span><span>Acompanhar pedido</span>';

  actionsWrap.append(btnPrint, btnContinuar, btnAcompanhar);
  footerCard.append(totalWrap, actionsWrap);

  body.append(gridInfo, itensSection, footerCard);
  wrapper.append(header, body);
  container.appendChild(wrapper);
}
