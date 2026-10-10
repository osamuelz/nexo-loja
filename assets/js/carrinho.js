/**
 * Nexo - Loja Virtual
 * Lógica da Página Completa da Sacola de Compras (carrinho.html - Etapa 4)
 *
 * Conectado ao catálogo e validação no PostgreSQL via API Flask.
 * Não utiliza silenciosamente dados fictícios.
 * Renderização segura contra XSS via textContent e createElement.
 */

import {
  inicializarComponentesComuns,
  obterItensDetalhadosCarrinho,
  alterarQuantidadeCarrinho,
  removerItemCarrinho,
  sincronizarCarrinhoComServidor,
  estadoSincronizacao,
  formatarPreco,
  LOJA_CONFIG
} from './componentes.js';

async function iniciar() {
  // Inicialização global (já executa a sincronização autoritativa com o servidor)
  inicializarComponentesComuns();
  renderizarPaginaCarrinho();

  window.addEventListener('storage', (event) => {
    if (event.key === 'nexo_carrinho') {
      renderizarPaginaCarrinho();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}

/**
 * Renderiza a página completa da sacola com duas colunas
 */
export function renderizarPaginaCarrinho() {
  const container = document.getElementById('carrinho-conteudo-dinamico');
  const bagCountHeader = document.getElementById('bag-count-header');
  if (!container) return;

  const resumo = obterItensDetalhadosCarrinho();
  const totalItens = resumo.quantidadeTotal;

  if (bagCountHeader) {
    bagCountHeader.textContent = `(${totalItens} item${totalItens === 1 ? '' : 's'} adicionado${totalItens === 1 ? '' : 's'})`;
  }

  // Estado Vazio
  if (resumo.itens.length === 0) {
    container.replaceChildren();

    const emptyWrap = document.createElement('div');
    emptyWrap.className = 'cart-empty-state';
    emptyWrap.style.cssText = 'padding: 5rem 1rem;';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'cart-empty-icon';
    iconDiv.style.cssText = 'width: 80px; height: 80px;';
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-[40px]">shopping_bag</span>';

    const titleH2 = document.createElement('h2');
    titleH2.className = 'cart-empty-title';
    titleH2.style.fontSize = '1.5rem';
    titleH2.textContent = 'Sua sacola está vazia';

    const descP = document.createElement('p');
    descP.className = 'cart-empty-desc';
    descP.style.maxWidth = '360px';
    descP.textContent = 'Nenhum produto foi adicionado ainda. Explore nossos celulares, eletrodomésticos, hardware e acessórios.';

    const actionsDiv = document.createElement('div');
    actionsDiv.style.marginTop = '1rem';

    const btnExplorar = document.createElement('a');
    btnExplorar.href = '/#catalogo';
    btnExplorar.className = 'btn-primary';
    btnExplorar.innerHTML = '<span class="material-symbols-outlined text-[18px]">storefront</span><span>Explorar catálogo da loja</span>';

    actionsDiv.appendChild(btnExplorar);
    emptyWrap.append(iconDiv, titleH2, descP, actionsDiv);
    container.appendChild(emptyWrap);
    return;
  }

  container.replaceChildren();

  // Grid Principal (2 colunas)
  const grid = document.createElement('div');
  grid.className = 'cart-page-grid';

  // ---------------------------------------------------------
  // COLUNA ESQUERDA: Lista de Itens do Carrinho
  // ---------------------------------------------------------
  const colEsquerda = document.createElement('section');
  colEsquerda.className = 'cart-items-column';
  colEsquerda.style.cssText = 'display: flex; flex-direction: column; gap: 1.25rem;';

  // Banners de Avisos Retornados pelo Catálogo (se houver)
  const avisosAtivos = estadoSincronizacao.avisosServidor || [];
  if (avisosAtivos.length > 0) {
    avisosAtivos.forEach(aviso => {
      const bannerAviso = document.createElement('div');
      bannerAviso.className = 'cart-pickup-banner';
      bannerAviso.style.cssText = 'background-color: rgba(234, 88, 12, 0.08); border: 1px solid rgba(234, 88, 12, 0.3); color: #C2410C; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 0.75rem; border-radius: var(--radius-md);';
      bannerAviso.innerHTML = '<span class="material-symbols-outlined text-[20px]">info</span>';

      const textoAviso = document.createElement('span');
      textoAviso.style.fontSize = '0.875rem';
      textoAviso.textContent = aviso;

      bannerAviso.appendChild(textoAviso);
      colEsquerda.appendChild(bannerAviso);
    });
  }

  // Estado de Validação Autoritativa: Informa claramente falhas de sincronização
  if (!estadoSincronizacao.ultimaValidacaoSucesso) {
    const bannerFalha = document.createElement('div');
    bannerFalha.className = 'cart-pickup-banner';
    bannerFalha.style.cssText = 'background-color: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.3); color: #B91C1C; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; border-radius: var(--radius-md);';

    const textoFalha = document.createElement('div');
    textoFalha.style.cssText = 'display: flex; align-items: center; gap: 0.75rem;';
    textoFalha.innerHTML = '<span class="material-symbols-outlined text-[20px]">cloud_off</span>';

    const msg = document.createElement('span');
    msg.style.fontSize = '0.875rem';
    msg.textContent = 'Atenção: Não foi possível validar os itens com o servidor no momento. Os preços e a disponibilidade exibidos baseiam-se na sua seleção local.';
    textoFalha.appendChild(msg);

    const btnTentar = document.createElement('button');
    btnTentar.type = 'button';
    btnTentar.className = 'btn-secondary';
    btnTentar.style.cssText = 'padding: 0.4rem 0.8rem; font-size: 0.8125rem; white-space: nowrap; cursor: pointer;';
    btnTentar.textContent = 'Tentar novamente';
    btnTentar.addEventListener('click', async () => {
      btnTentar.disabled = true;
      btnTentar.textContent = 'Verificando...';
      await sincronizarCarrinhoComServidor();
      renderizarPaginaCarrinho();
    });

    bannerFalha.append(textoFalha, btnTentar);
    colEsquerda.appendChild(bannerFalha);
  } else {
    // Banner de Prontidão de Estoque (exibido APENAS quando verificado com sucesso pelo servidor)
    const bannerEstoque = document.createElement('div');
    bannerEstoque.className = 'cart-pickup-banner';
    bannerEstoque.style.cssText = 'background-color: var(--color-surface); padding: 1.25rem; box-shadow: var(--shadow-sm);';
    bannerEstoque.innerHTML = '<span class="material-symbols-outlined text-[24px]">verified</span>';

    const bannerEstoqueText = document.createElement('div');
    const bannerEstoqueStrong = document.createElement('strong');
    bannerEstoqueStrong.textContent = 'Itens validados com o banco de dados Nexo';
    const bannerEstoqueP = document.createElement('p');
    bannerEstoqueP.textContent = 'Retirada no balcão presencial com conferência visual antes do pagamento.';
    bannerEstoqueText.append(bannerEstoqueStrong, bannerEstoqueP);
    bannerEstoque.appendChild(bannerEstoqueText);
    colEsquerda.appendChild(bannerEstoque);
  }

  // Lista de Cards de Itens
  const listaItensDiv = document.createElement('div');
  listaItensDiv.style.cssText = 'display: flex; flex-direction: column; gap: 1rem;';

  resumo.itens.forEach(item => {
    const article = document.createElement('article');
    article.className = 'cart-item-card';
    article.style.padding = '1.25rem';
    article.dataset.variante = item.varianteId;

    // Miniatura
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'cart-item-thumb';
    thumbDiv.style.cssText = 'width: 96px; height: 96px;';
    const img = document.createElement('img');
    img.src = item.imagem;
    img.alt = item.nome;
    thumbDiv.appendChild(img);

    // Bloco de Informação
    const infoDiv = document.createElement('div');
    infoDiv.className = 'cart-item-info';

    const topBlock = document.createElement('div');
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start;';

    const titleWrap = document.createElement('div');
    const titleH3 = document.createElement('h3');
    titleH3.className = 'cart-item-title';
    titleH3.style.fontSize = '1.0625rem';

    const link = document.createElement('a');
    link.href = `/produto?id=${encodeURIComponent(item.id)}`;
    link.textContent = item.nome;
    titleH3.appendChild(link);
    titleWrap.appendChild(titleH3);

    if (item.rotuloVariante) {
      const tagDiv = document.createElement('div');
      tagDiv.className = 'cart-item-tags';
      tagDiv.style.marginTop = '0.25rem';
      const tagSpan = document.createElement('span');
      tagSpan.className = 'cart-item-tag';
      tagSpan.textContent = item.rotuloVariante;
      tagDiv.appendChild(tagSpan);
      titleWrap.appendChild(tagDiv);
    }

    const priceUnitSpan = document.createElement('div');
    priceUnitSpan.className = 'cart-item-price tabular-nums';
    priceUnitSpan.style.fontSize = '1.125rem';
    priceUnitSpan.textContent = formatarPreco(item.subtotalCentavos);

    headerRow.append(titleWrap, priceUnitSpan);
    topBlock.appendChild(headerRow);

    // Controles inferiores (stepper, remover, estoque)
    const bottomRow = document.createElement('div');
    bottomRow.className = 'cart-item-bottom';
    bottomRow.style.marginTop = '1rem';

    const stockInfo = document.createElement('span');
    stockInfo.style.cssText = 'font-size: 0.8125rem; color: var(--color-text-secondary);';
    stockInfo.textContent = `Preço unitário: ${formatarPreco(item.precoUnitarioCentavos)} (Estoque: ${item.estoqueMaximo} un.)`;

    const controlsWrap = document.createElement('div');
    controlsWrap.style.cssText = 'display: flex; align-items: center; gap: 0.75rem;';

    const stepperDiv = document.createElement('div');
    stepperDiv.className = 'cart-mini-stepper';

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.className = 'btn-mini-stepper';
    btnMinus.setAttribute('aria-label', `Diminuir quantidade de ${item.nome}`);
    btnMinus.innerHTML = '<span class="material-symbols-outlined text-[14px]">remove</span>';
    btnMinus.addEventListener('click', () => {
      alterarQuantidadeCarrinho(item.varianteId, -1);
      renderizarPaginaCarrinho();
    });

    const qtySpan = document.createElement('span');
    qtySpan.className = 'mini-stepper-val tabular-nums';
    qtySpan.textContent = String(item.quantidade);

    const btnPlus = document.createElement('button');
    btnPlus.type = 'button';
    btnPlus.className = 'btn-mini-stepper';
    btnPlus.setAttribute('aria-label', `Aumentar quantidade de ${item.nome}`);
    btnPlus.innerHTML = '<span class="material-symbols-outlined text-[14px]">add</span>';
    if (item.quantidade >= item.estoqueMaximo) {
      btnPlus.disabled = true;
      btnPlus.title = 'Limite de estoque atingido';
    }
    btnPlus.addEventListener('click', () => {
      alterarQuantidadeCarrinho(item.varianteId, 1);
      renderizarPaginaCarrinho();
    });

    stepperDiv.append(btnMinus, qtySpan, btnPlus);

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn-remove-item';
    btnRemove.setAttribute('aria-label', `Remover ${item.nome}`);
    btnRemove.title = 'Remover item da sacola';
    btnRemove.innerHTML = '<span class="material-symbols-outlined text-[18px]">delete</span>';
    btnRemove.addEventListener('click', () => {
      removerItemCarrinho(item.varianteId);
      renderizarPaginaCarrinho();
    });

    controlsWrap.append(stepperDiv, btnRemove);
    bottomRow.append(stockInfo, controlsWrap);

    infoDiv.append(topBlock, bottomRow);
    article.append(thumbDiv, infoDiv);
    listaItensDiv.appendChild(article);
  });

  colEsquerda.appendChild(listaItensDiv);

  // Link para continuar comprando
  const continueDiv = document.createElement('div');
  continueDiv.style.marginTop = '0.5rem';
  const continueLink = document.createElement('a');
  continueLink.href = '/#catalogo';
  continueLink.className = 'btn-secondary';
  continueLink.style.cssText = 'display: inline-flex; align-items: center; gap: 0.5rem; width: auto;';
  continueLink.innerHTML = '<span class="material-symbols-outlined text-[18px]">arrow_back</span><span>Continuar navegando no catálogo</span>';
  continueDiv.appendChild(continueLink);
  colEsquerda.appendChild(continueDiv);

  // ---------------------------------------------------------
  // COLUNA DIREITA: Resumo Financeiro e Orientações de Retirada
  // ---------------------------------------------------------
  const colDireita = document.createElement('aside');
  colDireita.className = 'cart-summary-column';
  colDireita.setAttribute('aria-label', 'Resumo de valores');

  const summaryCard = document.createElement('div');
  summaryCard.className = 'cart-summary-card';
  summaryCard.style.cssText = 'position: sticky; top: 96px;';

  const summaryTitle = document.createElement('h3');
  summaryTitle.className = 'cart-summary-title';
  summaryTitle.textContent = 'Resumo da Compra';

  const rowsWrap = document.createElement('div');
  rowsWrap.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;';

  // Subtotal
  const rowSubtotal = document.createElement('div');
  rowSubtotal.className = 'cart-summary-row';
  const labelSub = document.createElement('span');
  labelSub.textContent = `Subtotal (${totalItens} item${totalItens === 1 ? '' : 's'})`;
  const valSub = document.createElement('span');
  valSub.className = 'tabular-nums font-semibold';
  valSub.textContent = formatarPreco(resumo.subtotalCentavos);
  rowSubtotal.append(labelSub, valSub);

  // Retirada
  const rowRetirada = document.createElement('div');
  rowRetirada.className = 'cart-summary-row';
  const labelRet = document.createElement('span');
  labelRet.textContent = 'Retirada presencial (Loja Física)';
  const valRet = document.createElement('span');
  valRet.className = 'font-semibold text-primary';
  valRet.textContent = 'Grátis';
  rowRetirada.append(labelRet, valRet);

  // Total
  const rowTotal = document.createElement('div');
  rowTotal.className = 'cart-summary-row total-row';
  const labelTot = document.createElement('span');
  labelTot.textContent = 'Total a pagar';
  const valTot = document.createElement('span');
  valTot.className = 'cart-summary-total-val tabular-nums';
  valTot.textContent = formatarPreco(resumo.totalCentavos);
  rowTotal.append(labelTot, valTot);

  rowsWrap.append(rowSubtotal, rowRetirada, rowTotal);

  // Detalhes do Local de Retirada
  const pickupBox = document.createElement('div');
  pickupBox.style.cssText = 'background-color: var(--color-surface-low); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1.25rem; font-size: 0.8125rem; display: flex; flex-direction: column; gap: 0.35rem;';
  pickupBox.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; color: var(--color-text-primary);">
      <span class="material-symbols-outlined text-[18px]">storefront</span>
      <span>${LOJA_CONFIG.enderecoRetirada}</span>
    </div>
    <p style="color: var(--color-text-secondary); margin: 0;">
      Horário: Seg. a Sáb. das 09h às 20h. Apresente seu documento na retirada.
    </p>
  `;

  // Informação de Finalização Segura
  const avisoBox = document.createElement('div');
  avisoBox.className = 'cart-notice-step';
  avisoBox.style.cssText = 'margin-bottom: 1.25rem; text-align: center;';
  avisoBox.textContent = 'Preços e estoque são conferidos de forma atômica no PostgreSQL';

  // Botão de Avançar para o Checkout
  const btnFinalizar = document.createElement('a');
  btnFinalizar.href = '/checkout';
  btnFinalizar.className = 'btn-primary';
  btnFinalizar.id = 'btn-ir-checkout';
  btnFinalizar.style.cssText = 'width: 100%; padding: 1rem; font-size: 1rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-decoration: none;';
  btnFinalizar.innerHTML = '<span class="material-symbols-outlined text-[20px]">receipt_long</span><span>Avançar para o Checkout</span>';
  btnFinalizar.title = 'Ir para a página de conferência e finalização do pedido';

  summaryCard.append(summaryTitle, rowsWrap, pickupBox, avisoBox, btnFinalizar);
  colDireita.appendChild(summaryCard);

  grid.append(colEsquerda, colDireita);
  container.appendChild(grid);
}

window.renderizarPaginaCarrinho = renderizarPaginaCarrinho;
