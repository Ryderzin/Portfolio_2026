// Fontes de dados do painel.
// - criarFonteGitHub: API REST do GitHub, com o token digitado no painel.
// - criarFonteLocal: content/ servido pelo scripts/serve.mjs (modo ?local=1). Nunca grava:
//   publicar() nela é sempre um ensaio.
// Interface comum:
//   { descricao, verificarAcesso(), lerVersao(), listarArquivos(), lerTexto(caminho), publicar(pedido) }
// Os caminhos são relativos a content/ (ex.: "projetos/exemplo-web/projeto.json").
//
// publicar({ arquivos: [{ caminho, texto? , bytes? }], mensagem, versaoBase, ensaio, aoProgresso })
// monta UM commit com todos os arquivos pela Git Data API:
// ref → árvore base → blobs → nova árvore → commit → atualizar ref.
// Com ensaio = true, faz só as leituras e mostra no console o que seria enviado.

const API = 'https://api.github.com';

export class ErroFonte extends Error {}

// A branch mudou desde que o conteúdo foi carregado.
export class ErroConflito extends ErroFonte {}

function mensagemHttp(status, contexto) {
  switch (status) {
    case 401:
      return 'O GitHub recusou o token: ele está errado, foi revogado ou expirou. Crie um novo e entre de novo.';
    case 403:
      return 'O GitHub negou o acesso. Confira se o token tem acesso a este repositório com a permissão Contents (leitura e escrita), ou espere alguns minutos se o limite de requisições foi atingido.';
    case 404:
      return `Não encontrado: ${contexto}. Confira o repositório em site.json e se o token tem acesso a ele (sem acesso, o GitHub responde 404).`;
    case 409:
    case 422:
      return `O GitHub não aceitou a operação em ${contexto} (a branch pode ter mudado).`;
    default:
      return `O GitHub respondeu com erro ${status} em ${contexto}. Tente de novo em instantes.`;
  }
}

async function pedir(url, opcoes, contexto) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    throw new ErroFonte('Sem conexão. Confira a internet e tente de novo.');
  }
  if (!resposta.ok) {
    const Erro = resposta.status === 409 || resposta.status === 422 ? ErroConflito : ErroFonte;
    throw new Erro(mensagemHttp(resposta.status, contexto));
  }
  return resposta;
}

function caminhoUrl(caminho) {
  return caminho.split('/').map(encodeURIComponent).join('/');
}

export function paraBase64(bytes) {
  let binario = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    binario += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(binario);
}

function tamanhoDe(arquivo) {
  return arquivo.bytes ? arquivo.bytes.length : new TextEncoder().encode(arquivo.texto).length;
}

// Mostra no console o que seria enviado. Nada é gravado.
function registrarEnsaio({ arquivos, mensagem, versaoBase }, origem) {
  const linhas = arquivos.map((a) => ({
    arquivo: `content/${a.caminho}`,
    codificacao: a.bytes ? 'base64' : 'utf-8',
    bytes: tamanhoDe(a),
  }));
  console.group(`[ensaio] Publicação montada (${origem}) — nada foi enviado`);
  console.log('Mensagem do commit:\n' + mensagem);
  console.log('Versão base:', versaoBase ?? '(modo local)');
  console.table(linhas);
  console.log('Total:', linhas.reduce((soma, l) => soma + l.bytes, 0), 'bytes');
  for (const a of arquivos.filter((x) => x.texto !== undefined)) {
    console.groupCollapsed(`content/${a.caminho}`);
    console.log(a.texto);
    console.groupEnd();
  }
  console.groupEnd();
  return { ensaio: true, arquivos: linhas, mensagem };
}

export function criarFonteGitHub({ dono, nome, branch, token }) {
  const repo = `${API}/repos/${encodeURIComponent(dono)}/${encodeURIComponent(nome)}`;
  const cabecalhos = (aceitar = 'application/vnd.github+json') => ({
    Accept: aceitar,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  });
  const json = () => ({ 'Content-Type': 'application/json', ...cabecalhos() });

  async function lerVersao() {
    const resposta = await pedir(`${repo}/git/ref/heads/${caminhoUrl(branch)}`, { headers: cabecalhos(), cache: 'no-store' }, `a branch ${branch}`);
    return (await resposta.json()).object.sha;
  }

  async function postar(caminho, corpo, contexto) {
    const resposta = await pedir(`${repo}${caminho}`, { method: 'POST', headers: json(), body: JSON.stringify(corpo) }, contexto);
    return resposta.json();
  }

  return {
    descricao: `${dono}/${nome} · ${branch}`,

    async verificarAcesso() {
      await pedir(repo, { headers: cabecalhos() }, `o repositório ${dono}/${nome}`);
    },

    lerVersao,

    async listarArquivos() {
      const resposta = await pedir(
        `${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers: cabecalhos(), cache: 'no-store' },
        `a branch ${branch}`,
      );
      const dados = await resposta.json();
      if (dados.truncated) throw new ErroFonte('O repositório tem arquivos demais para listar de uma vez.');
      return dados.tree
        .filter((item) => item.type === 'blob' && item.path.startsWith('content/'))
        .map((item) => item.path.slice('content/'.length));
    },

    async lerTexto(caminho) {
      const resposta = await pedir(
        `${repo}/contents/${caminhoUrl(`content/${caminho}`)}?ref=${encodeURIComponent(branch)}`,
        { headers: cabecalhos('application/vnd.github.raw+json'), cache: 'no-store' },
        `content/${caminho}`,
      );
      return resposta.text();
    },

    async lerBytes(caminho) {
      const resposta = await pedir(
        `${repo}/contents/${caminhoUrl(`content/${caminho}`)}?ref=${encodeURIComponent(branch)}`,
        { headers: cabecalhos('application/vnd.github.raw+json') },
        `content/${caminho}`,
      );
      return resposta.arrayBuffer();
    },

    async publicar({ arquivos, mensagem, versaoBase, ensaio = false, aoProgresso = () => {} }) {
      aoProgresso('Conferindo se a branch mudou…');
      const atual = await lerVersao();
      if (versaoBase && atual !== versaoBase) {
        throw new ErroConflito('O repositório mudou desde que você abriu o painel (outra publicação ou um commit). Recarregue o conteúdo antes de publicar.');
      }

      const commitBase = await (await pedir(`${repo}/git/commits/${atual}`, { headers: cabecalhos() }, 'o commit atual')).json();
      if (ensaio) return registrarEnsaio({ arquivos, mensagem, versaoBase: atual }, 'GitHub, só leitura');

      const itens = [];
      for (const [i, arquivo] of arquivos.entries()) {
        aoProgresso(`Enviando arquivo ${i + 1} de ${arquivos.length}…`);
        const blob = await postar('/git/blobs', arquivo.bytes
          ? { content: paraBase64(arquivo.bytes), encoding: 'base64' }
          : { content: arquivo.texto, encoding: 'utf-8' }, `content/${arquivo.caminho}`);
        itens.push({ path: `content/${arquivo.caminho}`, mode: '100644', type: 'blob', sha: blob.sha });
      }

      aoProgresso('Montando o commit…');
      const arvore = await postar('/git/trees', { base_tree: commitBase.tree.sha, tree: itens }, 'a nova árvore');
      const commit = await postar('/git/commits', { message: mensagem, tree: arvore.sha, parents: [atual] }, 'o commit');

      aoProgresso('Atualizando a branch…');
      await pedir(`${repo}/git/refs/heads/${caminhoUrl(branch)}`, {
        method: 'PATCH',
        headers: json(),
        body: JSON.stringify({ sha: commit.sha, force: false }),
      }, `a branch ${branch}`);

      return { ensaio: false, versao: commit.sha, url: commit.html_url };
    },
  };
}

export function criarFonteLocal() {
  return {
    descricao: 'modo local · content/ desta máquina',

    async verificarAcesso() {
      await pedir('/__local/arquivos.json', { cache: 'no-store' }, 'a lista local (rode node scripts/serve.mjs)');
    },

    async lerVersao() {
      return null;
    },

    async listarArquivos() {
      const resposta = await pedir('/__local/arquivos.json', { cache: 'no-store' }, 'a lista local');
      return resposta.json();
    },

    async lerTexto(caminho) {
      const resposta = await pedir(`/content/${caminhoUrl(caminho)}`, { cache: 'no-store' }, `content/${caminho}`);
      return resposta.text();
    },

    async lerBytes(caminho) {
      const resposta = await pedir(`/content/${caminhoUrl(caminho)}`, {}, `content/${caminho}`);
      return resposta.arrayBuffer();
    },

    // O modo local nunca grava: a publicação é sempre um ensaio.
    async publicar(pedido) {
      return registrarEnsaio(pedido, 'modo local');
    },
  };
}
