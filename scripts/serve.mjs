// Servidor local de dist/ (inclui /admin/), só para desenvolvimento.
// Uso: node scripts/serve.mjs   (porta 8080; outra porta: variável PORT)

import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(RAIZ, 'dist');
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

  // Impede sair de dist/ com "..", barras invertidas ou caminhos absolutos.
  const alvo = path.join(DIST, caminho);
  if (alvo !== DIST && !alvo.startsWith(DIST + path.sep)) {
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
