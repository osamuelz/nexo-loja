/**
 * Nexo - Loja Virtual
 * Lógica Completa da Página de Detalhes do Produto (Etapa 4 - Flask e PostgreSQL)
 *
 * Separação estrita de requisições e renderização.
 * Consulta o catálogo do servidor e variantes autoritativas do PostgreSQL.
 * Não utiliza silenciosamente dados fictícios como alternativa quando o servidor falhar.
 */

import { fetchProdutoDetalhes } from './api.js';
import {
  inicializarComponentesComuns,
  adicionarItemCarrinho,
  notificar,
  formatarPreco,
  LOJA_CONFIG
} from './componentes.js';

// Estado reativo da página de produto
const estadoProduto = {
  produto: null,
  varianteAtiva: null,
  corSelecionada: null,
  opcaoSelecionada: null, // Capacidade, Hardware ou Voltagem
  imagemAtiva: '',
  quantidade: 1,
  estoqueDisponivel: 0,
  precoAtualCentavos: 0,
  carregando: false,
  erro: null
};

function iniciar() {
  inicializarComponentesComuns();
  carregarProdutoDaUrl();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}

/**
 * Lê o parâmetro ?id= da URL e carrega os dados via API Flask
 */
export async function carregarProdutoDaUrl() {
  const params = new URLSearchParams(window.location.search);
  const produtoId = params.get('id');
  const container = document.getElementById('produto-detalhe-container');

  if (!container) return;

  if (!produtoId) {
    renderizarEstadoInexistente(container, 'Nenhum identificador de produto foi informado na URL.');
    return;
  }

  // Estado de carregamento
  estadoProduto.carregando = true;
  estadoProduto.erro = null;
  renderizarCarregando(container);

  try {
    const produto = await fetchProdutoDetalhes(produtoId);

    estadoProduto.carregando = false;

    if (!produto) {
      // Produto inexistente ou inativo (404)
      renderizarEstadoInexistente(container, `O produto "${produtoId}" não foi localizado ou não está ativo em nosso catálogo.`);
      return;
    }

    estadoProduto.produto = produto;
    inicializarEstadoVariantes(produto);
    renderizarPaginaCompleta(container);
  } catch (erro) {
    estadoProduto.carregando = false;
    estadoProduto.erro = erro.message || 'Falha ao conectar com o servidor.';
    renderizarEstadoFalha(container, produtoId);
  }
}

/**
 * Renderiza estado de carregamento
 */
function renderizarCarregando(container) {
  container.innerHTML = `
    <div class="empty-state-card" style="padding: 5rem 1.5rem; text-align: center; max-width: 600px; margin: 2rem auto;">
      <div class="empty-state-icon">
        <span class="material-symbols-outlined text-[36px]" style="animation: spin 1s linear infinite;">sync</span>
      </div>
      <h3 class="empty-state-title">Carregando detalhes do produto</h3>
      <p class="empty-state-desc">Consultando estoque e variantes em tempo real no banco de dados...</p>
    </div>
  `;
}

/**
 * Renderiza falha na comunicação com o servidor com opção de tentar novamente.
 * NÃO utiliza dados fictícios como fallback silencioso.
 */
function renderizarEstadoFalha(container, produtoId) {
  container.replaceChildren();

  const card = document.createElement('div');
  card.className = 'empty-state-card';
  card.style.cssText = 'max-width: 600px; margin: 3rem auto; border-color: rgba(220, 38, 38, 0.3); background-color: rgba(254, 242, 242, 0.4); text-align: center;';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'empty-state-icon';
  iconDiv.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
  iconDiv.style.color = '#DC2626';
  iconDiv.innerHTML = '<span class="material-symbols-outlined text-[36px]">cloud_off</span>';

  const title = document.createElement('h3');
  title.className = 'empty-state-title';
  title.textContent = 'Falha ao carregar informações do produto';

  const desc = document.createElement('p');
  desc.className = 'empty-state-desc';
  desc.textContent = 'Ocorreu um erro ao comunicar com a API da loja. As variantes e estoques não puderam ser verificados.';

  const detail = document.createElement('p');
  detail.style.cssText = 'font-size: 0.8125rem; color: var(--color-text-secondary); margin-bottom: 1.5rem;';
  detail.textContent = `Erro: ${estadoProduto.erro}`;

  const actions = document.createElement('div');
  actions.className = 'empty-state-actions';

  const btnTentar = document.createElement('button');
  btnTentar.type = 'button';
  btnTentar.className = 'btn-primary';
  btnTentar.innerHTML = '<span class="material-symbols-outlined text-[18px]">refresh</span><span>Tentar novamente</span>';
  btnTentar.addEventListener('click', carregarProdutoDaUrl);

  const btnVoltar = document.createElement('a');
  btnVoltar.href = '/';
  btnVoltar.className = 'btn-secondary';
  btnVoltar.innerHTML = '<span class="material-symbols-outlined text-[18px]">arrow_back</span><span>Voltar ao catálogo</span>';

  actions.append(btnTentar, btnVoltar);
  card.append(iconDiv, title, desc, detail, actions);
  container.appendChild(card);
}

/**
 * Renderiza estado quando o produto não existe ou está inativo
 */
function renderizarEstadoInexistente(container, mensagem) {
  container.replaceChildren();

  const card = document.createElement('div');
  card.className = 'empty-state-card';
  card.style.cssText = 'max-width: 600px; margin: 3rem auto; text-align: center;';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'empty-state-icon';
  iconDiv.innerHTML = '<span class="material-symbols-outlined text-[36px]">inventory_2</span>';

  const title = document.createElement('h3');
  title.className = 'empty-state-title';
  title.textContent = 'Produto não encontrado ou indisponível';

  const desc = document.createElement('p');
  desc.className = 'empty-state-desc';
  desc.textContent = mensagem || 'O item solicitado não está disponível em nosso estoque.';

  const actions = document.createElement('div');
  actions.className = 'empty-state-actions';

  const btnVoltar = document.createElement('a');
  btnVoltar.href = '/';
  btnVoltar.className = 'btn-primary';
  btnVoltar.innerHTML = '<span class="material-symbols-outlined text-[18px]">arrow_back</span><span>Explorar o catálogo completo</span>';

  actions.appendChild(btnVoltar);
  card.append(iconDiv, title, desc, actions);
  container.appendChild(card);
}

/**
 * Inicializa a variante padrão para o produto carregado
 */
function inicializarEstadoVariantes(produto) {
  estadoProduto.imagemAtiva = produto.imagem;
  estadoProduto.quantidade = 1;

  // 1. Cores
  if (produto.opcoesCores && produto.opcoesCores.length > 0) {
    estadoProduto.corSelecionada = produto.opcoesCores[0].nome;
  } else {
    estadoProduto.corSelecionada = null;
  }

  // 2. Opções de Capacidade / Hardware / Voltagem
  if (produto.opcoesCapacidades && produto.opcoesCapacidades.length > 0) {
    estadoProduto.opcaoSelecionada = produto.opcoesCapacidades[0];
  } else if (produto.opcoesHardware && produto.opcoesHardware.length > 0) {
    estadoProduto.opcaoSelecionada = produto.opcoesHardware[0];
  } else if (produto.opcoesVoltagem && produto.opcoesVoltagem.length > 0) {
    estadoProduto.opcaoSelecionada = produto.opcoesVoltagem[0];
  } else {
    estadoProduto.opcaoSelecionada = null;
  }

  recalcularPrecoEEstoque();
}

/**
 * Consulta a variante correspondente no banco de dados e recalcula preço e estoque
 * Preserva estoque zero!
 */
function recalcularPrecoEEstoque() {
  const produto = estadoProduto.produto;
  if (!produto || !produto.variantes) return;

  const cor = estadoProduto.corSelecionada;
  const opcaoValor = estadoProduto.opcaoSelecionada ? estadoProduto.opcaoSelecionada.valor : null;

  let varianteEncontrada = null;

  if (cor && opcaoValor) {
    varianteEncontrada = produto.variantes.find(v => v.corNome === cor && v.nomeOpcao === opcaoValor);
  } else if (opcaoValor) {
    varianteEncontrada = produto.variantes.find(v => v.nomeOpcao === opcaoValor);
  } else if (cor) {
    varianteEncontrada = produto.variantes.find(v => v.corNome === cor);
  } else if (produto.variantes.length > 0) {
    varianteEncontrada = produto.variantes[0];
  }

  if (varianteEncontrada) {
    estadoProduto.varianteAtiva = varianteEncontrada;
    estadoProduto.precoAtualCentavos = varianteEncontrada.precoCentavos;
    estadoProduto.estoqueDisponivel = varianteEncontrada.estoque; // Preserva estritamente 0!
  } else {
    estadoProduto.varianteAtiva = null;
    estadoProduto.precoAtualCentavos = produto.precoBaseCentavos;
    estadoProduto.estoqueDisponivel = 0;
  }

  // Ajusta quantidade para respeitar o estoque disponível
  if (estadoProduto.estoqueDisponivel === 0) {
    estadoProduto.quantidade = 0;
  } else if (estadoProduto.quantidade > estadoProduto.estoqueDisponivel) {
    estadoProduto.quantidade = estadoProduto.estoqueDisponivel;
  } else if (estadoProduto.quantidade <= 0 && estadoProduto.estoqueDisponivel > 0) {
    estadoProduto.quantidade = 1;
  }
}

/**
 * Renderiza a página completa do produto
 */
function renderizarPaginaCompleta(container) {
  const p = estadoProduto.produto;

  // Atualiza título da aba e breadcrumbs
  document.title = `${p.nome} — Nexo`;
  const bNome = document.getElementById('breadcrumb-nome');
  if (bNome) bNome.textContent = p.nome;
  const bCat = document.getElementById('breadcrumb-categoria');
  if (bCat) {
    bCat.textContent = p.categoria;
    bCat.href = `/?categoria=${encodeURIComponent(p.categoria)}`;
  }

  const imagensGaleria = (p.galeria && p.galeria.length > 0)
    ? p.galeria
    : [{ titulo: p.nome, url: p.imagem }];

  container.innerHTML = `
    <div class="product-stage-grid">
      
      <!-- Coluna Esquerda: Galeria Minimalista -->
      <div class="gallery-column">
        <div class="gallery-main-card">
          <img
            id="main-product-img"
            src="${estadoProduto.imagemAtiva}"
            alt="${p.nome}"
            class="gallery-main-img"
          />
        </div>

        <!-- Miniaturas da Galeria -->
        <div class="gallery-thumbs-row" role="tablist" aria-label="Miniaturas do produto">
          ${imagensGaleria.map((img, idx) => `
            <button
              type="button"
              class="gallery-thumb-btn ${idx === 0 ? 'is-active' : ''}"
              data-img-url="${img.url}"
              data-thumb-idx="${idx}"
              aria-label="Ver ${img.titulo || 'foto ' + (idx + 1)}"
            >
              <img src="${img.url}" alt="${img.titulo || 'Miniatura ' + (idx + 1)}" class="gallery-thumb-img" />
            </button>
          `).join('')}
        </div>

        <!-- Faixa de Confiabilidade -->
        <div class="reassurance-ribbon">
          <div class="reassurance-card-mini">
            <div class="reassurance-icon-mini">
              <span class="material-symbols-outlined text-[18px]">storefront</span>
            </div>
            <div class="reassurance-info-mini">
              <h5>Retirada na Loja</h5>
              <p>Grátis no balcão</p>
            </div>
          </div>

          <div class="reassurance-card-mini">
            <div class="reassurance-icon-mini">
              <span class="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div class="reassurance-info-mini">
              <h5>Garantia Legal</h5>
              <p>Produto 100% original</p>
            </div>
          </div>

          <div class="reassurance-card-mini">
            <div class="reassurance-icon-mini">
              <span class="material-symbols-outlined text-[18px]">payments</span>
            </div>
            <div class="reassurance-info-mini">
              <h5>Pague no Balcão</h5>
              <p>Pix, cartão ou dinheiro</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Coluna Direita: Matriz de Compra e Variantes -->
      <div class="product-info-column">
        
        <div class="product-header-block">
          <span class="product-category-eyebrow">${p.categoria}</span>
          <h1 class="product-detail-title" id="product-detail-h1">${p.nome}</h1>
          <p class="product-detail-sub">${p.subtitulo || ''}</p>
        </div>

        <!-- Bloco de Preço Conectado à Variante -->
        <div class="pricing-card">
          <span class="price-caption">Preço para retirada presencial</span>
          <div class="price-main tabular-nums" id="display-preco">
            ${formatarPreco(estadoProduto.precoAtualCentavos)}
          </div>
        </div>

        <!-- Indicador de Disponibilidade em Estoque Real -->
        <div class="stock-status-pill" id="stock-pill">
          ${renderizarPillEstoque()}
        </div>

        <!-- Seleção de Cores -->
        ${renderizarSeletorCores(p)}

        <!-- Seleção de Capacidades / Hardware / Voltagem -->
        ${renderizarSeletorOpcoes(p)}

        <!-- Compatibilidade -->
        ${p.compatibilidade ? `
          <div class="info-callout-box" role="note">
            <span class="material-symbols-outlined">memory</span>
            <div>
              <strong>Informação de Compatibilidade Técnica:</strong><br />
              ${p.compatibilidade}
            </div>
          </div>
        ` : ''}

        <!-- Alimentação -->
        ${p.notaAlimentacao ? `
          <div class="info-callout-box" style="background-color: var(--color-surface-low);">
            <span class="material-symbols-outlined" style="color: var(--color-text-secondary);">power</span>
            <div>${p.notaAlimentacao}</div>
          </div>
        ` : ''}

        <!-- Controles de Quantidade e Adicionar ao Carrinho -->
        <div class="purchase-action-row">
          <div class="qty-stepper" aria-label="Quantidade">
            <button
              type="button"
              class="btn-stepper"
              id="btn-qty-minus"
              aria-label="Diminuir quantidade"
              ${estadoProduto.quantidade <= 1 ? 'disabled' : ''}
            >
              <span class="material-symbols-outlined text-[18px]">remove</span>
            </button>
            <span class="qty-display tabular-nums" id="display-qty">${estadoProduto.quantidade}</span>
            <button
              type="button"
              class="btn-stepper"
              id="btn-qty-plus"
              aria-label="Aumentar quantidade"
              ${estadoProduto.quantidade >= estadoProduto.estoqueDisponivel ? 'disabled' : ''}
            >
              <span class="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>

          <button
            type="button"
            class="btn-add-cart"
            id="btn-add-to-cart"
            ${estadoProduto.estoqueDisponivel === 0 ? 'disabled' : ''}
          >
            <span class="material-symbols-outlined text-[20px]">shopping_bag</span>
            <span id="btn-add-to-cart-text">${estadoProduto.estoqueDisponivel > 0 ? 'Adicionar ao carrinho' : 'Indisponível no momento'}</span>
          </button>
        </div>

        <!-- Banner de Retirada Presencial -->
        <div class="pickup-store-card">
          <div class="pickup-icon-wrap">
            <span class="material-symbols-outlined text-[20px]">storefront</span>
          </div>
          <div class="pickup-info">
            <h4>${LOJA_CONFIG.enderecoRetirada}</h4>
            <p>
              Pronto para conferência e retirada física. Pague diretamente ao retirar seu produto com segurança.
            </p>
          </div>
        </div>

        <!-- Acordeões Estruturados (Descrição & Ficha Técnica) -->
        <div class="accordion-item">
          <button
            type="button"
            class="accordion-trigger"
            id="acc-btn-desc"
            aria-expanded="true"
            aria-controls="acc-content-desc"
          >
            <span>Descrição e Destaques</span>
            <span class="material-symbols-outlined accordion-chevron">expand_more</span>
          </button>
          <div class="accordion-body is-open" id="acc-content-desc">
            <p>${p.descricao || ''}</p>
            ${(p.destaquesCards && p.destaquesCards.length > 0) ? `
              <div class="features-subgrid">
                ${p.destaquesCards.map(d => `
                  <div class="feature-subcard">
                    <p class="feature-subcard-title">${d.titulo}</p>
                    <p class="feature-subcard-desc">${d.subtitulo}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="accordion-item">
          <button
            type="button"
            class="accordion-trigger"
            id="acc-btn-specs"
            aria-expanded="false"
            aria-controls="acc-content-specs"
          >
            <span>Ficha Técnica Completa</span>
            <span class="material-symbols-outlined accordion-chevron">expand_more</span>
          </button>
          <div class="accordion-body" id="acc-content-specs">
            <dl class="specs-dl">
              ${(p.especificacoes || []).map(esp => `
                <div class="spec-dl-row">
                  <dt class="spec-dt">${esp.rotulo}</dt>
                  <dd class="spec-dd">${esp.valor}</dd>
                </div>
              `).join('')}
            </dl>
          </div>
        </div>

      </div>
    </div>
  `;

  vincularEventosInterativos();
}

/**
 * Renderiza o pill de estoque conforme a quantidade real
 */
function renderizarPillEstoque() {
  const estoque = estadoProduto.estoqueDisponivel;

  if (estoque > 3) {
    return `
      <div class="stock-indicator">
        <span class="pulse-dot"></span>
        <span>Em estoque na Loja Física (${estoque} unidades)</span>
      </div>
      <span class="stock-tag">Pronta entrega</span>
    `;
  } else if (estoque > 0) {
    return `
      <div class="stock-indicator">
        <span class="pulse-dot warning"></span>
        <span>Poucas unidades em estoque (${estoque} restantes)</span>
      </div>
      <span class="stock-tag warning">Estoque baixo</span>
    `;
  } else {
    return `
      <div class="stock-indicator">
        <span class="pulse-dot danger"></span>
        <span>Produto temporariamente esgotado</span>
      </div>
      <span class="stock-tag danger">Indisponível</span>
    `;
  }
}

/**
 * Renderiza seletor de cores
 */
function renderizarSeletorCores(produto) {
  if (!produto.opcoesCores || produto.opcoesCores.length === 0) return '';

  return `
    <div class="variant-group">
      <div class="variant-group-header">
        <span class="variant-group-label">Cor selecionada:</span>
        <span class="variant-group-val" id="label-cor-selecionada">${estadoProduto.corSelecionada}</span>
      </div>
      <div class="color-picker-row" role="radiogroup" aria-label="Opções de cor">
        ${produto.opcoesCores.map(cor => `
          <button
            type="button"
            class="color-btn ${estadoProduto.corSelecionada === cor.nome ? 'is-active' : ''}"
            data-color-name="${cor.nome}"
            aria-checked="${estadoProduto.corSelecionada === cor.nome ? 'true' : 'false'}"
            role="radio"
          >
            <span class="color-swatch-circle" style="background-color: ${cor.corHex};"></span>
            <span>${cor.nome}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Renderiza seletor de opções (Capacidade, Hardware ou Voltagem)
 */
function renderizarSeletorOpcoes(produto) {
  const lista = produto.opcoesCapacidades || produto.opcoesHardware || produto.opcoesVoltagem;
  if (!lista || lista.length === 0) return '';

  let labelGrupo = 'Opção';
  if (produto.opcoesCapacidades) labelGrupo = 'Capacidade';
  else if (produto.opcoesVoltagem) labelGrupo = 'Voltagem';
  else if (produto.opcoesHardware) labelGrupo = 'Opção de Hardware';

  return `
    <div class="variant-group">
      <div class="variant-group-header">
        <span class="variant-group-label">${labelGrupo}:</span>
        <span class="variant-group-val" id="label-opcao-selecionada">
          ${estadoProduto.opcaoSelecionada ? estadoProduto.opcaoSelecionada.valor : ''}
        </span>
      </div>
      <div class="options-grid" role="radiogroup" aria-label="${labelGrupo}">
        ${lista.map((opt, idx) => {
          const isAtivo = estadoProduto.opcaoSelecionada && estadoProduto.opcaoSelecionada.valor === opt.valor;
          const acrescimoCentavos = opt.acrescimoCentavos || 0;
          const rotuloPreco = acrescimoCentavos > 0 ? `+ ${formatarPreco(acrescimoCentavos)}` : 'Incluso';
          return `
            <button
              type="button"
              class="option-card-btn ${isAtivo ? 'is-active' : ''}"
              data-option-idx="${idx}"
              aria-checked="${isAtivo ? 'true' : 'false'}"
              role="radio"
            >
              <span class="option-name">${opt.valor}</span>
              <span class="option-price-diff">${rotuloPreco}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Vincula todos os eventos de interação da página de detalhes
 */
function vincularEventosInterativos() {
  const produto = estadoProduto.produto;
  if (!produto) return;

  // Miniaturas da Galeria
  const thumbBtns = document.querySelectorAll('.gallery-thumb-btn');
  const mainImg = document.getElementById('main-product-img');

  thumbBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const novaUrl = btn.getAttribute('data-img-url');
      if (mainImg && novaUrl) {
        mainImg.style.opacity = '0.3';
        setTimeout(() => {
          mainImg.src = novaUrl;
          mainImg.style.opacity = '1';
        }, 150);
      }
      thumbBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
  });

  // Cores
  const colorBtns = document.querySelectorAll('.color-btn');
  const labelCor = document.getElementById('label-cor-selecionada');
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const corNome = btn.getAttribute('data-color-name');
      estadoProduto.corSelecionada = corNome;
      if (labelCor) labelCor.textContent = corNome;
      colorBtns.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-checked', 'true');

      recalcularPrecoEEstoque();
      atualizarExibicaoDinamica();
    });
  });

  // Opções (Capacidade, Voltagem, Hardware)
  const optionBtns = document.querySelectorAll('.option-card-btn');
  const labelOpcao = document.getElementById('label-opcao-selecionada');
  const listaOpcoes = produto.opcoesCapacidades || produto.opcoesHardware || produto.opcoesVoltagem || [];

  optionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-option-idx'), 10);
      const optSelecionada = listaOpcoes[idx];
      if (!optSelecionada) return;

      estadoProduto.opcaoSelecionada = optSelecionada;
      if (labelOpcao) labelOpcao.textContent = optSelecionada.valor;

      optionBtns.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-checked', 'true');

      recalcularPrecoEEstoque();
      atualizarExibicaoDinamica();
    });
  });

  // Controles de Quantidade (Stepper)
  const btnMinus = document.getElementById('btn-qty-minus');
  const btnPlus = document.getElementById('btn-qty-plus');
  const displayQty = document.getElementById('display-qty');

  if (btnMinus) {
    btnMinus.addEventListener('click', () => {
      if (estadoProduto.quantidade > 1) {
        estadoProduto.quantidade -= 1;
        if (displayQty) displayQty.textContent = estadoProduto.quantidade;
        atualizarBotoesStepper();
      }
    });
  }

  if (btnPlus) {
    btnPlus.addEventListener('click', () => {
      if (estadoProduto.quantidade < estadoProduto.estoqueDisponivel) {
        estadoProduto.quantidade += 1;
        if (displayQty) displayQty.textContent = estadoProduto.quantidade;
        atualizarBotoesStepper();
      }
    });
  }

  // Botão Adicionar à Sacola
  const btnAdd = document.getElementById('btn-add-to-cart');
  if (btnAdd) {
    btnAdd.addEventListener('click', () => {
      adicionarAoCarrinho();
    });
  }

  // Acordeões
  configurarAcordeao('acc-btn-desc', 'acc-content-desc');
  configurarAcordeao('acc-btn-specs', 'acc-content-specs');
}

/**
 * Atualiza DOM reativo de preço, estoque e stepper
 */
function atualizarExibicaoDinamica() {
  const displayPreco = document.getElementById('display-preco');
  const stockPill = document.getElementById('stock-pill');
  const displayQty = document.getElementById('display-qty');
  const btnAdd = document.getElementById('btn-add-to-cart');
  const btnAddText = document.getElementById('btn-add-to-cart-text');

  if (displayPreco) {
    displayPreco.textContent = formatarPreco(estadoProduto.precoAtualCentavos);
  }

  if (stockPill) {
    stockPill.innerHTML = renderizarPillEstoque();
  }

  if (displayQty) {
    displayQty.textContent = estadoProduto.quantidade;
  }

  if (btnAdd) {
    btnAdd.disabled = estadoProduto.estoqueDisponivel === 0;
  }

  if (btnAddText) {
    btnAddText.textContent = estadoProduto.estoqueDisponivel > 0
      ? 'Adicionar ao carrinho'
      : 'Indisponível no momento';
  }

  // Atualiza título dinâmico com a opção da variante ativa (ex: '256 GB', 'Com Cooler')
  const titleH1 = document.getElementById('product-detail-h1');
  const p = estadoProduto.produto;
  const v = estadoProduto.varianteAtiva;

  if (titleH1 && p) {
    const nomeComposto = (v && v.nomeOpcao) ? `${p.nome} — ${v.nomeOpcao}` : p.nome;
    titleH1.textContent = nomeComposto;
    document.title = `${nomeComposto} — Nexo`;
    const bNome = document.getElementById('breadcrumb-nome');
    if (bNome) bNome.textContent = nomeComposto;
  }

  atualizarBotoesStepper();
}

/**
 * Atualiza estado dos botões de incremento/decremento
 */
function atualizarBotoesStepper() {
  const btnMinus = document.getElementById('btn-qty-minus');
  const btnPlus = document.getElementById('btn-qty-plus');

  if (btnMinus) {
    btnMinus.disabled = estadoProduto.quantidade <= 1;
  }

  if (btnPlus) {
    btnPlus.disabled = estadoProduto.quantidade >= estadoProduto.estoqueDisponivel;
  }
}

/**
 * Adiciona a variante autoritativa à sacola de compras local
 */
function adicionarAoCarrinho() {
  const p = estadoProduto.produto;
  const v = estadoProduto.varianteAtiva;

  if (!p || !v || estadoProduto.estoqueDisponivel <= 0 || estadoProduto.quantidade <= 0) {
    notificar('Não foi possível adicionar o item: sem estoque disponível.', 'warning');
    return;
  }

  const prodId = p.slug || p.id;
  const varId = v.slug || v.varianteId || v.id;

  const item = {
    id: prodId,
    produtoId: prodId,
    varianteId: varId,
    nome: p.nome,
    categoria: p.categoria,
    imagem: p.imagem,
    cor: v.corNome || v.cor || null,
    corHex: v.corHex || null,
    opcao: v.nomeOpcao || v.opcao || null,
    rotuloVariante: v.rotuloVariante || '',
    precoUnitarioCentavos: v.precoCentavos,
    quantidade: estadoProduto.quantidade,
    estoque: estadoProduto.estoqueDisponivel
  };

  adicionarItemCarrinho(item);
}

/**
 * Controle de expansão/recolhimento dos acordeões
 */
function configurarAcordeao(btnId, contentId) {
  const btn = document.getElementById(btnId);
  const content = document.getElementById(contentId);
  if (!btn || !content) return;

  btn.addEventListener('click', () => {
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isExpanded));
    if (isExpanded) {
      content.classList.remove('is-open');
    } else {
      content.classList.add('is-open');
    }
  });
}
