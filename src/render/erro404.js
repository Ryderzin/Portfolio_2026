// Página 404: número, título, frase, dois botões e uma capa vazia decorativa.

import { pagina } from './layout.js';
import { esc, seta } from './util.js';

// conteudo: { site, erro404 }
export function renderErro404({ site, erro404 }) {
  const { rotulos } = site;
  const conteudo = `<main class="container">
    <div class="erro">
      <div class="erro__texto">
        <h1 class="erro__codigo"><span class="marca">${esc(erro404.codigo)}</span></h1>
        <p class="erro__titulo titulo"><span class="marca">${esc(erro404.titulo)}</span></p>
        <p class="erro__frase">${esc(erro404.texto)}</p>
        <div class="acoes rotulo">
          <a class="botao botao--primario" href="/#projetos">${esc(rotulos.geral.verProjetos)} ${seta('→')}</a>
          <a class="botao botao--secundario" href="/">${esc(rotulos.geral.paginaInicial)}</a>
        </div>
      </div>
      <div class="erro__capa" aria-hidden="true">
        <span class="faixa faixa--capa rotulo">${esc(erro404.codigo)}</span>
        <span class="erro__capa-titulo"></span>
        <span class="erro__capa-subtitulo"></span>
        <span class="erro__capa-janela"></span>
      </div>
    </div>
  </main>`;

  return pagina({
    site,
    caminho: '/404.html',
    titulo: erro404.titulo,
    descricao: erro404.texto,
    noindex: true,
    conteudo,
  });
}
