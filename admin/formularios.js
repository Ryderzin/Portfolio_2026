// Formulários do painel, montados a partir de descritores.
// Cada campo aponta para um caminho dentro do documento JSON (ex.: ['capa', 'alt']).
// Os valores são gravados no próprio objeto do documento a cada digitação.

import { CATEGORIAS, LAYOUTS_GALERIA } from './validacao.js';

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
  for (const chave of caminho.slice(0, -1)) {
    if (pai[chave] === undefined || pai[chave] === null) {
      if (opcional && vazio(valor)) return;
      pai[chave] = {};
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

// ---------- Descritores ----------

const texto = (k, r, extra = {}) => ({ t: 'texto', k, r, ...extra });
const area = (k, r, extra = {}) => ({ t: 'area', k, r, ...extra });
const md = (k, r, extra = {}) => ({ t: 'markdown', k, r, ...extra });
const leitura = (k, r, extra = {}) => ({ t: 'leitura', k, r, ...extra });

const AJUDA_MARKDOWN = 'Markdown: **negrito**, *itálico*, `código`, [texto](https://…), "### " para título, "- " ou "1. " para listas. Linha em branco separa parágrafos.';
const AJUDA_ALT = 'Descreva a imagem para quem usa leitor de tela.';

const imagemAlt = (k, r) => ({
  t: 'grupo', k, r, campos: [leitura('src', 'Arquivo'), texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT })],
});

const ROTULOS_INTERFACE = {
  geral: {
    _titulo: 'Geral',
    navegacaoPrincipal: 'Nome do menu principal (lido por leitores de tela)',
    paginaInicial: 'Botão "Página inicial" (404)',
    verProjetos: 'Botão "Ver projetos"',
  },
  projeto: {
    _titulo: 'Página de projeto',
    voltarProjetos: 'Botão de voltar',
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

const rotulosInterface = () => ({
  t: 'secao',
  r: 'Rótulos da interface',
  ajuda: 'Textos fixos que aparecem nas páginas. Setas e ícones são acrescentados pelo site.',
  campos: Object.entries(ROTULOS_INTERFACE).map(([grupo, { _titulo, ...chaves }]) => ({
    t: 'grupo',
    k: ['rotulos', grupo],
    r: _titulo,
    campos: Object.entries(chaves).map(([k, r]) => texto(k, r, k === 'abreEm' ? { ajuda: '{onde} vira o nome do site, ex.: "Abre em {onde}".' } : {})),
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
    { t: 'secao', r: 'Foto', seExiste: 'foto', campos: [
      { t: 'grupo', k: 'foto', campos: [
        leitura('src', 'Arquivo'),
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
    { t: 'secao', r: 'Currículo', seExiste: 'curriculo', campos: [leitura('curriculo', 'Arquivo PDF')] },
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

  projeto: (slug) => [
    { t: 'secao', r: '1 · Informações', campos: [
      texto('titulo', 'Título'),
      texto('subtitulo', 'Subtítulo'),
      { t: 'escolha', k: 'categoria', r: 'Categoria (faixa amarela)', opcoes: CATEGORIAS.map((c) => [c, c]) },
      texto('ano', 'Ano', { ajuda: 'Quatro dígitos.', inputmode: 'numeric' }),
      texto('stack', 'Stack', { ajuda: 'Aparece na lombada, ex.: "C# · ASP.NET Core".' }),
      { t: 'numero', k: 'ordem', r: 'Ordem na home', ajuda: 'Menor aparece primeiro.' },
      { t: 'booleano', k: 'publicado', r: 'Publicado (aparece no site)' },
      { t: 'leitura', r: 'Endereço da página', valor: `/projetos/${slug}/` },
    ] },
    { t: 'secao', r: '2 · Capa na home', campos: [
      { t: 'grupo', k: 'capa', campos: [
        leitura('src', 'Arquivo'),
        texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT }),
        leitura(['previa', 'src'], 'Prévia em movimento'),
      ] },
    ] },
    { t: 'secao', r: 'Galeria do topo', seExiste: 'galeriaTopo', campos: [
      { t: 'lista', k: 'galeriaTopo', fixa: true, rotuloItem: (_, i) => `Imagem ${i + 1}`, item: [leitura('src', 'Arquivo'), texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT })] },
    ] },
    { t: 'secao', r: '3 · Conteúdo da página', ajuda: 'Adicionar, reordenar e remover blocos chega na próxima etapa.', campos: [{ t: 'blocos', k: 'blocos' }] },
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
        { t: 'escolha', k: 'layout', r: 'Layout', opcoes: LAYOUTS_GALERIA.map((l) => [l, { duas: 'Duas por linha', grande: 'Uma grande', carrossel: 'Carrossel' }[l]]) },
        { t: 'lista', k: 'imagens', fixa: true, rotuloItem: (_, i) => `Imagem ${i + 1}`, item: [leitura('src', 'Arquivo'), texto('alt', 'Texto alternativo', { ajuda: AJUDA_ALT })] },
        texto('legenda', 'Legenda', { opc: true }),
      ];
    case 'video':
      return bloco.origem === 'link'
        ? [texto('url', 'Link do YouTube ou Vimeo', { tipoInput: 'url' }), texto('legenda', 'Legenda', { opc: true })]
        : [
          leitura('src', 'Arquivo'),
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

function mensagemCampo(campo) {
  return h('p', { class: 'campo__mensagem', id: idPara(['msg']), 'data-mensagem': campo, hidden: true });
}

function entrada(d, ctx, caminho) {
  const id = idPara(caminho);
  const valor = ler(ctx.doc, caminho);
  const ajuda = d.ajuda ? h('p', { class: 'campo__ajuda', id: `${id}-ajuda` }, d.ajuda) : null;
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

  controle.addEventListener('input', () => {
    let novo = controle.value;
    if (d.t === 'numero') novo = novo === '' ? undefined : Number(novo);
    if (d.t === 'linhas') novo = novo.split('\n').map((l) => l.trim()).filter(Boolean);
    escrever(ctx.doc, caminho, novo, { opcional: d.opc, podar: ctx.podar });
    ctx.aoMudar();
  });

  return h('div', { class: 'campo' },
    h('label', { for: id, class: 'campo__rotulo' }, d.r, d.opc ? h('span', { class: 'campo__opcional' }, ' (opcional)') : null),
    ajuda,
    controle,
    mensagem);
}

function caixaMarcar(d, ctx, caminho) {
  const id = idPara(caminho);
  const mensagem = mensagemCampo(formatarCaminho(caminho));
  const controle = h('input', { id, type: 'checkbox', checked: ler(ctx.doc, caminho) === true, 'aria-describedby': mensagem.id });
  controle.dataset.campo = formatarCaminho(caminho);
  controle.addEventListener('change', () => {
    escrever(ctx.doc, caminho, controle.checked);
    ctx.aoMudar();
  });
  return h('div', { class: 'campo campo--marcar' }, h('label', { for: id }, controle, ' ', d.r), mensagem);
}

function escolha(d, ctx, caminho) {
  const id = idPara(caminho);
  const atual = ler(ctx.doc, caminho);
  const mensagem = mensagemCampo(formatarCaminho(caminho));
  const opcoes = d.opcoes.map(([valor, rotulo]) => h('option', { value: valor }, rotulo));
  if (!d.opcoes.some(([valor]) => valor === atual)) opcoes.unshift(h('option', { value: atual ?? '' }, `${atual ?? ''} (inválido)`));
  const controle = h('select', { id, 'aria-describedby': mensagem.id }, opcoes);
  controle.value = atual ?? '';
  controle.dataset.campo = formatarCaminho(caminho);
  controle.addEventListener('change', () => {
    escrever(ctx.doc, caminho, controle.value);
    ctx.aoMudar();
  });
  return h('div', { class: 'campo' }, h('label', { for: id, class: 'campo__rotulo' }, d.r), controle, mensagem);
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

function lista(d, ctx, caminho) {
  const itens = ler(ctx.doc, caminho);
  const nomeCampo = formatarCaminho(caminho);
  const elementos = (Array.isArray(itens) ? itens : []).map((item, i) => {
    const rotulo = d.rotuloItem ? d.rotuloItem(item, i) : `Item ${i + 1}`;
    const acoes = d.fixa ? null : h('span', { class: 'item__acoes' },
      botaoIcone(`Mover "${rotulo}" para cima`, '↑', () => { mover(itens, i, i - 1); ctx.aoEstrutura({ foco: `${nomeCampo}[${i - 1}]` }); }, i === 0),
      botaoIcone(`Mover "${rotulo}" para baixo`, '↓', () => { mover(itens, i, i + 1); ctx.aoEstrutura({ foco: `${nomeCampo}[${i + 1}]` }); }, i === itens.length - 1),
      botaoIcone(`Remover "${rotulo}"`, '✕', () => {
        if (!confirm(`Remover "${rotulo}"?`)) return;
        itens.splice(i, 1);
        ctx.aoEstrutura({ foco: `${nomeCampo}:adicionar` });
      }));
    return h('div', { class: 'item', 'data-item': `${nomeCampo}[${i}]` },
      h('div', { class: 'item__topo' }, h('span', { class: 'item__nome' }, rotulo), acoes),
      h('div', { class: 'item__campos' }, montarCampos(d.item, ctx, [...caminho, i])));
  });

  const adicionar = d.fixa || !d.novo ? null : h('button', {
    type: 'button',
    class: 'botao-painel botao-painel--secundario',
    'data-acao': `${nomeCampo}:adicionar`,
    onclick: () => {
      const atual = ler(ctx.doc, caminho);
      if (Array.isArray(atual)) atual.push(d.novo());
      else escrever(ctx.doc, caminho, [d.novo()]);
      ctx.aoEstrutura({ foco: `${nomeCampo}[${ler(ctx.doc, caminho).length - 1}]` });
    },
  }, `+ Adicionar${d.r ? ` em ${d.r.toLowerCase()}` : ''}`);

  return h('fieldset', { class: 'lista' },
    d.r ? h('legend', { class: 'lista__titulo' }, d.r) : null,
    d.ajuda ? h('p', { class: 'campo__ajuda' }, d.ajuda) : null,
    elementos,
    mensagemCampo(nomeCampo),
    adicionar);
}

function blocosEditor(d, ctx, caminho) {
  const blocos = ler(ctx.doc, caminho) ?? [];
  return h('div', { class: 'blocos-editor' },
    blocos.map((bloco, i) => {
      const nome = NOMES_BLOCO[bloco.tipo] ?? bloco.tipo;
      const detalhe = bloco.tipo === 'video' ? (bloco.origem === 'link' ? ' · link' : ' · arquivo') : '';
      return h('div', { class: 'item item--bloco', 'data-item': formatarCaminho([...caminho, i]) },
        h('div', { class: 'item__topo' }, h('span', { class: 'item__nome' }, `${i + 1} · ${nome}${detalhe}`)),
        h('div', { class: 'item__campos' }, montarCampos(camposDoBloco(bloco), ctx, [...caminho, i])),
        mensagemCampo(formatarCaminho([...caminho, i])));
    }),
    mensagemCampo(formatarCaminho(caminho)));
}

function montarCampo(d, ctx, base) {
  const caminho = d.k === undefined ? base : [...base, ...[].concat(d.k)];
  switch (d.t) {
    case 'secao': {
      if (d.seExiste && ler(ctx.doc, [...base, d.seExiste]) === undefined) return null;
      return h('section', { class: 'painel-secao' },
        h('h2', { class: 'painel-secao__titulo' }, d.r),
        d.ajuda ? h('p', { class: 'campo__ajuda' }, d.ajuda) : null,
        h('div', { class: 'painel-secao__campos' }, montarCampos(d.campos, ctx, base)));
    }
    case 'grupo': {
      if (!d.opc && ler(ctx.doc, caminho) === undefined) return null;
      const filho = { ...ctx, podar: d.opc ? caminho : ctx.podar };
      const conteudo = montarCampos(d.campos, filho, caminho);
      return d.r
        ? h('fieldset', { class: 'grupo' }, h('legend', { class: 'lista__titulo' }, d.r), conteudo, mensagemCampo(formatarCaminho(caminho)))
        : h('div', { class: 'grupo grupo--simples' }, conteudo, mensagemCampo(formatarCaminho(caminho)));
    }
    case 'lista': return lista(d, ctx, caminho);
    case 'blocos': return blocosEditor(d, ctx, caminho);
    case 'booleano': return caixaMarcar(d, ctx, caminho);
    case 'escolha': return escolha(d, ctx, caminho);
    case 'leitura': return campoLeitura(d, ctx, caminho);
    default: return entrada(d, ctx, caminho);
  }
}

function montarCampos(descritores, ctx, base) {
  return descritores.map((d) => montarCampo(d, ctx, base)).filter(Boolean);
}

// ctx: { doc, aoMudar(), aoEstrutura({ foco }) }
export function montarFormulario(descritores, ctx) {
  return h('form', { class: 'formulario', novalidate: true, onsubmit: (e) => e.preventDefault() }, montarCampos(descritores, ctx, []));
}

// Mostra erros e avisos de validação junto aos campos. Devolve os problemas que não têm campo visível.
export function mostrarProblemas(formulario, problemas) {
  for (const el of formulario.querySelectorAll('[data-mensagem]')) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('campo__mensagem--erro', 'campo__mensagem--aviso');
  }
  for (const el of formulario.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');

  const semCampo = [];
  for (const p of problemas) {
    const alvo = [...formulario.querySelectorAll('[data-mensagem]')].find((el) => el.dataset.mensagem === p.campo);
    if (!alvo) {
      semCampo.push(p);
      continue;
    }
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
