// Gera o site estático em dist/.
// Uso: node scripts/build.mjs

import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');

// Pastas copiadas como estão: [origem, destino dentro de dist/].
const COPIAS = [
  ['src/styles', 'css'],
  ['src/fonts', 'fonts'],
  ['src/js', 'js'],
  ['content/midia', 'midia'],
  ['admin', 'admin'],
  ['src/render', 'admin/render'],
];

// Folhas de estilo do site, na ordem em que entram no <head>.
const ESTILOS = ['tokens.css', 'base.css', 'componentes.css'];

// Fonte pré-carregada (só a DM Serif Display, usada no nome).
const FONTE_PRELOAD = '/fonts/dm-serif-display/dm-serif-display-latin-400-normal.woff2';

async function limparDist() {
  // Salvaguarda: só apaga a pasta dist/ na raiz do projeto.
  if (path.dirname(DIST) !== RAIZ || path.basename(DIST) !== 'dist') {
    throw new Error(`caminho de saída inesperado: ${DIST}`);
  }
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
}

// Copia uma pasta recursivamente, ignorando arquivos ocultos (.gitkeep etc.).
// Devolve quantos arquivos foram copiados.
async function copiarPasta(origem, destino) {
  let total = 0;
  const itens = await readdir(origem, { withFileTypes: true });
  for (const item of itens) {
    if (item.name.startsWith('.')) continue;
    const de = path.join(origem, item.name);
    const para = path.join(destino, item.name);
    if (item.isDirectory()) {
      total += await copiarPasta(de, para);
    } else if (item.isFile()) {
      await mkdir(destino, { recursive: true });
      await copyFile(de, para);
      total += 1;
    }
  }
  return total;
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

// Página provisória para conferir tokens, grade e fontes.
// Será trocada pelas páginas geradas a partir de content/.
function paginaDeTeste() {
  const estilos = ESTILOS.map((nome) => `  <link rel="stylesheet" href="/css/${nome}">`).join('\n');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="robots" content="noindex">
  <title>Página de teste</title>
  <link rel="preload" href="${FONTE_PRELOAD}" as="font" type="font/woff2" crossorigin>
${estilos}
</head>
<body>
  <header class="cabecalho">
    <div class="container cabecalho__interno">
      <nav class="nav-principal" aria-label="Principal">
        <ul>
          <li><a href="/" aria-current="page">Projetos</a></li>
          <li><a href="/sobre/">Sobre</a></li>
          <li><a href="/contato/">Contato</a></li>
        </ul>
      </nav>
    </div>
  </header>

  <main>
    <section class="abertura container" aria-labelledby="nome">
      <div class="abertura__caixa">
        <h1 class="abertura__nome" id="nome"><span class="marca">Ryan Leite</span></h1>
        <p class="abertura__especialidades"><span class="marca">C# · Dados · Web · Unity</span></p>
        <p class="abertura__apresentacao"><strong>Desenvolvedor full-stack.</strong> Back-end em C# e .NET com Entity Framework, bancos SQL e NoSQL, front-end em HTML, CSS e JavaScript, e projetos em Unity.</p>
      </div>
    </section>
  </main>

  <footer class="rodape container">
    <div class="rodape__caixa">
      <div>
        <p class="rodape__chamada titulo">Vamos conversar.</p>
        <p class="rodape__texto">© 2026 · Feito à mão em HTML, CSS e JS · Hospedado no Render</p>
      </div>
      <ul class="rodape__links rotulo">
        <li><a href="#">E-mail</a></li>
        <li><a href="#">GitHub</a></li>
        <li><a href="#">LinkedIn</a></li>
      </ul>
    </div>
  </footer>
</body>
</html>
`;
}

async function build() {
  const inicio = Date.now();
  await limparDist();

  for (const [origem, destino] of COPIAS) {
    const de = path.join(RAIZ, origem);
    if (!existsSync(de)) {
      console.log(`  ignorado: ${origem}/ não existe`);
      continue;
    }
    const total = await copiarPasta(de, path.join(DIST, destino));
    console.log(`  ${origem}/ → dist/${destino}/ (${total} ${total === 1 ? 'arquivo' : 'arquivos'})`);
  }

  await writeFile(path.join(DIST, 'index.html'), paginaDeTeste(), 'utf8');
  console.log('  index.html gerado');

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
