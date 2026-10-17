// Servidor local de dist/ (inclui /admin/), só para desenvolvimento.
// Também serve content/ em /content/ e a lista dos arquivos em /__local/arquivos.json,
// usados pelo painel no modo ?local=1. Nada disso existe no site publicado.
// Uso: node scripts/serve.mjs   (porta 8080; outra porta: variável PORT)

import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
const CONTENT = path.join(RAIZ, 'content');
const HOST = '127.0.0.1';
const PORTA = Number(process.env.PORT) || 8080;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.pdf': 'application/pdf',
};

function tipoDe(arquivo) {
  return TIPOS[path.extname(arquivo).toLowerCase()] ?? 'application/octet-stream';
}

async function infoDe(caminho) {
  try {
    return await stat(caminho);
  } catch {
    return null;
  }
}

// Lista os arquivos de content/ (caminhos relativos, com "/"), ignorando ocultos.
async function listarConteudo(pasta, prefixo = '') {
  const saida = [];
  if (!existsSync(pasta)) return saida;
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    if (item.name.startsWith('.')) continue;
    const relativo = prefixo ? `${prefixo}/${item.name}` : item.name;
    if (item.isDirectory()) saida.push(...await listarConteudo(path.join(pasta, item.name), relativo));
    else if (item.isFile()) saida.push(relativo);
  }
  return saida;
}

function responderTexto(res, status, texto) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(texto);
}

// Envia um arquivo, com suporte a um único intervalo (Range), usado por vídeos.
function enviarArquivo(req, res, arquivo, tamanho, status = 200) {
  const cabecalhos = {
    'Content-Type': tipoDe(arquivo),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  };

  const intervalo = status === 200 ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '') : null;
  if (intervalo && (intervalo[1] || intervalo[2])) {
    let inicio = intervalo[1] ? Number(intervalo[1]) : tamanho - Number(intervalo[2]);
    let fim = intervalo[1] && intervalo[2] ? Number(intervalo[2]) : tamanho - 1;
    inicio = Math.max(0, inicio);
    fim = Math.min(fim, tamanho - 1);
    if (inicio > fim) {
      res.writeHead(416, { 'Content-Range': `bytes */${tamanho}` });
      res.end();
      return;
    }
    res.writeHead(206, { ...cabecalhos, 'Content-Range': `bytes ${inicio}-${fim}/${tamanho}`, 'Content-Length': fim - inicio + 1 });
    if (req.method === 'HEAD') res.end();
    else createReadStream(arquivo, { start: inicio, end: fim }).pipe(res);
    return;
  }

  res.writeHead(status, { ...cabecalhos, 'Content-Length': tamanho });
  if (req.method === 'HEAD') res.end();
  else createReadStream(arquivo).pipe(res);
}

async function naoEncontrado(req, res) {
  const pagina = path.join(DIST, '404.html');
  const info = await infoDe(pagina);
  if (info?.isFile()) enviarArquivo(req, res, pagina, info.size, 404);
  else responderTexto(res, 404, '404 — não encontrado');
}

async function atender(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return responderTexto(res, 405, 'Método não permitido');
  }

  const url = new URL(req.url, `http://${HOST}`);
  let caminho;
  try {
    caminho = decodeURIComponent(url.pathname);
  } catch {
    return responderTexto(res, 400, 'Endereço inválido');
  }
  if (caminho.includes('\0')) return responderTexto(res, 400, 'Endereço inválido');

  // Só no servidor local: o painel em ?local=1 lê content/ direto do disco.
  if (caminho === '/__local/arquivos.json') {
    const arquivos = await listarConteudo(CONTENT);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(arquivos));
  }
  const base = caminho.startsWith('/content/') ? CONTENT : DIST;
  const relativo = base === CONTENT ? caminho.slice('/content'.length) : caminho;

  // Impede sair da pasta servida com "..", barras invertidas ou caminhos absolutos.
  const alvo = path.join(base, relativo);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) {
    return responderTexto(res, 403, 'Acesso negado');
  }

  let info = await infoDe(alvo);
  let arquivo = alvo;

  if (info?.isDirectory()) {
    // URLs bonitas: /sobre → /sobre/ → sobre/index.html
    if (!url.pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
      return res.end();
    }
    arquivo = path.join(alvo, 'index.html');
    info = await infoDe(arquivo);
  }

  if (!info?.isFile()) return naoEncontrado(req, res);
  enviarArquivo(req, res, arquivo, info.size);
}

if (!existsSync(DIST)) {
  console.error('A pasta dist/ não existe. Rode antes: node scripts/build.mjs');
  process.exit(1);
}

const servidor = createServer((req, res) => {
  atender(req, res).catch((erro) => {
    console.error(erro);
    if (!res.headersSent) responderTexto(res, 500, 'Erro interno');
    else res.end();
  });
  res.on('finish', () => console.log(`${res.statusCode} ${req.method} ${req.url}`));
});

servidor.on('error', (erro) => {
  if (erro.code === 'EADDRINUSE') {
    console.error(`A porta ${PORTA} já está em uso. Defina outra na variável PORT.`);
  } else {
    console.error(erro);
  }
  process.exit(1);
});

servidor.listen(PORTA, HOST, () => {
  console.log(`Servindo dist/ em http://localhost:${PORTA}  (painel: http://localhost:${PORTA}/admin/)`);
  console.log('Ctrl+C para parar.');
});
