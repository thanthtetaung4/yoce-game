import { photoInfo, photoSrc } from '../utils.js';

// The memory card: photo carousel (1–3 photos with captions) + date, title and story.
export function createModal({ onClose }) {
  const modal = document.getElementById('memory');
  const card = modal.querySelector('.memory__card');
  const track = modal.querySelector('.memory__track');
  const dots = modal.querySelector('.memory__dots');
  const prev = modal.querySelector('.memory__prev');
  const next = modal.querySelector('.memory__next');
  const num = modal.querySelector('.memory__num');
  const date = modal.querySelector('.memory__date');
  const title = modal.querySelector('.memory__title');
  const story = modal.querySelector('.memory__story');
  const closeBtn = modal.querySelector('.memory__close');
  let index = 0, count = 0, open = false, lastFocus = null;

  function go(i) {
    index = Math.max(0, Math.min(count - 1, i));
    track.style.transform = `translateX(${-index * 100}%)`;
    [...dots.children].forEach((d, k) => d.setAttribute('aria-current', k === index ? 'true' : 'false'));
    prev.disabled = index === 0;
    next.disabled = index === count - 1;
  }

  function slide(file, caption, alt) {
    const fig = document.createElement('figure');
    fig.className = 'memory__slide';
    const frame = document.createElement('div');
    frame.className = 'memory__frame';
    const info = photoInfo(file);
    const img = new Image();
    if (info) {
      frame.style.setProperty('--ratio', `${info.w} / ${info.h}`);
      frame.style.backgroundImage = `url("${info.blur}")`;
      img.srcset = info.srcset.map(([src, w]) => `${src} ${w}w`).join(', ');
      img.sizes = '(max-width: 700px) 86vw, 420px';
      img.src = photoSrc(file, 960);
      img.width = info.w; img.height = info.h;
    } else {
      frame.classList.add('is-missing');
      frame.style.setProperty('--ratio', '3 / 4');
    }
    img.alt = alt;
    img.decoding = 'async';
    img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
    if (info) frame.append(img);
    fig.append(frame);
    if (caption) {
      const cap = document.createElement('figcaption');
      cap.textContent = caption;
      fig.append(cap);
    }
    return fig;
  }

  function show(mem, i, total) {
    lastFocus = document.activeElement;
    const photos = (mem.photos?.length ? mem.photos : [null]).slice(0, 3);
    count = photos.length;
    track.replaceChildren(...photos.map((f, k) => slide(f, mem.captions?.[k] || '', mem.captions?.[k] ? `${mem.title} — ${mem.captions[k]}` : mem.title)));
    dots.replaceChildren(...photos.map((_, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Photo ${k + 1} of ${count}`);
      b.addEventListener('click', () => go(k));
      return b;
    }));
    modal.classList.toggle('is-single', count < 2);
    num.textContent = `Memory ${String(i + 1).padStart(2, '0')} of ${String(total).padStart(2, '0')}`;
    date.textContent = mem.date || '';
    title.textContent = mem.title || '';
    story.textContent = mem.story || '';
    card.scrollTop = 0;
    go(0);
    modal.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
    open = true;
    closeBtn.focus({ preventScroll: true });
  }

  function close() {
    if (!open) return;
    open = false;
    modal.classList.remove('is-open');
    const done = () => { if (!open) modal.hidden = true; };
    setTimeout(done, 380);
    lastFocus?.focus?.({ preventScroll: true });
    onClose();
  }

  prev.addEventListener('click', () => go(index - 1));
  next.addEventListener('click', () => go(index + 1));
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  window.addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') go(index - 1);
    else if (e.key === 'ArrowRight') go(index + 1);
    else if (e.key === 'Tab') {
      // keep focus inside the card
      const f = [...modal.querySelectorAll('button:not([disabled])')].filter((b) => b.offsetParent);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // swipe between photos
  let sx = null, sy = 0;
  track.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  track.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(index + (dx < 0 ? 1 : -1));
  });

  return { show, close, get open() { return open; } };
}
