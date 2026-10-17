// Painel: entrada com token, navegação, edição e pré-visualização.
// Nesta etapa o painel só lê o repositório; nada é gravado.

import { ErroFonte, criarFonteGitHub, criarFonteLocal } from './github.js';
import { DESCRITORES, formatarCaminho, h, montarFormulario, mostrarProblemas } from './formularios.js';
import { PAGINAS, formatarProblema, validarPagina, validarProjeto } from './validacao.js';
import { ordenarProjetos } from './render/util.js';
import { renderHome } from './render/home.js';
import { renderProjeto } from './render/projeto.js';
import { renderSobre } from './render/sobre.js';
import { renderContato } from './render/contato.js';
import { renderErro404 } from './render/erro404.js';

const CHAVE_TOKEN = 'painel.token';
const MODO_LOCAL = new URLSearchParams(location.search).has('local');

const $ = (seletor) => document.querySelector(seletor);

const estado = {
  fonte: null,
  arquivos: new Set(),
  docs: new Map(), // caminho → { caminho, tipo: 'pagina'|'projeto', chave, slug, original, dados }
  atual: null,
  formulario: null,
  saindo: false,
};

// ---------- Utilidades ----------

function serializar(dados) {
  return `${JSON.stringify(dados, null, 2)}\n`;
}

function alterado(doc) {
  return serializar(doc.dados) !== doc.original;
}

function docsAlterados() {
  return [...estado.docs.values()].filter(alterado);
}

function existeArquivo(caminho) {
  return estado.arquivos.has(caminho);
}

function validar(doc) {
  return doc.tipo === 'projeto'
    ? validarProjeto(doc.slug, doc.dados, existeArquivo)
    : validarPagina(doc.chave, doc.dados, existeArquivo);
}

function projetos() {
  return [...estado.docs.values()].filter((d) => d.tipo === 'projeto').map(({ slug, dados }) => ({ slug, dados }));
}

function doc(caminho) {
  return estado.docs.get(caminho);
}

// ---------- Entrada ----------

function mostrarEntrada(mensagem = '') {
  $('#entrada').hidden = false;
  $('#painel').hidden = true;
  const erro = $('#entrada-erro');
  erro.textContent = mensagem;
  erro.hidden = !mensagem;
  $('#token').focus();
}

async function lerConfig() {
  let resposta;
  try {
    resposta = await fetch('./config.json', { cache: 'no-store' });
  } catch {
    throw new ErroFonte('Não foi possível ler a configuração do painel. Confira a conexão.');
  }
  if (!resposta.ok) throw new ErroFonte('Configuração do painel ausente (admin/config.json). Rode o build.');
  return resposta.json();
}

async function entrarComToken(token) {
  const config = await lerConfig();
  const fonte = criarFonteGitHub({ ...config, token });
  await fonte.verificarAcesso();
  return fonte;
}

$('#form-entrada').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const campo = $('#token');
  const token = campo.value.trim();
  if (!token) return mostrarEntrada('Cole o token para entrar.');
  const botao = $('#entrar');
  botao.disabled = true;
  botao.textContent = 'Verificando…';
  try {
    const fonte = await entrarComToken(token);
    sessionStorage.setItem(CHAVE_TOKEN, token);
    campo.value = '';
    await iniciar(fonte);
  } catch (erro) {
    mostrarEntrada(erro instanceof ErroFonte ? erro.message : `Erro inesperado: ${erro.message}`);
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
});

$('#sair').addEventListener('click', () => {
  if (docsAlterados().length && !confirm('Há alterações não publicadas. Elas serão perdidas. Sair mesmo assim?')) return;
  sessionStorage.removeItem(CHAVE_TOKEN);
  estado.saindo = true;
  location.reload();
});

window.addEventListener('beforeunload', (evento) => {
  if (!estado.saindo && docsAlterados().length) {
    evento.preventDefault();
    evento.returnValue = '';
  }
});

// ---------- Carregamento ----------

async function carregar(fonte) {
  const arquivos = await fonte.listarArquivos();
  estado.arquivos = new Set(arquivos);
  estado.docs.clear();

  const alvos = [
    ...Object.entries(PAGINAS).map(([chave, { arquivo }]) => ({ caminho: arquivo, tipo: 'pagina', chave })),
    ...arquivos
      .filter((c) => /^projetos\/[^/]+\/projeto\.json$/.test(c))
      .map((c) => ({ caminho: c, tipo: 'projeto', slug: c.split('/')[1] })),
  ];

  const falhas = [];
  await Promise.all(alvos.map(async (alvo) => {
    try {
      const texto = await fonte.lerTexto(alvo.caminho);
      const dados = JSON.parse(texto);
      estado.docs.set(alvo.caminho, { ...alvo, original: serializar(dados), dados });
    } catch (erro) {
      falhas.push(`content/${alvo.caminho}: ${erro instanceof SyntaxError ? 'JSON inválido' : erro.message}`);
    }
  }));
  if (!doc('site.json')) throw new ErroFonte(`Não foi possível ler content/site.json. ${falhas.join(' ')}`);
  return falhas;
}

async function iniciar(fonte) {
  estado.fonte = fonte;
  $('#entrada').hidden = true;
  $('#painel').hidden = false;
  $('#fonte').textContent = fonte.descricao;
  $('#sair').hidden = MODO_LOCAL;
  $('#editor').replaceChildren(h('p', { class: 'aviso-carregando', role: 'status' }, 'Carregando o conteúdo…'));
  try {
    const falhas = await carregar(fonte);
    if (falhas.length) alert(`Alguns arquivos não puderam ser lidos:\n${falhas.join('\n')}`);
  } catch (erro) {
    if (MODO_LOCAL) {
      $('#editor').replaceChildren(h('p', { class: 'campo__mensagem campo__mensagem--erro', role: 'alert' }, erro.message));
      return;
    }
    sessionStorage.removeItem(CHAVE_TOKEN);
    mostrarEntrada(erro instanceof ErroFonte ? erro.message : `Erro inesperado: ${erro.message}`);
    return;
  }
  abrirPelaUrl();
}

// ---------- Navegação ----------

function rotaPara(d) {
  return d.tipo === 'projeto' ? `#projeto/${d.slug}` : `#pagina/${d.chave}`;
}

function abrirPelaUrl() {
  const [tipo, id] = location.hash.slice(1).split('/');
  let alvo = null;
  if (tipo === 'projeto') alvo = doc(`projetos/${id}/projeto.json`);
  if (tipo === 'pagina' && PAGINAS[id]) alvo = doc(PAGINAS[id].arquivo);
  if (!alvo) {
    const primeiro = ordenarProjetos(projetos())[0] ?? projetos()[0];
    alvo = primeiro ? doc(`projetos/${primeiro.slug}/projeto.json`) : doc('home.json');
    history.replaceState(null, '', rotaPara(alvo));
  }
  abrir(alvo);
}

window.addEventListener('hashchange', abrirPelaUrl);

const NOMES_PAGINAS = { home: 'Home', sobre: 'Sobre', contato: 'Contato', erro404: 'Página 404', site: 'Site e rótulos' };

function itemNavegacao(d, titulo, detalhe) {
  return h('li', {},
    h('a', { href: rotaPara(d), class: 'nav-painel__item', 'aria-current': estado.atual === d ? 'page' : null },
      h('span', { class: 'nav-painel__titulo' }, titulo),
      detalhe ? h('span', { class: 'nav-painel__detalhe' }, detalhe) : null,
      alterado(d) ? h('span', { class: 'nav-painel__alterado' }, 'alterado') : null));
}

function desenharNavegacao() {
  const lista = projetos()
    .sort((a, b) => (a.dados.ordem ?? 0) - (b.dados.ordem ?? 0) || a.slug.localeCompare(b.slug))
    .map(({ slug }) => doc(`projetos/${slug}/projeto.json`));
  $('#nav-projetos').replaceChildren(...lista.map((d) =>
    itemNavegacao(d, d.dados.titulo || d.slug, `${d.dados.categoria ?? '?'} · ${d.dados.publicado === true ? 'publicado' : 'rascunho'}`)));
  $('#nav-paginas').replaceChildren(...['home', 'sobre', 'contato', 'erro404', 'site']
    .map((chave) => doc(PAGINAS[chave].arquivo))
    .filter(Boolean)
    .map((d) => itemNavegacao(d, NOMES_PAGINAS[d.chave])));
}

function desenharStatus() {
  const alterados = docsAlterados();
  const status = $('#status');
  status.textContent = alterados.length
    ? `Rascunho · ${alterados.length} ${alterados.length === 1 ? 'arquivo alterado' : 'arquivos alterados'}, não publicado${alterados.length === 1 ? '' : 's'}`
    : 'Sem alterações';
  status.classList.toggle('selo--alterado', alterados.length > 0);
  const desfazer = $('#desfazer');
  if (desfazer) desfazer.disabled = !alterado(estado.atual);
}

// ---------- Editor ----------

function resumoValidacao(problemas, semCampo) {
  const erros = problemas.filter((p) => p.nivel === 'erro');
  const marcadores = problemas.filter((p) => p.marcador).length;
  const avisos = problemas.filter((p) => p.nivel === 'aviso' && !p.marcador);
  const partes = [];
  partes.push(erros.length ? `${erros.length} ${erros.length === 1 ? 'erro' : 'erros'}` : 'Sem erros');
  if (marcadores) partes.push(`${marcadores} ${marcadores === 1 ? 'marcador […] a preencher' : 'marcadores […] a preencher'}`);
  if (avisos.length) partes.push(`${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}`);

  const extras = [...semCampo.filter((p) => !p.marcador)];
  return h('div', { class: `resumo ${erros.length ? 'resumo--erro' : ''}` },
    h('p', { class: 'resumo__linha' }, partes.join(' · ')),
    extras.length ? h('ul', { class: 'resumo__lista' }, extras.map((p) => h('li', {}, formatarProblema(p)))) : null);
}

function revalidar() {
  const d = estado.atual;
  const problemas = validar(d);
  const semCampo = mostrarProblemas(estado.formulario, problemas);
  $('#resumo').replaceChildren(resumoValidacao(problemas, semCampo));
}

function aoMudar() {
  revalidar();
  desenharStatus();
  desenharNavegacao();
}

function focarDepois(foco) {
  if (!foco) return;
  const area = $('#editor');
  const item = [...area.querySelectorAll('[data-item]')].find((el) => el.dataset.item === foco);
  const alvo = item?.querySelector('input, textarea, select')
    ?? [...area.querySelectorAll('[data-acao]')].find((el) => el.dataset.acao === foco);
  alvo?.focus();
}

function abrir(d, { foco } = {}) {
  const rolagem = estado.atual === d ? window.scrollY : 0;
  estado.atual = d;
  const descritores = d.tipo === 'projeto' ? DESCRITORES.projeto(d.slug) : DESCRITORES[d.chave];
  const titulo = d.tipo === 'projeto' ? `Editar projeto: ${d.dados.titulo || d.slug}` : `Editar: ${NOMES_PAGINAS[d.chave]}`;

  estado.formulario = montarFormulario(descritores, {
    doc: d.dados,
    aoMudar,
    aoEstrutura: ({ foco: novoFoco } = {}) => { abrir(d, { foco: novoFoco }); aoMudar(); },
  });

  $('#editor').replaceChildren(
    h('div', { class: 'editor__topo' },
      h('h1', { class: 'editor__titulo' }, h('span', { class: 'marca' }, titulo)),
      h('button', {
        type: 'button',
        id: 'desfazer',
        class: 'botao-painel botao-painel--secundario',
        disabled: !alterado(d),
        onclick: () => {
          if (!confirm('Desfazer todas as alterações deste item?')) return;
          d.dados = JSON.parse(d.original);
          abrir(d);
          aoMudar();
        },
      }, 'Desfazer alterações')),
    h('p', { class: 'editor__arquivo' }, `content/${d.caminho}`),
    h('div', { id: 'resumo', 'aria-live': 'polite' }),
    estado.formulario,
  );

  revalidar();
  desenharStatus();
  desenharNavegacao();
  window.scrollTo(0, rolagem);
  if (foco) focarDepois(foco);
}

// ---------- Pré-visualização ----------

function htmlDaPrevia() {
  const d = estado.atual;
  const site = doc('site.json').dados;
  const todos = projetos();
  switch (d.tipo === 'projeto' ? 'projeto' : d.chave) {
    case 'site':
    case 'home':
      return renderHome({ site, home: doc('home.json').dados, projetos: ordenarProjetos(todos) });
    case 'sobre':
      return renderSobre({ site, sobre: d.dados });
    case 'contato':
      return renderContato({ site, contato: d.dados });
    case 'erro404':
      return renderErro404({ site, erro404: d.dados });
    default: {
      const publicados = ordenarProjetos(todos);
      const i = publicados.findIndex((p) => p.slug === d.slug);
      const candidatos = publicados.filter((p) => p.slug !== d.slug);
      const proximo = i >= 0 ? (publicados.length > 1 ? publicados[(i + 1) % publicados.length] : null) : (candidatos[0] ?? null);
      return renderProjeto({ site, projeto: { slug: d.slug, dados: d.dados }, proximo });
    }
  }
}

// Na prévia os links não navegam: ela mostra a página, não o site inteiro.
const ESTILO_PREVIA = '<style>a { pointer-events: none; }</style>';

function abrirPrevia() {
  const dialogo = $('#previa');
  const quadro = $('#previa-quadro');
  const erro = $('#previa-erro');
  try {
    const html = htmlDaPrevia().replace('</head>', `${ESTILO_PREVIA}</head>`);
    quadro.srcdoc = html;
    quadro.hidden = false;
    erro.hidden = true;
  } catch (e) {
    quadro.hidden = true;
    erro.hidden = false;
    erro.textContent = `Não foi possível montar a prévia. Corrija os erros do formulário e tente de novo. (${e.message})`;
  }
  dialogo.showModal();
}

$('#previsualizar').addEventListener('click', abrirPrevia);
$('#previa-fechar').addEventListener('click', () => $('#previa').close());
for (const botao of document.querySelectorAll('[data-largura]')) {
  botao.addEventListener('click', () => {
    $('#previa-quadro').style.width = botao.dataset.largura;
    for (const outro of document.querySelectorAll('[data-largura]')) outro.setAttribute('aria-pressed', String(outro === botao));
  });
}

// ---------- Início ----------

async function comecar() {
  if (MODO_LOCAL) return iniciar(criarFonteLocal());
  const token = sessionStorage.getItem(CHAVE_TOKEN);
  if (!token) return mostrarEntrada();
  try {
    await iniciar(await entrarComToken(token));
  } catch (erro) {
    sessionStorage.removeItem(CHAVE_TOKEN);
    mostrarEntrada(erro instanceof ErroFonte ? erro.message : `Erro inesperado: ${erro.message}`);
  }
}

comecar();

// Exposto só para inspeção no console durante o desenvolvimento.
if (MODO_LOCAL) window.painel = { estado, serializar, formatarCaminho };
