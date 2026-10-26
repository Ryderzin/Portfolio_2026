// Estrutura comum das páginas: <head>, header com item ativo e rodapé.

import { attrs, attrsLink, esc, rota } from './util.js';

export const ESTILOS = ['tokens.css', 'base.css', 'componentes.css', 'paginas.css', 'movimento.css'];
export const FONTE_PRELOAD = '/fonts/dm-serif-display/dm-serif-display-latin-400-normal.woff2';

export function urlAbsoluta(site, caminho) {
  return site.url.replace(/\/+$/, '') + caminho;
}

// Roda antes da primeira pintura (sem piscar):
// - aplica o tema salvo (sem JS ou sem escolha: claro);
// - na home (de qualquer idioma), marca a entrada animada uma vez por sessão, se o movimento não estiver reduzido.
export function scriptInicial(site) {
  const homes = (site.lingua?.todos ?? [{ prefixo: '' }]).flatMap(({ prefixo }) => [`${prefixo}/`, `${prefixo}/index.html`]);
  return '<script>(function(d){'
    + 'try{if(localStorage.getItem("tema")==="escuro")d.dataset.tema="escuro"}catch(e){}'
    + `try{if(${JSON.stringify(homes)}.indexOf(location.pathname)>=0&&!sessionStorage.getItem("entrada")`
    + '&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("entrada");sessionStorage.setItem("entrada","1")}}catch(e){}'
    + '})(document.documentElement)</script>';
}

// Seletor de idioma: um link por idioma para a mesma página (no 404, para a home).
// O idioma atual fica marcado; no mobile só aparece o outro.
function seletorIdioma(site, caminho) {
  const { lingua } = site;
  if (!lingua || lingua.todos.length < 2) return '';
  const itens = lingua.todos.map(({ codigo, sigla, nome, prefixo }) => `<li><a${attrs({
    href: `${prefixo}${caminho}`,
    hreflang: codigo,
    lang: codigo,
    'aria-label': nome,
    'aria-current': codigo === lingua.codigo ? 'true' : null,
  })}>${esc(sigla)}</a></li>`).join('');
  return `<nav class="idiomas"${attrs({ 'aria-label': site.rotulos.geral.idiomas })}><ul>${itens}</ul></nav>`;
}

// <link rel="alternate" hreflang> de cada idioma, mais o x-default (o principal).
function alternativas(site, caminho) {
  const { lingua } = site;
  if (!lingua || lingua.todos.length < 2) return [];
  const links = lingua.todos.map(({ codigo, prefixo }) =>
    `<link rel="alternate"${attrs({ hreflang: codigo, href: urlAbsoluta(site, `${prefixo}${caminho}`) })}>`);
  links.push(`<link rel="alternate" hreflang="x-default"${attrs({ href: urlAbsoluta(site, caminho) })}>`);
  return links;
}

function cabecalho(site, ativo, caminhoIdioma) {
  const itens = site.navegacao.map(({ rotulo, caminho }) =>
    `<li><a${attrs({ href: rota(site, caminho), 'aria-current': caminho === ativo ? 'page' : null })}>${esc(rotulo)}</a></li>`).join('\n          ');
  return `<header class="cabecalho">
    <div class="container cabecalho__interno">
      <nav class="nav-principal"${attrs({ 'aria-label': site.rotulos.geral.navegacaoPrincipal })}>
        <ul>
          ${itens}
        </ul>
      </nav>
      ${seletorIdioma(site, caminhoIdioma)}
      ${botaoTema(site)}
    </div>
  </header>`;
}

function linksRodape(site, classe) {
  const itens = site.rodape.links
    .map(({ rotulo, url }) => {
      const atributos = attrsLink(url);
      return atributos ? `<li><a${atributos}>${esc(rotulo)}</a></li>` : '';
    })
    .join('');
  return itens ? `<ul class="${classe}">${itens}</ul>` : '';
}

// Botão de tema, no header: oculto sem JavaScript; o src/js/site.js mostra e controla.
// No mobile só o ícone aparece; o rótulo continua para leitores de tela.
function botaoTema(site) {
  return `<button type="button" class="botao-tema rotulo" aria-pressed="false" hidden><span class="botao-tema__icone" aria-hidden="true"></span> <span class="botao-tema__rotulo">${esc(site.rotulos.geral.temaEscuro)}</span></button>`;
}

function rodape(site, chamada) {
  if (chamada) {
    return `<footer class="rodape rodape--home container">
    <div class="rodape__caixa">
      <div>
        <p class="rodape__chamada titulo">${esc(chamada)}</p>
        <p class="rodape__texto">${esc(site.rodape.texto)}</p>
      </div>
      <div class="rodape__acoes">
        ${linksRodape(site, 'rodape__links rotulo')}
      </div>
    </div>
  </footer>`;
  }
  return `<footer class="rodape rodape--simples container">
    <p class="rodape__texto rotulo"><span class="marca">${esc(site.rodape.texto)}</span></p>
    <div class="rodape__acoes">
      ${linksRodape(site, 'rodape__links rodape__links--marca rotulo')}
    </div>
  </footer>`;
}

// Página completa. caminho e ativo são os do idioma principal ("/sobre/"); o prefixo
// do idioma (site.lingua) é aplicado aqui.
// opcoes: { site, caminho, titulo?, descricao, imagem?, tipo?, noindex?, ativo?, chamadaRodape?, conteudo }
export function pagina({ site, caminho, titulo, descricao, imagem, tipo = 'website', noindex = false, ativo, chamadaRodape, conteudo }) {
  const tituloCompleto = titulo ? `${titulo} — ${site.titulo}` : site.titulo;
  const url = urlAbsoluta(site, rota(site, caminho));
  // Prévia de links: a imagem da página (a foto do Sobre) ou a do site.
  const compartilhada = imagem ?? site.imagem;
  // Páginas fora do índice (404) não têm equivalente: o seletor leva à home do outro idioma.
  const caminhoIdioma = noindex ? '/' : caminho;
  const meta = [
    `<meta name="description"${attrs({ content: descricao })}>`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical"${attrs({ href: url })}>`,
    `<meta property="og:type"${attrs({ content: tipo })}>`,
    `<meta property="og:site_name"${attrs({ content: site.titulo })}>`,
    `<meta property="og:title"${attrs({ content: tituloCompleto })}>`,
    `<meta property="og:description"${attrs({ content: descricao })}>`,
    `<meta property="og:url"${attrs({ content: url })}>`,
    `<meta property="og:locale"${attrs({ content: site.idioma.replace('-', '_') })}>`,
    ...(noindex ? [] : alternativas(site, caminho)),
  ];
  if (compartilhada) {
    meta.push(
      `<meta property="og:image"${attrs({ content: urlAbsoluta(site, compartilhada.src) })}>`,
      `<meta property="og:image:width"${attrs({ content: compartilhada.largura })}>`,
      `<meta property="og:image:height"${attrs({ content: compartilhada.altura })}>`,
      `<meta property="og:image:alt"${attrs({ content: compartilhada.alt })}>`,
      '<meta name="twitter:card" content="summary_large_image">',
    );
  }
  const estilos = ESTILOS.map((nome) => `<link rel="stylesheet" href="/css/${nome}">`).join('\n  ');

  return `<!doctype html>
<html${attrs({ lang: site.idioma })}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  ${scriptInicial(site)}
  <title>${esc(tituloCompleto)}</title>
  ${meta.join('\n  ')}
  <link rel="preload" href="${FONTE_PRELOAD}" as="font" type="font/woff2" crossorigin>
  ${estilos}
  <script type="module" src="/js/site.js"></script>
</head>
<body>
  ${cabecalho(site, ativo, caminhoIdioma)}

  ${conteudo}

  ${rodape(site, chamadaRodape)}
</body>
</html>
`;
}
