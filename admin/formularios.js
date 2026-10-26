// Formulários do painel, montados a partir de descritores.
// Cada campo aponta para um caminho dentro do documento JSON (ex.: ['capa', 'alt']).
// Os valores são gravados no próprio objeto do documento a cada digitação.

import { ENCAIXES_CAPA, LAYOUTS_GALERIA, MOLDURAS } from './validacao.js';
import { NOMES_MOLDURA, editorEnquadramento } from './enquadramento.js';
import { ACEITA } from './midia.js';

// ---------- DOM ----------

export function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave.startsWith('on')) el.addEventListener(chave.slice(2), valor);
    else if (chave === 'class') el.className = valor;
    else if (chave === 'value' || chave === 'checked') el[chave] = valor;
    else el.setAttribute(chave, valor === true ? '' : String(valor));
  }
  for (const filho of filhos.flat(Infinity)) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : String(filho));
  }
  return el;
}

// ---------- Caminhos ----------

// Mesmo formato das mensagens de src/validacao.js: "blocos[2].imagens[0].alt".
export function formatarCaminho(caminho) {
  return caminho.reduce((saida, chave) => (typeof chave === 'number' ? `${saida}[${chave}]` : saida ? `${saida}.${chave}` : chave), '');
}

function ler(objeto, caminho) {
  return caminho.reduce((atual, chave) => (atual === undefined || atual === null ? undefined : atual[chave]), objeto);
}

function vazio(valor) {
  return valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0);
}

// Grava o valor. Campo opcional vazio é removido; objeto opcional que fica vazio também.
function escrever(objeto, caminho, valor, { opcional = false, podar = null } = {}) {
  let pai = objeto;
  for (const [n, chave] of caminho.slice(0, -1).entries()) {
    if (pai[chave] === undefined || pai[chave] === null) {
      if (opcional && vazio(valor)) return;
      pai[chave] = typeof caminho[n + 1] === 'number' ? [] : {};
    }
    pai = pai[chave];
  }
  const chave = caminho.at(-1);
  if (opcional && vazio(valor)) delete pai[chave];
  else pai[chave] = valor;

  if (podar) {
    const grupo = ler(objeto, podar);
    if (grupo && Object.values(grupo).every(vazio)) delete ler(objeto, podar.slice(0, -1))[podar.at(-1)];
  }
}

function mover(lista, de, para) {
  const [item] = lista.splice(de, 1);
  lista.splice(para, 0, item);
}

// ---------- Modo tradução ----------
// Com ctx.original, o formulário edita a tradução (ctx.doc) de um documento do idioma principal
// (ctx.original, só leitura): listas, blocos e grupos seguem o original, só os textos traduzíveis
// (ctx.traduzivel(caminho)) viram campos, e cada um mostra o texto original como referência.

const emTraducao = (ctx) => ctx.original !== undefined;

// Documento que define a estrutura (quais itens e blocos existem).
const estrutura = (ctx) => (emTraducao(ctx) ? ctx.original : ctx.doc);

function textoOriginal(ctx, caminho, id) {
  const valor = ler(ctx.original, caminho);
  const texto = Array.isArray(valor) ? valor.join('\n') : valor;
  if (typeof texto !== 'string' || texto.trim() === '') return null;
  return h('div', { class: 'campo__original', id },
    h('span', { class: 'campo__original-rotulo' }, 'Original: '),
    h('span', { lang: ctx.idiomaOriginal ?? null }, texto));
}

// No idioma principal, mover ou remover itens de uma lista faz o mesmo nas traduções,
// para cada tradução continuar no item certo.
function espelhar(ctx, caminho, operacao) {
  if (!emTraducao(ctx)) ctx.espelhar?.(caminho, operacao);
}

// ---------- Descritores ----------

const texto = (k, r, extra = {}) => ({ t: 'texto', k, r, ...extra });
const area = (k, r, extra = {}) => ({ t: 'area', k, r, ...extra });
const md = (k, r, extra = {}) => ({ t: 'markdown', k, r, ...extra });
const leitura = (k, r, extra = {}) => ({ t: 'leitura', k, r, ...extra });

const AJUDA_MARKDOWN = 'Markdown: **negrito**, *itálico*, `código`, [texto](https://…), "### " para título, "- " ou "1. " para listas. Linha em branco separa parágrafos.';
const AJUDA_ALT = 'Descreva a imagem para quem usa leitor de tela.';

// Campo de arquivo. formato 'objeto' grava { src, largura, altura } no caminho; 'caminho' grava só o texto.
const midia = (k, r, aceita, extra = {}) => ({ t: 'midia', k, r, aceita, formato: 'objeto', ...extra });

const IMAGEM_DE_LISTA = [
  midia([], 'Arquivo', 'imagem'),
  texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT }),
  { t: 'enquadramento' },
];

const listaImagens = (k, r, extra = {}) => ({
  t: 'lista', k, r, rotuloItem: (_, i) => `Imagem ${i + 1}`, adicionarArquivos: 'imagem', item: IMAGEM_DE_LISTA, ...extra,
});

const ROTULOS_INTERFACE = {
  geral: {
    _titulo: 'Geral',
    navegacaoPrincipal: 'Nome do menu principal (lido por leitores de tela)',
    paginaInicial: 'Botão "Página inicial" (404)',
    verProjetos: 'Botão "Ver projetos"',
    temaEscuro: 'Botão de modo escuro',
    idiomas: 'Nome do seletor de idioma (lido por leitores de tela)',
  },
  projeto: {
    _titulo: 'Página de projeto',
    voltarProjetos: 'Botão de voltar',
    galeriaTopo: 'Nome do carrossel do topo (lido por leitores de tela)',
    fichaTecnica: 'Título da ficha técnica',
    tecnologia: 'Ficha: tecnologia',
    linguagem: 'Ficha: linguagem',
    plataformas: 'Ficha: plataformas',
    ano: 'Ficha: ano',
    papel: 'Ficha: papel',
    links: 'Título da caixa de links',
    video: 'Nome do vídeo incorporado sem legenda',
    jogarOnline: 'Botão "Jogar online"',
    abreEm: 'Texto ao lado do botão de jogar',
    proximoProjeto: 'Link para o próximo projeto',
    imagemAnterior: 'Carrossel: botão de imagem anterior (lido por leitores de tela)',
    proximaImagem: 'Carrossel: botão de próxima imagem (lido por leitores de tela)',
    contadorImagens: 'Carrossel: contador de imagens',
  },
  sobre: {
    _titulo: 'Sobre',
    tecnologias: 'Título "Tecnologias"',
    experiencia: 'Título "Experiência"',
    baixarCurriculo: 'Botão do currículo',
  },
  contato: {
    _titulo: 'Contato',
    escreverEmail: 'Botão de e-mail',
    email: 'Cartão: e-mail',
    telefone: 'Cartão: telefone',
    linkedin: 'Cartão: LinkedIn',
    github: 'Cartão: GitHub',
  },
};

const AJUDA_ROTULOS = {
  abreEm: '{onde} vira o nome do site, ex.: "Abre em {onde}".',
  contadorImagens: '{atual} vira o número da imagem e {total} a quantidade, ex.: "{atual} / {total}".',
};

const rotulosInterface = () => ({
  t: 'secao',
  r: 'Rótulos da interface',
  ajuda: 'Textos fixos que aparecem nas páginas. Setas e ícones são acrescentados pelo site.',
  campos: Object.entries(ROTULOS_INTERFACE).map(([grupo, { _titulo, ...chaves }]) => ({
    t: 'grupo',
    k: ['rotulos', grupo],
    r: _titulo,
    campos: Object.entries(chaves).map(([k, r]) => texto(k, r, AJUDA_ROTULOS[k] ? { ajuda: AJUDA_ROTULOS[k] } : {})),
  })),
});

export const DESCRITORES = {
  site: [
    { t: 'secao', r: 'Site', campos: [
      texto('titulo', 'Título do site'),
      area('descricao', 'Descrição (buscadores e compartilhamento)'),
      texto('url', 'Endereço do site', { tipoInput: 'url', ajuda: 'Começa com https://. Usado no canonical, no sitemap e no compartilhamento.' }),
      texto('idioma', 'Idioma', { ajuda: 'Ex.: pt-BR' }),
    ] },
    { t: 'secao', r: 'Prévia de links', seExiste: 'imagem', ajuda: 'Imagem que aparece ao compartilhar o site (LinkedIn, WhatsApp…). Para trocar, substitua o arquivo em content/midia/ por outro PNG ou JPG de 1200 × 630: o painel converte envios para WebP, que nem todas as redes aceitam.', campos: [
      { t: 'grupo', k: 'imagem', campos: [
        leitura('src', 'Arquivo'),
        texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT }),
      ] },
    ] },
    { t: 'secao', r: 'Repositório', ajuda: 'Onde o painel lê e grava o conteúdo. Mude só se mover o repositório.', campos: [
      { t: 'grupo', k: 'repositorio', campos: [texto('dono', 'Dono'), texto('nome', 'Nome'), texto('branch', 'Branch')] },
    ] },
    { t: 'secao', r: 'Navegação', campos: [
      { t: 'lista', k: 'navegacao', fixa: true, rotuloItem: (item) => item.caminho, item: [texto('rotulo', 'Rótulo')] },
    ] },
    { t: 'secao', r: 'Rodapé', campos: [
      { t: 'grupo', k: 'rodape', campos: [
        texto('texto', 'Texto do rodapé'),
        { t: 'lista', k: 'links', r: 'Links do rodapé', rotuloItem: (item, i) => item.rotulo || `Link ${i + 1}`, novo: () => ({ rotulo: '', url: '' }), item: [
          texto('rotulo', 'Rótulo'), texto('url', 'Endereço', { ajuda: 'https://…, mailto:… ou tel:…' }),
        ] },
      ] },
    ] },
    rotulosInterface(),
  ],

  home: [
    { t: 'secao', r: 'Abertura', campos: [
      texto('nome', 'Nome'),
      texto('especialidades', 'Linha de especialidades'),
      area('apresentacao', 'Apresentação'),
    ] },
    { t: 'secao', r: 'Projetos e rodapé', campos: [
      texto('tituloProjetos', 'Título da seção de projetos'),
      texto('chamadaRodape', 'Chamada do rodapé'),
    ] },
  ],

  sobre: [
    { t: 'secao', r: 'Apresentação', campos: [
      texto('titulo', 'Título da página'),
      area('destaque', 'Destaque (frase grande)'),
      md('texto', 'Texto', { linhas: 10, ajuda: AJUDA_MARKDOWN }),
    ] },
    { t: 'secao', r: 'Foto', campos: [
      midia('foto', 'Arquivo da foto', 'imagem', { removivel: true }),
      { t: 'grupo', k: 'foto', campos: [
        texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT }),
        texto('legenda', 'Legenda', { opc: true }),
      ] },
    ] },
    { t: 'secao', r: 'Tecnologias', campos: [
      { t: 'lista', k: 'tecnologias', rotuloItem: (item, i) => item.grupo || `Grupo ${i + 1}`, novo: () => ({ grupo: '', itens: [] }), item: [
        texto('grupo', 'Grupo'),
        { t: 'linhas', k: 'itens', r: 'Itens', ajuda: 'Um por linha.' },
      ] },
    ] },
    { t: 'secao', r: 'Experiência', campos: [
      { t: 'lista', k: 'experiencia', rotuloItem: (item, i) => item.cargo || `Experiência ${i + 1}`, novo: () => ({ periodo: '', cargo: '', empresa: '', resumo: '' }), item: [
        texto('periodo', 'Período'), texto('cargo', 'Cargo'), texto('empresa', 'Empresa'), area('resumo', 'Resumo', { linhas: 2 }),
      ] },
    ] },
    { t: 'secao', r: 'Currículo', campos: [midia('curriculo', 'Arquivo PDF', 'pdf', { formato: 'caminho', removivel: true })] },
  ],

  contato: [
    { t: 'secao', r: 'Contato', campos: [
      texto('titulo', 'Título da página'),
      area('frase', 'Frase'),
      texto('email', 'E-mail', { tipoInput: 'email' }),
      texto('assuntoEmail', 'Assunto do e-mail', { ajuda: 'Já vem preenchido quando o visitante clica em "Escrever um e-mail".' }),
      texto('telefone', 'Telefone', { opc: true, tipoInput: 'tel' }),
      texto('linkedin', 'LinkedIn', { opc: true, tipoInput: 'url' }),
      texto('github', 'GitHub', { opc: true, tipoInput: 'url' }),
    ] },
  ],

  erro404: [
    { t: 'secao', r: 'Página 404', campos: [texto('codigo', 'Número'), texto('titulo', 'Título'), area('texto', 'Texto')] },
  ],

  projeto: (slug, { categorias = [] } = {}) => [
    { t: 'secao', r: '1 · Informações', campos: [
      texto('titulo', 'Título'),
      texto('subtitulo', 'Subtítulo'),
      texto('categoria', 'Categoria (texto da faixa amarela)', { sugestoes: categorias, ajuda: 'Livre. Até 16 caracteres cabem bem na faixa.' }),
      { t: 'booleano', k: 'ocultarFaixa', r: 'Esconder a faixa amarela', opc: true },
      texto('ano', 'Ano ou período', { ajuda: 'Um ano ("2026") ou um período ("2022-2026").' }),
      texto('stack', 'Stack', { ajuda: 'Aparece na lombada, ex.: "C# · ASP.NET Core".' }),
      { t: 'numero', k: 'ordem', r: 'Ordem na home', ajuda: 'Menor aparece primeiro.' },
      { t: 'booleano', k: 'publicado', r: 'Publicado (aparece no site)' },
      { t: 'leitura', r: 'Endereço da página', valor: `/projetos/${slug}/` },
    ] },
    { t: 'secao', r: '2 · Capa na home', campos: [
      { t: 'grupo', k: 'capa', campos: [
        midia([], 'Imagem da capa', 'imagem', { ajuda: 'JPG, PNG, WebP ou AVIF: convertida para WebP com até 2000 px. GIF é mantido.' }),
        texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT }),
        midia('previa', 'Prévia em movimento', 'previa', { removivel: true, ajuda: 'Opcional. MP4 ou WebM curto, sem som, até 7,5 MB.' }),
        { t: 'escolha', k: 'encaixe', r: 'Encaixe na capa', padrao: 'cobrir', ajuda: 'Vale para a imagem e para a prévia. "Conter" é melhor para logos e imagens que não podem ser cortadas.', opcoes: ENCAIXES_CAPA.map((e) => [e, { cobrir: 'Cobrir (preenche e corta)', conter: 'Conter (inteira, sem corte)' }[e]]) },
        { t: 'escolha', k: 'moldura', r: 'Moldura da capa', padrao: 'nenhuma', ajuda: 'Na cor do site. Com "Cobrir", contorna a janela da imagem; com "Conter", a própria imagem.', opcoes: [['nenhuma', 'Nenhuma'], ...MOLDURAS.map((m) => [m, NOMES_MOLDURA[m]])] },
      ] },
    ] },
    { t: 'secao', r: 'Galeria do topo', ajuda: 'Opcional. Imagens acima do título.', campos: [listaImagens('galeriaTopo', null, { opc: true })] },
    { t: 'secao', r: '3 · Conteúdo da página', ajuda: 'Reordene com ↑ e ↓ ou arrastando pela alça ⋮⋮.', campos: [{ t: 'blocos', k: 'blocos' }] },
    { t: 'secao', r: '4 · Ficha técnica e links', campos: [
      { t: 'grupo', k: 'ficha', r: 'Ficha técnica', campos: [
        texto('tecnologia', 'Tecnologia', { opc: true }),
        texto('linguagem', 'Linguagem', { opc: true }),
        texto('plataformas', 'Plataformas', { opc: true }),
        texto('papel', 'Seu papel', { opc: true }),
      ] },
      { t: 'grupo', k: 'jogar', r: 'Jogar online', opc: true, campos: [
        texto('url', 'Link para jogar', { opc: true, tipoInput: 'url', ajuda: 'Opcional. Preenchido, aparece o botão "Jogar online".' }),
        texto('onde', 'Onde está hospedado', { opc: true, ajuda: 'Aparece ao lado do botão, ex.: itch.io' }),
      ] },
      { t: 'lista', k: 'links', r: 'Links', ajuda: 'O primeiro aparece em destaque.', rotuloItem: (item, i) => item.rotulo || `Link ${i + 1}`, novo: () => ({ rotulo: '', url: '' }), item: [
        texto('rotulo', 'Rótulo'), texto('url', 'Endereço', { tipoInput: 'url' }),
      ] },
    ] },
  ],
};

const NOMES_BLOCO = { texto: 'Texto', galeria: 'Imagem ou galeria', video: 'Vídeo', codigo: 'Código', citacao: 'Citação' };

function camposDoBloco(bloco) {
  switch (bloco.tipo) {
    case 'texto':
      return [md('markdown', 'Texto do bloco', { linhas: 8, ajuda: AJUDA_MARKDOWN })];
    case 'galeria':
      return [
        { t: 'escolha', k: 'layout', r: 'Layout', estrutura: true, opcoes: LAYOUTS_GALERIA.map((l) => [l, { duas: 'Duas por linha', grande: 'Uma grande', carrossel: 'Carrossel' }[l]]) },
        listaImagens('imagens', 'Imagens'),
        texto('legenda', 'Legenda', { opc: true }),
      ];
    case 'video':
      return bloco.origem === 'link'
        ? [texto('url', 'Link do YouTube ou Vimeo', { tipoInput: 'url' }), texto('legenda', 'Legenda', { opc: true })]
        : [
          midia([], 'Arquivo de vídeo', 'video', { ajuda: 'MP4 ou WebM, até 25 MB. Maior que isso, use um bloco de vídeo por link.' }),
          { t: 'booleano', k: 'loop', r: 'Repetir em loop' },
          { t: 'booleano', k: 'mudo', r: 'Começar sem som' },
          { t: 'booleano', k: 'autoplay', r: 'Tocar sozinho (exige sem som)' },
          texto('legenda', 'Legenda', { opc: true }),
        ];
    case 'codigo':
      return [texto('linguagem', 'Linguagem', { ajuda: 'Uma palavra, ex.: csharp' }), { t: 'codigo', k: 'codigo', r: 'Código', linhas: 8 }];
    case 'citacao':
      return [area('texto', 'Citação'), texto('autor', 'Autor', { opc: true })];
    default:
      return [];
  }
}

// ---------- Montagem ----------

let contadorIds = 0;

function idPara(caminho) {
  contadorIds += 1;
  return `campo-${formatarCaminho(caminho).replace(/[^\w-]/g, '_') || 'raiz'}-${contadorIds}`;
}

// Lugar da mensagem de validação. "apelidos" recebe mensagens de outros caminhos;
// com "unico", só a primeira mensagem aparece.
function mensagemCampo(campo, { apelidos = [], unico = false } = {}) {
  return h('p', {
    class: 'campo__mensagem',
    id: idPara(['msg']),
    'data-mensagem': campo,
    'data-apelidos': apelidos.length ? apelidos.join(' ') : null,
    'data-unico': unico ? 'sim' : null,
    hidden: true,
  });
}

function entrada(d, ctx, caminho) {
  if (emTraducao(ctx) && !ctx.traduzivel(caminho)) return null;
  const id = idPara(caminho);
  const valor = ler(ctx.doc, caminho);
  const ajuda = emTraducao(ctx)
    ? textoOriginal(ctx, caminho, `${id}-ajuda`)
    : d.ajuda ? h('p', { class: 'campo__ajuda', id: `${id}-ajuda` }, d.ajuda) : null;
  const mensagem = mensagemCampo(formatarCaminho(caminho));
  const descritoPor = [ajuda && `${id}-ajuda`, mensagem.id].filter(Boolean).join(' ');
  const multilinha = ['area', 'markdown', 'codigo', 'linhas'].includes(d.t);

  const controle = multilinha
    ? h('textarea', {
      id,
      rows: d.linhas ?? (d.t === 'linhas' ? 4 : 3),
      class: d.t === 'codigo' ? 'campo__codigo' : null,
      spellcheck: d.t === 'codigo' ? 'false' : null,
      value: d.t === 'linhas' ? (valor ?? []).join('\n') : (valor ?? ''),
    })
    : h('input', {
      id,
      type: d.t === 'numero' ? 'number' : (d.tipoInput ?? 'text'),
      step: d.t === 'numero' ? '1' : null,
      inputmode: d.inputmode,
      value: valor ?? '',
      autocomplete: 'off',
    });
  controle.setAttribute('aria-describedby', descritoPor);
  controle.dataset.campo = formatarCaminho(caminho);
  const sugestoes = d.sugestoes?.length ? h('datalist', { id: `${id}-sugestoes` }, d.sugestoes.map((s) => h('option', { value: s }))) : null;
  if (sugestoes) controle.setAttribute('list', sugestoes.id);

  controle.addEventListener('input', () => {
    let novo = controle.value;
    if (d.t === 'numero') novo = novo === '' ? undefined : Number(novo);
    if (d.t === 'linhas') novo = novo.split('\n').map((l) => l.trim()).filter(Boolean);
    escrever(ctx.doc, caminho, novo, { opcional: d.opc || emTraducao(ctx), podar: ctx.podar });
    ctx.aoMudar();
  });

  return h('div', { class: 'campo' },
    h('label', { for: id, class: 'campo__rotulo' }, d.r, d.opc && !emTraducao(ctx) ? h('span', { class: 'campo__opcional' }, ' (opcional)') : null),
    ajuda,
    controle,
    sugestoes,
    mensagem);
}

function caixaMarcar(d, ctx, caminho) {
  const id = idPara(caminho);
  const mensagem = mensagemCampo(formatarCaminho(caminho));
  const controle = h('input', { id, type: 'checkbox', checked: ler(ctx.doc, caminho) === true, 'aria-describedby': mensagem.id });
  controle.dataset.campo = formatarCaminho(caminho);
  controle.addEventListener('change', () => {
    escrever(ctx.doc, caminho, d.opc && !controle.checked ? undefined : controle.checked, { opcional: d.opc });
    ctx.aoMudar();
  });
  return h('div', { class: 'campo campo--marcar' }, h('label', { for: id }, controle, ' ', d.r), mensagem);
}

// Com "padrao", o campo é opcional: ausente vale o padrão, e escolher o padrão remove o campo.
function escolha(d, ctx, caminho) {
  const id = idPara(caminho);
  const atual = ler(ctx.doc, caminho) ?? d.padrao;
  const mensagem = mensagemCampo(formatarCaminho(caminho));
  const ajuda = d.ajuda ? h('p', { class: 'campo__ajuda', id: `${id}-ajuda` }, d.ajuda) : null;
  const opcoes = d.opcoes.map(([valor, rotulo]) => h('option', { value: valor }, rotulo));
  if (!d.opcoes.some(([valor]) => valor === atual)) opcoes.unshift(h('option', { value: atual ?? '' }, `${atual ?? ''} (inválido)`));
  const controle = h('select', { id, 'aria-describedby': [ajuda && `${id}-ajuda`, mensagem.id].filter(Boolean).join(' ') }, opcoes);
  controle.value = atual ?? '';
  controle.dataset.campo = formatarCaminho(caminho);
  // Com "estrutura", o formulário é remontado (ex.: o layout muda o editor de enquadramento).
  if (d.estrutura) controle.dataset.acao = formatarCaminho(caminho);
  controle.addEventListener('change', () => {
    const padrao = d.padrao !== undefined && controle.value === d.padrao;
    escrever(ctx.doc, caminho, padrao ? undefined : controle.value, { opcional: d.padrao !== undefined });
    if (d.estrutura) ctx.aoEstrutura({ foco: controle.dataset.acao });
    else ctx.aoMudar();
  });
  return h('div', { class: 'campo' }, h('label', { for: id, class: 'campo__rotulo' }, d.r), ajuda, controle, mensagem);
}

// Imagem de galeria: caminho é ['galeriaTopo', i] ou ['blocos', b, 'imagens', i].
function enquadramento(ctx, caminho) {
  const imagem = ler(ctx.doc, caminho);
  if (!imagem || !ctx.urlImagem) return null;
  // 'carrossel' e 'duas' têm largura própria; 'livre' é a imagem sozinha na linha (aceita posição).
  let layout = 'livre';
  if (caminho[0] === 'galeriaTopo') {
    if ((ler(ctx.doc, ['galeriaTopo'])?.length ?? 0) > 1) layout = 'carrossel';
  } else {
    const doBloco = ler(ctx.doc, caminho.slice(0, -2))?.layout;
    if (doBloco === 'carrossel' || doBloco === 'duas') layout = doBloco;
  }
  const campo = formatarCaminho(caminho);
  const subcampos = ['escala', 'alinhamento', 'recorte', 'foco', 'foco.x', 'foco.y', 'moldura'].map((k) => `${campo}.${k}`);
  return editorEnquadramento({
    imagem,
    layout,
    campo,
    mensagem: mensagemCampo(subcampos[0], { apelidos: subcampos.slice(1) }),
    urlImagem: ctx.urlImagem,
    aoMudar: ctx.aoMudar,
  });
}

function campoLeitura(d, ctx, caminho) {
  const valor = d.valor ?? ler(ctx.doc, caminho);
  if (valor === undefined || valor === null || valor === '') return null;
  return h('div', { class: 'campo campo--leitura' },
    h('span', { class: 'campo__rotulo' }, d.r),
    h('code', { class: 'campo__valor' }, String(valor)),
    mensagemCampo(formatarCaminho(caminho)));
}

function botaoIcone(rotulo, simbolo, aoClicar, desativado = false) {
  return h('button', { type: 'button', class: 'botao-icone', 'aria-label': rotulo, title: rotulo, disabled: desativado, onclick: aoClicar }, h('span', { 'aria-hidden': 'true' }, simbolo));
}

// Botão de envio: um <input type="file"> visível como botão, acessível pelo teclado.
function botaoArquivo(rotulo, aceita, multiplo, aoEscolher, extra = {}) {
  const id = idPara(['arquivo']);
  const entradaArquivo = h('input', {
    id,
    type: 'file',
    class: 'arquivo__entrada',
    accept: ACEITA[aceita],
    multiple: multiplo,
    onchange: async (evento) => {
      const arquivos = [...evento.target.files];
      evento.target.value = '';
      if (arquivos.length) await aoEscolher(arquivos);
    },
  });
  return h('span', { class: 'arquivo', ...extra }, entradaArquivo, h('label', { for: id, class: 'botao-painel botao-painel--secundario arquivo__botao' }, rotulo));
}

const NOMES_ACEITA = { imagem: 'imagem', video: 'vídeo', previa: 'vídeo', pdf: 'PDF' };

function campoMidia(d, ctx, caminho) {
  const nome = formatarCaminho(caminho);
  const atual = ler(ctx.doc, caminho);
  const src = d.formato === 'caminho' ? atual : atual?.src;
  const apelidos = d.formato === 'caminho' ? [] : ['src', 'largura', 'altura'].map((k) => (nome ? `${nome}.${k}` : k));
  const mensagem = mensagemCampo(nome, { apelidos, unico: true });

  const enviar = async ([arquivo]) => {
    const resultado = await ctx.enviar(arquivo, d.aceita);
    if (!resultado) return;
    if (d.formato === 'caminho') {
      escrever(ctx.doc, caminho, resultado.src);
    } else {
      for (const k of ['src', 'largura', 'altura']) escrever(ctx.doc, [...caminho, k], resultado[k]);
    }
    ctx.aoEstrutura({ foco: `${nome}:arquivo` });
  };

  const remover = d.removivel && src ? h('button', {
    type: 'button',
    class: 'botao-painel botao-painel--secundario',
    onclick: () => {
      if (!confirm('Remover este arquivo da página? (O arquivo continua no repositório.)')) return;
      escrever(ctx.doc, caminho, undefined, { opcional: true });
      ctx.aoEstrutura({ foco: `${nome}:arquivo` });
    },
  }, 'Remover') : null;

  return h('div', { class: 'campo campo--midia' },
    h('span', { class: 'campo__rotulo' }, d.r, d.removivel ? h('span', { class: 'campo__opcional' }, ' (opcional)') : null),
    d.ajuda ? h('p', { class: 'campo__ajuda' }, d.ajuda) : null,
    h('code', { class: 'campo__valor' }, src || 'Nenhum arquivo'),
    h('span', { class: 'campo__acoes' },
      botaoArquivo(src ? `Trocar ${NOMES_ACEITA[d.aceita]}` : `Enviar ${NOMES_ACEITA[d.aceita]}`, d.aceita, false, enviar, { 'data-acao': `${nome}:arquivo` }),
      remover),
    mensagem);
}

function lista(d, ctx, caminho) {
  const itens = ler(estrutura(ctx), caminho);
  const nomeCampo = formatarCaminho(caminho);
  const traducao = emTraducao(ctx);
  const removerItem = (i) => {
    itens.splice(i, 1);
    espelhar(ctx, caminho, (lista) => lista.splice(i, 1));
    if (d.opc && itens.length === 0) escrever(ctx.doc, caminho, [], { opcional: true });
    ctx.aoEstrutura({ foco: `${nomeCampo}:adicionar` });
  };
  const elementos = (Array.isArray(itens) ? itens : []).map((item, i) => {
    const rotulo = d.rotuloItem ? d.rotuloItem(item, i) : `Item ${i + 1}`;
    const acoes = d.fixa || traducao ? null : h('span', { class: 'item__acoes' },
      botaoIcone(`Mover "${rotulo}" para cima`, '↑', () => { mover(itens, i, i - 1); espelhar(ctx, caminho, (lista) => mover(lista, i, i - 1)); ctx.aoEstrutura({ foco: `${nomeCampo}[${i - 1}]` }); }, i === 0),
      botaoIcone(`Mover "${rotulo}" para baixo`, '↓', () => { mover(itens, i, i + 1); espelhar(ctx, caminho, (lista) => mover(lista, i, i + 1)); ctx.aoEstrutura({ foco: `${nomeCampo}[${i + 1}]` }); }, i === itens.length - 1),
      botaoIcone(`Remover "${rotulo}"`, '✕', () => { if (confirm(`Remover "${rotulo}"?`)) removerItem(i); }));
    const campos = montarCampos(d.item, ctx, [...caminho, i]);
    if (traducao && !campos.length) return null;
    return h('div', { class: 'item', 'data-item': `${nomeCampo}[${i}]` },
      h('div', { class: 'item__topo' }, h('span', { class: 'item__nome' }, rotulo), acoes),
      h('div', { class: 'item__campos' }, campos));
  }).filter(Boolean);
  if (traducao && !elementos.length) return null;

  const garantirLista = () => {
    if (!Array.isArray(ler(ctx.doc, caminho))) escrever(ctx.doc, caminho, []);
    return ler(ctx.doc, caminho);
  };

  let adicionar = null;
  if (traducao) {
    // A tradução segue os itens do original: nada se adiciona aqui.
  } else if (d.adicionarArquivos) {
    adicionar = botaoArquivo('+ Adicionar imagens', d.adicionarArquivos, true, async (arquivos) => {
      let ultimo = null;
      for (const arquivo of arquivos) {
        const resultado = await ctx.enviar(arquivo, d.adicionarArquivos);
        if (!resultado) continue;
        const destino = garantirLista();
        destino.push({ src: resultado.src, alt: '', largura: resultado.largura, altura: resultado.altura });
        ultimo = destino.length - 1;
      }
      if (ultimo !== null) ctx.aoEstrutura({ foco: `${nomeCampo}[${ultimo}]` });
    }, { 'data-acao': `${nomeCampo}:adicionar` });
  } else if (!d.fixa && d.novo) {
    adicionar = h('button', {
      type: 'button',
      class: 'botao-painel botao-painel--secundario',
      'data-acao': `${nomeCampo}:adicionar`,
      onclick: () => {
        const destino = garantirLista();
        destino.push(d.novo());
        ctx.aoEstrutura({ foco: `${nomeCampo}[${destino.length - 1}]` });
      },
    }, `+ Adicionar${d.r ? ` em ${d.r.toLowerCase()}` : ''}`);
  }

  return h('fieldset', { class: 'lista' },
    d.r ? h('legend', { class: 'lista__titulo' }, d.r) : null,
    d.ajuda ? h('p', { class: 'campo__ajuda' }, d.ajuda) : null,
    elementos,
    mensagemCampo(nomeCampo),
    adicionar);
}

const MODELOS_BLOCO = [
  ['Texto', () => ({ tipo: 'texto', markdown: '' })],
  ['Imagem ou galeria', () => ({ tipo: 'galeria', layout: 'duas', imagens: [] })],
  ['Vídeo (arquivo)', () => ({ tipo: 'video', origem: 'arquivo', src: '', loop: true, mudo: true, autoplay: false })],
  ['Vídeo (YouTube ou Vimeo)', () => ({ tipo: 'video', origem: 'link', url: '' })],
  ['Código', () => ({ tipo: 'codigo', linguagem: 'csharp', codigo: '' })],
  ['Citação', () => ({ tipo: 'citacao', texto: '' })],
];

function blocosEditor(d, ctx, caminho) {
  const blocos = ler(estrutura(ctx), caminho) ?? [];
  const nomeCampo = formatarCaminho(caminho);
  let arrastado = null;

  if (emTraducao(ctx)) {
    // Mesma ordem do original; só os blocos com texto para traduzir.
    const itens = blocos.map((bloco, i) => {
      const campos = montarCampos(camposDoBloco(bloco), ctx, [...caminho, i]);
      if (!campos.length) return null;
      const nome = `${NOMES_BLOCO[bloco.tipo] ?? bloco.tipo}${bloco.tipo === 'video' ? (bloco.origem === 'link' ? ' · link' : ' · arquivo') : ''}`;
      return h('div', { class: 'item item--bloco', 'data-item': `${nomeCampo}[${i}]` },
        h('div', { class: 'item__topo' }, h('span', { class: 'item__nome' }, `${i + 1} · ${nome}`)),
        h('div', { class: 'item__campos' }, campos),
        mensagemCampo(formatarCaminho([...caminho, i])));
    }).filter(Boolean);
    return itens.length ? h('div', { class: 'blocos-editor' }, itens, mensagemCampo(nomeCampo)) : null;
  }

  const itens = blocos.map((bloco, i) => {
    const nome = `${NOMES_BLOCO[bloco.tipo] ?? bloco.tipo}${bloco.tipo === 'video' ? (bloco.origem === 'link' ? ' · link' : ' · arquivo') : ''}`;
    const rotulo = `bloco ${i + 1} (${nome})`;
    const alca = h('span', {
      class: 'item__alca',
      draggable: 'true',
      title: 'Arraste para reordenar',
      'aria-hidden': 'true',
      ondragstart: (e) => {
        arrastado = i;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
        e.target.closest('.item').classList.add('item--arrastando');
      },
      ondragend: (e) => {
        arrastado = null;
        e.target.closest('.item')?.classList.remove('item--arrastando');
      },
    }, '⋮⋮');
    return h('div', {
      class: 'item item--bloco',
      'data-item': `${nomeCampo}[${i}]`,
      ondragover: (e) => {
        if (arrastado === null) return;
        e.preventDefault();
        e.currentTarget.classList.add('item--alvo');
      },
      ondragleave: (e) => e.currentTarget.classList.remove('item--alvo'),
      ondrop: (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('item--alvo');
        if (arrastado === null || arrastado === i) return;
        const de = arrastado;
        mover(blocos, de, i);
        espelhar(ctx, caminho, (lista) => mover(lista, de, i));
        ctx.aoEstrutura({ foco: `${nomeCampo}[${i}]` });
      },
    },
    h('div', { class: 'item__topo' },
      h('span', { class: 'item__nome' }, alca, ` ${i + 1} · ${nome}`),
      h('span', { class: 'item__acoes' },
        botaoIcone(`Mover ${rotulo} para cima`, '↑', () => { mover(blocos, i, i - 1); espelhar(ctx, caminho, (lista) => mover(lista, i, i - 1)); ctx.aoEstrutura({ foco: `${nomeCampo}[${i - 1}]` }); }, i === 0),
        botaoIcone(`Mover ${rotulo} para baixo`, '↓', () => { mover(blocos, i, i + 1); espelhar(ctx, caminho, (lista) => mover(lista, i, i + 1)); ctx.aoEstrutura({ foco: `${nomeCampo}[${i + 1}]` }); }, i === blocos.length - 1),
        botaoIcone(`Remover ${rotulo}`, '✕', () => {
          if (!confirm(`Remover o ${rotulo}? O conteúdo dele será perdido.`)) return;
          blocos.splice(i, 1);
          espelhar(ctx, caminho, (lista) => lista.splice(i, 1));
          ctx.aoEstrutura({ foco: `${nomeCampo}:adicionar` });
        }))),
    h('div', { class: 'item__campos' }, montarCampos(camposDoBloco(bloco), ctx, [...caminho, i])),
    mensagemCampo(formatarCaminho([...caminho, i])));
  });

  const adicionar = h('div', { class: 'blocos-editor__adicionar', 'data-acao': `${nomeCampo}:adicionar`, tabindex: '-1' },
    h('p', { class: 'lista__titulo' }, '+ Adicionar bloco'),
    h('div', { class: 'blocos-editor__opcoes' }, MODELOS_BLOCO.map(([rotulo, criar]) => h('button', {
      type: 'button',
      class: 'botao-painel botao-painel--secundario',
      onclick: () => {
        if (!Array.isArray(ler(ctx.doc, caminho))) escrever(ctx.doc, caminho, []);
        const destino = ler(ctx.doc, caminho);
        destino.push(criar());
        ctx.aoEstrutura({ foco: `${nomeCampo}[${destino.length - 1}]` });
      },
    }, rotulo))));

  return h('div', { class: 'blocos-editor' }, itens, mensagemCampo(nomeCampo), adicionar);
}

function montarCampo(d, ctx, base) {
  const caminho = d.k === undefined ? base : [...base, ...[].concat(d.k)];
  switch (d.t) {
    case 'secao': {
      if (d.seExiste && ler(estrutura(ctx), [...base, d.seExiste]) === undefined) return null;
      const campos = montarCampos(d.campos, ctx, base);
      if (emTraducao(ctx) && !campos.length) return null;
      return h('section', { class: 'painel-secao' },
        h('h2', { class: 'painel-secao__titulo' }, d.r),
        d.ajuda && !emTraducao(ctx) ? h('p', { class: 'campo__ajuda' }, d.ajuda) : null,
        h('div', { class: 'painel-secao__campos' }, campos));
    }
    case 'grupo': {
      if ((!d.opc || emTraducao(ctx)) && ler(estrutura(ctx), caminho) === undefined) return null;
      const filho = { ...ctx, podar: d.opc && !emTraducao(ctx) ? caminho : ctx.podar };
      const conteudo = montarCampos(d.campos, filho, caminho);
      if (emTraducao(ctx) && !conteudo.length) return null;
      return d.r
        ? h('fieldset', { class: 'grupo' }, h('legend', { class: 'lista__titulo' }, d.r), conteudo, mensagemCampo(formatarCaminho(caminho)))
        : h('div', { class: 'grupo grupo--simples' }, conteudo, mensagemCampo(formatarCaminho(caminho)));
    }
    case 'lista': return lista(d, ctx, caminho);
    case 'blocos': return blocosEditor(d, ctx, caminho);
  }
  // Na tradução, só textos: arquivos, caixas, escolhas, enquadramento e campos só de leitura ficam no original.
  if (emTraducao(ctx) && !['texto', 'area', 'markdown', 'linhas', 'codigo'].includes(d.t)) return null;
  switch (d.t) {
    case 'midia': return campoMidia(d, ctx, caminho);
    case 'booleano': return caixaMarcar(d, ctx, caminho);
    case 'escolha': return escolha(d, ctx, caminho);
    case 'enquadramento': return enquadramento(ctx, caminho);
    case 'leitura': return campoLeitura(d, ctx, caminho);
    default: return entrada(d, ctx, caminho);
  }
}

function montarCampos(descritores, ctx, base) {
  return descritores.map((d) => montarCampo(d, ctx, base)).filter(Boolean);
}

// ctx: { doc, aoMudar(), aoEstrutura({ foco }), enviar(arquivo, aceita) → { src, largura, altura } | null,
//        urlImagem(src) → Promise<url | null>, espelhar?(caminho, operacao(lista)) }
// Na tradução, também: { original, traduzivel(caminho) → boolean, idiomaOriginal }.
export function montarFormulario(descritores, ctx) {
  return h('form', { class: 'formulario', novalidate: true, onsubmit: (e) => e.preventDefault() }, montarCampos(descritores, ctx, []));
}

// Mostra erros e avisos de validação junto aos campos. Devolve os problemas que não têm campo visível.
export function mostrarProblemas(formulario, problemas) {
  const lugares = [...formulario.querySelectorAll('[data-mensagem]')];
  for (const el of lugares) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('campo__mensagem--erro', 'campo__mensagem--aviso');
  }
  for (const el of formulario.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');

  const semCampo = [];
  for (const p of problemas) {
    const alvo = lugares.find((el) => el.dataset.mensagem === p.campo)
      ?? lugares.find((el) => (el.dataset.apelidos ?? '').split(' ').includes(p.campo));
    if (!alvo) {
      semCampo.push(p);
      continue;
    }
    if (alvo.dataset.unico && alvo.textContent) continue;
    const texto = p.marcador ? 'Marcador […] a preencher antes de publicar.' : p.mensagem;
    alvo.textContent = alvo.textContent ? `${alvo.textContent} · ${texto}` : texto;
    alvo.hidden = false;
    alvo.classList.add(p.nivel === 'erro' ? 'campo__mensagem--erro' : 'campo__mensagem--aviso');
    if (p.nivel === 'erro') {
      const controle = [...formulario.querySelectorAll('[data-campo]')].find((el) => el.dataset.campo === p.campo);
      controle?.setAttribute('aria-invalid', 'true');
    }
  }
  return semCampo;
}
