/**
 * Nexo - Loja Virtual
 * Lógica da Página de Checkout (Etapa 5)
 *
 * Integração autoritativa com POST /api/pedidos.
 * - Confere sacola de compras com o catálogo no PostgreSQL.
 * - Valida formulário de comprador e entrega.
 * - Impede pedidos duplicados via chave de idempotência e bloqueio imediato do botão.
 * - Pagamento simulado presencial (sem requisição de dados de cartão).
 * - Renderização segura contra XSS via textContent e createElement.
 */

import {
  inicializarComponentesComuns,
  obterItensDetalhadosCarrinho,
  sincronizarCarrinhoComServidor,
  limparCarrinhoCompleto,
  formatarPreco,
  notificar
} from './componentes.js';

let processandoEnvio = false;
let chaveIdempotencia = obterChaveIdempotencia();

function obterChaveIdempotencia() {
  try {
    let key = sessionStorage.getItem('nexo_checkout_idempotency_key');
    if (!key) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        key = crypto.randomUUID();
      } else {
        key = 'nx-idem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
      }
      sessionStorage.setItem('nexo_checkout_idempotency_key', key);
    }
    return key;
  } catch (_) {
    return 'nx-idem-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
  }
}

async function iniciarCheckout() {
  inicializarComponentesComuns();
  
  // Revalida a sacola com o PostgreSQL antes de renderizar
  await sincronizarCarrinhoComServidor();
  renderizarTelaCheckout();

  window.addEventListener('storage', (event) => {
    if (event.key === 'nexo_carrinho' && !processandoEnvio) {
      renderizarTelaCheckout();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarCheckout);
} else {
  iniciarCheckout();
}

/**
 * Renderiza o fluxo de checkout
 */
export function renderizarTelaCheckout() {
  const container = document.getElementById('checkout-container');
  if (!container) return;

  const resumo = obterItensDetalhadosCarrinho();
  
  // Se a sacola estiver vazia
  if (!resumo.itens || resumo.itens.length === 0) {
    container.replaceChildren();

    const emptyWrap = document.createElement('div');
    emptyWrap.className = 'cart-empty-state';
    emptyWrap.style.cssText = 'padding: 5rem 1rem;';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'cart-empty-icon';
    iconDiv.style.cssText = 'width: 80px; height: 80px;';
    iconDiv.innerHTML = '<span class="material-symbols-outlined text-[40px]">remove_shopping_cart</span>';

    const titleH2 = document.createElement('h2');
    titleH2.className = 'cart-empty-title';
    titleH2.textContent = 'Não há itens para finalizar';

    const descP = document.createElement('p');
    descP.className = 'cart-empty-desc';
    descP.textContent = 'Sua sacola está vazia. Adicione produtos na vitrine antes de acessar o checkout.';

    const actionsDiv = document.createElement('div');
    actionsDiv.style.marginTop = '1rem';

    const btnVitrine = document.createElement('a');
    btnVitrine.href = '/#catalogo';
    btnVitrine.className = 'btn-primary';
    btnVitrine.innerHTML = '<span class="material-symbols-outlined text-[18px]">storefront</span><span>Explorar Produtos</span>';

    actionsDiv.appendChild(btnVitrine);
    emptyWrap.append(iconDiv, titleH2, descP, actionsDiv);
    container.appendChild(emptyWrap);
    return;
  }

  container.replaceChildren();

  const grid = document.createElement('div');
  grid.className = 'checkout-grid';

  // -------------------------------------------------------------
  // COLUNA ESQUERDA: Formulários do Comprador e Entrega
  // -------------------------------------------------------------
  const colEsquerda = document.createElement('div');
  colEsquerda.className = 'checkout-sections';

  // Card 1: Dados do Comprador
  const cardComprador = document.createElement('section');
  cardComprador.className = 'checkout-card';

  const headComprador = document.createElement('div');
  headComprador.className = 'checkout-card-header';
  headComprador.innerHTML = `
    <span class="checkout-step-badge">1</span>
    <h2 class="checkout-card-title">Identificação do Comprador</h2>
  `;

  const formGridComprador = document.createElement('div');
  formGridComprador.className = 'form-grid';

  // Nome Completo
  const grpNome = criarCampoFormulario({
    colClass: 'col-12',
    label: 'Nome Completo',
    id: 'checkout-nome',
    type: 'text',
    placeholder: 'Ex: Lucas Silva',
    required: true,
    autocomplete: 'name'
  });

  // E-mail
  const grpEmail = criarCampoFormulario({
    colClass: 'col-6',
    label: 'E-mail para Confirmação',
    id: 'checkout-email',
    type: 'email',
    placeholder: 'seu.email@exemplo.com',
    required: true,
    autocomplete: 'email'
  });

  // Telefone / WhatsApp
  const grpTelefone = criarCampoFormulario({
    colClass: 'col-6',
    label: 'Telefone / WhatsApp',
    id: 'checkout-telefone',
    type: 'tel',
    placeholder: '(11) 98765-4321',
    required: true,
    autocomplete: 'tel'
  });

  formGridComprador.append(grpNome, grpEmail, grpTelefone);
  cardComprador.append(headComprador, formGridComprador);

  // Card 2: Endereço de Entrega
  const cardEntrega = document.createElement('section');
  cardEntrega.className = 'checkout-card';

  const headEntrega = document.createElement('div');
  headEntrega.className = 'checkout-card-header';
  headEntrega.innerHTML = `
    <span class="checkout-step-badge">2</span>
    <h2 class="checkout-card-title">Endereço de Entrega</h2>
  `;

  const formGridEntrega = document.createElement('div');
  formGridEntrega.className = 'form-grid';

  // CEP
  const grpCep = criarCampoFormulario({
    colClass: 'col-4',
    label: 'CEP',
    id: 'checkout-cep',
    type: 'text',
    placeholder: '00000-000',
    required: true,
    autocomplete: 'postal-code'
  });

  // Logradouro / Rua
  const grpLogradouro = criarCampoFormulario({
    colClass: 'col-8',
    label: 'Logradouro / Avenida / Rua',
    id: 'checkout-logradouro',
    type: 'text',
    placeholder: 'Ex: Av. Paulista',
    required: true,
    autocomplete: 'address-line1'
  });

  // Número
  const grpNumero = criarCampoFormulario({
    colClass: 'col-4',
    label: 'Número',
    id: 'checkout-numero',
    type: 'text',
    placeholder: 'Ex: 1000',
    required: true
  });

  // Complemento
  const grpComplemento = criarCampoFormulario({
    colClass: 'col-4',
    label: 'Complemento',
    id: 'checkout-complemento',
    type: 'text',
    placeholder: 'Apto, Bloco (opcional)',
    required: false
  });

  // Bairro
  const grpBairro = criarCampoFormulario({
    colClass: 'col-4',
    label: 'Bairro',
    id: 'checkout-bairro',
    type: 'text',
    placeholder: 'Ex: Bela Vista',
    required: true
  });

  // Cidade
  const grpCidade = criarCampoFormulario({
    colClass: 'col-8',
    label: 'Cidade',
    id: 'checkout-cidade',
    type: 'text',
    placeholder: 'Ex: São Paulo',
    required: true
  });

  // Estado (UF)
  const grpEstado = criarCampoFormulario({
    colClass: 'col-4',
    label: 'Estado (UF)',
    id: 'checkout-estado',
    type: 'text',
    placeholder: 'SP',
    required: true
  });

  formGridEntrega.append(grpCep, grpLogradouro, grpNumero, grpComplemento, grpBairro, grpCidade, grpEstado);
  cardEntrega.append(headEntrega, formGridEntrega);

  // Card 3: Forma de Pagamento (Simulada nesta etapa)
  const cardPagamento = document.createElement('section');
  cardPagamento.className = 'checkout-card';

  const headPagamento = document.createElement('div');
  headPagamento.className = 'checkout-card-header';
  headPagamento.innerHTML = `
    <span class="checkout-step-badge">3</span>
    <h2 class="checkout-card-title">Forma de Pagamento (Simulado)</h2>
  `;

  const boxPagamento = document.createElement('div');
  boxPagamento.className = 'payment-method-box';
  boxPagamento.innerHTML = `
    <div class="payment-method-icon">
      <span class="material-symbols-outlined text-[24px]">payments</span>
    </div>
    <div style="flex: 1;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
        <strong style="color: var(--color-text-primary); font-size: 0.9375rem;">Pagamento Presencial / Retirada no Balcão</strong>
        <span style="font-size: 0.75rem; background: var(--color-success-bg); color: #15803d; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); font-weight: 600;">Simulado</span>
      </div>
      <p style="color: var(--color-text-secondary); font-size: 0.8125rem; margin: 0; line-height: 1.4;">
        O pedido será registrado com reserva atômica de estoque no PostgreSQL. O pagamento será concluído presencialmente na entrega/retirada (Pix, Cartão ou Dinheiro). Não solicitamos dados de cartão online nesta etapa.
      </p>
    </div>
  `;

  // Observações opcionais
  const grpObs = document.createElement('div');
  grpObs.className = 'form-group';
  grpObs.style.marginTop = '1.25rem';
  grpObs.innerHTML = `
    <label class="form-label" for="checkout-obs">Observações do Pedido (opcional)</label>
    <textarea id="checkout-obs" class="form-textarea" rows="2" placeholder="Ex: Deixar na portaria com o zelador ou instruções específicas."></textarea>
  `;

  cardPagamento.append(headPagamento, boxPagamento, grpObs);
  colEsquerda.append(cardComprador, cardEntrega, cardPagamento);

  // -------------------------------------------------------------
  // COLUNA DIREITA: Resumo da Compra e Botão de Confirmação
  // -------------------------------------------------------------
  const colDireita = document.createElement('aside');
  colDireita.className = 'checkout-summary-column';

  const summaryCard = document.createElement('div');
  summaryCard.className = 'checkout-summary-card';

  const summaryTitle = document.createElement('h3');
  summaryTitle.className = 'cart-summary-title';
  summaryTitle.textContent = 'Resumo do Pedido';

  // Lista dos Itens
  const itemsList = document.createElement('div');
  itemsList.className = 'checkout-items-list';

  resumo.itens.forEach(item => {
    const itemRow = document.createElement('div');
    itemRow.className = 'checkout-item-row';

    const img = document.createElement('img');
    img.src = item.imagem || '/static/images/placeholder.svg';
    img.alt = item.nome;
    img.className = 'checkout-item-thumb';

    const info = document.createElement('div');
    info.className = 'checkout-item-info';

    const nomeP = document.createElement('div');
    nomeP.className = 'checkout-item-name';
    nomeP.textContent = item.nome;

    const varP = document.createElement('div');
    varP.className = 'checkout-item-variant';
    varP.textContent = `${item.quantidade}x ${item.rotuloVariante || 'Padrão'}`;

    info.append(nomeP, varP);

    const priceDiv = document.createElement('div');
    priceDiv.className = 'checkout-item-price tabular-nums';
    priceDiv.textContent = formatarPreco(item.subtotalCentavos);

    itemRow.append(img, info, priceDiv);
    itemsList.appendChild(itemRow);
  });

  // Linhas financeiras
  const rowsWrap = document.createElement('div');
  rowsWrap.style.cssText = 'display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.25rem;';

  const rowSubtotal = document.createElement('div');
  rowSubtotal.className = 'cart-summary-row';
  rowSubtotal.innerHTML = `
    <span>Subtotal (${resumo.quantidadeTotal} itens)</span>
    <span class="tabular-nums font-semibold">${formatarPreco(resumo.subtotalCentavos)}</span>
  `;

  const rowFrete = document.createElement('div');
  rowFrete.className = 'cart-summary-row';
  rowFrete.innerHTML = `
    <span>Entrega / Retirada</span>
    <span class="font-semibold text-primary">Grátis</span>
  `;

  const rowTotal = document.createElement('div');
  rowTotal.className = 'cart-summary-row total-row';
  rowTotal.innerHTML = `
    <span>Total do Pedido</span>
    <span class="cart-summary-total-val tabular-nums">${formatarPreco(resumo.totalCentavos)}</span>
  `;

  rowsWrap.append(rowSubtotal, rowFrete, rowTotal);

  // Botão de Confirmação com Prevenção de Clique Duplo
  const btnConfirmar = document.createElement('button');
  btnConfirmar.type = 'button';
  btnConfirmar.id = 'btn-confirmar-pedido';
  btnConfirmar.className = 'btn-confirm-order';
  btnConfirmar.innerHTML = `
    <span class="material-symbols-outlined text-[20px]">check_circle</span>
    <span>Confirmar Pedido</span>
  `;

  btnConfirmar.addEventListener('click', () => submeterPedido(btnConfirmar, resumo));

  const safeNotice = document.createElement('div');
  safeNotice.style.cssText = 'font-size: 0.75rem; color: var(--color-text-secondary); text-align: center; margin-top: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 0.35rem;';
  safeNotice.innerHTML = `
    <span class="material-symbols-outlined text-[16px]">lock</span>
    <span>Ambiente seguro • Estoque reservado no PostgreSQL</span>
  `;

  summaryCard.append(summaryTitle, itemsList, rowsWrap, btnConfirmar, safeNotice);
  colDireita.appendChild(summaryCard);

  grid.append(colEsquerda, colDireita);
  container.appendChild(grid);
}

/**
 * Cria elemento de input de formulário padronizado
 */
function criarCampoFormulario({ colClass, label, id, type, placeholder, required, autocomplete }) {
  const grp = document.createElement('div');
  grp.className = `form-group ${colClass}`;

  const lbl = document.createElement('label');
  lbl.className = 'form-label';
  lbl.htmlFor = id;
  lbl.textContent = label;
  if (required) {
    const star = document.createElement('span');
    star.className = 'required';
    star.textContent = '*';
    lbl.appendChild(star);
  }

  const input = document.createElement('input');
  input.type = type;
  input.id = id;
  input.className = 'form-input';
  input.placeholder = placeholder || '';
  if (autocomplete) input.autocomplete = autocomplete;
  if (required) input.required = true;

  grp.append(lbl, input);
  return grp;
}

/**
 * Envia o pedido para o servidor via transação atômica em POST /api/pedidos
 */
async function submeterPedido(btnElement, resumo) {
  if (processandoEnvio) return;

  // 1. Obter e validar dados do formulário
  const nome = (document.getElementById('checkout-nome')?.value || '').trim();
  const email = (document.getElementById('checkout-email')?.value || '').trim();
  const telefone = (document.getElementById('checkout-telefone')?.value || '').trim();

  const cep = (document.getElementById('checkout-cep')?.value || '').trim();
  const logradouro = (document.getElementById('checkout-logradouro')?.value || '').trim();
  const numero = (document.getElementById('checkout-numero')?.value || '').trim();
  const complemento = (document.getElementById('checkout-complemento')?.value || '').trim();
  const bairro = (document.getElementById('checkout-bairro')?.value || '').trim();
  const cidade = (document.getElementById('checkout-cidade')?.value || '').trim();
  const estado = (document.getElementById('checkout-estado')?.value || '').trim();
  const obs = (document.getElementById('checkout-obs')?.value || '').trim();

  if (!nome) {
    notificar('Por favor, informe seu nome completo.', 'aviso');
    document.getElementById('checkout-nome')?.focus();
    return;
  }
  if (!email || !email.includes('@')) {
    notificar('Por favor, informe um endereço de e-mail válido.', 'aviso');
    document.getElementById('checkout-email')?.focus();
    return;
  }
  if (!telefone) {
    notificar('Por favor, informe um telefone de contato.', 'aviso');
    document.getElementById('checkout-telefone')?.focus();
    return;
  }
  if (!cep || !logradouro || !numero || !bairro || !cidade || !estado) {
    notificar('Por favor, preencha todos os campos obrigatórios do endereço de entrega.', 'aviso');
    return;
  }

  // 2. Trava imediata contra duplo clique
  processandoEnvio = true;
  btnElement.disabled = true;
  btnElement.innerHTML = `
    <span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">progress_activity</span>
    <span>Processando pedido...</span>
  `;

  // 3. Montar payload estrito para a API
  const payload = {
    idempotencyKey: chaveIdempotencia,
    cliente: {
      nome,
      email,
      telefone
    },
    endereco: {
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado
    },
    metodoPagamento: 'simulado_retirada',
    observacoes: obs,
    itens: resumo.itens.map(it => ({
      id: it.produtoId || it.id,
      produtoId: it.produtoId || it.id,
      varianteId: it.varianteId,
      nome: it.nome,
      quantidade: it.quantidade,
      precoUnitarioCentavos: it.precoUnitarioCentavos
    }))
  };

  try {
    const respostaHttp = await fetch('/api/pedidos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await respostaHttp.json();

    if (respostaHttp.ok && data.sucesso && data.pedido) {
      // 1. Salva a referência do pedido no navegador com token imprevisível
      const numPedido = data.pedido.numeroPedido || data.pedido.numero_pedido;
      const tokAcesso = data.pedido.tokenAcesso;
      if (numPedido && tokAcesso) {
        try {
          const raw = localStorage.getItem('nexo_meus_pedidos');
          const lista = raw ? JSON.parse(raw) : [];
          if (!lista.some(it => it.numeroPedido === numPedido)) {
            lista.unshift({
              numeroPedido: numPedido,
              tokenAcesso: tokAcesso,
              criadoEm: data.pedido.criadoEm || new Date().toISOString()
            });
            localStorage.setItem('nexo_meus_pedidos', JSON.stringify(lista));
          }
        } catch (e) {
          console.warn('Erro ao registrar pedido em nexo_meus_pedidos:', e);
        }
      }

      // 2. Limpa o carrinho centralizadamente, invalidando qualquer requisição pendente em voo
      limparCarrinhoCompleto();
      try {
        sessionStorage.removeItem('nexo_checkout_idempotency_key');
      } catch (_) {}

      notificar('Pedido confirmado com sucesso!', 'sucesso');

      // 3. Redireciona para a página oficial de confirmação com token de acesso seguro
      const tokenParam = tokAcesso ? `&token=${encodeURIComponent(tokAcesso)}` : '';
      setTimeout(() => {
        window.location.href = `/pedido/confirmacao?numero=${encodeURIComponent(numPedido)}${tokenParam}`;
      }, 300);

    } else {
      // Falha de validação, estoque insuficiente ou preço alterado
      processandoEnvio = false;
      btnElement.disabled = false;
      btnElement.innerHTML = `
        <span class="material-symbols-outlined text-[20px]">check_circle</span>
        <span>Confirmar Pedido</span>
      `;

      const msgErro = data.erro || 'Não foi possível finalizar o pedido. Tente novamente.';
      notificar(msgErro, 'aviso');

      // Se o preço foi alterado ou o estoque esgotou no PostgreSQL, resincroniza a sacola
      if (data.precoAtualizado || data.estoqueInsuficiente) {
        await sincronizarCarrinhoComServidor();
        renderizarTelaCheckout();
      }
    }
  } catch (erroRede) {
    processandoEnvio = false;
    btnElement.disabled = false;
    btnElement.innerHTML = `
      <span class="material-symbols-outlined text-[20px]">check_circle</span>
      <span>Confirmar Pedido</span>
    `;
    notificar('Erro de conexão ao registrar pedido. Por favor, tente novamente.', 'aviso');
  }
}
