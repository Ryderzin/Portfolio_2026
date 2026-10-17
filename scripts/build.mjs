// Gera o site estático em dist/.
// Uso: node scripts/build.mjs

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imprimirRelatorio, validarDoDisco } from './conteudo.mjs';
import { urlAbsoluta } from '../src/render/layout.js';
import { ordenarProjetos } from '../src/render/util.js';
import { renderHome } from '../src/render/home.js';
import { renderProjeto } from '../src/render/projeto.js';
import { renderSobre } from '../src/render/sobre.js';
import { renderContato } from '../src/render/contato.js';
import { renderErro404 } from '../src/render/erro404.js';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');

// Copiados como estão: [origem, destino dentro de dist/].
const COPIAS = [
  ['src/styles', 'css'],
  ['src/fonts', 'fonts'],
  ['src/js', 'js'],
  ['content/midia', 'midia'],
  ['admin', 'admin'],
  ['src/render', 'admin/render'],
  ['src/validacao.js', 'admin/validacao.js'],
];

async function limparDist() {
  // Salvaguarda: só apaga a pasta dist/ na raiz do projeto.
  if (path.dirname(DIST) !== RAIZ || path.basename(DIST) !== 'dist') {
    throw new Error(`caminho de saída inesperado: ${DIST}`);
  }
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
}

// Copia uma pasta recursivamente, ignorando arquivos ocultos (.gitkeep etc.)
// e os nomes em `ignorar`. Devolve quantos arquivos foram copiados.
async function copiarPasta(origem, destino, ignorar = []) {
  let total = 0;
  const itens = await readdir(origem, { withFileTypes: true });
  for (const item of itens) {
    if (item.name.startsWith('.') || ignorar.includes(item.name)) continue;
    const de = path.join(origem, item.name);
    const para = path.join(destino, item.name);
    if (item.isDirectory()) {
      total += await copiarPasta(de, para, ignorar);
    } else if (item.isFile()) {
      await mkdir(destino, { recursive: true });
      await copyFile(de, para);
      total += 1;
    }
  }
  return total;
}

async function copiar(origem, destino) {
  const de = path.join(RAIZ, origem);
  if (!existsSync(de)) {
    console.log(`  ignorado: ${origem} não existe`);
    return;
  }
  const para = path.join(DIST, destino);
  if (origem.endsWith('.js')) {
    await mkdir(path.dirname(para), { recursive: true });
    await copyFile(de, para);
    console.log(`  ${origem} → dist/${destino}`);
    return;
  }
  const total = await copiarPasta(de, para);
  console.log(`  ${origem}/ → dist/${destino}/ (${total} ${total === 1 ? 'arquivo' : 'arquivos'})`);
}

async function gravar(relativo, conteudo) {
  const destino = path.join(DIST, ...relativo.split('/'));
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, conteudo, 'utf8');
}

async function listarArquivos(pasta, extensao) {
  const saida = [];
  if (!existsSync(pasta)) return saida;
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) saida.push(...await listarArquivos(caminho, extensao));
    else if (item.name.endsWith(extensao)) saida.push(caminho);
  }
  return saida;
}

// Procura url("/…") nos CSS gerados e devolve os que não existem em dist/.
async function urlsAusentesNoCss() {
  const ausentes = new Set();
  for (const arquivo of await listarArquivos(path.join(DIST, 'css'), '.css')) {
    const css = await readFile(arquivo, 'utf8');
    for (const [, url] of css.matchAll(/url\(\s*["']?(\/[^"')?#]+)/g)) {
      if (!existsSync(path.join(DIST, url))) ausentes.add(url);
    }
  }
  return [...ausentes].sort();
}

function sitemap(site, caminhos) {
  const urls = caminhos
    .map((caminho) => `  <url><loc>${urlAbsoluta(site, caminho).replace(/&/g, '&amp;')}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function robots(site) {
  return `User-agent: *
Disallow: /admin/

Sitemap: ${urlAbsoluta(site, '/sitemap.xml')}
`;
}

async function build() {
  const inicio = Date.now();

  // Valida antes de apagar dist/: com erro, nada é gerado e o site anterior fica intacto.
  const { conteudo, problemas } = await validarDoDisco();
  if (!imprimirRelatorio(conteudo, problemas)) {
    throw new Error('o conteúdo tem erros (listados acima). Nada foi gerado em dist/.');
  }
  console.log('');

  await limparDist();
  for (const [origem, destino] of COPIAS) await copiar(origem, destino);

  const { site, home, sobre, contato, erro404 } = conteudo;
  const projetos = ordenarProjetos(conteudo.projetos);

  // O painel lê daqui em qual repositório e branch buscar o conteúdo.
  await gravar('admin/config.json', `${JSON.stringify(site.repositorio, null, 2)}\n`);

  await gravar('index.html', renderHome({ site, home, projetos }));

  for (const [i, projeto] of projetos.entries()) {
    const proximo = projetos.length > 1 ? projetos[(i + 1) % projetos.length] : null;
    await gravar(`projetos/${projeto.slug}/index.html`, renderProjeto({ site, projeto, proximo }));
    await copiarPasta(path.join(RAIZ, 'content', 'projetos', projeto.slug), path.join(DIST, 'projetos', projeto.slug), ['projeto.json']);
  }

  await gravar('sobre/index.html', renderSobre({ site, sobre }));
  await gravar('contato/index.html', renderContato({ site, contato }));
  await gravar('404.html', renderErro404({ site, erro404 }));

  const caminhos = ['/', ...projetos.map(({ slug }) => `/projetos/${slug}/`), '/sobre/', '/contato/'];
  await gravar('sitemap.xml', sitemap(site, caminhos));
  await gravar('robots.txt', robots(site));

  const ocultos = conteudo.projetos.length - projetos.length;
  console.log(`  páginas: home, ${projetos.length} ${projetos.length === 1 ? 'projeto' : 'projetos'}${ocultos ? ` (${ocultos} rascunho(s) ignorado(s))` : ''}, sobre, contato, 404`);
  console.log('  sitemap.xml e robots.txt gerados');

  const ausentes = await urlsAusentesNoCss();
  if (ausentes.length > 0) {
    console.warn(`\nAviso: ${ausentes.length} arquivo(s) referenciado(s) no CSS não existe(m) em dist/:`);
    for (const url of ausentes) console.warn(`  - ${url}`);
  }

  console.log(`\nBuild concluído em ${Date.now() - inicio} ms → dist/`);
}

try {
  await build();
} catch (erro) {
  console.error(`\nErro no build: ${erro.message}`);
  process.exitCode = 1;
}
