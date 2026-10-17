// Fontes de dados do painel. Nesta etapa só há leitura.
// - criarFonteGitHub: API REST do GitHub, com o token digitado no painel.
// - criarFonteLocal: content/ servido pelo scripts/serve.mjs (modo ?local=1).
// As duas expõem a mesma interface: { descricao, verificarAcesso(), listarArquivos(), lerTexto(caminho) }.
// Os caminhos são relativos a content/ (ex.: "projetos/exemplo-web/projeto.json").

const API = 'https://api.github.com';

export class ErroFonte extends Error {}

function mensagemHttp(status, contexto) {
  switch (status) {
    case 401:
      return 'O GitHub recusou o token: ele está errado, foi revogado ou expirou. Crie um novo e entre de novo.';
    case 403:
      return 'O GitHub negou o acesso. Confira se o token tem acesso a este repositório com a permissão Contents, ou espere alguns minutos se o limite de requisições foi atingido.';
    case 404:
      return `Não encontrado: ${contexto}. Confira o repositório em site.json e se o token tem acesso a ele (sem acesso, o GitHub responde 404).`;
    default:
      return `O GitHub respondeu com erro ${status} ao ler ${contexto}. Tente de novo em instantes.`;
  }
}

async function pedir(url, opcoes, contexto) {
  let resposta;
  try {
    resposta = await fetch(url, opcoes);
  } catch {
    throw new ErroFonte('Sem conexão. Confira a internet e tente de novo.');
  }
  if (!resposta.ok) throw new ErroFonte(mensagemHttp(resposta.status, contexto));
  return resposta;
}

function caminhoUrl(caminho) {
  return caminho.split('/').map(encodeURIComponent).join('/');
}

export function criarFonteGitHub({ dono, nome, branch, token }) {
  const repo = `${API}/repos/${encodeURIComponent(dono)}/${encodeURIComponent(nome)}`;
  const cabecalhos = (aceitar = 'application/vnd.github+json') => ({
    Accept: aceitar,
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  });

  return {
    descricao: `${dono}/${nome} · ${branch}`,

    async verificarAcesso() {
      await pedir(repo, { headers: cabecalhos() }, `o repositório ${dono}/${nome}`);
    },

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
  };
}

export function criarFonteLocal() {
  return {
    descricao: 'modo local · content/ desta máquina',

    async verificarAcesso() {
      await pedir('/__local/arquivos.json', { cache: 'no-store' }, 'a lista local (rode node scripts/serve.mjs)');
    },

    async listarArquivos() {
      const resposta = await pedir('/__local/arquivos.json', { cache: 'no-store' }, 'a lista local');
      return resposta.json();
    },

    async lerTexto(caminho) {
      const resposta = await pedir(`/content/${caminhoUrl(caminho)}`, { cache: 'no-store' }, `content/${caminho}`);
      return resposta.text();
    },
  };
}
