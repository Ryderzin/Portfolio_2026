// Página Sobre: foto, texto, tecnologias, experiência e currículo.

import { pagina } from './layout.js';
import { markdown } from './markdown.js';
import { attrs, esc, imagem, preenchido, rota, seta } from './util.js';

function foto(dados) {
  if (!dados.foto) return '';
  const legenda = preenchido(dados.foto.legenda)
    ? `<figcaption class="legenda"><span class="marca">${esc(dados.foto.legenda)}</span></figcaption>`
    : '';
  return `<figure class="sobre__foto">
  ${imagem(dados.foto, { prioridade: true })}
  ${legenda}
</figure>`;
}

function tecnologias(dados, rotulos) {
  if (!dados.tecnologias.length) return '';
  const grupos = dados.tecnologias
    .map(({ grupo, itens }) => `<li class="caixa tecnologia">
  <h3 class="caixa__titulo rotulo">${esc(grupo)}</h3>
  <p>${itens.map(esc).join(' · ')}</p>
</li>`)
    .join('\n');
  return `<section class="sobre__secao" aria-labelledby="titulo-tecnologias">
  <h2 class="titulo-interno" id="titulo-tecnologias"><span class="marca">${esc(rotulos.sobre.tecnologias)}</span></h2>
  <ul class="tecnologias">
${grupos}
  </ul>
</section>`;
}

function experiencia(dados, rotulos) {
  if (!dados.experiencia.length) return '';
  const itens = dados.experiencia
    .map(({ periodo, cargo, empresa, resumo }) => `<li class="experiencia__item">
  <p class="experiencia__periodo rotulo">${esc(periodo)}</p>
  <div>
    <h3 class="experiencia__cargo titulo">${esc(cargo)} · ${esc(empresa)}</h3>
    <p class="experiencia__resumo">${esc(resumo)}</p>
  </div>
</li>`)
    .join('\n');
  return `<section class="sobre__secao" aria-labelledby="titulo-experiencia">
  <h2 class="titulo-interno" id="titulo-experiencia"><span class="marca">${esc(rotulos.sobre.experiencia)}</span></h2>
  <ol class="caixa experiencia">
${itens}
  </ol>
</section>`;
}

// conteudo: { site, sobre }
export function renderSobre({ site, sobre }) {
  const { rotulos } = site;
  const curriculo = preenchido(sobre.curriculo)
    ? `<a class="botao botao--primario"${attrs({ href: sobre.curriculo })}>${esc(rotulos.sobre.baixarCurriculo)}</a>`
    : '';

  const conteudo = `<main class="container">
    <article class="cartao-pagina sobre">
      <h1 class="titulo-pagina"><span class="marca">${esc(sobre.titulo)}</span></h1>
      <div class="sobre__intro">
        ${foto(sobre)}
        <div class="sobre__texto texto-corrido">
          <p class="sobre__destaque titulo">${esc(sobre.destaque)}</p>
${markdown(sobre.texto, { nivel: 2 })}
        </div>
      </div>
      ${tecnologias(sobre, rotulos)}
      ${experiencia(sobre, rotulos)}
      <div class="acoes rotulo">
        ${curriculo}
        <a class="botao ${curriculo ? 'botao--secundario' : 'botao--primario'}" ${attrs({ href: rota(site, '/#projetos') })}>${esc(rotulos.geral.verProjetos)} ${seta('→')}</a>
      </div>
    </article>
  </main>`;

  return pagina({
    site,
    caminho: '/sobre/',
    titulo: sobre.titulo,
    descricao: sobre.destaque,
    imagem: sobre.foto ?? null,
    ativo: '/sobre/',
    conteudo,
  });
}
