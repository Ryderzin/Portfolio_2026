// Um renderizador por tipo de bloco de projeto.

import { idDeVideo } from '../validacao.js';
import { markdown } from './markdown.js';
import { attrs, esc, imagem, preenchido, urlMidia } from './util.js';

function legenda(texto) {
  return preenchido(texto) ? `<figcaption class="legenda"><span class="marca">${esc(texto)}</span></figcaption>` : '';
}

function blocoTexto(bloco) {
  return `<div class="bloco bloco-texto texto-corrido">
${markdown(bloco.markdown, { nivel: 2 })}
</div>`;
}

function blocoGaleria(bloco, { slug }) {
  const carrossel = bloco.layout === 'carrossel';
  const imagens = bloco.imagens
    .map((img) => `<li class="galeria__item">${imagem(img, { slug })}</li>`)
    .join('\n');
  // O carrossel rola na horizontal; tabindex deixa rolar pelo teclado.
  return `<figure class="bloco bloco-galeria galeria galeria--${esc(bloco.layout)}">
<ul class="galeria__lista"${attrs({
    tabindex: carrossel ? '0' : null,
    'aria-label': carrossel && preenchido(bloco.legenda) ? bloco.legenda : null,
  })}>
${imagens}
</ul>
${legenda(bloco.legenda)}
</figure>`;
}

function blocoVideoArquivo(bloco, { slug }) {
  const video = `<video${attrs({
    class: 'midia-video',
    src: urlMidia(bloco.src, slug),
    width: bloco.largura,
    height: bloco.altura,
    controls: true,
    preload: 'none',
    playsinline: true,
    loop: bloco.loop,
    muted: bloco.mudo,
    'data-autoplay': bloco.autoplay ? 'sim' : null,
  })}></video>`;
  return `<figure class="bloco bloco-video">
${video}
${legenda(bloco.legenda)}
</figure>`;
}

function enderecoIncorporado(url) {
  const video = idDeVideo(url);
  if (!video) return null;
  return video.servico === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`
    : `https://player.vimeo.com/video/${encodeURIComponent(video.id)}`;
}

function blocoVideoLink(bloco, { rotulos }) {
  const src = enderecoIncorporado(bloco.url);
  if (!src) return '';
  const iframe = `<iframe${attrs({
    class: 'midia-incorporada',
    src,
    title: preenchido(bloco.legenda) ? bloco.legenda : rotulos.projeto.video,
    loading: 'lazy',
    allow: 'fullscreen; picture-in-picture',
    referrerpolicy: 'strict-origin-when-cross-origin',
  })}></iframe>`;
  return `<figure class="bloco bloco-video">
<div class="moldura-16x9">${iframe}</div>
${legenda(bloco.legenda)}
</figure>`;
}

function blocoCodigo(bloco) {
  const linguagem = esc(bloco.linguagem);
  return `<figure class="bloco bloco-codigo">
<figcaption class="bloco-codigo__linguagem rotulo">${linguagem}</figcaption>
<pre tabindex="0"><code class="linguagem-${linguagem}">${esc(bloco.codigo)}</code></pre>
</figure>`;
}

function blocoCitacao(bloco) {
  const autor = preenchido(bloco.autor) ? `<figcaption class="citacao__autor rotulo">${esc(bloco.autor)}</figcaption>` : '';
  return `<figure class="bloco bloco-citacao">
<blockquote><p>${esc(bloco.texto)}</p></blockquote>
${autor}
</figure>`;
}

// contexto: { slug, rotulos }
export function bloco(dados, contexto) {
  switch (dados.tipo) {
    case 'texto': return blocoTexto(dados);
    case 'galeria': return blocoGaleria(dados, contexto);
    case 'video': return dados.origem === 'link' ? blocoVideoLink(dados, contexto) : blocoVideoArquivo(dados, contexto);
    case 'codigo': return blocoCodigo(dados);
    case 'citacao': return blocoCitacao(dados);
    default: return '';
  }
}

export function blocos(lista, contexto) {
  return lista.map((dados) => bloco(dados, contexto)).filter(Boolean).join('\n');
}
