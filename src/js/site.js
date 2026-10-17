// Melhorias progressivas: sem JavaScript, o site funciona igual, no tema claro,
// sem a prévia das capas e sem o autoplay dos blocos.
// - Tema: o botão do cabeçalho alterna claro/escuro e guarda a escolha (o <head> já a aplica).
// - Capas: o <video> da prévia só é criado quando a capa entra na tela.
// - Blocos: vídeos com data-autoplay tocam só quando visíveis; todos pausam ao sair da tela.

const movimentoReduzido = matchMedia('(prefers-reduced-motion: reduce)');

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
  janela.append(video);
  return video;
}

function observarCapas() {
  const janelas = document.querySelectorAll('.capa__janela[data-previa]');
  if (!janelas.length) return;
  const observador = new IntersectionObserver((entradas) => {
    for (const { target, isIntersecting } of entradas) {
      const video = target.querySelector('.capa__previa');
      if (isIntersecting && !video) {
        criarPrevia(target);
        target.dispatchEvent(new CustomEvent('previa-pronta', { bubbles: true }));
      } else if (!isIntersecting && video && !video.paused) {
        video.pause();
      }
    }
  }, { rootMargin: '200px 0px' });
  janelas.forEach((janela) => observador.observe(janela));
}

function observarVideosDeBloco() {
  const videos = document.querySelectorAll('.bloco-video video');
  if (!videos.length) return;
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

if ('IntersectionObserver' in window) {
  observarCapas();
  observarVideosDeBloco();
}
