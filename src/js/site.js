// Vídeos sob demanda. Melhoria progressiva: sem JavaScript, o site funciona igual,
// só sem a prévia das capas e sem o autoplay dos blocos.
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

if ('IntersectionObserver' in window) {
  observarCapas();
  observarVideosDeBloco();
}
