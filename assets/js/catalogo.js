/**
 * Nexo - Loja Virtual
 * Lógica do Catálogo e Página Inicial (Etapa 4 - Conectado ao Flask e PostgreSQL)
 *
 * Separação estrita de requisições e renderização.
 * Não utiliza silenciosamente dados locais/fictícios em caso de falha do servidor.
 */

import { fetchProdutos } from './api.js';
import { inicializarComponentesComuns, debounce, formatarPreco } from './componentes.js';

// Estado reativo da página inicial
const estado = {
  categoria: 'all',
  termoBusca: '',
  produtos: [],
  carregando: false,
  erro: null
};

/**
 * Elementos do DOM
 */
let productGrid;
let productCount;
let searchInput;
let searchInputMobile;
let filterButtons;
let activeFilterIndicator;

/**
 * Inicialização
 */
function iniciar() {
  inicializarComponentesComuns();
  capturarElementos();
  lerParametrosUrl();
  vincularEventos();
  carregarCatalogo();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar);
} else {
  iniciar();
}

function capturarElementos() {
  productGrid = document.getElementById('product-grid');
  productCount = document.getElementById('product-count');
  searchInput = document.getElementById('search-input');
  searchInputMobile = document.getElementById('search-input-mobile');
  filterButtons = document.querySelectorAll('.category-filter-btn');
  activeFilterIndicator = document.getElementById('active-filter-indicator');
}

/**
 * Lê parâmetros da URL (ex: ?categoria=Celulares&busca=nexo)
 */
function lerParametrosUrl() {
  const params = new URLSearchParams(window.location.search);
  const catParam = params.get('categoria');
  const buscaParam = params.get('busca');

  if (catParam) {
    estado.categoria = catParam;
  }
  if (buscaParam) {
    estado.termoBusca = buscaParam;
    if (searchInput) searchInput.value = buscaParam;
    if (searchInputMobile) searchInputMobile.value = buscaParam;
  }
}

/**
 * Registra listeners de eventos do usuário
 */
function vincularEventos() {
  // Filtros de Categoria
  filterButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const categoria = btn.getAttribute('data-category');
      selecionarCategoria(categoria);
    });
  });

  // Busca em tempo real com debounce para performance
  const onSearchInput = debounce((valor) => {
    estado.termoBusca = valor.trim();
    if (searchInput && searchInput.value !== valor) searchInput.value = valor;
    if (searchInputMobile && searchInputMobile.value !== valor) searchInputMobile.value = valor;
    carregarCatalogo();
  }, 250);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => onSearchInput(e.target.value));
    searchInput.addEventListener('search', (e) => onSearchInput(e.target.value));
  }

  if (searchInputMobile) {
    searchInputMobile.addEventListener('input', (e) => onSearchInput(e.target.value));
    searchInputMobile.addEventListener('search', (e) => onSearchInput(e.target.value));
  }

  // Links do menu do cabeçalho que filtram categorias
  const navCategoryLinks = document.querySelectorAll('[data-nav-category]');
  navCategoryLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const cat = link.getAttribute('data-nav-category');
      selecionarCategoria(cat);
      const catalogoSection = document.getElementById('catalogo');
      if (catalogoSection) {
        catalogoSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Atualiza categoria selecionada e recarrega
 */
function selecionarCategoria(categoria) {
  estado.categoria = categoria || 'all';
  atualizarEstiloBotoesFiltro();
  carregarCatalogo();
}

/**
 * Atualiza destaque visual dos botões de filtro
 */
function atualizarEstiloBotoesFiltro() {
  if (!filterButtons) return;
  filterButtons.forEach(btn => {
    const btnCat = btn.getAttribute('data-category');
    const isAtivo = (estado.categoria.toLowerCase() === (btnCat || '').toLowerCase()) ||
                    (estado.categoria === 'all' && btnCat === 'all');

    if (isAtivo) {
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });

  const navCategoryLinks = document.querySelectorAll('[data-nav-category]');
  navCategoryLinks.forEach(link => {
    const navCat = link.getAttribute('data-nav-category');
    if ((navCat || '').toLowerCase() === estado.categoria.toLowerCase()) {
      link.classList.add('nav-link-active');
    } else {
      link.classList.remove('nav-link-active');
    }
  });
}

/**
 * Reseta todos os filtros e a busca
 */
export function limparFiltros() {
  estado.categoria = 'all';
  estado.termoBusca = '';
  if (searchInput) searchInput.value = '';
  if (searchInputMobile) searchInputMobile.value = '';
  atualizarEstiloBotoesFiltro();
  carregarCatalogo();
}

window.limparFiltros = limparFiltros;

// Controle de sequência de requisições do catálogo para evitar race conditions
let idRequisicaoCatalogoAtual = 0;

/**
 * Carrega produtos do servidor Flask / PostgreSQL com tratamento de estados e controle de respostas obsoletas
 */
export async function carregarCatalogo() {
  if (!productGrid) return;

  const idRequisicao = ++idRequisicaoCatalogoAtual;
  atualizarEstiloBotoesFiltro();

  // Estado de carregamento
  estado.carregando = true;
  estado.erro = null;
  renderizarEstadoCarregamento();

  try {
    const produtos = await fetchProdutos({
      categoria: estado.categoria,
      busca: estado.termoBusca
    });

    // Se uma nova busca foi solicitada enquanto esta requisição processava, descarta a resposta obsoleta
    if (idRequisicao !== idRequisicaoCatalogoAtual) {
      return;
    }

    estado.produtos = produtos;
    estado.carregando = false;
    renderizarProdutos();
  } catch (erro) {
    if (idRequisicao !== idRequisicaoCatalogoAtual) {
      return;
    }
    estado.carregando = false;
    estado.erro = erro.message || 'Falha ao conectar com o catálogo do servidor.';
    estado.produtos = [];
    renderizarEstadoFalha();
  }
}

/**
 * Renderiza estado de carregamento amigável
 */
function renderizarEstadoCarregamento() {
  if (productCount) {
    productCount.textContent = 'Carregando produtos do servidor...';
  }

  productGrid.replaceChildren();

  const loadingCard = document.createElement('div');
  loadingCard.className = 'empty-state-card col-span-full';
  loadingCard.style.cssText = 'padding: 4rem 1.5rem; text-align: center;';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'empty-state-icon';
  iconDiv.innerHTML = '<span class="material-symbols-outlined text-[36px]" style="animation: spin 1s linear infinite;">sync</span>';

  const titleH3 = document.createElement('h3');
  titleH3.className = 'empty-state-title';
  titleH3.textContent = 'Carregando catálogo Nexo';

  const descP = document.createElement('p');
  descP.className = 'empty-state-desc';
  descP.textContent = 'Conectando ao banco de dados e sincronizando os produtos mais recentes...';

  loadingCard.append(iconDiv, titleH3, descP);
  productGrid.appendChild(loadingCard);
}

/**
 * Renderiza estado de falha na requisição (com opção de tentar novamente)
 * NÃO utiliza silenciosamente dados fictícios como alternativa.
 */
function renderizarEstadoFalha() {
  if (productCount) {
    productCount.textContent = 'Erro de conexão com o servidor';
  }

  productGrid.replaceChildren();

  const errorCard = document.createElement('div');
  errorCard.className = 'empty-state-card col-span-full';
  errorCard.style.cssText = 'border-color: rgba(220, 38, 38, 0.3); background-color: rgba(254, 242, 242, 0.4);';

  const iconDiv = document.createElement('div');
  iconDiv.className = 'empty-state-icon';
  iconDiv.style.backgroundColor = 'rgba(220, 38, 38, 0.1)';
  iconDiv.style.color = '#DC2626';
  iconDiv.innerHTML = '<span class="material-symbols-outlined text-[36px]">cloud_off</span>';

  const titleH3 = document.createElement('h3');
  titleH3.className = 'empty-state-title';
  titleH3.textContent = 'Não foi possível carregar o catálogo';

  const descP = document.createElement('p');
  descP.className = 'empty-state-desc';
  descP.textContent = 'Ocorreu um erro ao comunicar com a API do servidor Nexo. O catálogo real do PostgreSQL não pôde ser consultado.';

  const detailP = document.createElement('p');
  detailP.style.cssText = 'font-size: 0.8125rem; color: var(--color-text-secondary); margin-bottom: 1.5rem;';
  detailP.textContent = `Detalhe: ${estado.erro}`;

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'empty-state-actions';

  const btnTentar = document.createElement('button');
  btnTentar.type = 'button';
  btnTentar.className = 'btn-primary';
  btnTentar.innerHTML = '<span class="material-symbols-outlined text-[18px]">refresh</span><span>Tentar novamente</span>';
  btnTentar.addEventListener('click', carregarCatalogo);

  actionsDiv.appendChild(btnTentar);
  errorCard.append(iconDiv, titleH3, descP, detailP, actionsDiv);
  productGrid.appendChild(errorCard);
}

/**
 * Renderiza a lista de produtos retornada pelo servidor
 */
function renderizarProdutos() {
  const produtos = estado.produtos;
  const total = produtos.length;

  // Atualiza contagem textual
  if (productCount) {
    const textoPlural = total === 1 ? '1 produto' : `${total} produtos`;
    productCount.textContent = `Exibindo ${textoPlural}`;
  }

  // Indicador de filtro ativo
  if (activeFilterIndicator) {
    const temFiltroAtivo = (estado.categoria && estado.categoria !== 'all') || Boolean(estado.termoBusca);
    if (temFiltroAtivo) {
      activeFilterIndicator.style.display = 'inline-flex';
      activeFilterIndicator.replaceChildren();

      const label = (estado.categoria && estado.categoria !== 'all')
        ? estado.categoria
        : `Busca: "${estado.termoBusca}"`;

      const iconSpan = document.createElement('span');
      iconSpan.className = 'material-symbols-outlined text-[16px]';
      iconSpan.textContent = 'tune';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = `Filtro ativo: ${label}`;

      const btnClear = document.createElement('button');
      btnClear.type = 'button';
      btnClear.className = 'btn-clear-chip';
      btnClear.setAttribute('aria-label', 'Limpar filtro');
      btnClear.innerHTML = '<span class="material-symbols-outlined text-[14px]">close</span>';
      btnClear.addEventListener('click', limparFiltros);

      activeFilterIndicator.append(iconSpan, labelSpan, btnClear);
    } else {
      activeFilterIndicator.style.display = 'none';
      activeFilterIndicator.replaceChildren();
    }
  }

  // Estado Vazio: Nenhum produto encontrado
  if (total === 0) {
    productGrid.replaceChildren();

    const emptyCard = document.createElement('div');
    emptyCard.className = 'empty-state-card col-span-full';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'empty-state-icon';
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-[36px]">search_off</span>';

    const titleH3 = document.createElement('h3');
    titleH3.className = 'empty-state-title';
    titleH3.textContent = 'Nenhum produto encontrado';

    const descP = document.createElement('p');
    descP.className = 'empty-state-desc';

    const strongTermo = document.createElement('strong');
    strongTermo.textContent = `"${estado.termoBusca || estado.categoria}"`;

    descP.append(
      document.createTextNode('Não localizamos produtos correspondentes a '),
      strongTermo,
      document.createTextNode('. Tente verificar a ortografia ou limpar os filtros para ver todo o catálogo.')
    );

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'empty-state-actions';

    const btnRestart = document.createElement('button');
    btnRestart.type = 'button';
    btnRestart.className = 'btn-primary';
    btnRestart.innerHTML = '<span class="material-symbols-outlined text-[18px]">restart_alt</span><span>Limpar filtros e busca</span>';
    btnRestart.addEventListener('click', limparFiltros);

    actionsDiv.appendChild(btnRestart);
    emptyCard.append(iconDiv, titleH3, descP, actionsDiv);
    productGrid.appendChild(emptyCard);
    return;
  }

  // Renderiza produtos carregados do PostgreSQL
  productGrid.innerHTML = produtos.map(produto => {
    const semEstoque = !produto.disponivel;
    const badgeEsgotado = semEstoque
      ? '<span class="product-badge" style="background-color: var(--color-text-secondary);">Esgotado</span>'
      : (produto.destaque ? `<span class="product-badge">${produto.destaque}</span>` : '');

    return `
      <article class="product-card group" data-category="${produto.categoria}">
        <div class="product-card-top">
          <div class="product-image-container">
            <img
              src="${produto.imagem}"
              alt="${produto.nome}"
              class="product-image"
              loading="lazy"
            />
            ${badgeEsgotado}
          </div>

          <div class="product-meta">
            <span class="product-category-tag">${produto.categoria}</span>
            <h3 class="product-title" title="${produto.nome}">
              <a href="produto.html?id=${encodeURIComponent(produto.id)}">${produto.nome}</a>
            </h3>
            <p class="product-subtitle">${produto.subtitulo || ''}</p>
          </div>
        </div>

        <div class="product-card-bottom">
          <div class="product-price-block">
            <span class="product-price-label">Preço para retirada</span>
            <span class="product-price">${formatarPreco(produto.precoCentavos)}</span>
          </div>

          <a
            href="produto.html?id=${encodeURIComponent(produto.id)}"
            class="btn-view-product"
            aria-label="Ver detalhes de ${produto.nome}"
          >
            <span>Ver produto</span>
            <span class="material-symbols-outlined text-[16px]">chevron_right</span>
          </a>
        </div>
      </article>
    `;
  }).join('');
}
