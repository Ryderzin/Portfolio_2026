// Subconjunto próprio de Markdown, sem HTML bruto.
// Blocos: parágrafos (linha em branco separa), "### " (título), listas "- " e "1. ".
// Em linha: **negrito**, *itálico*, `código` e [texto](url).
// Todo texto é escapado antes de virar HTML; links só com URLs permitidas.

import { attrsLink, esc } from './util.js';

const CODIGO = /`([^`\n]+)`/;
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/;

function enfase(escapado) {
  return escapado
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
}

// Texto sem código: links + ênfase.
function textoComLinks(bruto) {
  let saida = '';
  let resto = bruto;
  let achado;
  while ((achado = LINK.exec(resto))) {
    saida += enfase(esc(resto.slice(0, achado.index)));
    const rotulo = enfase(esc(achado[1]));
    const atributos = attrsLink(achado[2]);
    saida += atributos ? `<a${atributos}>${rotulo}</a>` : rotulo;
    resto = resto.slice(achado.index + achado[0].length);
  }
  return saida + enfase(esc(resto));
}

export function emLinha(bruto) {
  let saida = '';
  let resto = String(bruto ?? '');
  let achado;
  while ((achado = CODIGO.exec(resto))) {
    saida += textoComLinks(resto.slice(0, achado.index));
    saida += `<code>${esc(achado[1])}</code>`;
    resto = resto.slice(achado.index + achado[0].length);
  }
  return saida + textoComLinks(resto);
}

function lista(linhas, ordenada) {
  const marca = ordenada ? /^\d+\.\s+/ : /^-\s+/;
  const itens = linhas.map((linha) => `<li>${emLinha(linha.replace(marca, ''))}</li>`).join('');
  return ordenada ? `<ol>${itens}</ol>` : `<ul>${itens}</ul>`;
}

// opcoes.nivel: nível do título gerado por "### " (3 por padrão; 2 quando o texto fica logo abaixo do h1).
export function markdown(bruto, { nivel = 3 } = {}) {
  const blocos = String(bruto ?? '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
  const saida = [];
  for (const bloco of blocos) {
    let linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) continue;

    if (linhas[0].startsWith('### ')) {
      saida.push(`<h${nivel}>${emLinha(linhas[0].slice(4))}</h${nivel}>`);
      linhas = linhas.slice(1);
      if (linhas.length === 0) continue;
    }

    if (linhas.every((l) => /^-\s+/.test(l))) saida.push(lista(linhas, false));
    else if (linhas.every((l) => /^\d+\.\s+/.test(l))) saida.push(lista(linhas, true));
    else saida.push(`<p>${linhas.map(emLinha).join('\n')}</p>`);
  }
  return saida.join('\n');
}
