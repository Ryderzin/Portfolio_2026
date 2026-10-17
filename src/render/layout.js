// Estrutura comum das páginas: <head>, header com item ativo e rodapé.

import { attrs, attrsLink, esc } from './util.js';

export const ESTILOS = ['tokens.css', 'base.css', 'componentes.css', 'paginas.css', 'movimento.css'];
export const FONTE_PRELOAD = '/fonts/dm-serif-display/dm-serif-display-latin-400-normal.woff2';

export function urlAbsoluta(site, caminho) {
  return site.url.replace(/\/+$/, '') + caminho;
}

// Roda antes da primeira pintura (sem piscar):
// - aplica o tema salvo (sem JS ou sem escolha: claro);
// - na home, marca a entrada animada uma vez por sessão, se o movimento não estiver reduzido.
export const SCRIPT_INICIAL = '<script>(function(d){'
  + 'try{if(localStorage.getItem("tema")==="escuro")d.dataset.tema="escuro"}catch(e){}'
  + 'try{if((location.pathname==="/"||location.pathname==="/index.html")&&!sessionStorage.getItem("entrada")'
  + '&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.classList.add("entrada");sessionStorage.setItem("entrada","1")}}catch(e){}'
  + '})(document.documentElement)</script>';

function cabecalho(site, ativo) {
  const itens = site.navegacao.map(({ rotulo, caminho }) =>
    `<li><a${attrs({ href: caminho, 'aria-current': caminho === ativo ? 'page' : null })}>${esc(rotulo)}</a></li>`).join('\n          ');
  return `<header class="cabecalho">
    <div class="container cabecalho__interno">
      <nav class="nav-principal"${attrs({ 'aria-label': site.rotulos.geral.navegacaoPrincipal })}>
        <ul>
          ${itens}
        </ul>
      </nav>
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

// Botão de tema: oculto sem JavaScript; o src/js/site.js mostra e controla.
function botaoTema(site) {
  return `<button type="button" class="botao-tema rotulo" aria-pressed="false" hidden><span class="botao-tema__icone" aria-hidden="true">◐</span> ${esc(site.rotulos.geral.temaEscuro)}</button>`;
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
        ${botaoTema(site)}
      </div>
    </div>
  </footer>`;
  }
  return `<footer class="rodape rodape--simples container">
    <p class="rodape__texto rotulo"><span class="marca">${esc(site.rodape.texto)}</span></p>
    <div class="rodape__acoes">
      ${linksRodape(site, 'rodape__links rodape__links--marca rotulo')}
      ${botaoTema(site)}
    </div>
  </footer>`;
}

// Página completa.
// opcoes: { site, caminho, titulo?, descricao, imagem?, tipo?, noindex?, ativo?, chamadaRodape?, conteudo }
export function pagina({ site, caminho, titulo, descricao, imagem, tipo = 'website', noindex = false, ativo, chamadaRodape, conteudo }) {
  const tituloCompleto = titulo ? `${titulo} — ${site.titulo}` : site.titulo;
  const url = urlAbsoluta(site, caminho);
  const meta = [
    `<meta name="description"${attrs({ content: descricao })}>`,
    noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical"${attrs({ href: url })}>`,
    `<meta property="og:type"${attrs({ content: tipo })}>`,
    `<meta property="og:site_name"${attrs({ content: site.titulo })}>`,
    `<meta property="og:title"${attrs({ content: tituloCompleto })}>`,
    `<meta property="og:description"${attrs({ content: descricao })}>`,
    `<meta property="og:url"${attrs({ content: url })}>`,
    `<meta property="og:locale"${attrs({ content: site.idioma.replace('-', '_') })}>`,
  ];
  if (imagem) {
    meta.push(
      `<meta property="og:image"${attrs({ content: urlAbsoluta(site, imagem.src) })}>`,
      `<meta property="og:image:width"${attrs({ content: imagem.largura })}>`,
      `<meta property="og:image:height"${attrs({ content: imagem.altura })}>`,
      `<meta property="og:image:alt"${attrs({ content: imagem.alt })}>`,
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
  ${SCRIPT_INICIAL}
  <title>${esc(tituloCompleto)}</title>
  ${meta.join('\n  ')}
  <link rel="preload" href="${FONTE_PRELOAD}" as="font" type="font/woff2" crossorigin>
  ${estilos}
  <script type="module" src="/js/site.js"></script>
</head>
<body>
  ${cabecalho(site, ativo)}

  ${conteudo}

  ${rodape(site, chamadaRodape)}
</body>
</html>
`;
}
