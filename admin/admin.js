// Painel: entrada com token, navegação, edição, mídia, pré-visualização e publicação.
// ?local=1  lê content/ do servidor local e nunca grava (publicar vira ensaio).
// ?ensaio=1 monta o commit e mostra no console, sem chamar a API de escrita do GitHub.

import { ErroConflito, ErroFonte, criarFonteGitHub, criarFonteLocal } from './github.js';
import { DESCRITORES, formatarCaminho, h, montarFormulario, mostrarProblemas } from './formularios.js';
import { ErroEnvio, nomeLivre, nomeSeguro, processarImagem, processarPdf, processarVideo } from './midia.js';
import { PAGINAS, SLUG, formatarProblema, validarPagina, validarProjeto } from './validacao.js';
import { ordenarProjetos } from './render/util.js';
import { renderHome } from './render/home.js';
import { renderProjeto } from './render/projeto.js';
import { renderSobre } from './render/sobre.js';
import { renderContato } from './render/contato.js';
import { renderErro404 } from './render/erro404.js';

const CHAVE_TOKEN = 'painel.token';
const parametros = new URLSearchParams(location.search);
const MODO_LOCAL = parametros.has('local');
const ENSAIO = MODO_LOCAL || parametros.has('ensaio');

const $ = (seletor) => document.querySelector(seletor);

const estado = {
  fonte: null,
  versao: null, // commit da branch quando o conteúdo foi carregado
  arquivos: new Set(), // arquivos que já existem no repositório (relativos a content/)
  uploads: new Map(), // caminho → { bytes, url } enviados nesta sessão, ainda não publicados
  docs: new Map(), // caminho → { caminho, tipo: 'pagina'|'projeto', chave, slug, original, dados, novo }
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

// Uploads ainda usados por algum documento (os removidos da página não são publicados).
function uploadsUsados() {
  const textos = [...estado.docs.values()].map((d) => ({ d, texto: serializar(d.dados) }));
  return [...estado.uploads.keys()].filter((caminho) => {
    const nome = caminho.split('/').pop();
    if (caminho.startsWith('midia/')) return textos.some(({ texto }) => texto.includes(`"/${caminho}"`));
    const slug = caminho.split('/')[1];
    return textos.some(({ d, texto }) => d.slug === slug && texto.includes(`"${nome}"`));
  });
}

function totalPendente() {
  return docsAlterados().length + uploadsUsados().length;
}

function existeArquivo(caminho) {
  return estado.arquivos.has(caminho) || estado.uploads.has(caminho);
}

function validar(doc) {
  return doc.tipo === 'projeto'
    ? validarProjeto(doc.slug, doc.dados, existeArquivo)
    : validarPagina(doc.chave, doc.dados, existeArquivo);
}

function projetos() {
  return [...estado.docs.values()].filter((d) => d.tipo === 'projeto').map(({ slug, dados }) => ({ slug, dados }));
}

function categoriasUsadas() {
  return [...new Set(projetos().map((p) => p.dados.categoria).filter(Boolean))].sort();
}

function doc(caminho) {
  return estado.docs.get(caminho);
}

function avisar(texto, tipo = 'info') {
  const aviso = $('#aviso');
  aviso.textContent = texto;
  aviso.className = `aviso aviso--${tipo}`;
  aviso.hidden = false;
  clearTimeout(avisar.tempo);
  if (tipo !== 'erro') avisar.tempo = setTimeout(() => { aviso.hidden = true; }, 8000);
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
  if (totalPendente() && !confirm('Há alterações não publicadas. Elas serão perdidas. Sair mesmo assim?')) return;
  sessionStorage.removeItem(CHAVE_TOKEN);
  estado.saindo = true;
  location.reload();
});

window.addEventListener('beforeunload', (evento) => {
  if (!estado.saindo && totalPendente()) {
    evento.preventDefault();
    evento.returnValue = '';
  }
});

// ---------- Carregamento ----------

async function carregar(fonte) {
  estado.versao = await fonte.lerVersao();
  const arquivos = await fonte.listarArquivos();
  estado.arquivos = new Set(arquivos);
  for (const { url } of estado.uploads.values()) URL.revokeObjectURL(url);
  estado.uploads.clear();
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
  $('#selo-ensaio').hidden = !ENSAIO;
  $('#editor').replaceChildren(h('p', { class: 'aviso-carregando', role: 'status' }, 'Carregando o conteúdo…'));
  try {
    const falhas = await carregar(fonte);
    if (falhas.length) avisar(`Alguns arquivos não puderam ser lidos: ${falhas.join(' · ')}`, 'erro');
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

window.addEventListener('hashchange', () => {
  if (estado.fonte) abrirPelaUrl();
});

const NOMES_PAGINAS = { home: 'Home', sobre: 'Sobre', contato: 'Contato', erro404: 'Página 404', site: 'Site e rótulos' };

function itemNavegacao(d, titulo, detalhe) {
  return h('li', {},
    h('a', { href: rotaPara(d), class: 'nav-painel__item', 'aria-current': estado.atual === d ? 'page' : null },
      h('span', { class: 'nav-painel__titulo' }, titulo),
      detalhe ? h('span', { class: 'nav-painel__detalhe' }, detalhe) : null,
      alterado(d) ? h('span', { class: 'nav-painel__alterado' }, d.novo ? 'novo' : 'alterado') : null));
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
  const total = totalPendente();
  const status = $('#status');
  status.textContent = total
    ? `Rascunho · ${total} ${total === 1 ? 'arquivo alterado' : 'arquivos alterados'}, não publicado${total === 1 ? '' : 's'}`
    : 'Sem alterações';
  status.classList.toggle('selo--alterado', total > 0);
  $('#publicar').disabled = total === 0;
  const desfazer = $('#desfazer');
  if (desfazer) desfazer.disabled = !alterado(estado.atual);
}

// ---------- Mídia ----------

// Prepara o arquivo, guarda em memória e devolve { src, largura, altura } para o documento.
async function enviar(arquivo, aceita) {
  const d = estado.atual;
  const pasta = d.tipo === 'projeto' ? `projetos/${d.slug}` : 'midia';
  avisar(`Preparando "${arquivo.name}"…`);
  try {
    const pronto = aceita === 'imagem' ? await processarImagem(arquivo)
      : aceita === 'pdf' ? await processarPdf(arquivo)
        : await processarVideo(arquivo, aceita);
    const nome = nomeLivre(pasta, nomeSeguro(arquivo.name, pronto.extensao), existeArquivo);
    const caminho = `${pasta}/${nome}`;
    const tipoMime = { webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', pdf: 'application/pdf' }[pronto.extensao];
    estado.uploads.set(caminho, { bytes: pronto.bytes, url: URL.createObjectURL(new Blob([pronto.bytes], { type: tipoMime })) });
    const tamanho = `${Math.max(1, Math.round(pronto.bytes.length / 1024))} KB`;
    avisar(`${nome} pronto (${tamanho}${pronto.largura ? `, ${pronto.largura} × ${pronto.altura}` : ''}).${pronto.aviso ? ` ${pronto.aviso}` : ''}`, pronto.aviso ? 'aviso' : 'info');
    return { src: d.tipo === 'projeto' ? nome : `/${caminho}`, largura: pronto.largura, altura: pronto.altura };
  } catch (erro) {
    avisar(erro instanceof ErroEnvio ? erro.message : `Não foi possível preparar o arquivo: ${erro.message}`, 'erro');
    return null;
  }
}

// ---------- Editor ----------

// Resumo acima do formulário: só aparece quando há erro, aviso ou marcador.
function resumoValidacao(problemas, semCampo) {
  const erros = problemas.filter((p) => p.nivel === 'erro');
  const marcadores = problemas.filter((p) => p.marcador).length;
  const avisos = problemas.filter((p) => p.nivel === 'aviso' && !p.marcador);
  if (!erros.length && !marcadores && !avisos.length) return null;
  const partes = [];
  if (erros.length) partes.push(`${erros.length} ${erros.length === 1 ? 'erro' : 'erros'}`);
  if (marcadores) partes.push(`${marcadores} ${marcadores === 1 ? 'marcador […] a preencher' : 'marcadores […] a preencher'}`);
  if (avisos.length) partes.push(`${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}`);

  const extras = semCampo.filter((p) => !p.marcador);
  return h('div', { class: `resumo ${erros.length ? 'resumo--erro' : ''}` },
    h('p', { class: 'resumo__linha' }, partes.join(' · ')),
    extras.length ? h('ul', { class: 'resumo__lista' }, extras.map((p) => h('li', {}, formatarProblema(p)))) : null);
}

function revalidar() {
  const problemas = validar(estado.atual);
  const semCampo = mostrarProblemas(estado.formulario, problemas);
  const resumo = resumoValidacao(problemas, semCampo);
  $('#resumo').replaceChildren(...(resumo ? [resumo] : []));
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
  const acao = [...area.querySelectorAll('[data-acao]')].find((el) => el.dataset.acao === foco);
  const alvo = item?.querySelector('input:not([type="file"]), textarea, select')
    ?? acao?.querySelector('input, button')
    ?? acao;
  alvo?.focus();
  (item ?? acao)?.scrollIntoView({ block: 'nearest' });
}

function botoesDoTopo(d) {
  const botoes = [];
  if (d.tipo === 'projeto' && d.dados.publicado === true) {
    botoes.push(h('button', {
      type: 'button',
      class: 'botao-painel botao-painel--secundario',
      onclick: () => {
        if (!confirm('Arquivar este projeto? Ele sai do site na próxima publicação, mas continua no repositório.')) return;
        d.dados.publicado = false;
        abrir(d);
      },
    }, 'Arquivar'));
  }
  botoes.push(h('button', {
    type: 'button',
    id: 'desfazer',
    class: 'botao-painel botao-painel--secundario',
    disabled: !alterado(d),
    onclick: () => {
      if (d.novo) {
        if (!confirm('Descartar este projeto novo?')) return;
        estado.docs.delete(d.caminho);
        location.hash = '';
        abrirPelaUrl();
        return;
      }
      if (!confirm('Desfazer todas as alterações deste item?')) return;
      d.dados = JSON.parse(d.original);
      abrir(d);
    },
  }, d.novo ? 'Descartar projeto' : 'Desfazer alterações'));
  return botoes;
}

function abrir(d, { foco } = {}) {
  const rolagem = estado.atual === d ? window.scrollY : 0;
  estado.atual = d;
  const descritores = d.tipo === 'projeto' ? DESCRITORES.projeto(d.slug, { categorias: categoriasUsadas() }) : DESCRITORES[d.chave];
  const titulo = d.tipo === 'projeto' ? `Editar projeto: ${d.dados.titulo || d.slug}` : `Editar: ${NOMES_PAGINAS[d.chave]}`;

  estado.formulario = montarFormulario(descritores, {
    doc: d.dados,
    aoMudar,
    aoEstrutura: ({ foco: novoFoco } = {}) => abrir(d, { foco: novoFoco }),
    enviar,
  });

  $('#editor').replaceChildren(
    h('div', { class: 'editor__topo' },
      h('h1', { class: 'editor__titulo' }, h('span', { class: 'marca' }, titulo)),
      h('div', { class: 'editor__botoes' }, botoesDoTopo(d))),
    h('p', { class: 'editor__arquivo' }, `content/${d.caminho}`),
    h('div', { id: 'resumo', 'aria-live': 'polite' }),
    estado.formulario,
  );

  aoMudar();
  window.scrollTo(0, rolagem);
  if (foco) focarDepois(foco);
}

// ---------- Novo projeto ----------

function slugPara(titulo) {
  const base = nomeSeguro(titulo, 'x').replace(/\.x$/, '').replace(/^-+|-+$/g, '') || 'projeto';
  let slug = base;
  for (let n = 2; doc(`projetos/${slug}/projeto.json`) || [...estado.arquivos].some((c) => c.startsWith(`projetos/${slug}/`)); n += 1) slug = `${base}-${n}`;
  return slug;
}

$('#novo-projeto').addEventListener('click', () => {
  $('#novo-erro').hidden = true;
  $('#form-novo').reset();
  $('#novo-categorias').replaceChildren(...categoriasUsadas().map((c) => h('option', { value: c })));
  $('#dialogo-novo').showModal();
});

$('#novo-cancelar').addEventListener('click', () => $('#dialogo-novo').close());

$('#form-novo').addEventListener('submit', (evento) => {
  evento.preventDefault();
  const titulo = $('#novo-titulo').value.trim();
  const categoria = $('#novo-categoria').value.trim();
  if (!titulo || !categoria) {
    $('#novo-erro').textContent = titulo ? 'Escreva uma categoria.' : 'Dê um título ao projeto.';
    $('#novo-erro').hidden = false;
    (titulo ? $('#novo-categoria') : $('#novo-titulo')).focus();
    return;
  }
  const slug = slugPara(titulo);
  if (!SLUG.test(slug)) throw new Error(`slug inválido: ${slug}`);
  const ordem = Math.max(0, ...projetos().map((p) => Number(p.dados.ordem) || 0)) + 1;
  const caminho = `projetos/${slug}/projeto.json`;
  estado.docs.set(caminho, {
    caminho,
    tipo: 'projeto',
    slug,
    novo: true,
    original: '',
    dados: {
      publicado: false,
      ordem,
      titulo,
      subtitulo: '',
      categoria,
      ano: String(new Date().getFullYear()),
      stack: '',
      capa: { src: '', alt: '' },
      blocos: [],
      ficha: {},
      links: [],
    },
  });
  $('#dialogo-novo').close();
  location.hash = `#projeto/${slug}`;
  avisar(`Projeto criado como rascunho em content/projetos/${slug}/. Envie a capa e preencha os campos antes de publicar.`);
});

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

// Mídia enviada nesta sessão ainda não existe no site: a prévia usa o arquivo em memória.
function trocarUploads(html) {
  let saida = html;
  for (const [caminho, { url }] of estado.uploads) saida = saida.replaceAll(`"/${caminho}"`, `"${url}"`);
  return saida;
}

// Na prévia os links não navegam: ela mostra a página, não o site inteiro.
const ESTILO_PREVIA = '<style>a { pointer-events: none; }</style>';

function abrirPrevia() {
  const quadro = $('#previa-quadro');
  const erro = $('#previa-erro');
  try {
    quadro.srcdoc = trocarUploads(htmlDaPrevia()).replace('</head>', `${ESTILO_PREVIA}</head>`);
    quadro.hidden = false;
    erro.hidden = true;
  } catch (e) {
    quadro.hidden = true;
    erro.hidden = false;
    erro.textContent = `Não foi possível montar a prévia. Corrija os erros do formulário e tente de novo. (${e.message})`;
  }
  $('#previa').showModal();
}

$('#previsualizar').addEventListener('click', () => estado.atual && abrirPrevia());
$('#previa-fechar').addEventListener('click', () => $('#previa').close());
for (const botao of document.querySelectorAll('[data-largura]')) {
  botao.addEventListener('click', () => {
    $('#previa-quadro').style.width = botao.dataset.largura;
    for (const outro of document.querySelectorAll('[data-largura]')) outro.setAttribute('aria-pressed', String(outro === botao));
  });
}

// ---------- Publicação ----------

function nomeDoc(d) {
  return d.tipo === 'projeto' ? `projeto ${d.slug}` : `página ${d.chave === 'erro404' ? '404' : d.chave}`;
}

function mensagemCommit(alterados, midias) {
  let titulo;
  if (alterados.length === 1) {
    const [d] = alterados;
    titulo = `conteúdo: ${d.novo ? 'cria' : 'atualiza'} ${nomeDoc(d)}`;
  } else if (alterados.length === 0) {
    titulo = `conteúdo: envia ${midias.length} ${midias.length === 1 ? 'arquivo de mídia' : 'arquivos de mídia'}`;
  } else {
    titulo = `conteúdo: atualiza ${alterados.length} itens`;
  }
  const linhas = [
    ...alterados.map((d) => `- ${d.novo ? 'cria' : 'atualiza'} ${nomeDoc(d)}`),
    ...midias.map((c) => `- envia content/${c}`),
  ];
  return linhas.length > 1 ? `${titulo}\n\n${linhas.join('\n')}` : titulo;
}

function mostrarPublicacao({ titulo, texto, tipo = 'info', lista = [], recarregar = false }) {
  $('#publicacao-titulo').textContent = titulo;
  const corpo = $('#publicacao-corpo');
  corpo.className = `publicacao__corpo aviso--${tipo}`;
  // replaceChildren transforma null em texto, então a lista só entra quando existe.
  const filhos = [h('p', {}, texto)];
  if (lista.length) filhos.push(h('ul', {}, lista.map((l) => h('li', {}, l))));
  corpo.replaceChildren(...filhos);
  $('#publicacao-recarregar').hidden = !recarregar;
  $('#publicacao-fechar').disabled = false;
  if (!$('#publicacao').open) $('#publicacao').showModal();
}

async function publicar() {
  const alterados = docsAlterados();
  const midias = uploadsUsados();
  if (!alterados.length && !midias.length) return;

  const erros = alterados.flatMap((d) => validar(d).filter((p) => p.nivel === 'erro'));
  if (erros.length) {
    mostrarPublicacao({
      titulo: 'Corrija antes de publicar',
      texto: `Há ${erros.length} ${erros.length === 1 ? 'erro' : 'erros'} nos itens alterados. O build recusaria o conteúdo, então nada foi enviado.`,
      tipo: 'erro',
      lista: erros.map(formatarProblema),
    });
    return;
  }

  const arquivos = [
    ...alterados.map((d) => ({ caminho: d.caminho, texto: serializar(d.dados) })),
    ...midias.map((caminho) => ({ caminho, bytes: estado.uploads.get(caminho).bytes })),
  ];
  const mensagem = mensagemCommit(alterados, midias);

  mostrarPublicacao({ titulo: ENSAIO ? 'Ensaio da publicação' : 'Publicando', texto: 'Preparando…' });
  $('#publicacao-fechar').disabled = true;
  const progresso = (texto) => { $('#publicacao-corpo').firstChild.textContent = texto; };

  try {
    const resultado = await estado.fonte.publicar({ arquivos, mensagem, versaoBase: estado.versao, ensaio: ENSAIO, aoProgresso: progresso });
    if (resultado.ensaio) {
      mostrarPublicacao({
        titulo: 'Ensaio concluído',
        texto: `Nada foi enviado. O commit teria ${arquivos.length} ${arquivos.length === 1 ? 'arquivo' : 'arquivos'}; a lista, os tamanhos e a mensagem estão no console do navegador.`,
        lista: [`Mensagem: ${mensagem.split('\n')[0]}`, ...resultado.arquivos.map((a) => `${a.arquivo} · ${a.bytes} bytes`)],
      });
      return;
    }
    for (const d of alterados) {
      d.original = serializar(d.dados);
      d.novo = false;
    }
    for (const caminho of estado.uploads.keys()) estado.arquivos.add(caminho);
    for (const caminho of midias) estado.uploads.delete(caminho);
    estado.versao = resultado.versao;
    abrir(estado.atual);
    mostrarPublicacao({ titulo: 'Publicado', texto: 'Publicado. O Render deve atualizar o site em instantes.', tipo: 'sucesso' });
  } catch (erro) {
    if (erro instanceof ErroConflito) {
      mostrarPublicacao({ titulo: 'O repositório mudou', texto: `${erro.message} Recarregar descarta as alterações feitas aqui.`, tipo: 'erro', recarregar: true });
    } else {
      mostrarPublicacao({ titulo: 'Não foi possível publicar', texto: erro instanceof ErroFonte ? erro.message : `Erro inesperado: ${erro.message}`, tipo: 'erro' });
    }
  }
}

$('#publicar').addEventListener('click', publicar);
$('#publicacao-fechar').addEventListener('click', () => $('#publicacao').close());
$('#publicacao-recarregar').addEventListener('click', async () => {
  if (totalPendente() && !confirm('Descartar as alterações e recarregar o conteúdo do repositório?')) return;
  $('#publicacao').close();
  await iniciar(estado.fonte);
});

// ---------- Tema ----------

// O mesmo tema do site (chave "tema" no localStorage); o <head> já aplica a escolha salva.
function prepararTema() {
  const botao = $('#tema');
  const raiz = document.documentElement;
  const atualizar = () => botao.setAttribute('aria-pressed', String(raiz.dataset.tema === 'escuro'));
  atualizar();
  botao.addEventListener('click', () => {
    const escuro = raiz.dataset.tema !== 'escuro';
    if (escuro) raiz.dataset.tema = 'escuro';
    else delete raiz.dataset.tema;
    try {
      localStorage.setItem('tema', escuro ? 'escuro' : 'claro');
    } catch {
      // Sem armazenamento: o tema vale só nesta página.
    }
    atualizar();
  });
}

prepararTema();

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
if (MODO_LOCAL) window.painel = { estado, serializar, formatarCaminho, uploadsUsados };
