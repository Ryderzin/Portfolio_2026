// Página 404: número, título, frase, dois botões e uma capa vazia decorativa.

import { pagina } from './layout.js';
import { attrs, esc, rota, seta } from './util.js';

// O servidor responde com o 404 do idioma principal para qualquer endereço que não existe.
// Se o endereço é de outro idioma ("/en/…"), o script troca pelo 404 desse idioma.
function redirecionarIdioma(site) {
  const { lingua } = site;
  if (!lingua || lingua.codigo !== lingua.principal) return '';
  const prefixos = lingua.todos.map(({ prefixo }) => prefixo).filter(Boolean);
  if (!prefixos.length) return '';
  return `<script>(function(p){var l=${JSON.stringify(prefixos)};for(var i=0;i<l.length;i++){`
    + 'if(p.indexOf(l[i]+"/")===0&&p!==l[i]+"/404.html"){location.replace(l[i]+"/404.html");return}}'
    + '})(location.pathname)</script>';
}

// conteudo: { site, erro404 }
export function renderErro404({ site, erro404 }) {
  const { rotulos } = site;
  const conteudo = `${redirecionarIdioma(site)}<main class="container">
    <div class="erro">
      <div class="erro__texto">
        <h1 class="erro__codigo"><span class="marca">${esc(erro404.codigo)}</span></h1>
        <p class="erro__titulo titulo"><span class="marca">${esc(erro404.titulo)}</span></p>
        <p class="erro__frase">${esc(erro404.texto)}</p>
        <div class="acoes rotulo">
          <a class="botao botao--primario"${attrs({ href: rota(site, '/#projetos') })}>${esc(rotulos.geral.verProjetos)} ${seta('→')}</a>
          <a class="botao botao--secundario"${attrs({ href: rota(site, '/') })}>${esc(rotulos.geral.paginaInicial)}</a>
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
