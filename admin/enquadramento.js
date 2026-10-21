// Editor visual do enquadramento de uma imagem de galeria.
// - Largura: arrastando a alça na borda da miniatura (ou setas do teclado), de 5 em 5%.
// - Posição: esquerda, centro ou direita, quando a imagem está sozinha na linha e é menor que ela.
// - Recorte: proporção fixa; o ponto de foco escolhe a parte da imagem que fica visível.
// - Moldura: contorno na cor da tinta do site.
// Grava escala, alinhamento, recorte, foco e moldura direto no objeto da imagem; padrões não são gravados.

import { ALINHAMENTOS, ESCALA_MAX, ESCALA_MIN, MOLDURAS, RECORTES } from './validacao.js';
import { h } from './formularios.js';

const PASSO = 5;
const NOMES_ALINHAMENTO = { esquerda: 'Esquerda', centro: 'Centro', direita: 'Direita' };
const NOMES_MOLDURA = { fina: 'Fina', grossa: 'Grossa', sombra: 'Sombra dura', 'passe-partout': 'Passe-partout' };

// Explicação da largura em cada layout.
const AJUDAS = {
  carrossel: 'Arraste a alça para mudar a largura do slide. O padrão (85%) deixa a próxima imagem aparecer na borda.',
  duas: 'Arraste a alça para mudar a largura em relação à metade da linha (a área tracejada). As duas imagens ficam juntas e centralizadas.',
  livre: 'Arraste a alça para mudar a largura da imagem na linha (a área tracejada).',
};

const limitar = (n, min, max) => Math.min(max, Math.max(min, n));
const arredondar = (n) => Math.round(n / PASSO) * PASSO;

function proporcao(recorte) {
  const [a, b] = recorte.split(':').map(Number);
  return a / b;
}

// Arrasto com mouse, toque ou caneta: chama aoMover a cada movimento e aoSoltar no fim.
function arrastar(el, aoMover, aoSoltar) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.focus();
    el.setPointerCapture(e.pointerId);
    aoMover(e);
    const soltar = () => {
      el.removeEventListener('pointermove', aoMover);
      el.removeEventListener('pointerup', soltar);
      el.removeEventListener('pointercancel', soltar);
      aoSoltar();
    };
    el.addEventListener('pointermove', aoMover);
    el.addEventListener('pointerup', soltar);
    el.addEventListener('pointercancel', soltar);
  });
}

function grupoDeBotoes(rotulo, botoes) {
  const titulo = h('span', { class: 'campo__rotulo' }, rotulo);
  titulo.id = `enq-${Math.random().toString(36).slice(2)}`;
  return h('div', { class: 'enq__grupo', role: 'group', 'aria-labelledby': titulo.id },
    titulo, h('div', { class: 'enq__botoes' }, botoes));
}

// opcoes: { imagem, layout ('carrossel' | 'duas' | 'livre'), campo ("blocos[1].imagens[0]"), mensagem,
//           urlImagem(src) → Promise<url|null>, aoMudar() }
export function editorEnquadramento({ imagem, layout, campo, mensagem, urlImagem, aoMudar }) {
  const padrao = layout === 'carrossel' ? 85 : 100;
  const comPosicao = layout === 'livre';
  const natural = imagem.largura > 0 && imagem.altura > 0 ? imagem.largura / imagem.altura : 4 / 3;

  // ---------- Miniatura no espaço, com a alça de largura ----------
  const foto = h('img', { class: 'enq__foto', alt: '', draggable: 'false' });
  const alca = h('div', {
    class: 'enq__alca',
    role: 'slider',
    tabindex: '0',
    'aria-label': 'Largura da imagem',
    'aria-valuemin': ESCALA_MIN,
    'aria-valuemax': ESCALA_MAX,
    'data-campo': `${campo}.escala`,
  });
  const caixa = h('div', { class: 'enq__caixa' }, foto, alca);
  const espaco = h('div', { class: 'enq__espaco' }, caixa);
  const valor = h('span', { class: 'enq__valor' });
  const usarPadrao = h('button', {
    type: 'button',
    class: 'botao-painel botao-painel--secundario',
    onclick: () => {
      delete imagem.escala;
      atualizar(true);
      alca.focus();
    },
  }, 'Usar padrão');

  // ---------- Posição e recorte ----------
  const botoesPosicao = ALINHAMENTOS.map((a) => h('button', {
    type: 'button',
    class: 'botao-painel botao-painel--secundario',
    onclick: () => {
      if (a === 'esquerda') delete imagem.alinhamento;
      else imagem.alinhamento = a;
      atualizar(true);
    },
  }, NOMES_ALINHAMENTO[a]));

  const opcoesRecorte = [['', 'Original'], ...RECORTES.map((r) => [r, r])];
  const botoesRecorte = opcoesRecorte.map(([r, nome]) => h('button', {
    type: 'button',
    class: 'botao-painel botao-painel--secundario',
    onclick: () => {
      if (r) imagem.recorte = r;
      else {
        delete imagem.recorte;
        delete imagem.foco;
      }
      atualizar(true);
    },
  }, nome));

  const opcoesMoldura = [['', 'Nenhuma'], ...MOLDURAS.map((m) => [m, NOMES_MOLDURA[m]])];
  const botoesMoldura = opcoesMoldura.map(([m, nome]) => h('button', {
    type: 'button',
    class: 'botao-painel botao-painel--secundario',
    onclick: () => {
      if (m) imagem.moldura = m;
      else delete imagem.moldura;
      atualizar(true);
    },
  }, nome));

  // ---------- Ponto de foco ----------
  const fotoInteira = h('img', { class: 'enq__foto-inteira', alt: '', draggable: 'false' });
  const janela = h('div', { class: 'enq__janela' });
  const ponto = h('div', { class: 'enq__ponto' });
  const seletorFoco = h('div', {
    class: 'enq__foco',
    role: 'slider',
    tabindex: '0',
    'aria-label': 'Ponto de foco do recorte',
    'aria-valuemin': 0,
    'aria-valuemax': 100,
    'data-campo': `${campo}.foco`,
  }, fotoInteira, janela, ponto);
  seletorFoco.style.aspectRatio = String(natural);
  const grupoFoco = h('div', { class: 'enq__grupo' },
    h('span', { class: 'campo__rotulo' }, 'Ponto de foco'),
    h('p', { class: 'campo__ajuda' }, 'Clique ou arraste na imagem. O retângulo mostra a parte que aparece no site; as setas do teclado movem o ponto.'),
    seletorFoco);

  const foco = () => ({ x: imagem.foco?.x ?? 50, y: imagem.foco?.y ?? 50 });

  function desenharFoco() {
    const { x, y } = foco();
    const c = proporcao(imagem.recorte);
    // Fração da imagem que o recorte mostra; a sobra se divide conforme o foco (como object-position).
    const largura = c < natural ? c / natural : 1;
    const altura = c < natural ? 1 : natural / c;
    Object.assign(janela.style, {
      width: `${largura * 100}%`,
      height: `${altura * 100}%`,
      left: `${(1 - largura) * x}%`,
      top: `${(1 - altura) * y}%`,
    });
    Object.assign(ponto.style, { left: `${x}%`, top: `${y}%` });
    seletorFoco.setAttribute('aria-valuenow', x);
    seletorFoco.setAttribute('aria-valuetext', `${x}% na horizontal, ${y}% na vertical`);
  }

  function atualizar(mudou) {
    const escala = imagem.escala ?? padrao;
    const posicao = comPosicao ? (imagem.alinhamento ?? 'esquerda') : 'esquerda';
    espaco.dataset.alinhamento = posicao;
    caixa.style.width = `${escala}%`;
    caixa.style.aspectRatio = String(imagem.recorte ? proporcao(imagem.recorte) : natural);
    caixa.dataset.moldura = imagem.moldura ?? '';
    const { x, y } = foco();
    foto.style.objectPosition = `${x}% ${y}%`;

    const texto = imagem.escala === undefined ? `${escala}% (padrão)` : `${escala}%`;
    alca.setAttribute('aria-valuenow', escala);
    alca.setAttribute('aria-valuetext', texto);
    valor.textContent = `Largura: ${texto}`;
    usarPadrao.hidden = imagem.escala === undefined;

    botoesPosicao.forEach((b, i) => b.setAttribute('aria-pressed', String(ALINHAMENTOS[i] === posicao)));
    botoesRecorte.forEach((b, i) => b.setAttribute('aria-pressed', String(opcoesRecorte[i][0] === (imagem.recorte ?? ''))));
    botoesMoldura.forEach((b, i) => b.setAttribute('aria-pressed', String(opcoesMoldura[i][0] === (imagem.moldura ?? ''))));
    grupoFoco.hidden = !imagem.recorte;
    if (imagem.recorte) desenharFoco();
    if (mudou) aoMudar();
  }

  // Largura pela posição do ponteiro, medida a partir do lado onde a imagem encosta.
  arrastar(alca, (e) => {
    const r = espaco.getBoundingClientRect();
    const posicao = espaco.dataset.alinhamento;
    const fracao = posicao === 'direita' ? (r.right - e.clientX) / r.width
      : posicao === 'centro' ? (2 * Math.abs(e.clientX - (r.left + r.width / 2))) / r.width
        : (e.clientX - r.left) / r.width;
    imagem.escala = limitar(arredondar(fracao * 100), ESCALA_MIN, ESCALA_MAX);
    atualizar(false);
  }, aoMudar);

  alca.addEventListener('keydown', (e) => {
    const atual = imagem.escala ?? padrao;
    const novo = {
      ArrowRight: atual + PASSO, ArrowUp: atual + PASSO, ArrowLeft: atual - PASSO, ArrowDown: atual - PASSO,
      PageUp: atual + 4 * PASSO, PageDown: atual - 4 * PASSO, Home: ESCALA_MIN, End: ESCALA_MAX,
    }[e.key];
    if (novo === undefined) return;
    e.preventDefault();
    imagem.escala = limitar(arredondar(novo), ESCALA_MIN, ESCALA_MAX);
    atualizar(true);
  });

  arrastar(seletorFoco, (e) => {
    const r = seletorFoco.getBoundingClientRect();
    imagem.foco = {
      x: limitar(Math.round(((e.clientX - r.left) / r.width) * 100), 0, 100),
      y: limitar(Math.round(((e.clientY - r.top) / r.height) * 100), 0, 100),
    };
    atualizar(false);
  }, aoMudar);

  seletorFoco.addEventListener('keydown', (e) => {
    const { x, y } = foco();
    const passo = {
      ArrowLeft: [-PASSO, 0], ArrowRight: [PASSO, 0], ArrowUp: [0, -PASSO], ArrowDown: [0, PASSO],
    }[e.key];
    if (!passo && e.key !== 'Home') return;
    e.preventDefault();
    imagem.foco = passo
      ? { x: limitar(x + passo[0], 0, 100), y: limitar(y + passo[1], 0, 100) }
      : { x: 50, y: 50 };
    atualizar(true);
  });

  if (imagem.src) {
    urlImagem(imagem.src).then((url) => {
      if (!url) return;
      foto.src = url;
      fotoInteira.src = url;
    });
  }

  atualizar(false);

  return h('div', { class: 'campo enq' },
    h('span', { class: 'campo__rotulo' }, 'Enquadramento'),
    h('p', { class: 'campo__ajuda' }, AJUDAS[layout]),
    h('div', { class: 'enq__moldura' }, espaco),
    h('div', { class: 'enq__linha' }, valor, usarPadrao),
    comPosicao ? grupoDeBotoes('Posição', botoesPosicao) : null,
    grupoDeBotoes('Recorte', botoesRecorte),
    grupoFoco,
    grupoDeBotoes('Moldura', botoesMoldura),
    mensagem);
}
