// Página Contato: CTA de e-mail e cartões (e-mail, telefone, LinkedIn, GitHub).

import { pagina } from './layout.js';
import { attrsLink, esc, preenchido, seta } from './util.js';

function linkEmail(contato) {
  return `mailto:${contato.email}?subject=${encodeURIComponent(contato.assuntoEmail)}`;
}

// O link tel: leva só dígitos e "+".
function linkTelefone(telefone) {
  return `tel:${telefone.replace(/[^\d+]/g, '')}`;
}

// Texto exibido no cartão: o caminho do perfil, mais curto que a URL.
function exibicaoLinkedin(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || url;
  } catch {
    return url;
  }
}

function exibicaoGithub(url) {
  try {
    const usuario = new URL(url).pathname.split('/').filter(Boolean)[0];
    return usuario ? `@${usuario}` : url;
  } catch {
    return url;
  }
}

function cartao(rotulo, valor, url) {
  const atributos = attrsLink(url);
  if (!atributos) return '';
  return `<li><a class="cartao-contato"${atributos}>
  <span class="cartao-contato__textos">
    <span class="cartao-contato__rotulo rotulo">${esc(rotulo)}</span>
    <span class="cartao-contato__valor titulo">${esc(valor)}</span>
  </span>
  ${seta('→')}
</a></li>`;
}

// conteudo: { site, contato }
export function renderContato({ site, contato }) {
  const r = site.rotulos.contato;
  const cartoes = [
    cartao(r.email, contato.email, `mailto:${contato.email}`),
    preenchido(contato.telefone) ? cartao(r.telefone, contato.telefone, linkTelefone(contato.telefone)) : '',
    preenchido(contato.linkedin) ? cartao(r.linkedin, exibicaoLinkedin(contato.linkedin), contato.linkedin) : '',
    preenchido(contato.github) ? cartao(r.github, exibicaoGithub(contato.github), contato.github) : '',
  ].filter(Boolean).join('\n');

  const cta = attrsLink(linkEmail(contato));

  const conteudo = `<main class="container">
    <article class="cartao-pagina contato">
      <h1 class="titulo-pagina"><span class="marca">${esc(contato.titulo)}</span></h1>
      <p class="contato__frase"><span class="marca">${esc(contato.frase)}</span></p>
      ${cta ? `<a class="botao botao--primario botao--cta rotulo"${cta}>${esc(r.escreverEmail)} ${seta('→')}</a>` : ''}
      <ul class="cartoes-contato">
${cartoes}
      </ul>
    </article>
  </main>`;

  return pagina({
    site,
    caminho: '/contato/',
    titulo: contato.titulo,
    descricao: contato.frase,
    ativo: '/contato/',
    conteudo,
  });
}
