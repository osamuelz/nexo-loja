/**
 * Nexo - Loja Virtual
 * Componentes e Utilitários Compartilhados (Etapa 4 - Flask e PostgreSQL)
 *
 * Gerenciamento seguro da Sacola de Compras com sincronização e validação via API RESTful.
 * Acessibilidade rigorosa do Drawer lateral (inert, focus trap, escape, restauração de foco).
 * Renderização segura com textContent e createElement contra XSS.
 */

import { validarCarrinhoServidor } from './api.js';

export const LOJA_CONFIG = {
  nome: 'nexo',
  nomeCompleto: 'Nexo Loja Virtual',
  slogan: 'Tecnologia que facilita seu dia.',
  modalidadeEntrega: 'Retirada na Loja física',
  formaPagamento: 'Pagamento presencial na retirada (Pix, Cartão ou Dinheiro)',
  enderecoRetirada: 'Loja Física Nexo — Balcão de Atendimento Jardins',
  avisoLegal: 'Protótipo para demonstração técnica conectado ao PostgreSQL.'
};

let ultimoElementoFocado = null;

/**
 * Formata centavos inteiros para representação monetária brasileira (R$ X,XX)
 * Evita imprecisões de ponto flutuante.
 * @param {number} centavos
 * @returns {string}
 */
export function formatarPreco(centavos) {
  if (typeof centavos !== 'number' || isNaN(centavos)) {
    return 'R$ 0,00';
  }
  const valorEmReais = centavos / 100;
  return valorEmReais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Controle de concorrência e estado da sincronização autoritativa
let versaoCarrinhoLocal = 0;

export const estadoSincronizacao = {
  ultimaValidacaoSucesso: true,
  emAndamento: false,
  ultimoErro: null,
  avisosServidor: []
};

/**
 * Lê os itens da sacola salvos localmente com sanitização estrita e tratamento de dados corrompidos
 * @returns {Array}
 */
export function lerCarrinhoLocal() {
  try {
    let raw;
    try {
      raw = localStorage.getItem('nexo_carrinho');
    } catch (eStorage) {
      console.warn('Acesso ao localStorage indisponível:', eStorage);
      return [];
    }

    if (!raw) return [];

    let dados;
    try {
      dados = JSON.parse(raw);
    } catch (eParse) {
      console.warn('JSON corrompido no localStorage do carrinho, normalizando:', eParse);
      try { localStorage.removeItem('nexo_carrinho'); } catch (_) {}
      return [];
    }

    if (!Array.isArray(dados)) {
      console.warn('Carrinho salvo não é uma lista, redefinindo:', dados);
      try { localStorage.removeItem('nexo_carrinho'); } catch (_) {}
      return [];
    }

    const itensValidos = [];
    let houveInconsistencia = false;

    for (const item of dados) {
      // Descarta valores nulos ou primitivos (ex: [null], ['erro'])
      if (!item || typeof item !== 'object') {
        houveInconsistencia = true;
        continue;
      }

      // Suporta contrato novo ('produtoId') e formato legado ('id')
      const prodId = item.produtoId || item.id;
      const varId = item.varianteId || item.idVariante;

      if (!prodId || !varId) {
        houveInconsistencia = true;
        continue;
      }

      const qtd = parseInt(item.quantidade, 10);
      if (isNaN(qtd) || qtd <= 0) {
        houveInconsistencia = true;
        continue;
      }

      // Normaliza propriedades com compatibilidade mútua
      const itemNormalizado = {
        id: String(prodId),
        produtoId: String(prodId),
        varianteId: String(varId),
        nome: item.nome || 'Produto',
        categoria: item.categoria || '',
        imagem: item.imagem || '',
        cor: item.cor || null,
        corHex: item.corHex || null,
        opcao: item.opcao || null,
        rotuloVariante: item.rotuloVariante || '',
        quantidade: qtd,
        precoUnitarioCentavos: Math.max(0, parseInt(item.precoUnitarioCentavos, 10) || 0),
        estoque: typeof item.estoque === 'number' ? item.estoque : 99,
        disponivel: item.disponivel !== false
      };

      itensValidos.push(itemNormalizado);
    }

    // Se encontramos itens nulos ou corrompidos, limpa o localStorage com a versão higienizada
    if (houveInconsistencia) {
      console.warn('Carrinho local higienizado: itens corrompidos foram removidos.');
      try {
        localStorage.setItem('nexo_carrinho', JSON.stringify(itensValidos));
      } catch (_) {}
    }

    return itensValidos;
  } catch (erro) {
    console.warn('Erro geral ao processar carrinho local:', erro);
    return [];
  }
}

/**
 * Salva a lista de itens no localStorage com controle de versão
 * @param {Array} itens
 */
export function salvarCarrinhoLocal(itens) {
  versaoCarrinhoLocal++;
  try {
    const lista = Array.isArray(itens) ? itens : [];
    localStorage.setItem('nexo_carrinho', JSON.stringify(lista));
    localStorage.setItem('nexo_carrinho_versao', String(versaoCarrinhoLocal));
    atualizarContadorCarrinho();
  } catch (erro) {
    console.error('Erro ao salvar no localStorage:', erro);
  }
}

/**
 * Limpa o carrinho de compras centralizadamente com invalidação atômica de versão.
 * Garante que requisições de validação em voo atrasadas não restaurem itens antigos.
 */
export function limparCarrinhoCompleto() {
  versaoCarrinhoLocal++;
  try {
    localStorage.removeItem('nexo_carrinho');
    localStorage.setItem('nexo_carrinho_versao', String(versaoCarrinhoLocal));
  } catch (_) {}
  estadoSincronizacao.emAndamento = false;
  estadoSincronizacao.avisosServidor = [];
  atualizarContadorCarrinho();
  renderizarConteudoCarrinho();
  if (typeof window.renderizarPaginaCarrinho === 'function') {
    window.renderizarPaginaCarrinho();
  }
  window.dispatchEvent(new Event('storage'));
}

/**
 * Validação autoritativa do carrinho com o servidor Flask/PostgreSQL.
 * Trata:
 * - Anti-race condition: descarta respostas de requisições que chegaram após nova alteração local
 * - Notificação de indisponibilidade de rede ou falha sem apagar a seleção do cliente
 * - Preservação de estoque zero e atualização transparente de preços
 *
 * @returns {Promise<object>} Resposta com itens validados e avisos
 */
export async function sincronizarCarrinhoComServidor() {
  const itensLocais = lerCarrinhoLocal();
  if (itensLocais.length === 0) {
    estadoSincronizacao.ultimaValidacaoSucesso = true;
    estadoSincronizacao.ultimoErro = null;
    estadoSincronizacao.avisosServidor = [];
    return { itens: [], avisos: [], sucesso: true };
  }

  const versaoRequisicao = versaoCarrinhoLocal;
  estadoSincronizacao.emAndamento = true;

  try {
    const res = await validarCarrinhoServidor(itensLocais);

    // Se o usuário alterou ou limpou o carrinho enquanto a requisição estava em voo, descarta a resposta obsoleta
    const itensAtuais = lerCarrinhoLocal();
    if (versaoRequisicao !== versaoCarrinhoLocal || itensAtuais.length === 0) {
      console.info('Descartando sincronização de carrinho obsoleta (carrinho foi alterado ou limpo durante a requisição).');
      return { itens: itensAtuais, avisos: [], obsoleta: true, sucesso: true };
    }

    if (res && res.sucesso && Array.isArray(res.itens)) {
      estadoSincronizacao.ultimaValidacaoSucesso = true;
      estadoSincronizacao.ultimoErro = null;
      estadoSincronizacao.avisosServidor = res.avisos || [];

      salvarCarrinhoLocal(res.itens);
      atualizarContadorCarrinho();
      renderizarConteudoCarrinho();
      if (typeof window.renderizarPaginaCarrinho === 'function') {
        window.renderizarPaginaCarrinho();
      }
      return res;
    } else {
      throw new Error(res && res.erro ? res.erro : 'Erro na validação do servidor');
    }
  } catch (erro) {
    console.warn('Falha ao sincronizar carrinho com o servidor:', erro);
    // Preserva a seleção local do usuário, mas registra o estado de falha na validação
    estadoSincronizacao.ultimaValidacaoSucesso = false;
    estadoSincronizacao.ultimoErro = erro.message || 'Falha de comunicação';
    if (typeof window.renderizarPaginaCarrinho === 'function') {
      window.renderizarPaginaCarrinho();
    }
  } finally {
    estadoSincronizacao.emAndamento = false;
  }

  return {
    itens: lerCarrinhoLocal(),
    avisos: estadoSincronizacao.avisosServidor,
    falhaValidacao: true
  };
}

/**
 * Enriquece os itens do carrinho com totais e subtotais
 * @returns {object} Resumo com totais e lista de itens
 */
export function obterItensDetalhadosCarrinho() {
  const itens = lerCarrinhoLocal();
  let quantidadeTotal = 0;
  let subtotalCentavos = 0;

  const itensFormatados = itens
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const qtd = Math.max(1, parseInt(item.quantidade, 10) || 1);
      const precoUnitario = Math.max(0, parseInt(item.precoUnitarioCentavos, 10) || 0);
      const itemSubtotal = precoUnitario * qtd;

      quantidadeTotal += qtd;
      subtotalCentavos += itemSubtotal;

      return {
        id: item.produtoId || item.id,
        produtoId: item.produtoId || item.id,
        varianteId: item.varianteId,
        nome: item.nome || 'Produto',
        categoria: item.categoria || '',
        imagem: item.imagem || '',
        rotuloVariante: item.rotuloVariante || '',
        cor: item.cor || null,
        opcao: item.opcao || null,
        quantidade: qtd,
        estoqueMaximo: typeof item.estoque === 'number' ? item.estoque : 99,
        precoUnitarioCentavos: precoUnitario,
        subtotalCentavos: itemSubtotal
      };
    });

  return {
    itens: itensFormatados,
    quantidadeTotal: quantidadeTotal,
    subtotalCentavos: subtotalCentavos,
    totalCentavos: subtotalCentavos // Retirada gratuita no balcão
  };
}

/**
 * Atualiza o badge numérico no cabeçalho
 */
export function atualizarContadorCarrinho() {
  const badge = document.getElementById('cart-count');
  if (!badge) return;

  const resumo = obterItensDetalhadosCarrinho();
  const total = resumo.quantidadeTotal;

  badge.textContent = String(total);
  badge.setAttribute('aria-label', `${total} itens na sacola`);

  if (total > 0) {
    badge.classList.remove('badge-hidden');
  } else {
    badge.classList.add('badge-hidden');
  }
}

/**
 * Adiciona um item à sacola
 * Consolida variantes iguais somando quantidades
 */
export function adicionarItemCarrinho(novoItem) {
  if (!novoItem || !novoItem.varianteId) return;

  const prodId = String(novoItem.produtoId || novoItem.id || '');
  if (!prodId) return;

  novoItem.id = prodId;
  novoItem.produtoId = prodId;

  const itens = lerCarrinhoLocal();
  const indexExistente = itens.findIndex(it => it.varianteId === novoItem.varianteId);
  const limiteEstoque = typeof novoItem.estoque === 'number' ? novoItem.estoque : 99;

  if (indexExistente >= 0) {
    const existente = itens[indexExistente];
    const novaQtd = (parseInt(existente.quantidade, 10) || 0) + (parseInt(novoItem.quantidade, 10) || 1);
    existente.quantidade = Math.min(novaQtd, limiteEstoque);
    existente.precoUnitarioCentavos = novoItem.precoUnitarioCentavos;
    if (typeof novoItem.estoque === 'number') {
      existente.estoque = novoItem.estoque;
    }
  } else {
    novoItem.quantidade = Math.min(parseInt(novoItem.quantidade, 10) || 1, limiteEstoque);
    itens.push(novoItem);
  }

  salvarCarrinhoLocal(itens);
  renderizarConteudoCarrinho();

  notificar(
    `"${novoItem.nome}" foi adicionado à sua sacola.`,
    'sucesso',
    'Ver Sacola →',
    '/carrinho'
  );

  // Sincroniza em segundo plano com o banco de dados
  sincronizarCarrinhoComServidor();
}

/**
 * Altera quantidade de uma variante (+1 ou -1)
 */
export function alterarQuantidadeCarrinho(varianteId, delta) {
  const itens = lerCarrinhoLocal();
  const index = itens.findIndex(it => it.varianteId === varianteId);
  if (index < 0) return;

  const item = itens[index];
  const qtdAtual = parseInt(item.quantidade, 10) || 1;
  const novaQtd = qtdAtual + delta;

  if (novaQtd <= 0) {
    removerItemCarrinho(varianteId);
    return;
  }

  const limiteEstoque = typeof item.estoque === 'number' ? item.estoque : 99;
  item.quantidade = Math.min(novaQtd, limiteEstoque);

  salvarCarrinhoLocal(itens);
  renderizarConteudoCarrinho();

  if (typeof window.renderizarPaginaCarrinho === 'function') {
    window.renderizarPaginaCarrinho();
  }
}

/**
 * Remove um item da sacola
 */
export function removerItemCarrinho(varianteId) {
  let itens = lerCarrinhoLocal();
  const itemRemovido = itens.find(it => it.varianteId === varianteId);
  itens = itens.filter(it => it.varianteId !== varianteId);

  salvarCarrinhoLocal(itens);
  renderizarConteudoCarrinho();

  if (typeof window.renderizarPaginaCarrinho === 'function') {
    window.renderizarPaginaCarrinho();
  }

  if (itemRemovido) {
    notificar(`"${itemRemovido.nome}" foi removido da sua sacola.`, 'info');
  }
}

/**
 * Garante a criação da estrutura do painel lateral (Drawer) no DOM
 */
export function assegurarEstruturaDrawer() {
  if (document.getElementById('cart-drawer')) return;

  const overlay = document.createElement('div');
  overlay.id = 'cart-drawer-overlay';
  overlay.className = 'cart-drawer-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.addEventListener('click', fecharCarrinho);

  const drawer = document.createElement('aside');
  drawer.id = 'cart-drawer';
  drawer.className = 'cart-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Sua sacola de compras');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.setAttribute('inert', '');

  // Cabeçalho do Drawer
  const header = document.createElement('div');
  header.className = 'cart-drawer-header';

  const titleWrap = document.createElement('div');
  titleWrap.className = 'cart-drawer-title-wrap';

  const titleH2 = document.createElement('h2');
  titleH2.className = 'cart-drawer-title';
  titleH2.textContent = 'Sua Sacola';

  const countBadge = document.createElement('span');
  countBadge.className = 'cart-drawer-count';
  countBadge.id = 'drawer-count-badge';
  countBadge.textContent = '0 itens';

  titleWrap.append(titleH2, countBadge);

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'btn-close-drawer';
  btnClose.id = 'btn-close-cart-drawer';
  btnClose.setAttribute('aria-label', 'Fechar painel da sacola (Escape)');
  btnClose.innerHTML = '<span class="material-symbols-outlined text-[20px]">close</span>';
  btnClose.addEventListener('click', fecharCarrinho);

  header.append(titleWrap, btnClose);

  // Lista de Itens do Drawer
  const listDiv = document.createElement('div');
  listDiv.id = 'cart-drawer-items-list';
  listDiv.className = 'cart-drawer-body';

  // Rodapé do Drawer
  const footerDiv = document.createElement('div');
  footerDiv.id = 'cart-drawer-footer';
  footerDiv.className = 'cart-drawer-footer';

  drawer.append(header, listDiv, footerDiv);
  document.body.append(overlay, drawer);

  // Trap de foco no teclado e fechamento com Escape
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      fecharCarrinho();
      return;
    }

    if (e.key === 'Tab') {
      const elementosFocaveis = drawer.querySelectorAll(
        'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (elementosFocaveis.length === 0) return;

      const primeiro = elementosFocaveis[0];
      const ultimo = elementosFocaveis[elementosFocaveis.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        }
      } else {
        if (document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    }
  });
}

/**
 * Abre o Drawer lateral com foco contido
 */
export function abrirCarrinho() {
  assegurarEstruturaDrawer();
  renderizarConteudoCarrinho();

  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');

  if (drawer && overlay) {
    ultimoElementoFocado = document.activeElement;

    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.setAttribute('aria-hidden', 'false');

    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Dispara sincronização com o banco de dados
    sincronizarCarrinhoComServidor();

    setTimeout(() => {
      const btnFechar = document.getElementById('btn-close-cart-drawer');
      if (btnFechar) btnFechar.focus();
    }, 50);
  }
}

/**
 * Fecha o Drawer e restaura o foco
 */
export function fecharCarrinho() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-drawer-overlay');

  if (drawer && overlay) {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';

    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
    overlay.setAttribute('aria-hidden', 'true');

    if (ultimoElementoFocado && typeof ultimoElementoFocado.focus === 'function') {
      ultimoElementoFocado.focus();
    }
  }
}

window.abrirCarrinho = abrirCarrinho;
window.fecharCarrinho = fecharCarrinho;

/**
 * Renderiza o conteúdo do Drawer com textContent e createElement
 */
export function renderizarConteudoCarrinho() {
  const listEl = document.getElementById('cart-drawer-items-list');
  const footerEl = document.getElementById('cart-drawer-footer');
  const badgeEl = document.getElementById('drawer-count-badge');

  if (!listEl || !footerEl) return;

  const resumo = obterItensDetalhadosCarrinho();
  const totalItens = resumo.quantidadeTotal;

  if (badgeEl) {
    badgeEl.textContent = `${totalItens} item${totalItens === 1 ? '' : 's'}`;
  }

  // Estado Vazio
  if (resumo.itens.length === 0) {
    listEl.replaceChildren();

    const emptyWrap = document.createElement('div');
    emptyWrap.className = 'cart-empty-state';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'cart-empty-icon';
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-[32px]">shopping_bag</span>';

    const titleH3 = document.createElement('h3');
    titleH3.className = 'cart-empty-title';
    titleH3.textContent = 'Sua sacola está vazia';

    const descP = document.createElement('p');
    descP.className = 'cart-empty-desc';
    descP.textContent = 'Adicione produtos da nossa vitrine para visualizar valores e opções de retirada aqui.';

    const actionsDiv = document.createElement('div');
    actionsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 0.6rem; width: 100%; max-width: 260px; margin-top: 0.5rem;';

    const linkSacola = document.createElement('a');
    linkSacola.href = '/carrinho';
    linkSacola.className = 'btn-primary';
    linkSacola.style.cssText = 'text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 0.5rem; width: 100%;';
    linkSacola.innerHTML = '<span class="material-symbols-outlined text-[18px]">shopping_bag</span><span>Acessar página da sacola</span>';

    const btnContinuar = document.createElement('button');
    btnContinuar.type = 'button';
    btnContinuar.className = 'btn-drawer-close-action';
    btnContinuar.textContent = 'Continuar navegando';
    btnContinuar.addEventListener('click', fecharCarrinho);

    actionsDiv.append(linkSacola, btnContinuar);
    emptyWrap.append(iconDiv, titleH3, descP, actionsDiv);
    listEl.appendChild(emptyWrap);

    footerEl.style.display = 'none';
    footerEl.replaceChildren();
    return;
  }

  footerEl.style.display = 'flex';
  listEl.replaceChildren();

  // Banner de Política de Retirada Física
  const pickupBanner = document.createElement('div');
  pickupBanner.className = 'cart-pickup-banner';
  pickupBanner.innerHTML = '<span class="material-symbols-outlined">storefront</span>';

  const bannerTextWrap = document.createElement('div');
  const bannerStrong = document.createElement('strong');
  bannerStrong.textContent = 'Retirada na Loja Física Nexo';
  const bannerP = document.createElement('p');
  bannerP.textContent = 'Pagamento presencial no balcão de retirada. Sem custo de entrega.';
  bannerTextWrap.append(bannerStrong, bannerP);
  pickupBanner.appendChild(bannerTextWrap);
  listEl.appendChild(pickupBanner);

  // Renderiza cada item
  resumo.itens.forEach(item => {
    const article = document.createElement('article');
    article.className = 'cart-item-card';
    article.dataset.variante = item.varianteId;

    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'cart-item-thumb';
    const img = document.createElement('img');
    img.src = item.imagem;
    img.alt = item.nome;
    thumbDiv.appendChild(img);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'cart-item-info';

    const headerBlock = document.createElement('div');
    const titleH4 = document.createElement('h4');
    titleH4.className = 'cart-item-title';
    const linkProd = document.createElement('a');
    linkProd.href = `/produto?id=${encodeURIComponent(item.id)}`;
    linkProd.textContent = item.nome;
    titleH4.appendChild(linkProd);
    headerBlock.appendChild(titleH4);

    if (item.rotuloVariante) {
      const tagsWrap = document.createElement('div');
      tagsWrap.className = 'cart-item-tags';
      const tagSpan = document.createElement('span');
      tagSpan.className = 'cart-item-tag';
      tagSpan.textContent = item.rotuloVariante;
      tagsWrap.appendChild(tagSpan);
      headerBlock.appendChild(tagsWrap);
    }

    const bottomDiv = document.createElement('div');
    bottomDiv.className = 'cart-item-bottom';

    const priceDiv = document.createElement('div');
    priceDiv.className = 'cart-item-price tabular-nums';
    priceDiv.textContent = formatarPreco(item.subtotalCentavos);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'cart-item-actions';

    const stepperDiv = document.createElement('div');
    stepperDiv.className = 'cart-mini-stepper';

    const btnMinus = document.createElement('button');
    btnMinus.type = 'button';
    btnMinus.className = 'btn-mini-stepper';
    btnMinus.setAttribute('aria-label', `Diminuir quantidade de ${item.nome}`);
    btnMinus.innerHTML = '<span class="material-symbols-outlined text-[14px]">remove</span>';
    btnMinus.addEventListener('click', () => alterarQuantidadeCarrinho(item.varianteId, -1));

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
    btnPlus.addEventListener('click', () => alterarQuantidadeCarrinho(item.varianteId, 1));

    stepperDiv.append(btnMinus, qtySpan, btnPlus);

    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.className = 'btn-remove-item';
    btnRemove.setAttribute('aria-label', `Remover ${item.nome}`);
    btnRemove.title = 'Remover item da sacola';
    btnRemove.innerHTML = '<span class="material-symbols-outlined text-[18px]">delete</span>';
    btnRemove.addEventListener('click', () => removerItemCarrinho(item.varianteId));

    actionsDiv.append(stepperDiv, btnRemove);
    bottomDiv.append(priceDiv, actionsDiv);

    infoDiv.append(headerBlock, bottomDiv);
    article.append(thumbDiv, infoDiv);
    listEl.appendChild(article);
  });

  // Totais do rodapé
  footerEl.replaceChildren();

  const rowSubtotal = document.createElement('div');
  rowSubtotal.className = 'cart-summary-row';
  const labelSub = document.createElement('span');
  labelSub.textContent = 'Subtotal dos produtos';
  const valSub = document.createElement('span');
  valSub.className = 'tabular-nums font-semibold';
  valSub.textContent = formatarPreco(resumo.subtotalCentavos);
  rowSubtotal.append(labelSub, valSub);

  const rowPickup = document.createElement('div');
  rowPickup.className = 'cart-summary-row';
  const labelPick = document.createElement('span');
  labelPick.textContent = 'Retirada presencial';
  const valPick = document.createElement('span');
  valPick.className = 'font-semibold text-primary';
  valPick.textContent = 'Grátis';
  rowPickup.append(labelPick, valPick);

  const rowTotal = document.createElement('div');
  rowTotal.className = 'cart-summary-row total-row';
  const labelTot = document.createElement('span');
  labelTot.textContent = 'Total a pagar';
  const valTot = document.createElement('span');
  valTot.className = 'cart-summary-total-val tabular-nums';
  valTot.textContent = formatarPreco(resumo.totalCentavos);
  rowTotal.append(labelTot, valTot);

  const noticeDiv = document.createElement('div');
  noticeDiv.className = 'cart-notice-step';
  noticeDiv.textContent = 'Reserva atômica de estoque • Retirada presencial gratuita';

  const actionsWrap = document.createElement('div');
  actionsWrap.style.cssText = 'display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.25rem;';

  const linkCheckout = document.createElement('a');
  linkCheckout.href = '/checkout';
  linkCheckout.className = 'btn-drawer-checkout';
  linkCheckout.id = 'btn-drawer-checkout';
  linkCheckout.innerHTML = '<span class="material-symbols-outlined text-[20px]">receipt_long</span><span>Avançar para o Checkout</span>';

  const linkCarrinho = document.createElement('a');
  linkCarrinho.href = '/carrinho';
  linkCarrinho.className = 'btn-drawer-close-action';
  linkCarrinho.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 0.35rem;';
  linkCarrinho.innerHTML = '<span class="material-symbols-outlined text-[16px]">shopping_bag</span><span>Ver sacola completa</span>';

  const btnClose = document.createElement('button');
  btnClose.type = 'button';
  btnClose.className = 'btn-drawer-close-action';
  btnClose.textContent = 'Continuar navegando';
  btnClose.addEventListener('click', fecharCarrinho);

  actionsWrap.append(linkCheckout, linkCarrinho, btnClose);
  footerEl.append(rowSubtotal, rowPickup, rowTotal, noticeDiv, actionsWrap);
}

/**
 * Notificação flutuante acessível (Toast)
 */
export function notificar(mensagem, tipo = 'info', acaoTexto = null, acaoUrl = null) {
  let container = document.getElementById('nexo-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'nexo-toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-atomic', 'true');
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item toast-${tipo}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';

  const iconSpan = document.createElement('span');
  iconSpan.className = 'material-symbols-outlined toast-icon';
  iconSpan.textContent = tipo === 'sucesso' ? 'check_circle' : tipo === 'aviso' ? 'warning' : 'info';

  const msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = mensagem;

  contentDiv.append(iconSpan, msgSpan);
  toast.appendChild(contentDiv);

  if (acaoTexto && acaoUrl) {
    const actionLink = document.createElement('a');
    actionLink.href = acaoUrl;
    actionLink.className = 'toast-action-btn';

    const actionTextSpan = document.createElement('span');
    actionTextSpan.textContent = acaoTexto;
    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'material-symbols-outlined text-[16px]';
    arrowSpan.textContent = 'arrow_forward';

    actionLink.append(actionTextSpan, arrowSpan);
    toast.appendChild(actionLink);
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 4200);
}

/**
 * Utilitário Debounce
 */
export function debounce(funcao, espera = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => funcao.apply(this, args), espera);
  };
}

/**
 * Inicialização global
 */
export function inicializarComponentesComuns() {
  atualizarContadorCarrinho();
  assegurarEstruturaDrawer();

  // Sincroniza sacola com o servidor logo na inicialização
  sincronizarCarrinhoComServidor();

  const btnsOpenDrawer = document.querySelectorAll('[data-open-cart]');
  btnsOpenDrawer.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      abrirCarrinho();
    });
  });

  window.addEventListener('storage', (event) => {
    if (event.key === 'nexo_carrinho') {
      atualizarContadorCarrinho();
      renderizarConteudoCarrinho();
      if (typeof window.renderizarPaginaCarrinho === 'function') {
        window.renderizarPaginaCarrinho();
      }
    }
  });
}
