// Melhorias progressivas: sem JavaScript, o site funciona igual, no tema claro,
// sem prévias em vídeo, sem autoplay e sem animações que escondam conteúdo.
// - Tema: o botão do rodapé alterna claro/escuro e guarda a escolha (o <head> já a aplica).
// - Capas: o <video> da prévia só é criado quando a capa entra na tela. No desktop toca no
//   hover/foco; no mobile toca enquanto a capa está visível.
// - Blocos: vídeos com data-autoplay tocam só quando visíveis; todos pausam ao sair da tela.
// - Revelação ao rolar (só até 768 px): os blocos abaixo da dobra aparecem uma única vez.
// A entrada da home é aplicada pelo script do <head> e feita só com CSS.

const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(hover: hover) and (min-width: 769px)');
const mobile = matchMedia('(max-width: 768px)');

// ---------- Prévia em movimento nas capas ----------

function criarPrevia(janela) {
  const video = document.createElement('video');
  video.className = 'capa__previa';
  video.src = janela.dataset.previa;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');
  video.tabIndex = -1;
  // Só aparece por cima da imagem quando já tem quadro para mostrar.
  video.addEventListener('playing', () => video.classList.add('capa__previa--tocando'));
  janela.append(video);
  return video;
}

function previaDe(janela) {
  return janela.querySelector('.capa__previa') ?? criarPrevia(janela);
}

function tocar(video) {
  if (movimentoReduzido.matches) return;
  video.play().catch(() => {});
}

function parar(video) {
  if (!video) return;
  video.pause();
  video.classList.remove('capa__previa--tocando');
}

function prepararCapas() {
  const janelas = document.querySelectorAll('.capa__janela[data-previa]');
  if (!janelas.length) return;

  // Desktop: toca no hover e no foco do link da capa.
  for (const janela of janelas) {
    const capa = janela.closest('.capa');
    const entrar = () => { if (desktop.matches) tocar(previaDe(janela)); };
    const sair = () => parar(janela.querySelector('.capa__previa'));
    capa.addEventListener('mouseenter', entrar);
    capa.addEventListener('focus', entrar);
    capa.addEventListener('mouseleave', sair);
    capa.addEventListener('blur', sair);
  }

  if (!('IntersectionObserver' in window)) return;
  // Cria a prévia quando a capa se aproxima da tela; no mobile, toca enquanto visível.
  const observador = new IntersectionObserver((entradas) => {
    for (const { target, isIntersecting } of entradas) {
      if (isIntersecting) {
        const video = previaDe(target);
        if (!desktop.matches) tocar(video);
      } else {
        parar(target.querySelector('.capa__previa'));
      }
    }
  }, { rootMargin: '200px 0px', threshold: 0 });
  janelas.forEach((janela) => observador.observe(janela));
}

// ---------- Vídeos de bloco ----------

function observarVideosDeBloco() {
  const videos = document.querySelectorAll('.bloco-video video');
  if (!videos.length || !('IntersectionObserver' in window)) return;
  const observador = new IntersectionObserver((entradas) => {
    for (const { target: video, isIntersecting } of entradas) {
      if (isIntersecting) {
        if (video.dataset.autoplay && !movimentoReduzido.matches && video.paused) {
          video.play().catch(() => {});
        }
      } else if (!video.paused) {
        video.pause();
      }
    }
  }, { threshold: 0.25 });
  videos.forEach((video) => observador.observe(video));
}

// ---------- Revelação ao rolar (mobile) ----------

const REVELAVEIS = [
  '.capa',
  '.bloco',
  '.card-projeto__caixas > *',
  '.tecnologia',
  '.experiencia',
  '.cartao-contato',
  '.rodape__caixa',
].join(', ');

function revelarAoRolar() {
  if (!mobile.matches || movimentoReduzido.matches || !('IntersectionObserver' in window)) return;
  // Só o que está abaixo da dobra é escondido; o que já aparece na tela fica como está.
  const alvos = [...document.querySelectorAll(REVELAVEIS)].filter((el) => el.getBoundingClientRect().top > window.innerHeight);
  if (!alvos.length) return;

  const observador = new IntersectionObserver((entradas) => {
    for (const { target, isIntersecting } of entradas) {
      if (!isIntersecting) continue;
      observador.unobserve(target);
      target.classList.add('revelado');
      // Ao terminar, tira as classes (o clip-path cortaria o contorno de foco).
      const limpar = () => target.classList.remove('revelar', 'revelado');
      target.addEventListener('transitionend', limpar, { once: true });
      setTimeout(limpar, 800);
    }
  }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

  for (const el of alvos) {
    el.classList.add('revelar');
    observador.observe(el);
  }
}

// ---------- Tema ----------

function botaoTema() {
  const botao = document.querySelector('.botao-tema');
  if (!botao) return;
  const raiz = document.documentElement;
  const atualizar = () => botao.setAttribute('aria-pressed', String(raiz.dataset.tema === 'escuro'));
  botao.hidden = false;
  atualizar();
  botao.addEventListener('click', () => {
    const escuro = raiz.dataset.tema !== 'escuro';
    if (escuro) raiz.dataset.tema = 'escuro';
    else delete raiz.dataset.tema;
    try {
      localStorage.setItem('tema', escuro ? 'escuro' : 'claro');
    } catch {
      // Sem armazenamento (navegação privada etc.): o tema vale só nesta página.
    }
    atualizar();
  });
}

botaoTema();
prepararCapas();
observarVideosDeBloco();
revelarAoRolar();
