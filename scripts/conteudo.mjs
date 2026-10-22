// Carrega content/ do disco e valida com src/validacao.js.
// Usado por validate.mjs e build.mjs.

import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGINAS, formatarProblema, validarConteudo } from '../src/validacao.js';
import { arquivoTraducao, traducoesDo } from '../src/idiomas.js';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT = path.join(RAIZ, 'content');

// Lista todos os arquivos de content/ (ignorando ocultos), com caminhos relativos
// separados por "/". A comparação é exata, inclusive maiúsculas e minúsculas,
// como no servidor de produção.
async function listarArquivos(pasta, prefixo = '') {
  const arquivos = new Set();
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const relativo = prefixo ? `${prefixo}/${item.name}` : item.name;
    if (item.isDirectory()) {
      for (const arquivo of await listarArquivos(path.join(pasta, item.name), relativo)) arquivos.add(arquivo);
    } else if (item.isFile()) {
      arquivos.add(relativo);
    }
  }
  return arquivos;
}

function erro(arquivo, mensagem) {
  return { nivel: 'erro', arquivo, campo: '', mensagem };
}

async function lerJson(relativo, problemas) {
  const exibicao = `content/${relativo}`;
  let bruto;
  try {
    bruto = await readFile(path.join(CONTENT, ...relativo.split('/')), 'utf8');
  } catch (e) {
    problemas.push(erro(exibicao, e.code === 'ENOENT' ? 'arquivo não encontrado' : `não foi possível ler (${e.message})`));
    return undefined;
  }
  if (bruto.charCodeAt(0) === 0xfeff) bruto = bruto.slice(1);
  try {
    return JSON.parse(bruto);
  } catch (e) {
    problemas.push(erro(exibicao, `JSON inválido — ${e.message}`));
    return undefined;
  }
}

// Devolve { conteudo, arquivos, problemas }.
// conteudo: { site, home, sobre, contato, erro404, projetos: [{ slug, dados }],
//             traducoes: { [codigo]: { paginas: { [chave]: dados }, projetos: { [slug]: dados } } } }
// Uma tradução que não existe fica de fora (todos os textos usam o idioma principal).
export async function carregarConteudo() {
  const problemas = [];
  const conteudo = { projetos: [] };

  if (!existsSync(CONTENT)) {
    problemas.push(erro('content/', 'pasta não encontrada'));
    return { conteudo, arquivos: new Set(), problemas };
  }

  const arquivos = await listarArquivos(CONTENT);

  for (const [chave, { arquivo }] of Object.entries(PAGINAS)) {
    conteudo[chave] = await lerJson(arquivo, problemas);
  }

  const pastaProjetos = path.join(CONTENT, 'projetos');
  const itens = existsSync(pastaProjetos) ? await readdir(pastaProjetos, { withFileTypes: true }) : [];
  for (const item of itens.sort((a, b) => a.name.localeCompare(b.name))) {
    if (item.name.startsWith('.')) continue;
    const exibicao = `content/projetos/${item.name}`;
    if (!item.isDirectory()) {
      problemas.push(erro(exibicao, 'arquivo solto em projetos/. Cada projeto fica na própria pasta'));
      continue;
    }
    if (!arquivos.has(`projetos/${item.name}/projeto.json`)) {
      problemas.push(erro(`${exibicao}/`, 'pasta sem projeto.json'));
      continue;
    }
    const dados = await lerJson(`projetos/${item.name}/projeto.json`, problemas);
    if (dados !== undefined) conteudo.projetos.push({ slug: item.name, dados });
  }

  conteudo.traducoes = {};
  for (const { codigo } of traducoesDo(conteudo.site)) {
    const traducao = { paginas: {}, projetos: {} };
    for (const [chave, { arquivo }] of Object.entries(PAGINAS)) {
      const caminho = arquivoTraducao(arquivo, codigo);
      if (arquivos.has(caminho)) traducao.paginas[chave] = await lerJson(caminho, problemas);
    }
    for (const { slug } of conteudo.projetos) {
      const caminho = arquivoTraducao(`projetos/${slug}/projeto.json`, codigo);
      if (arquivos.has(caminho)) traducao.projetos[slug] = await lerJson(caminho, problemas);
    }
    conteudo.traducoes[codigo] = traducao;
  }

  return { conteudo, arquivos, problemas };
}

export async function validarDoDisco() {
  const { conteudo, arquivos, problemas } = await carregarConteudo();
  problemas.push(...validarConteudo(conteudo, (relativo) => arquivos.has(relativo)));
  return { conteudo, problemas };
}

// Imprime o resultado da validação. Devolve true se não houver erros.
export function imprimirRelatorio(conteudo, problemas) {
  const erros = problemas.filter((p) => p.nivel === 'erro');
  const avisos = problemas.filter((p) => p.nivel === 'aviso' && !p.marcador && !p.pendente);
  const marcadores = problemas.filter((p) => p.marcador);
  const pendentes = problemas.filter((p) => p.pendente);

  const paginas = Object.keys(PAGINAS).filter((chave) => conteudo[chave] !== undefined).length;
  const projetos = conteudo.projetos.length;
  console.log(`Validação de content/: ${paginas} páginas e ${projetos} ${projetos === 1 ? 'projeto' : 'projetos'} lidos.`);

  if (marcadores.length > 0) {
    console.log(`\nMarcadores […] a preencher (${marcadores.length}):`);
    const porArquivo = new Map();
    for (const p of marcadores) porArquivo.set(p.arquivo, [...(porArquivo.get(p.arquivo) ?? []), p.campo]);
    for (const [arquivo, campos] of porArquivo) console.log(`  ${arquivo}: ${campos.join(', ')}`);
  }

  if (pendentes.length > 0) {
    console.log(`\nTraduções pendentes (${pendentes.length} textos usam o idioma principal):`);
    const porArquivo = new Map();
    for (const p of pendentes) porArquivo.set(p.arquivo, (porArquivo.get(p.arquivo) ?? 0) + 1);
    for (const [arquivo, total] of porArquivo) console.log(`  ${arquivo}: ${total} ${total === 1 ? 'texto' : 'textos'}`);
  }

  if (avisos.length > 0) {
    console.warn(`\nAvisos (${avisos.length}):`);
    for (const p of avisos) console.warn(`  - ${formatarProblema(p)}`);
  }

  if (erros.length > 0) {
    console.error(`\n${erros.length} ${erros.length === 1 ? 'erro' : 'erros'}:`);
    for (const p of erros) console.error(`  - ${formatarProblema(p)}`);
    return false;
  }

  console.log('\nConteúdo válido.');
  return true;
}
