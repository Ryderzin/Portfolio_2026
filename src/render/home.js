// Home: abertura e grade de capas.

import { MOLDURAS } from '../validacao.js';
import { pagina } from './layout.js';
import { attrs, esc, imagem, urlMidia } from './util.js';

export function capa({ slug, dados }, { prioridade = false } = {}) {
  const previa = dados.capa.previa
    ? attrs({ 'data-previa': urlMidia(dados.capa.previa.src, slug) })
    : '';
  const janela = [
    'capa__janela',
    dados.capa.encaixe === 'conter' && 'capa__janela--conter',
    MOLDURAS.includes(dados.capa.moldura) && `capa__janela--moldura-${dados.capa.moldura}`,
  ].filter(Boolean).join(' ');
  return `<li class="capas__item">
  <a class="capa" href="/projetos/${esc(slug)}/">
    ${dados.ocultarFaixa ? '' : `<span class="faixa faixa--capa rotulo">${esc(dados.categoria)}</span>`}
    <span class="capa__titulo titulo"><span class="marca">${esc(dados.titulo)}</span></span>
    <span class="capa__subtitulo titulo"><span class="marca">${esc(dados.subtitulo)}</span></span>
    <span class="${janela}"${previa}${attrs({ style: `--proporcao-capa: ${+(dados.capa.largura / dados.capa.altura).toFixed(4)}` })}>${imagem(dados.capa, { slug, prioridade, destaque: prioridade, classe: 'capa__imagem' })}</span>
  </a>
</li>`;
}

// conteudo: { site, home, projetos (já ordenados e publicados) }
export function renderHome({ site, home, projetos }) {
  const capas = projetos.map((projeto, i) => capa(projeto, { prioridade: i === 0 })).join('\n');

  const conteudo = `<main>
    <section class="abertura container" aria-labelledby="nome">
      <div class="abertura__caixa">
        <h1 class="abertura__nome" id="nome"><span class="marca">${esc(home.nome)}</span></h1>
        <p class="abertura__especialidades"><span class="marca">${esc(home.especialidades)}</span></p>
        <p class="abertura__apresentacao">${esc(home.apresentacao)}</p>
      </div>
    </section>

    <section class="secao-projetos container" id="projetos" aria-labelledby="titulo-projetos">
      <h2 class="titulo-secao" id="titulo-projetos"><span class="marca">${esc(home.tituloProjetos)}</span></h2>
      <ul class="capas">
${capas}
      </ul>
    </section>
  </main>`;

  return pagina({
    site,
    caminho: '/',
    descricao: site.descricao,
    ativo: '/',
    chamadaRodape: home.chamadaRodape,
    conteudo,
  });
}
