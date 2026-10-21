// Utilitários dos renderizadores. Funções puras: sem DOM, rede ou disco.

import { anoFinal, urlPermitida } from '../validacao.js';

const ENTIDADES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Escapa texto para HTML (conteúdo e atributos).
export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c]);
}

// Devolve a URL se for permitida (https, http, mailto, tel ou relativa); senão null.
export function urlSegura(valor) {
  return urlPermitida(valor) ? String(valor).trim() : null;
}

export function ehExterna(url) {
  return /^https?:\/\//i.test(url);
}

// Monta atributos: { href: '/x', hidden: true, alt: '' } → ' href="/x" hidden alt=""'.
// Valores null, undefined e false são omitidos.
export function attrs(objeto) {
  let saida = '';
  for (const [nome, valor] of Object.entries(objeto)) {
    if (valor === null || valor === undefined || valor === false) continue;
    saida += valor === true ? ` ${nome}` : ` ${nome}="${esc(valor)}"`;
  }
  return saida;
}

// Atributos de link: URL segura e, para links externos, nova aba com rel="noopener".
export function attrsLink(url) {
  const segura = urlSegura(url);
  if (!segura) return null;
  return ehExterna(segura) ? attrs({ href: segura, target: '_blank', rel: 'noopener' }) : attrs({ href: segura });
}

// Caminho público de uma mídia: "/midia/…" fica como está; o resto é relativo à pasta do projeto.
export function urlMidia(src, slug) {
  if (src.startsWith('/')) return src;
  return slug ? `/projetos/${slug}/${src}` : `/${src}`;
}

// <img> com width/height; lazy por padrão, eager na primeira dobra.
// fetchpriority="high" só com destaque (a primeira capa da home).
export function imagem({ src, alt, largura, altura }, { slug, prioridade = false, destaque = false, classe } = {}) {
  return `<img${attrs({
    class: classe,
    src: urlMidia(src, slug),
    alt,
    width: largura,
    height: altura,
    loading: prioridade ? 'eager' : 'lazy',
    fetchpriority: destaque ? 'high' : null,
    decoding: 'async',
  })}>`;
}

// Troca {chave} por valores já escapados.
export function preencher(modelo, valores) {
  return esc(modelo).replace(/\{(\w+)\}/g, (inteiro, chave) => (chave in valores ? esc(valores[chave]) : inteiro));
}

// Carrossel: a lista rola na horizontal com encaixe e recebe foco (setas do teclado).
// Com várias imagens, ganha os botões anterior/próxima e o contador, que o site.js ativa;
// sem JavaScript, os controles ficam ocultos e a lista rola pela barra do navegador.
// itens: [{ html, tamanho? }]; classes: { lista, item }.
export function carrossel(itens, { classes, nome, rotulos }) {
  const varios = itens.length > 1;
  const r = rotulos.projeto;
  const lis = itens.map(({ html, tamanho }) => `<li${attrs({ class: classes.item, 'data-tamanho': tamanho })}>${html}</li>`).join('\n');
  const lista = `<ul${attrs({
    class: `${classes.lista} carrossel__trilho`,
    tabindex: varios ? '0' : null,
    'aria-label': varios ? nome : null,
  })}>
${lis}
</ul>`;
  if (!varios) return lista;
  const contador = preencher(r.contadorImagens, { atual: 1, total: itens.length });
  return `<div class="carrossel" data-carrossel>
${lista}
<div class="carrossel__controles" hidden>
  <button type="button" class="botao botao--secundario carrossel__botao" data-direcao="-1"${attrs({ 'aria-label': r.imagemAnterior })}>${seta('←')}</button>
  <span class="carrossel__contador rotulo"${attrs({ 'data-modelo': r.contadorImagens })}><span class="marca" aria-live="polite">${contador}</span></span>
  <button type="button" class="botao botao--secundario carrossel__botao" data-direcao="1"${attrs({ 'aria-label': r.proximaImagem })}>${seta('→')}</button>
</div>
</div>`;
}

export const seta = (caractere) => `<span class="seta" aria-hidden="true">${caractere}</span>`;

// Junta pedaços de HTML ignorando vazios.
export function juntar(...partes) {
  return partes.flat().filter(Boolean).join('\n');
}

// Projetos publicados, na ordem da home: ordem crescente, empate pelo ano final decrescente.
export function ordenarProjetos(projetos) {
  return projetos
    .filter(({ dados }) => dados.publicado === true)
    .sort((a, b) => a.dados.ordem - b.dados.ordem || anoFinal(b.dados.ano) - anoFinal(a.dados.ano) || a.slug.localeCompare(b.slug));
}

// Ano ou período para exibir: "2022-2026" vira "2022–2026" (travessão tipográfico).
export function formatarAno(valor) {
  return String(valor ?? '').trim().replace(/^(\d{4})\s*[-–]\s*(\d{4})$/, '$1–$2');
}

// Texto opcional preenchido?
export function preenchido(valor) {
  return typeof valor === 'string' ? valor.trim() !== '' : valor !== undefined && valor !== null;
}
