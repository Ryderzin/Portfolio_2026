// Preparação de arquivos enviados pelo painel (no navegador, sem bibliotecas).
// - Imagens: redimensionadas para no máximo 2000 px no lado maior e convertidas para WebP (≈ 0,82).
// - GIF: mantido como está, até 8 MB, com aviso sugerindo MP4.
// - Vídeo: MP4 ou WebM, até 25 MB (prévia da capa: até 7,5 MB).
// - PDF: até 5 MB.

const MB = 1024 * 1024;

export const LIMITES = {
  ladoMaximo: 2000,
  qualidadeWebp: 0.82,
  gif: 8 * MB,
  imagemOriginal: 30 * MB,
  video: 25 * MB,
  previa: 7.5 * MB,
  pdf: 5 * MB,
};

export const ACEITA = {
  imagem: 'image/jpeg,image/png,image/webp,image/gif,image/avif',
  video: 'video/mp4,video/webm',
  previa: 'video/mp4,video/webm',
  pdf: 'application/pdf',
};

export class ErroEnvio extends Error {}

function mb(bytes) {
  return `${(bytes / MB).toFixed(1).replace('.', ',')} MB`;
}

// Nome de arquivo seguro: minúsculas, sem acentos, só [a-z0-9-], com a extensão dada.
export function nomeSeguro(nomeOriginal, extensao) {
  const base = nomeOriginal
    .replace(/\.[^.]+$/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'arquivo';
  return `${base}.${extensao}`;
}

// Evita sobrescrever: "tela.webp" → "tela-2.webp" se já existir na pasta.
export function nomeLivre(pasta, nome, existe) {
  const [, base, extensao] = /^(.*)\.([^.]+)$/.exec(nome);
  let candidato = nome;
  for (let n = 2; existe(`${pasta}/${candidato}`); n += 1) candidato = `${base}-${n}.${extensao}`;
  return candidato;
}

async function bytesDe(blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

async function dimensoesImagem(arquivo) {
  const bitmap = await createImageBitmap(arquivo);
  const dimensoes = { largura: bitmap.width, altura: bitmap.height };
  bitmap.close();
  return dimensoes;
}

export async function processarImagem(arquivo) {
  if (!ACEITA.imagem.split(',').includes(arquivo.type)) {
    throw new ErroEnvio(`"${arquivo.name}" não é uma imagem aceita. Use JPG, PNG, WebP, AVIF ou GIF.`);
  }

  if (arquivo.type === 'image/gif') {
    if (arquivo.size > LIMITES.gif) {
      throw new ErroEnvio(`O GIF tem ${mb(arquivo.size)}; o limite é ${mb(LIMITES.gif)}. Converta para MP4 e envie como vídeo.`);
    }
    return {
      bytes: await bytesDe(arquivo),
      extensao: 'gif',
      ...(await dimensoesImagem(arquivo)),
      aviso: `GIF mantido (${mb(arquivo.size)}). Um MP4 com o mesmo efeito costuma ser bem menor.`,
    };
  }

  if (arquivo.size > LIMITES.imagemOriginal) {
    throw new ErroEnvio(`A imagem tem ${mb(arquivo.size)}; o máximo aceito antes da conversão é ${mb(LIMITES.imagemOriginal)}.`);
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new ErroEnvio(`Não foi possível ler "${arquivo.name}" como imagem.`);
  }
  const escala = Math.min(1, LIMITES.ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const webp = await new Promise((resolver) => canvas.toBlob(resolver, 'image/webp', LIMITES.qualidadeWebp));
  if (!webp || webp.type !== 'image/webp') {
    throw new ErroEnvio('Este navegador não consegue gerar WebP. Use um navegador atualizado (Chrome, Edge, Firefox ou Safari 16+).');
  }
  return { bytes: await bytesDe(webp), extensao: 'webp', largura, altura };
}

function dimensoesVideo(arquivo) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.onloadedmetadata = () => {
      resolver({ largura: video.videoWidth, altura: video.videoHeight });
      URL.revokeObjectURL(url);
    };
    video.onerror = () => {
      rejeitar(new ErroEnvio(`Não foi possível ler "${arquivo.name}" como vídeo.`));
      URL.revokeObjectURL(url);
    };
    video.src = url;
  });
}

// tipo: 'video' (bloco) ou 'previa' (capa)
export async function processarVideo(arquivo, tipo = 'video') {
  if (!ACEITA.video.split(',').includes(arquivo.type)) {
    throw new ErroEnvio(`"${arquivo.name}" não é MP4 nem WebM.`);
  }
  const limite = tipo === 'previa' ? LIMITES.previa : LIMITES.video;
  if (arquivo.size > limite) {
    throw new ErroEnvio(tipo === 'previa'
      ? `A prévia tem ${mb(arquivo.size)}; o limite é ${mb(limite)}. Encurte o vídeo ou reduza a resolução.`
      : `O vídeo tem ${mb(arquivo.size)}; o limite é ${mb(limite)}. Para vídeos maiores, publique no YouTube ou no Vimeo e use um bloco de vídeo por link.`);
  }
  const extensao = arquivo.type === 'video/webm' ? 'webm' : 'mp4';
  return {
    bytes: await bytesDe(arquivo),
    extensao,
    ...(await dimensoesVideo(arquivo)),
    aviso: tipo === 'previa' ? 'Confira se a prévia não tem áudio: ela toca muda, então o áudio só ocupa espaço.' : null,
  };
}

export async function processarPdf(arquivo) {
  if (arquivo.type !== 'application/pdf') throw new ErroEnvio(`"${arquivo.name}" não é um PDF.`);
  if (arquivo.size > LIMITES.pdf) throw new ErroEnvio(`O PDF tem ${mb(arquivo.size)}; o limite é ${mb(LIMITES.pdf)}.`);
  return { bytes: await bytesDe(arquivo), extensao: 'pdf' };
}
