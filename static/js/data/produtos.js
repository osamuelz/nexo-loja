/**
 * Nexo - Loja Virtual
 * [REFERÊNCIA HISTÓRICA / MOCK INICIAL - ETAPAS 1 A 3]
 *
 * NOTA DE ARQUITETURA:
 * A partir da Etapa 4, a fonte oficial e autoritativa de dados do catálogo é o
 * banco relacional PostgreSQL, servido através dos endpoints da API Flask:
 * - GET /api/categorias
 * - GET /api/produtos
 * - GET /api/produtos/<id_ou_slug>
 *
 * Este arquivo foi preservado no repositório exclusivamente para fins de documentação
 * e rastreabilidade da estrutura de dados original utilizada no frontend antes da
 * integração com o banco de dados.
 */

export const LOJA_CONFIG = {
  nome: 'nexo',
  nomeCompleto: 'Nexo Loja Virtual',
  slogan: 'Tecnologia que facilita seu dia.',
  modalidadeEntrega: 'Retirada na Loja física',
  formaPagamento: 'Pagamento presencial na retirada (Pix, Cartão ou Dinheiro)',
  enderecoRetirada: 'Loja Física Nexo — Balcão de Atendimento Jardins',
  avisoLegal: 'Protótipo para demonstração técnica e acadêmica.'
};

export const PRODUTOS = [
  {
    id: 'smartphone-nexo-one',
    nome: 'Smartphone Nexo One — 128 GB',
    categoria: 'Celulares',
    subtitulo: 'Tela OLED 6.1" & Chip A16',
    precoBaseCentavos: 179900,
    precoCentavos: 179900,
    destaque: '128 GB',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCqSLVIs-1qFDs_pmPdLrlAHE4uLiZkEOge2adoa4oGLhjkvBQQbcpha7rKKUGiUTQcEB13YXIXDCMrmXFoGs6uK_4LRLqyl29QT-kvZRv_N35AAJCvOW7SCPKddftiHBSRH57V8M7QnyfsiSaTNU4XG7LEYDWiOQAlYykBLYoQ3cxapYcF-IKY1c3RDUjP6m-xbyk09VmTjjCTuxQz6uZDzcgu8GBnSWEDUx-lvP5QXcnzEkMh4yXN',
    galeria: [
      { titulo: 'Visão Geral', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA8w2Q-0r7vOx2o5mOBtFJ1OoGKw7sAUQ60SkzsSKojN_fwqcrsBccBWbDc-RgUkfrWKCQlWaRBCaKkZVb-lq_uVRkrzLfiRWq1xQP5zwInJOdCTlFglVZD8rsCyrz4PJ8NNyvtqLfXMAUq5a2k_OQUhqPhYKFEJ1lyHgvjPTjUKIYWXB0ybNZHqhQ8WueH_qw5dQESV_oZ_IrRVYrK3KogsGG_4ZvSZDK9R2zaV6FJnsXj9SRXMTQC' },
      { titulo: 'Perfil e Alto-Falante', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB3C8sWJiVOPSZgpzAB7Cb8_L7RDdIusLQJu-Ga518XldScdNrZplXpkRm-vpWVhV_naXj-lfbjVZpL3ou4gN5bGWleYEwCuP9xm88guov-L4g9xHNmf7N00xAylntmhQ4mw_p8X06rW0627N_WdmioyZX1g8o3YOQy7MZE3Cyeb0zJUUnePzHs_Z-r9bQn9X54CQfGhKLEZ9X5mHt_00x_wtho1prBsT1dHheHcnufDiUJV0sFgIqA' },
      { titulo: 'Traseira e Câmeras', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDRKKZFIixWDQZ6k62hMJjo6Y4M6hLvcmVzhtRQT2K3k8c3z7XHqtgd3paAX8KQ5d5oRT9mYZXUmvhz3tRkD3b0Qfr-0aAmLQuG3GTvYMsUG-QJQY5Pjr15zBjAxaj5Zfx_Rddkv9vRcDX2r3EQE24TTA1Y7l-lNhAwAdI0zXYaZKRiiaeazvMNBhMyPWWrKcO1zEOML66UzKg2gMg-Kzggigi45cNXNXK5IIujkhlNv_qKHArqMO5Q' },
      { titulo: 'Detalhe da Lente', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfOJJxO3tYU0JxsV4uuAuXRuQcaqeMNzEqQWTxKFU3zdSmBWfz5weUM4zfdNwlyJW_gUcvQNtr9mWDmHAygR89D0vlTSwdl3dRfK-QMZFEqs1IqQrsKZXzngVbNBFt1WBMzdNdolHbd-4dtexZskuMZu2ByO4U09QOp58WJQm4NIn8WHI-w99Gbt-0kWa8eQBC1-kr4VNdfZQ5018xYITWYQRymUzb5N6QDPvnmsvJWHQF6WB-GybM' }
    ],
    descricao: 'O Nexo One redefine a experiência móvel essencial. Projetado com linhas puristas e materiais nobres, o corpo em titânio aeroespacial proporciona leveza extrema e resistência superior. Equipado com tela Super Retina OLED de 6.1", chip neural A16 de alto desempenho e bateria com autonomia para o dia inteiro.',
    destaquesCards: [
      { titulo: 'Tela OLED Super 6.1"', subtitulo: 'OLED nítido com taxa de 120Hz' },
      { titulo: 'Chip Neural A16', subtitulo: 'Desempenho e eficiência energética' },
      { titulo: 'Titânio Aeroespacial', subtitulo: 'Estrutura leve e vidro acetinado' }
    ],
    tipoOpcoes: 'celular',
    opcoesCores: [
      { nome: 'Titânio Natural', corHex: '#A8A49F' },
      { nome: 'Preto Espacial', corHex: '#2A2B2E' },
      { nome: 'Prata Estelar', corHex: '#E3E4E6' }
    ],
    opcoesCapacidades: [
      { valor: '128 GB', acrescimoCentavos: 0, rotuloPreco: 'Incluso', estoque: 8 },
      { valor: '256 GB', acrescimoCentavos: 30000, rotuloPreco: '+ R$ 300,00', estoque: 5 },
      { valor: '512 GB', acrescimoCentavos: 70000, rotuloPreco: '+ R$ 700,00', estoque: 2 }
    ],
    notaAlimentacao: 'Alimentação Bivolt Universal (100V–240V). Acompanha cabo trançado USB-C de alta velocidade.',
    especificacoes: [
      { rotulo: 'Sistema Operacional', valor: 'NexoOS 18 (baseado em arquitetura aberta)' },
      { rotulo: 'Tela', valor: '6.1" OLED Super Retina (2556 x 1179 pixels a 460 ppi)' },
      { rotulo: 'Processador', valor: 'Chip A16 Bionic 6-core com Neural Engine 16-core' },
      { rotulo: 'Câmera Principal', valor: 'Dual 48 MP (Principal com OIS) + 12 MP (Ultra-angular)' },
      { rotulo: 'Câmera Frontal', valor: '12 MP TrueFocus com gravação 4K HDR' },
      { rotulo: 'Bateria & Autonomia', valor: 'Até 24h de reprodução contínua de vídeo' },
      { rotulo: 'Conectividade', valor: '5G Ultra, Wi-Fi 6E, Bluetooth 5.3, NFC' },
      { rotulo: 'Dimensões & Peso', valor: '146.6 x 70.6 x 7.85 mm • 171g' },
      { rotulo: 'Resistência à água', valor: 'Classificação IP68 (até 6 metros por 30 min)' }
    ]
  },
  {
    id: 'smartphone-nexo-pro',
    nome: 'Smartphone Nexo Pro — 256 GB',
    categoria: 'Celulares',
    subtitulo: 'Câmera Tripla 48MP & 120Hz ProMotion',
    precoBaseCentavos: 329900,
    precoCentavos: 329900,
    destaque: 'ProMotion',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFW_GNEZ00nZiN5XTGhYA-EeyIrCgVT_X4XXcllPJ-nrcie1ZfMBzvuYfH1FY6udBcGRcuZSC7CUcE39qTD_vwSjNL3VRHtpZiXlX1lUOw76rj5bftgHFpeTNgXSgPzy2cgPmtUfTCj7L-55OOe2VEqbfAqnq8y_tpPDG8JHwh4TYDSY_QUrP2TtpAm6TKIIji3mbcMGDj5oj8tdfppgGOCxh9HHgoulW5-O_LvUmtW-BuGUJYpEQa',
    galeria: [
      { titulo: 'Visão Geral Pro', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFW_GNEZ00nZiN5XTGhYA-EeyIrCgVT_X4XXcllPJ-nrcie1ZfMBzvuYfH1FY6udBcGRcuZSC7CUcE39qTD_vwSjNL3VRHtpZiXlX1lUOw76rj5bftgHFpeTNgXSgPzy2cgPmtUfTCj7L-55OOe2VEqbfAqnq8y_tpPDG8JHwh4TYDSY_QUrP2TtpAm6TKIIji3mbcMGDj5oj8tdfppgGOCxh9HHgoulW5-O_LvUmtW-BuGUJYpEQa' },
      { titulo: 'Módulo de Câmeras', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCfOJJxO3tYU0JxsV4uuAuXRuQcaqeMNzEqQWTxKFU3zdSmBWfz5weUM4zfdNwlyJW_gUcvQNtr9mWDmHAygR89D0vlTSwdl3dRfK-QMZFEqs1IqQrsKZXzngVbNBFt1WBMzdNdolHbd-4dtexZskuMZu2ByO4U09QOp58WJQm4NIn8WHI-w99Gbt-0kWa8eQBC1-kr4VNdfZQ5018xYITWYQRymUzb5N6QDPvnmsvJWHQF6WB-GybM' }
    ],
    descricao: 'Flagship profissional construído em titânio de grau aeroespacial com acabamento microjateado. Tela expansiva OLED Super Retina XDR com ProMotion adaptativo de 120Hz e sistema fotográfico com zoom óptico de 5x.',
    destaquesCards: [
      { titulo: 'Tela 6.7" ProMotion', subtitulo: 'Taxa adaptativa de 1 a 120Hz' },
      { titulo: 'Câmera Tripla Pro', subtitulo: '48MP + Teleobjetiva 5x + Ultra' },
      { titulo: 'Titânio Grau 5', subtitulo: 'Bordas ultrafinas e peso reduzido' }
    ],
    tipoOpcoes: 'celular',
    opcoesCores: [
      { nome: 'Titânio Preto', corHex: '#262628' },
      { nome: 'Titânio Natural', corHex: '#9E9A94' },
      { nome: 'Titânio Azul', corHex: '#39424E' }
    ],
    opcoesCapacidades: [
      { valor: '256 GB', acrescimoCentavos: 0, rotuloPreco: 'Incluso', estoque: 6 },
      { valor: '512 GB', acrescimoCentavos: 40000, rotuloPreco: '+ R$ 400,00', estoque: 4 },
      { valor: '1 TB', acrescimoCentavos: 90000, rotuloPreco: '+ R$ 900,00', estoque: 2 }
    ],
    notaAlimentacao: 'Alimentação Bivolt Universal. Cabo trançado USB-C 3 de 10 Gbps incluso.',
    especificacoes: [
      { rotulo: 'Tela', valor: '6.7" OLED Super Retina XDR ProMotion 120Hz' },
      { rotulo: 'Câmera Principal', valor: 'Tripla 48 MP + 12 MP Ultra-Wide + 12 MP Teleobjetiva 5x' },
      { rotulo: 'Vídeo', valor: 'Gravação em 4K a 60 fps ProRes com Log' },
      { rotulo: 'Bateria', valor: 'Até 29h de autonomia de vídeo contínuo' },
      { rotulo: 'Conector', valor: 'USB-C com transferência de dados de alta velocidade USB 3' }
    ]
  },
  {
    id: 'cpu-6-nucleos',
    nome: 'Processador de 6 núcleos',
    categoria: 'Informática',
    subtitulo: '12 Threads até 4.4 GHz',
    precoBaseCentavos: 89900,
    precoCentavos: 89900,
    destaque: '4.4 GHz',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIEUsR-mvYbYlUhOXslXwj7PzY_9iexKWCDQAPH5LTVJpMln3ceHl4iui6YtzLYLRMSID3fpNVyoUY_QsPp3QEvgjhDJD4o0gNBVObl-Dji0UkXLGR9g2v2uMDVT9Feq2kU3vi_OPDgVKbLZIMw_nG8lxLwTCGAkdgAzGSy7AaUFsjTTtWDGRq2VkRNyqRrDJvbilsx62ecBRxm1_2oW0jK692F-NaOoQEn59XcLG2F5RG0PUPp_Ob',
    galeria: [
      { titulo: 'Processador', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDIEUsR-mvYbYlUhOXslXwj7PzY_9iexKWCDQAPH5LTVJpMln3ceHl4iui6YtzLYLRMSID3fpNVyoUY_QsPp3QEvgjhDJD4o0gNBVObl-Dji0UkXLGR9g2v2uMDVT9Feq2kU3vi_OPDgVKbLZIMw_nG8lxLwTCGAkdgAzGSy7AaUFsjTTtWDGRq2VkRNyqRrDJvbilsx62ecBRxm1_2oW0jK692F-NaOoQEn59XcLG2F5RG0PUPp_Ob' }
    ],
    descricao: 'Processador desktop construído sob litografia refinada de alto rendimento. Com 6 núcleos físicos e 12 threads simultâneas, entrega excelente capacidade de resposta em jogos e multitarefas profissionais.',
    tipoOpcoes: 'informatica',
    opcoesHardware: [
      { valor: 'Versão Box (Sem Cooler)', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 12 },
      { valor: 'Versão Box (Com Cooler)', acrescimoCentavos: 8000, rotuloPreco: '+ R$ 80,00', estoque: 5 }
    ],
    compatibilidade: 'Soquete AM4 • Compatível com placas-mãe chipsets B450, B550 e X570 (com atualização de BIOS) • Suporte a memória RAM DDR4 dual channel até 3200 MHz • TDP de 65W.',
    especificacoes: [
      { rotulo: 'Soquete', valor: 'AM4' },
      { rotulo: 'Núcleos / Threads', valor: '6 núcleos / 12 threads' },
      { rotulo: 'Frequência Base / Boost', valor: '3.5 GHz / 4.4 GHz' },
      { rotulo: 'Cache L3', valor: '32 MB' },
      { rotulo: 'Consumo Térmico (TDP)', valor: '65 W' }
    ]
  },
  {
    id: 'ram-ddr4-16gb',
    nome: 'Memória RAM DDR4 — 16 GB',
    categoria: 'Informática',
    subtitulo: '3200MHz CL16 Dissipador Alumínio',
    precoBaseCentavos: 24900,
    precoCentavos: 24900,
    destaque: '3200MHz',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsHMiDccF_UzAQXqZE6sVzreAO30QwT9mgKUvyzlqVtdn4PSH2ZftZMmwTciSTd7fduQGx6G0DH2aX9ujNLS-vu56pPZ4cxxD9XxA9zcv-Qqo7g2GYyYDzpiTjmGzM0rzQ2dLc8Ut9ENOVUcugPHzSx7iP_Z4dcthxrejd5j3ujShHyMkLvpZFwgCn70Ff0AvDvGU95OwVx1r_SkkctdTPgUc6RfFmfbTCWaTG0HCiUKt6e3wsQNtT',
    galeria: [
      { titulo: 'Módulo DDR4', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAsHMiDccF_UzAQXqZE6sVzreAO30QwT9mgKUvyzlqVtdn4PSH2ZftZMmwTciSTd7fduQGx6G0DH2aX9ujNLS-vu56pPZ4cxxD9XxA9zcv-Qqo7g2GYyYDzpiTjmGzM0rzQ2dLc8Ut9ENOVUcugPHzSx7iP_Z4dcthxrejd5j3ujShHyMkLvpZFwgCn70Ff0AvDvGU95OwVx1r_SkkctdTPgUc6RfFmfbTCWaTG0HCiUKt6e3wsQNtT' }
    ],
    descricao: 'Módulo de memória desktop de alta performance com dissipador de calor de alumínio anodizado na cor grafite. Testada rigorosamente para estabilidade sob altas cargas e suporte a perfis XMP 2.0.',
    tipoOpcoes: 'informatica',
    opcoesHardware: [
      { valor: '1x 16 GB (Single Channel)', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 20 },
      { valor: '2x 16 GB (32 GB Dual Channel)', acrescimoCentavos: 23000, rotuloPreco: '+ R$ 230,00', estoque: 8 }
    ],
    compatibilidade: 'Placas-mãe para desktop compatíveis com módulos DDR4 UDIMM de 288 pinos • Tensão de operação: 1.35V.',
    especificacoes: [
      { rotulo: 'Capacidade', valor: '16 GB ou 32 GB' },
      { rotulo: 'Frequência', valor: '3200 MHz (PC4-25600)' },
      { rotulo: 'Latência', valor: 'CL16-18-18-38' },
      { rotulo: 'Tensão', valor: '1.35 V' }
    ]
  },
  {
    id: 'ssd-nvme-1tb',
    nome: 'SSD NVMe — 1 TB',
    categoria: 'Informática',
    subtitulo: 'Leitura 3500MB/s PCIe 4.0',
    precoBaseCentavos: 42900,
    precoCentavos: 42900,
    destaque: 'PCIe 4.0',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCynXv0y2zOgm180jBvtjz8huPCUp0xoGu2qw5rW7qixd_-zIe_OrxShhlfY5JvvGrqr1R6wMBLPb7WDOgjEEpJ-ihds1Ck6jr74DFDeqZuwY_YkA7i7R0mtvGVzsU8OCnd0vlmmb82Q9LOjhWtp_cc7WDauxpN9ilFFOLjAmeh9iw_6TiWtn3MRVvhjGcwRhz0hp7UDSRFcFMDAz23jXo2fI4yKPoAUd8Y3zeMBn-HWAt15vSPRcZD',
    galeria: [
      { titulo: 'SSD M.2', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCynXv0y2zOgm180jBvtjz8huPCUp0xoGu2qw5rW7qixd_-zIe_OrxShhlfY5JvvGrqr1R6wMBLPb7WDOgjEEpJ-ihds1Ck6jr74DFDeqZuwY_YkA7i7R0mtvGVzsU8OCnd0vlmmb82Q9LOjhWtp_cc7WDauxpN9ilFFOLjAmeh9iw_6TiWtn3MRVvhjGcwRhz0hp7UDSRFcFMDAz23jXo2fI4yKPoAUd8Y3zeMBn-HWAt15vSPRcZD' }
    ],
    descricao: 'Unidade de estado sólido NVMe M.2 2280 de alta velocidade com interface PCIe Gen 4.0 x4. Proporciona tempos mínimos de carregamento de jogos, inicialização de sistema em segundos e rápida transferência de arquivos volumosos.',
    tipoOpcoes: 'informatica',
    opcoesHardware: [
      { valor: '1 TB', acrescimoCentavos: 0, rotuloPreco: 'Incluso', estoque: 18 },
      { valor: '2 TB', acrescimoCentavos: 36000, rotuloPreco: '+ R$ 360,00', estoque: 7 }
    ],
    compatibilidade: 'Requer slot M.2 com suporte a chave M (M-Key) e protocolo PCIe NVMe 3.0 ou 4.0.',
    especificacoes: [
      { rotulo: 'Formato', valor: 'M.2 2280' },
      { rotulo: 'Interface', valor: 'PCIe 4.0 x4, NVMe 1.4' },
      { rotulo: 'Leitura Sequencial', valor: 'Até 3500 MB/s' },
      { rotulo: 'Gravação Sequencial', valor: 'Até 3000 MB/s' }
    ]
  },
  {
    id: 'gpu-8gb',
    nome: 'Placa de vídeo — 8 GB',
    categoria: 'Informática',
    subtitulo: 'Ray Tracing & GDDR6 256-bit',
    precoBaseCentavos: 189900,
    precoCentavos: 189900,
    destaque: 'Ray Tracing',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvNBos5FaIg6QcIwy8U3OPyFIhE221KwGKn0QK3baBsXfoR0Tw299MRMetbJwspKKcetfP6I6T-ee5j1zDBxsFFMIkd7yCZOfkhtCAk9ZfTX1UQJcCHeZfeVn2eont9SkFMeAoyuyl2X3ObpgUx6o_ZeyZp3bKVA1d8Bx-ozl_H9AVdnVtWDAp4H4Qll9lrhQNiB2_q6zry6xRT3ULKOh9fJY5pv6fvT9Fi2Hn6tU2cv6GVHXIgrEI',
    galeria: [
      { titulo: 'Placa de Vídeo', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvNBos5FaIg6QcIwy8U3OPyFIhE221KwGKn0QK3baBsXfoR0Tw299MRMetbJwspKKcetfP6I6T-ee5j1zDBxsFFMIkd7yCZOfkhtCAk9ZfTX1UQJcCHeZfeVn2eont9SkFMeAoyuyl2X3ObpgUx6o_ZeyZp3bKVA1d8Bx-ozl_H9AVdnVtWDAp4H4Qll9lrhQNiB2_q6zry6xRT3ULKOh9fJY5pv6fvT9Fi2Hn6tU2cv6GVHXIgrEI' }
    ],
    descricao: 'Placa gráfica para jogos em 1080p e 1440p de alta fidelidade, além de aceleração de softwares gráficos e edição 3D. Conta com ventoinhas duplas eficientes e estrutura metálica traseira rígida.',
    tipoOpcoes: 'informatica',
    opcoesHardware: [
      { valor: 'Modelo 8 GB Dual Fan', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 7 }
    ],
    compatibilidade: 'Slot PCIe 3.0/4.0 x16 • Fonte de alimentação recomendada de 550W ou superior • 1 conector de energia PCI-e de 8 pinos.',
    especificacoes: [
      { rotulo: 'Memória VRAM', valor: '8 GB GDDR6' },
      { rotulo: 'Interface de Memória', valor: '128-bit / 256-bit bus' },
      { rotulo: 'Saídas', valor: '3x DisplayPort 1.4a, 1x HDMI 2.1' },
      { rotulo: 'Consumo Energético', valor: '160 W' }
    ]
  },
  {
    id: 'geladeira-frost-free-400l',
    nome: 'Geladeira Frost Free — 400 litros',
    categoria: 'Eletrodomésticos',
    subtitulo: 'Inverter Econômica & Painel Touch',
    precoBaseCentavos: 349900,
    precoCentavos: 349900,
    destaque: 'Inverter',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRwtOPkgMC4wbj7C04n5UrRUUDNsADLsDdkADRUZcm9_C8IAlwuEsPbMBn3BKiSMwhu8KX5blKM7h9f1bVKKZjhYaSFTKjqCNa_L0xcvS9wzhz3AxhmjPrQXguVbPqiEYMR7Vkmmqv0LEzwlRuGo1ga2wEfe0Hcb_bvwFEdG6Moc3kW5Ae95xEC-JvSmxFKt7Bo3Cw2M7UAqJ2KG7NG2Uk5BFvURPYwpVLgNBMIHfCno2PuZD-5kEf',
    galeria: [
      { titulo: 'Refrigerador', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBRwtOPkgMC4wbj7C04n5UrRUUDNsADLsDdkADRUZcm9_C8IAlwuEsPbMBn3BKiSMwhu8KX5blKM7h9f1bVKKZjhYaSFTKjqCNa_L0xcvS9wzhz3AxhmjPrQXguVbPqiEYMR7Vkmmqv0LEzwlRuGo1ga2wEfe0Hcb_bvwFEdG6Moc3kW5Ae95xEC-JvSmxFKt7Bo3Cw2M7UAqJ2KG7NG2Uk5BFvURPYwpVLgNBMIHfCno2PuZD-5kEf' }
    ],
    descricao: 'Refrigerador duplex duplex com acabamento em aço inoxidável escovado e tecnologia de compressor Inverter para menor consumo de energia e ruído reduzido. Painel externo sensível ao toque com controle de zonas de temperatura.',
    tipoOpcoes: 'eletrodomestico',
    opcoesVoltagem: [
      { valor: '110V (127V)', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 4 },
      { valor: '220V', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 2 }
    ],
    notaAlimentacao: 'Verifique a voltagem do ponto de energia antes da retirada. Padrão ABNT 3 pinos (10A).',
    especificacoes: [
      { rotulo: 'Capacidade Total', valor: '400 Litros (Refrigerador 295L + Freezer 105L)' },
      { rotulo: 'Tipo de Degelo', valor: 'Frost Free automático' },
      { rotulo: 'Eficiência Energética', valor: 'Classificação A+++' },
      { rotulo: 'Dimensões (AxLxP)', valor: '185 x 62 x 69 cm' },
      { rotulo: 'Acabamento', valor: 'Aço inox escovado' }
    ]
  },
  {
    id: 'micro-ondas-30l',
    nome: 'Micro-ondas — 30 litros',
    categoria: 'Eletrodomésticos',
    subtitulo: 'Função Descongelar & Inox',
    precoBaseCentavos: 69900,
    precoCentavos: 69900,
    destaque: '30 Litros',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1aCc75hm82v3V5nHYetyH8PxEvtt4_GAzsRKuPRLYhZuuIgw6jV2Pfdet_zNPQvx-hB6ZlMBJj4H0CPlqz7SvjxFT59kpc4ojllcb9jJRR4uXewCuR4F57h1lUH4DHqb66TJT4yL9ZDOy9tBYHD5EeOpHcB0f0bg6R5AoNNeDnm3ZtR_pIMEN1Am6zhz2FIzvO-l5_aqzEMmhBot9EZe50taT4YXCZMq2W3RMiH3rG1SREnu_VhRG',
    galeria: [
      { titulo: 'Micro-ondas', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB1aCc75hm82v3V5nHYetyH8PxEvtt4_GAzsRKuPRLYhZuuIgw6jV2Pfdet_zNPQvx-hB6ZlMBJj4H0CPlqz7SvjxFT59kpc4ojllcb9jJRR4uXewCuR4F57h1lUH4DHqb66TJT4yL9ZDOy9tBYHD5EeOpHcB0f0bg6R5AoNNeDnm3ZtR_pIMEN1Am6zhz2FIzvO-l5_aqzEMmhBot9EZe50taT4YXCZMq2W3RMiH3rG1SREnu_VhRG' }
    ],
    descricao: 'Forno micro-ondas de bancada com ampla cavidade interna de 30 litros, porta com acabamento espelhado e 10 níveis de potência ajustáveis para aquecer, cozinhar e descongelar uniformemente.',
    tipoOpcoes: 'eletrodomestico',
    opcoesVoltagem: [
      { valor: '110V (127V)', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 8 },
      { valor: '220V', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 6 }
    ],
    notaAlimentacao: 'Requer tomada exclusiva de 20A no padrão brasileiro.',
    especificacoes: [
      { rotulo: 'Capacidade', valor: '30 Litros' },
      { rotulo: 'Potência Útil', valor: '900 W' },
      { rotulo: 'Diâmetro do Prato', valor: '31,5 cm' }
    ]
  },
  {
    id: 'air-fryer-5l',
    nome: 'Air fryer — 5 litros',
    categoria: 'Eletrodomésticos',
    subtitulo: 'Timer Digital & Cesto Antiaderente',
    precoBaseCentavos: 39900,
    precoCentavos: 39900,
    destaque: '5 Litros',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDLZ8Ea2DvVmE_itqHOPfnwbZy0-BWtVk1swT8vzdbsOrR_4uLGezAAPutqsb7XaF4LMhSwQ4yVkLtUFOi8zaoHg5AwZx5WFAvf0PaWoNt0dA6qbBMV7THkhTrw3jO8SnUyUZemkcoHrxcuuPXpQjBjm5p5Hte4IiFEBQGQ5-ZXe1SnmWtREFCKF98u0TAWoIIEyMzoZenI96Q5yglBA-ZU-J5KMxVf8DXLCRv72WXKv-6vLVOW_c3J',
    galeria: [
      { titulo: 'Air Fryer', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDLZ8Ea2DvVmE_itqHOPfnwbZy0-BWtVk1swT8vzdbsOrR_4uLGezAAPutqsb7XaF4LMhSwQ4yVkLtUFOi8zaoHg5AwZx5WFAvf0PaWoNt0dA6qbBMV7THkhTrw3jO8SnUyUZemkcoHrxcuuPXpQjBjm5p5Hte4IiFEBQGQ5-ZXe1SnmWtREFCKF98u0TAWoIIEyMzoZenI96Q5yglBA-ZU-J5KMxVf8DXLCRv72WXKv-6vLVOW_c3J' }
    ],
    descricao: 'Fritadeira sem óleo com painel digital sensível ao toque, cesto antiaderente quadrado de 5 litros e convecção de ar rápida que reduz até 85% do uso de gordura nas refeições cotidianas.',
    tipoOpcoes: 'eletrodomestico',
    opcoesVoltagem: [
      { valor: '110V (127V)', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 10 },
      { valor: '220V', acrescimoCentavos: 0, rotuloPreco: 'Padrão', estoque: 6 }
    ],
    notaAlimentacao: 'Potência de 1700W. Requer tomada padrão 20A.',
    especificacoes: [
      { rotulo: 'Capacidade', valor: '5.0 Litros' },
      { rotulo: 'Temperatura', valor: '80 °C a 200 °C' },
      { rotulo: 'Timer', valor: 'Até 60 min com aviso sonoro' }
    ]
  },
  {
    id: 'fone-bluetooth',
    nome: 'Fone Bluetooth',
    categoria: 'Acessórios',
    subtitulo: 'Cancelamento Ativo de Ruído & 30h',
    precoBaseCentavos: 17900,
    precoCentavos: 17900,
    destaque: 'ANC 30h',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkXT8C4q-PpvIKJR3mvsjdFCdkTayOzpJMx6_T8oIts3ARSp8CgHUZJD8fyLrWH94mWpY_gTuP92BLLMtnM9AHYt1nlO5rkp5kJfqv5piC9raBeSe9JY5tUMgrSz37koZbMQFXHTmhLcAqMAJlUxb-2youuUXjxIYaR6ezWKVZLa_Hr1nBvOpfJu2GDzpofAlEAUKVNJRCbRvLRtXGoDTUIi8x2Lpb0Ho_bMy4OKpwgkaZKTCOOMhM',
    galeria: [
      { titulo: 'Fone de Ouvido', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkXT8C4q-PpvIKJR3mvsjdFCdkTayOzpJMx6_T8oIts3ARSp8CgHUZJD8fyLrWH94mWpY_gTuP92BLLMtnM9AHYt1nlO5rkp5kJfqv5piC9raBeSe9JY5tUMgrSz37koZbMQFXHTmhLcAqMAJlUxb-2youuUXjxIYaR6ezWKVZLa_Hr1nBvOpfJu2GDzpofAlEAUKVNJRCbRvLRtXGoDTUIi8x2Lpb0Ho_bMy4OKpwgkaZKTCOOMhM' }
    ],
    descricao: 'Headphone over-ear sem fio com isolamento acústico híbrido ativo (ANC), almofadas com espuma viscoelástica macia e autonomia estendida para até 30 horas de reprodução com uma única carga.',
    tipoOpcoes: 'acessorio',
    opcoesCores: [
      { nome: 'Branco Estelar', corHex: '#F2F2F4', estoque: 15 },
      { nome: 'Grafite Espacial', corHex: '#2B2B2D', estoque: 10 }
    ],
    notaAlimentacao: 'Carregamento via USB-C. Cabo incluso na embalagem.',
    especificacoes: [
      { rotulo: 'Conectividade', valor: 'Bluetooth 5.3 + P2 3.5mm' },
      { rotulo: 'Drivers', valor: '40 mm de neodímio dinâmicos' },
      { rotulo: 'Autonomia', valor: 'Até 30h com ANC ativo' }
    ]
  },
  {
    id: 'carregador-usb-c-30w',
    nome: 'Carregador USB-C — 30 W',
    categoria: 'Acessórios',
    subtitulo: 'Power Delivery & Bivolt GaN',
    precoBaseCentavos: 8900,
    precoCentavos: 8900,
    destaque: 'GaN 30W',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6zhwN2H_823KTuK8OVxfUsuZnRp7veFXXPMF_Y9V_bCm6T7xhHo1Gr8aOJOA7kV5P7X9QrRgKSCi540ks-bqGLqShEReTFOsCm1uCwOouUoh8g5dIFRCQ-4FN8qCryaMY8nkXtHEMmP9nX2Vfdlnv_l59BTQtxrqjawV134DqBfSYv3Se8o73kEl08teIypbbRMqGnNTtTbdX_yB6uWJoq9dvO2XFKGcUs0am9eY6SlhGn32JP1mt',
    galeria: [
      { titulo: 'Carregador GaN', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD6zhwN2H_823KTuK8OVxfUsuZnRp7veFXXPMF_Y9V_bCm6T7xhHo1Gr8aOJOA7kV5P7X9QrRgKSCi540ks-bqGLqShEReTFOsCm1uCwOouUoh8g5dIFRCQ-4FN8qCryaMY8nkXtHEMmP9nX2Vfdlnv_l59BTQtxrqjawV134DqBfSYv3Se8o73kEl08teIypbbRMqGnNTtTbdX_yB6uWJoq9dvO2XFKGcUs0am9eY6SlhGn32JP1mt' }
    ],
    descricao: 'Adaptador de tomada ultracompacto construído com semicondutores de Nitreto de Gálio (GaN). Fornece até 30 W de entrega rápida de energia com baixa dissipação térmica para celulares, fones e tablets.',
    tipoOpcoes: 'acessorio',
    opcoesCores: [
      { nome: 'Branco Neve', corHex: '#F6F6F8', estoque: 18 },
      { nome: 'Preto Matte', corHex: '#1F1F21', estoque: 12 }
    ],
    notaAlimentacao: 'Bivolt Automático (100V - 240V). Certificado para segurança elétrica.',
    especificacoes: [
      { rotulo: 'Potência Máxima', valor: '30 W' },
      { rotulo: 'Protocolos', valor: 'USB PD 3.0, PPS, QC 4+' },
      { rotulo: 'Porta', valor: '1x USB-C fêmea' }
    ]
  },
  {
    id: 'mouse-sem-fio',
    nome: 'Mouse sem fio',
    categoria: 'Acessórios',
    subtitulo: 'Sensor Óptico 4000 DPI Silencioso',
    precoBaseCentavos: 7900,
    precoCentavos: 7900,
    destaque: '4000 DPI',
    imagem: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdRyM7-8-ZU_2L1osjOrzkCjAT25N6IAyAYaZlQCETyrvq_fVCY1tyJGOXvwm-a26kAAPxNlaZJH180Fjbu8CnjIW0kLh3cxuP8i9LcvEuRxY9aACpDScKcAPiaBK0vBMFG6mLGSaz-C4DXsvF5LIwcuuTr2WFmGBaoFPIntoDB8I4myu1gYK7Njl-Zu-Iv2cbXF0B2WnQZ86VyxJUfJQ2azY86ZyDCfv_cAgybdfLjmFQW2kWKk35',
    galeria: [
      { titulo: 'Mouse Sem Fio', url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDdRyM7-8-ZU_2L1osjOrzkCjAT25N6IAyAYaZlQCETyrvq_fVCY1tyJGOXvwm-a26kAAPxNlaZJH180Fjbu8CnjIW0kLh3cxuP8i9LcvEuRxY9aACpDScKcAPiaBK0vBMFG6mLGSaz-C4DXsvF5LIwcuuTr2WFmGBaoFPIntoDB8I4myu1gYK7Njl-Zu-Iv2cbXF0B2WnQZ86VyxJUfJQ2azY86ZyDCfv_cAgybdfLjmFQW2kWKk35' }
    ],
    descricao: 'Mouse ergonômico ambidestro de perfil baixo com cliques silenciosos e roda de rolagem usinada em alumínio. Conexão híbrida sem fio compatível com múltiplos dispositivos.',
    tipoOpcoes: 'acessorio',
    opcoesCores: [
      { nome: 'Cinza Platina', corHex: '#D5D5DB', estoque: 14 },
      { nome: 'Preto Grafite', corHex: '#212124', estoque: 8 }
    ],
    notaAlimentacao: 'Funciona com 1 pilha AA (inclusa). Autonomia estimada em até 18 meses.',
    especificacoes: [
      { rotulo: 'Sensor', valor: 'Óptico de alta precisão (1000 a 4000 DPI)' },
      { rotulo: 'Conexão', valor: 'Bluetooth Low Energy + Receptor USB 2.4 GHz' },
      { rotulo: 'Peso', valor: '82 g' }
    ]
  }
];

export const CATEGORIAS = [
  { id: 'all', nome: 'Todos', subtitulo: 'Catálogo completo', icone: 'grid_view' },
  { id: 'Celulares', nome: 'Celulares', subtitulo: 'Dispositivos móveis', icone: 'smartphone' },
  { id: 'Informática', nome: 'Informática', subtitulo: 'Hardware & Desempenho', icone: 'memory' },
  { id: 'Eletrodomésticos', nome: 'Eletrodomésticos', subtitulo: 'Casa e praticidade', icone: 'kitchen' },
  { id: 'Acessórios', nome: 'Acessórios', subtitulo: 'Cabos, áudio e periféricos', icone: 'headphones' }
];

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

export function obterTodosProdutos() {
  return JSON.parse(JSON.stringify(PRODUTOS));
}

export function obterProdutoPorId(id) {
  const produto = PRODUTOS.find(p => p.id === id);
  return produto ? JSON.parse(JSON.stringify(produto)) : null;
}

export function buscarProdutos({ termo = '', categoria = 'all' } = {}) {
  const normalizar = (txt) => (txt || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const termoNormalizado = normalizar(termo);

  return PRODUTOS.filter(produto => {
    const atendeCategoria = categoria === 'all' || !categoria
      ? true
      : normalizar(produto.categoria) === normalizar(categoria);

    if (!atendeCategoria) return false;

    if (!termoNormalizado) return true;

    const textoCompleto = normalizar(`
      ${produto.nome}
      ${produto.categoria}
      ${produto.subtitulo}
      ${produto.descricao}
      ${produto.destaque}
    `);

    return textoCompleto.includes(termoNormalizado);
  });
}

/**
 * Normaliza strings para chaves estáveis
 */
export function normalizarChave(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Gera identificador estável e canônico para a variante de um produto
 */
export function gerarVarianteId(produtoId, cor = null, opcao = null) {
  const partes = [normalizarChave(produtoId)];
  if (cor) partes.push(normalizarChave(cor));
  if (opcao) partes.push(normalizarChave(opcao));
  return partes.join('--');
}

/**
 * Centraliza a validação e resolução de variantes, preços e estoque da loja.
 * REGRA CENTRALIZADA:
 * - Valida a existência do produto no catálogo.
 * - Valida e normaliza cor e opção contra as listas permitidas do produto.
 * - PRESERVA ESTOQUE ZERO (nunca usa fallback padrão quando o estoque for 0).
 * - Calcula o preço unitário canônico (preço base + acréscimo da opção).
 * - Gera o identificador único canônico (varianteId).
 *
 * @param {string|object} produtoOuId - Objeto produto ou ID string
 * @param {object} selecao - { cor, opcao, varianteId }
 * @returns {object} Resultado autoritativo da variante
 */
export function resolverVariante(produtoOuId, { cor = null, opcao = null, varianteId = null } = {}) {
  const produto = typeof produtoOuId === 'string'
    ? obterProdutoPorId(produtoOuId)
    : produtoOuId;

  if (!produto || !produto.id) {
    return {
      valido: false,
      erro: 'Produto não encontrado no catálogo',
      estoque: 0,
      disponivel: false
    };
  }

  // 1. Validação e resolução de COR
  let corObj = null;
  if (produto.opcoesCores && produto.opcoesCores.length > 0) {
    if (cor) {
      const corNorm = normalizarChave(cor);
      corObj = produto.opcoesCores.find(c => normalizarChave(c.nome) === corNorm) || null;
      if (!corObj) {
        return {
          valido: false,
          erro: `Cor "${cor}" inválida para o produto "${produto.nome}"`,
          estoque: 0,
          disponivel: false
        };
      }
    } else {
      // Se não especificada, usa a primeira cor padrão
      corObj = produto.opcoesCores[0];
    }
  }

  // 2. Validação e resolução de OPÇÃO (Capacidade / Hardware / Voltagem)
  let optObj = null;
  const listaOpcoes = produto.opcoesCapacidades || produto.opcoesHardware || produto.opcoesVoltagem || null;

  if (listaOpcoes && listaOpcoes.length > 0) {
    if (opcao) {
      const optNorm = normalizarChave(opcao);
      optObj = listaOpcoes.find(o => normalizarChave(o.valor) === optNorm) || null;
      if (!optObj) {
        return {
          valido: false,
          erro: `Opção "${opcao}" inválida para o produto "${produto.nome}"`,
          estoque: 0,
          disponivel: false
        };
      }
    } else {
      // Se não especificada, usa a primeira opção padrão
      optObj = listaOpcoes[0];
    }
  }

  // 3. Resolução de ESTOQUE com preservação estrita de ZERO
  let estoque = 0;
  if (optObj && typeof optObj.estoque === 'number') {
    estoque = optObj.estoque;
  } else if (corObj && typeof corObj.estoque === 'number') {
    estoque = corObj.estoque;
  } else if (typeof produto.estoque === 'number') {
    estoque = produto.estoque;
  } else {
    estoque = 0; // Default seguro zero
  }

  // 4. Resolução de PREÇO em centavos
  const precoBase = produto.precoBaseCentavos || produto.precoCentavos || 0;
  const acrescimo = (optObj && typeof optObj.acrescimoCentavos === 'number') ? optObj.acrescimoCentavos : 0;
  const precoUnitarioCentavos = precoBase + acrescimo;

  // 5. Geração e validação do varianteId canônico
  const corNome = corObj ? corObj.nome : null;
  const opcaoValor = optObj ? optObj.valor : null;
  const canonicalVarianteId = gerarVarianteId(produto.id, corNome, opcaoValor);

  // Rótulo textual da variante para exibição
  const partesRotulo = [];
  if (corNome) partesRotulo.push(corNome);
  if (opcaoValor) partesRotulo.push(opcaoValor);
  const rotuloVariante = partesRotulo.join(' • ');

  return {
    valido: true,
    produtoId: produto.id,
    varianteId: canonicalVarianteId,
    nome: produto.nome,
    categoria: produto.categoria,
    imagem: produto.imagem,
    cor: corNome,
    corHex: corObj ? corObj.corHex : null,
    opcao: opcaoValor,
    rotuloVariante: rotuloVariante,
    precoBaseCentavos: precoBase,
    acrescimoCentavos: acrescimo,
    precoUnitarioCentavos: precoUnitarioCentavos,
    estoque: estoque,
    disponivel: estoque > 0
  };
}
