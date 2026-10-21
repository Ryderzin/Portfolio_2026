// Página de projeto: card com lombada, galeria do topo, blocos, ficha, links e próximo projeto.

import { blocos } from './blocos.js';
import { pagina } from './layout.js';
import { attrs, attrsLink, esc, formatarAno, imagem, preencher, preenchido, seta, urlMidia } from './util.js';

// Carrossel horizontal com rolagem por encaixe. Com mais de uma imagem, a lista recebe foco
// (rola com as setas do teclado) e um nome acessível. Só a primeira imagem é da primeira dobra.
function galeriaTopo(imagens, slug, rotulos) {
  if (!imagens?.length) return '';
  const varias = imagens.length > 1;
  const itens = imagens.map((img, i) => `<li class="galeria-topo__item">${imagem(img, { slug, prioridade: i === 0 })}</li>`).join('\n');
  return `<ul class="galeria-topo${varias ? '' : ' galeria-topo--uma'}"${attrs({
    tabindex: varias ? '0' : null,
    'aria-label': varias ? rotulos.projeto.galeriaTopo : null,
  })}>
${itens}
</ul>`;
}

function jogar(dados, rotulos) {
  const atributos = dados.jogar && preenchido(dados.jogar.url) ? attrsLink(dados.jogar.url) : null;
  if (!atributos) return '';
  return `<div class="jogar">
  <a class="botao botao--primario botao--grande"${atributos}>${seta('▶')} ${esc(rotulos.projeto.jogarOnline)} ${seta('↗')}</a>
  <span class="jogar__onde"><span class="marca">${preencher(rotulos.projeto.abreEm, { onde: dados.jogar.onde })}</span></span>
</div>`;
}

function ficha(dados, rotulos) {
  const r = rotulos.projeto;
  const linhas = [
    [r.tecnologia, dados.ficha.tecnologia],
    [r.linguagem, dados.ficha.linguagem],
    [r.plataformas, dados.ficha.plataformas],
    [r.ano, formatarAno(dados.ano)],
    [r.papel, dados.ficha.papel],
  ]
    .filter(([, valor]) => preenchido(valor))
    .map(([rotulo, valor]) => `<dt>${esc(rotulo)}</dt><dd>${esc(valor)}</dd>`)
    .join('\n');
  return `<section class="caixa ficha" aria-labelledby="titulo-ficha">
  <h2 class="caixa__titulo rotulo" id="titulo-ficha">${esc(r.fichaTecnica)}</h2>
  <dl class="ficha__lista">
${linhas}
  </dl>
</section>`;
}

function links(dados, rotulos) {
  const itens = dados.links
    .map(({ rotulo, url }, i) => {
      const atributos = attrsLink(url);
      if (!atributos) return '';
      const classe = i === 0 ? 'botao botao--primario botao--lista' : 'botao botao--secundario botao--lista';
      return `<li><a class="${classe}"${atributos}>${esc(rotulo)} ${seta('→')}</a></li>`;
    })
    .filter(Boolean)
    .join('\n');
  if (!itens) return '';
  return `<section class="caixa links" aria-labelledby="titulo-links">
  <h2 class="caixa__titulo rotulo" id="titulo-links">${esc(rotulos.projeto.links)}</h2>
  <ul class="links__lista rotulo">
${itens}
  </ul>
</section>`;
}

function rodapeProjeto(dados, proximo, rotulos) {
  const link = proximo
    ? `<a class="proximo titulo"${attrs({ href: `/projetos/${proximo.slug}/` })}><span class="marca">${esc(rotulos.projeto.proximoProjeto)} ${seta('→')}</span></a>`
    : '';
  return `<div class="card-projeto__fim">
  <p class="card-projeto__meta"><span class="marca">${esc(dados.categoria)} · ${esc(formatarAno(dados.ano))}</span></p>
  ${link}
</div>`;
}

// conteudo: { site, projeto: { slug, dados }, proximo?: { slug, dados } }
export function renderProjeto({ site, projeto, proximo }) {
  const { slug, dados } = projeto;
  const { rotulos } = site;
  const stackAno = `${esc(dados.stack)} · ${esc(formatarAno(dados.ano))}`;

  const conteudo = `<div class="container voltar">
    <a class="botao botao--secundario botao--pequeno" href="/">${seta('←')} ${esc(rotulos.projeto.voltarProjetos)}</a>
  </div>

  <main class="container">
    <article class="card-projeto">
      ${dados.ocultarFaixa ? '' : `<span class="faixa faixa--card rotulo">${esc(dados.categoria)}</span>`}
      <div class="card-projeto__conteudo">
        <p class="card-projeto__stack rotulo"><span class="marca">${stackAno}</span></p>
        ${galeriaTopo(dados.galeriaTopo, slug, rotulos)}
        <header class="card-projeto__titulos">
          <h1 class="card-projeto__titulo"><span class="marca">${esc(dados.titulo)}</span></h1>
          <p class="card-projeto__subtitulo titulo"><span class="marca">${esc(dados.subtitulo)}</span></p>
        </header>
        ${jogar(dados, rotulos)}
        <div class="card-projeto__blocos">
${blocos(dados.blocos, { slug, rotulos })}
        </div>
        <div class="card-projeto__caixas">
          ${ficha(dados, rotulos)}
          ${links(dados, rotulos)}
        </div>
        ${rodapeProjeto(dados, proximo, rotulos)}
      </div>
      <div class="lombada" aria-hidden="true">
        <span class="lombada__titulo titulo">${esc(dados.titulo)}</span>
        <span class="lombada__stack rotulo">${stackAno}</span>
      </div>
    </article>
  </main>`;

  return pagina({
    site,
    caminho: `/projetos/${slug}/`,
    titulo: dados.titulo,
    descricao: dados.subtitulo,
    imagem: { ...dados.capa, src: urlMidia(dados.capa.src, slug) },
    tipo: 'article',
    ativo: '/',
    conteudo,
  });
}
