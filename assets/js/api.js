/**
 * Nexo - Loja Virtual
 * api.js: Camada desacoplada de comunicação com a API RESTful Flask e PostgreSQL.
 *
 * Separação estrita de requisições e renderização.
 * Não utiliza silenciosamente dados fictícios como alternativa quando o servidor falhar.
 */

/**
 * Busca as categorias ativas do catálogo.
 * @returns {Promise<Array>} Lista de categorias
 */
export async function fetchCategorias() {
  const resp = await fetch('/api/categorias');
  if (!resp.ok) {
    throw new Error(`Falha ao comunicar com o servidor de categorias (Status ${resp.status})`);
  }
  const data = await resp.json();
  if (!data.sucesso) {
    throw new Error(data.erro || 'Erro desconhecido ao carregar categorias.');
  }
  return data.categorias || [];
}

/**
 * Busca produtos ativos no catálogo com suporte a filtros e busca.
 * @param {object} params - { categoria, busca }
 * @returns {Promise<Array>} Lista de produtos retornados pelo servidor
 */
export async function fetchProdutos({ categoria = '', busca = '' } = {}) {
  const params = new URLSearchParams();
  if (categoria && categoria !== 'all') {
    params.set('categoria', categoria);
  }
  if (busca && busca.trim()) {
    params.set('busca', busca.trim());
  }
  const url = `/api/produtos${params.toString() ? '?' + params.toString() : ''}`;
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Falha ao carregar produtos do catálogo (Status ${resp.status})`);
  }
  const data = await resp.json();
  if (!data.sucesso) {
    throw new Error(data.erro || 'Erro retornado pela API de produtos.');
  }
  return data.produtos || [];
}

/**
 * Obtém os detalhes completos de um produto específico e suas variantes ativas.
 * @param {string} idOuSlug - Identificador estável do produto
 * @returns {Promise<object|null>} Detalhes do produto ou null se inexistente/inativo
 */
export async function fetchProdutoDetalhes(idOuSlug) {
  if (!idOuSlug) return null;
  const resp = await fetch(`/api/produtos/${encodeURIComponent(idOuSlug)}`);
  if (resp.status === 404) {
    return null; // Produto inexistente ou inativo
  }
  if (!resp.ok) {
    throw new Error(`Falha ao consultar detalhes do produto (Status ${resp.status})`);
  }
  const data = await resp.json();
  if (!data.sucesso) {
    throw new Error(data.erro || 'Erro retornado pela API ao obter produto.');
  }
  return data.produto || null;
}

/**
 * Validação autoritativa dos itens do carrinho contra o banco de dados.
 * Detecta itens esgotados (estoque 0), produtos inativos/removidos, preços alterados
 * e quantidades que excedem o estoque atual.
 *
 * @param {Array} itens - Itens salvos localmente na sacola
 * @returns {Promise<object>} Resposta com itens validados e avisos
 */
export async function validarCarrinhoServidor(itens) {
  const resp = await fetch('/api/carrinho/validar', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ itens: itens || [] })
  });

  if (!resp.ok) {
    throw new Error(`Falha ao sincronizar sacola com o servidor (Status ${resp.status})`);
  }

  const data = await resp.json();
  if (!data.sucesso) {
    throw new Error(data.erro || 'Erro retornado ao validar itens da sacola.');
  }

  return data;
}
