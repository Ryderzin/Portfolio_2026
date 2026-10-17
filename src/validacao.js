// Validação do conteúdo de content/.
// Módulo puro (sem DOM, rede ou disco): o build usa no Node e o painel usa no navegador.
// Quem chama informa quais arquivos existem por meio de existeArquivo(caminho),
// com o caminho relativo a content/ (ex.: "projetos/exemplo-web/capa.png").

export const CATEGORIAS = ['Web', 'Jogos', 'Ferramentas'];
export const LAYOUTS_GALERIA = ['duas', 'grande', 'carrossel'];
export const ORIGENS_VIDEO = ['arquivo', 'link'];
export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const EXTENSOES_IMAGEM = ['webp', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'avif'];
export const EXTENSOES_VIDEO = ['mp4', 'webm'];
export const EXTENSOES_PDF = ['pdf'];

const ESQUEMAS_PERMITIDOS = ['https', 'http', 'mailto', 'tel'];

// Segmento de caminho de mídia: começa com letra ou número; sem espaços nem acentos.
const NOME_ARQUIVO = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Marcador de informação pendente, como "[seu@email.com]".
// Não confunde com link de Markdown "[texto](url)", com "[]" vazio nem com código entre crases.
const MARCADOR = /\[[^\]\n]+\](?!\()/;
const CODIGO_EM_LINHA = /`[^`\n]*`/g;

// Links de Markdown: [texto](url)
const LINK_MARKDOWN = /\[([^\]\n]*)\]\(([^)\s]*)\)/g;

// ---------- Utilitários exportados (também úteis aos renderizadores) ----------

export function temMarcador(valor) {
  return typeof valor === 'string' && MARCADOR.test(valor.replace(CODIGO_EM_LINHA, ''));
}

// Aceita só https:, http:, mailto:, tel: e caminhos relativos.
export function urlPermitida(valor) {
  if (typeof valor !== 'string') return false;
  const url = valor.trim();
  if (url === '' || /[\s\\\u0000-\u001f\u007f]/.test(url)) return false;
  const esquema = /^([a-z][a-z0-9+.-]*):/i.exec(url);
  if (esquema) {
    const nome = esquema[1].toLowerCase();
    if (!ESQUEMAS_PERMITIDOS.includes(nome)) return false;
    if (nome === 'http' || nome === 'https') return /^https?:\/\/[^/?#]+/i.test(url);
    return url.length > nome.length + 1;
  }
  return !url.startsWith('//');
}

// Identifica links do YouTube e do Vimeo. Devolve { servico, id } ou null.
export function idDeVideo(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const partes = url.pathname.split('/').filter(Boolean);

  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let id = null;
    if (host === 'youtu.be') id = partes[0];
    else if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live'].includes(partes[0])) id = partes[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id ?? '') ? { servico: 'youtube', id } : null;
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = [...partes].reverse().find((parte) => /^\d+$/.test(parte));
    return id ? { servico: 'vimeo', id } : null;
  }

  return null;
}

// ---------- Regras ----------

const qualquer = () => ({ tipo: 'qualquer' });
const texto = (extra = {}) => ({ tipo: 'texto', ...extra });
const markdown = () => ({ tipo: 'texto', markdown: true });
const inteiro = (extra = {}) => ({ tipo: 'inteiro', ...extra });
const booleano = () => ({ tipo: 'booleano' });
const umDe = (valores) => ({ tipo: 'umDe', valores });
const objeto = (campos, extra = {}) => ({ tipo: 'objeto', campos, ...extra });
const lista = (item, extra = {}) => ({ tipo: 'lista', item, ...extra });
const variante = (chave, opcoes) => ({ tipo: 'variante', chave, opcoes });
const midia = (extensoes) => ({ tipo: 'midia', extensoes });
const opcional = (regra) => ({ ...regra, opcional: true });

const formatoEmail = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'e-mail inválido');

const formatoTelefone = (v) => {
  if (!/^\+?[0-9\s().-]+$/.test(v)) return 'telefone inválido: use só números, espaços, +, -, ( e )';
  return v.replace(/\D/g, '').length >= 8 ? null : 'telefone inválido: poucos dígitos';
};

const formatoUrlCompleta = (v) =>
  (/^https?:\/\/[^/?#\s]+\.[^/?#\s]+/i.test(v) ? null : 'use um endereço completo, começando com https://');

const formatoUrlSite = (v) =>
  (/^https:\/\/[^/?#\s]+\.[^/?#\s]+/i.test(v) ? null : 'use o endereço do site, começando com https://');

const formatoCaminhoInterno = (v) =>
  (/^\/(?!\/)\S*$/.test(v) ? null : 'use um caminho do próprio site começando com / (ex.: "/sobre/")');

const formatoAno = (v) => (/^\d{4}$/.test(v) ? null : 'use o ano com quatro dígitos (ex.: "2026")');

const formatoLinguagem = (v) =>
  (/^[A-Za-z0-9+#._-]+$/.test(v) ? null : 'use uma palavra só, sem espaços (ex.: "csharp")');

const formatoVideoLink = (v) => (idDeVideo(v) ? null : 'use um link do YouTube ou do Vimeo');

const urlLink = () => texto({ url: true });
const urlCompleta = () => texto({ url: true, formato: formatoUrlCompleta });

const camposImagem = {
  src: midia(EXTENSOES_IMAGEM),
  alt: texto({ dica: 'descreva a imagem para quem usa leitor de tela' }),
  largura: inteiro({ min: 1 }),
  altura: inteiro({ min: 1 }),
};

const imagem = objeto(camposImagem);
const link = objeto({ rotulo: texto(), url: urlLink() });

function autoplayExigeMudo(bloco, campo, ctx) {
  if (bloco.autoplay === true && bloco.mudo !== true) {
    reportar(ctx, 'erro', juntar(campo, 'autoplay'),
      'autoplay exige "mudo": true (os navegadores bloqueiam vídeo com som que toca sozinho)');
  }
}

function carrosselComUmaImagem(bloco, campo, ctx) {
  if (bloco.layout === 'carrossel' && Array.isArray(bloco.imagens) && bloco.imagens.length === 1) {
    reportar(ctx, 'aviso', juntar(campo, 'layout'), 'carrossel com uma imagem só; o layout "grande" fica melhor');
  }
}

function jogarExigeOnde(jogar, campo, ctx) {
  const temUrl = typeof jogar.url === 'string' && jogar.url.trim() !== '';
  const temOnde = typeof jogar.onde === 'string' && jogar.onde.trim() !== '';
  if (temUrl && !temOnde) {
    reportar(ctx, 'erro', juntar(campo, 'onde'), 'obrigatório quando "url" está preenchido (ex.: "itch.io")');
  }
}

const BLOCO = variante('tipo', {
  texto: objeto({ tipo: qualquer(), markdown: markdown() }),
  galeria: objeto({
    tipo: qualquer(),
    layout: umDe(LAYOUTS_GALERIA),
    imagens: lista(imagem, { min: 1 }),
    legenda: opcional(texto()),
  }, { verificar: carrosselComUmaImagem }),
  video: variante('origem', {
    arquivo: objeto({
      tipo: qualquer(),
      origem: qualquer(),
      src: midia(EXTENSOES_VIDEO),
      largura: inteiro({ min: 1 }),
      altura: inteiro({ min: 1 }),
      loop: booleano(),
      mudo: booleano(),
      autoplay: booleano(),
      legenda: opcional(texto()),
    }, { verificar: autoplayExigeMudo }),
    link: objeto({
      tipo: qualquer(),
      origem: qualquer(),
      url: texto({ url: true, formato: formatoVideoLink }),
      legenda: opcional(texto()),
    }),
  }),
  codigo: objeto({
    tipo: qualquer(),
    linguagem: texto({ formato: formatoLinguagem }),
    codigo: texto({ ignorarMarcadores: true }),
  }),
  citacao: objeto({ tipo: qualquer(), texto: texto(), autor: opcional(texto()) }),
});

const ESQUEMA_SITE = objeto({
  titulo: texto(),
  descricao: texto(),
  url: texto({ url: true, formato: formatoUrlSite }),
  idioma: texto({ formato: (v) => (/^[a-z]{2,3}(-[A-Z]{2})?$/.test(v) ? null : 'use um código de idioma como "pt-BR"') }),
  repositorio: objeto({
    dono: texto({ formato: (v) => (/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(v) ? null : 'nome de usuário do GitHub inválido') }),
    nome: texto({ formato: (v) => (/^[A-Za-z0-9._-]+$/.test(v) ? null : 'nome de repositório inválido') }),
    branch: texto({ formato: (v) => (/^[^\s~^:?*\\]+$/.test(v) ? null : 'nome de branch inválido') }),
  }),
  navegacao: lista(objeto({ rotulo: texto(), caminho: texto({ formato: formatoCaminhoInterno }) }), { min: 1 }),
  rodape: objeto({ texto: texto(), links: lista(link) }),
  rotulos: objeto({
    geral: objeto({ navegacaoPrincipal: texto(), paginaInicial: texto(), verProjetos: texto() }),
    projeto: objeto({
      voltarProjetos: texto(),
      fichaTecnica: texto(),
      tecnologia: texto(),
      linguagem: texto(),
      plataformas: texto(),
      ano: texto(),
      papel: texto(),
      links: texto(),
      video: texto(),
      jogarOnline: texto(),
      abreEm: texto({ formato: (v) => (v.includes('{onde}') ? null : 'inclua {onde}, que vira o nome do site (ex.: "Abre em {onde}")') }),
      proximoProjeto: texto(),
    }),
    sobre: objeto({ tecnologias: texto(), experiencia: texto(), baixarCurriculo: texto() }),
    contato: objeto({ escreverEmail: texto(), email: texto(), telefone: texto(), linkedin: texto(), github: texto() }),
  }),
});

const ESQUEMA_HOME = objeto({
  nome: texto(),
  especialidades: texto(),
  apresentacao: texto(),
  tituloProjetos: texto(),
  chamadaRodape: texto(),
});

const ESQUEMA_SOBRE = objeto({
  titulo: texto(),
  foto: opcional(objeto({ ...camposImagem, legenda: opcional(texto()) })),
  destaque: texto(),
  texto: markdown(),
  tecnologias: lista(objeto({ grupo: texto(), itens: lista(texto(), { min: 1 }) })),
  experiencia: lista(objeto({ periodo: texto(), cargo: texto(), empresa: texto(), resumo: texto() })),
  curriculo: opcional(midia(EXTENSOES_PDF)),
});

const ESQUEMA_CONTATO = objeto({
  titulo: texto(),
  frase: texto(),
  email: texto({ formato: formatoEmail }),
  assuntoEmail: texto(),
  telefone: opcional(texto({ formato: formatoTelefone })),
  linkedin: opcional(urlCompleta()),
  github: opcional(urlCompleta()),
});

const ESQUEMA_404 = objeto({ codigo: texto(), titulo: texto(), texto: texto() });

const ESQUEMA_PROJETO = objeto({
  publicado: booleano(),
  ordem: inteiro(),
  titulo: texto(),
  subtitulo: texto(),
  categoria: umDe(CATEGORIAS),
  ano: texto({ formato: formatoAno }),
  stack: texto(),
  capa: objeto({
    ...camposImagem,
    previa: opcional(objeto({ src: midia(EXTENSOES_VIDEO), largura: inteiro({ min: 1 }), altura: inteiro({ min: 1 }) })),
  }),
  galeriaTopo: opcional(lista(imagem)),
  blocos: lista(BLOCO),
  ficha: objeto({
    tecnologia: opcional(texto()),
    linguagem: opcional(texto()),
    plataformas: opcional(texto()),
    papel: opcional(texto()),
  }),
  jogar: opcional(objeto({ url: opcional(urlCompleta()), onde: opcional(texto()) }, { verificar: jogarExigeOnde })),
  links: lista(link),
});

// Páginas fixas: chave usada no código → arquivo em content/ e esquema.
export const PAGINAS = {
  site: { arquivo: 'site.json', esquema: ESQUEMA_SITE },
  home: { arquivo: 'home.json', esquema: ESQUEMA_HOME },
  sobre: { arquivo: 'sobre.json', esquema: ESQUEMA_SOBRE },
  contato: { arquivo: 'contato.json', esquema: ESQUEMA_CONTATO },
  erro404: { arquivo: '404.json', esquema: ESQUEMA_404 },
};

// ---------- Motor de validação ----------

function juntar(caminho, chave) {
  if (typeof chave === 'number') return `${caminho}[${chave}]`;
  return caminho ? `${caminho}.${chave}` : chave;
}

function reportar(ctx, nivel, campo, mensagem, extra = {}) {
  ctx.problemas.push({ nivel, arquivo: ctx.arquivo, campo, mensagem, ...extra });
}

function descrever(valor) {
  if (valor === null) return 'nulo';
  if (Array.isArray(valor)) return 'uma lista';
  if (typeof valor === 'string') return 'texto';
  if (typeof valor === 'number') return 'número';
  if (typeof valor === 'boolean') return 'true/false';
  return 'um objeto';
}

function citar(valores) {
  return valores.map((v) => JSON.stringify(v)).join(', ');
}

function ehObjeto(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function validarValor(regra, valor, campo, ctx) {
  const textoVazio = typeof valor === 'string' && valor.trim() === '';
  if (valor === undefined || valor === null || (textoVazio && (regra.tipo === 'texto' || regra.tipo === 'midia'))) {
    if (!regra.opcional) {
      const mensagem = textoVazio ? 'não pode ficar vazio' : 'campo obrigatório ausente';
      reportar(ctx, 'erro', campo, regra.dica ? `${mensagem} — ${regra.dica}` : mensagem);
    }
    return;
  }

  switch (regra.tipo) {
    case 'qualquer':
      return;
    case 'texto':
      return validarTexto(regra, valor, campo, ctx);
    case 'midia':
      return validarMidia(regra, valor, campo, ctx);
    case 'inteiro':
      if (!Number.isInteger(valor)) return reportar(ctx, 'erro', campo, `deveria ser um número inteiro, mas é ${descrever(valor)}`);
      if (regra.min !== undefined && valor < regra.min) reportar(ctx, 'erro', campo, `deveria ser no mínimo ${regra.min}`);
      return;
    case 'booleano':
      if (typeof valor !== 'boolean') reportar(ctx, 'erro', campo, `deveria ser true ou false, mas é ${descrever(valor)}`);
      return;
    case 'umDe':
      if (!regra.valores.includes(valor)) {
        reportar(ctx, 'erro', campo, `${JSON.stringify(valor)} não é aceito. Use: ${citar(regra.valores)}`);
      }
      return;
    case 'objeto':
      return validarObjeto(regra, valor, campo, ctx);
    case 'lista':
      return validarLista(regra, valor, campo, ctx);
    case 'variante':
      return validarVariante(regra, valor, campo, ctx);
    default:
      throw new Error(`regra desconhecida: ${regra.tipo}`);
  }
}

function validarTexto(regra, valor, campo, ctx) {
  if (typeof valor !== 'string') {
    return reportar(ctx, 'erro', campo, `deveria ser texto (entre aspas), mas é ${descrever(valor)}`);
  }
  if (regra.url && !urlPermitida(valor)) {
    return reportar(ctx, 'erro', campo, 'endereço não permitido: use https://, http://, mailto:, tel: ou um caminho relativo');
  }
  if (regra.markdown) {
    for (const [, rotulo, url] of valor.matchAll(LINK_MARKDOWN)) {
      if (!urlPermitida(url)) {
        reportar(ctx, 'erro', campo, `link "${rotulo}" com endereço não permitido: use https://, http://, mailto: ou um caminho relativo`);
      }
    }
  }
  if (!regra.ignorarMarcadores && temMarcador(valor)) {
    return reportar(ctx, 'aviso', campo, 'marcador […] a preencher', { marcador: true });
  }
  const mensagem = regra.formato?.(valor);
  if (mensagem) reportar(ctx, 'erro', campo, mensagem);
}

function validarMidia(regra, valor, campo, ctx) {
  if (typeof valor !== 'string') {
    return reportar(ctx, 'erro', campo, `deveria ser o caminho de um arquivo (texto), mas é ${descrever(valor)}`);
  }

  let pasta;
  let relativo;
  if (valor.startsWith('/midia/')) {
    pasta = 'midia';
    relativo = valor.slice('/midia/'.length);
  } else if (valor.startsWith('/')) {
    return reportar(ctx, 'erro', campo, 'caminho absoluto só é aceito dentro de /midia/');
  } else if (ctx.pastaMidia) {
    pasta = ctx.pastaMidia;
    relativo = valor;
  } else {
    return reportar(ctx, 'erro', campo, 'use um caminho que comece com /midia/');
  }

  if (relativo.split('/').some((segmento) => !NOME_ARQUIVO.test(segmento))) {
    return reportar(ctx, 'erro', campo,
      `nome de arquivo inválido "${valor}": use só letras sem acento, números, ponto, hífen e sublinhado`);
  }

  const extensao = relativo.includes('.') ? relativo.split('.').pop().toLowerCase() : '';
  if (!regra.extensoes.includes(extensao)) {
    return reportar(ctx, 'erro', campo,
      `tipo de arquivo não aceito aqui (${extensao ? '.' + extensao : 'sem extensão'}). Use: ${regra.extensoes.map((e) => '.' + e).join(', ')}`);
  }

  const caminho = `${pasta}/${relativo}`;
  if (!ctx.existeArquivo(caminho)) {
    reportar(ctx, 'erro', campo, `arquivo não encontrado: content/${caminho} (confira também maiúsculas e minúsculas)`);
  }
}

function validarObjeto(regra, valor, campo, ctx) {
  if (!ehObjeto(valor)) {
    return reportar(ctx, 'erro', campo || '(arquivo)', `deveria ser um objeto { … }, mas é ${descrever(valor)}`);
  }
  for (const [chave, subregra] of Object.entries(regra.campos)) {
    validarValor(subregra, valor[chave], juntar(campo, chave), ctx);
  }
  for (const chave of Object.keys(valor)) {
    if (!Object.hasOwn(regra.campos, chave)) {
      reportar(ctx, 'erro', juntar(campo, chave), 'campo desconhecido (confira a grafia)');
    }
  }
  regra.verificar?.(valor, campo, ctx);
}

function validarLista(regra, valor, campo, ctx) {
  if (!Array.isArray(valor)) {
    return reportar(ctx, 'erro', campo, `deveria ser uma lista [ … ], mas é ${descrever(valor)}`);
  }
  if (regra.min !== undefined && valor.length < regra.min) {
    reportar(ctx, 'erro', campo, `precisa de pelo menos ${regra.min} ${regra.min === 1 ? 'item' : 'itens'}`);
  }
  valor.forEach((item, i) => validarValor(regra.item, item, juntar(campo, i), ctx));
  regra.verificar?.(valor, campo, ctx);
}

function validarVariante(regra, valor, campo, ctx) {
  if (!ehObjeto(valor)) {
    return reportar(ctx, 'erro', campo, `deveria ser um objeto { … }, mas é ${descrever(valor)}`);
  }
  const opcao = valor[regra.chave];
  const aceitas = Object.keys(regra.opcoes);
  if (opcao === undefined || opcao === null || opcao === '') {
    return reportar(ctx, 'erro', juntar(campo, regra.chave), `campo obrigatório ausente. Use: ${citar(aceitas)}`);
  }
  if (!Object.hasOwn(regra.opcoes, opcao)) {
    return reportar(ctx, 'erro', juntar(campo, regra.chave), `${JSON.stringify(opcao)} não é aceito. Use: ${citar(aceitas)}`);
  }
  validarValor(regra.opcoes[opcao], valor, campo, ctx);
}

// ---------- Entradas públicas ----------

// Cada problema: { nivel: 'erro' | 'aviso', arquivo, campo, mensagem, marcador? }

export function validarPagina(chave, dados, existeArquivo) {
  const pagina = PAGINAS[chave];
  if (!pagina) throw new Error(`página desconhecida: ${chave}`);
  const ctx = { arquivo: `content/${pagina.arquivo}`, pastaMidia: null, existeArquivo, problemas: [] };
  validarValor(pagina.esquema, dados, '', ctx);
  return ctx.problemas;
}

export function validarProjeto(slug, dados, existeArquivo) {
  const ctx = {
    arquivo: `content/projetos/${slug}/projeto.json`,
    pastaMidia: `projetos/${slug}`,
    existeArquivo,
    problemas: [],
  };
  if (!SLUG.test(slug)) {
    ctx.problemas.push({
      nivel: 'erro',
      arquivo: `content/projetos/${slug}/`,
      campo: '',
      mensagem: 'nome de pasta inválido. O slug usa só letras minúsculas sem acento, números e hífens (ex.: "meu-projeto")',
    });
  }
  validarValor(ESQUEMA_PROJETO, dados, '', ctx);
  return ctx.problemas;
}

// conteudo: { site, home, sobre, contato, erro404, projetos: [{ slug, dados }] }
// Páginas ausentes (undefined) são ignoradas aqui; quem carrega os arquivos informa a ausência.
export function validarConteudo(conteudo, existeArquivo) {
  const problemas = [];
  for (const chave of Object.keys(PAGINAS)) {
    if (conteudo[chave] !== undefined) problemas.push(...validarPagina(chave, conteudo[chave], existeArquivo));
  }
  for (const { slug, dados } of conteudo.projetos ?? []) {
    problemas.push(...validarProjeto(slug, dados, existeArquivo));
  }
  return problemas;
}

export function formatarProblema({ arquivo, campo, mensagem }) {
  return campo ? `${arquivo} › ${campo}: ${mensagem}` : `${arquivo}: ${mensagem}`;
}
