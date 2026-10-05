import { photoInfo, photoSrc, isTouch } from '../utils.js';

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

// Loading screen, title screen and the closing birthday card.
export function createScreens(story) {
  const $ = (s) => document.querySelector(s);
  const loader = $('#loader');
  const loaderBar = $('#loader-bar span');
  const loaderPct = $('#loader-pct');
  const title = $('#title');
  const startBtn = $('#start-btn');
  const ending = $('#ending');

  document.title = `Happy ${story.age}${ordinal(story.age)}, ${story.name}`;

  /* Title screen, filled from story.js */
  $('#title-kicker').textContent = story.hero.kicker;
  const nameEl = $('#title-name');
  nameEl.setAttribute('aria-label', story.name);
  [...story.name].forEach((ch, i) => {
    const c = document.createElement('span');
    c.className = 'char'; c.textContent = ch; c.style.setProperty('--i', i);
    c.setAttribute('aria-hidden', 'true');
    nameEl.append(c);
  });
  $('#title-headline').textContent = story.hero.headline;
  $('#title-sub').textContent = story.hero.subline;
  $('#title-age').textContent = story.age;
  const stack = $('#title-stack');
  story.hero.photos.slice(0, 3).forEach((f) => {
    const info = photoInfo(f);
    if (!info) return;
    const fig = document.createElement('figure');
    fig.className = 'mini-pola';
    const img = new Image();
    img.src = photoSrc(f, 480);
    img.alt = story.name;
    img.decoding = 'async';
    img.style.aspectRatio = `${info.w} / ${info.h}`;
    fig.append(img);
    stack.append(fig);
  });
  document.querySelectorAll(isTouch ? '.only-desktop' : '.only-touch').forEach((n) => n.remove());

  /* Ending card */
  const c = story.closing;
  $('#ending-title').textContent = c.title;
  $('#ending-msg').textContent = c.message;
  $('#ending-sign').textContent = c.signoff;
  $('#wish-btn').textContent = c.button;
  $('#replay-btn').textContent = c.replay;

  return {
    setProgress(p) {
      const pct = Math.round(p * 100);
      loaderBar.style.transform = `scaleX(${p})`;
      loaderPct.textContent = `${pct}%`;
    },
    showTitle(onStart) {
      loader.classList.add('is-leaving');
      setTimeout(() => { loader.hidden = true; }, 600);
      title.hidden = false;
      requestAnimationFrame(() => title.classList.add('is-in'));
      startBtn.disabled = false;
      startBtn.addEventListener('click', () => {
        title.classList.add('is-leaving');
        setTimeout(() => { title.hidden = true; title.classList.remove('is-leaving', 'is-in'); }, 700);
        onStart();
      }, { once: true });
      startBtn.focus({ preventScroll: true });
    },
    showEnding({ onWish, onReplay }) {
      ending.hidden = false;
      ending.classList.remove('is-wished');
      $('#wish-done').textContent = '';
      const wishBtn = $('#wish-btn');
      wishBtn.disabled = false;
      requestAnimationFrame(() => ending.classList.add('is-in'));
      wishBtn.onclick = () => {
        wishBtn.disabled = true;
        ending.classList.add('is-wished');
        $('#wish-done').textContent = c.afterWish;
        onWish();
        setTimeout(() => $('#replay-btn').focus({ preventScroll: true }), 300);
      };
      $('#replay-btn').onclick = () => {
        ending.classList.remove('is-in');
        setTimeout(() => { ending.hidden = true; }, 500);
        onReplay();
      };
      setTimeout(() => wishBtn.focus({ preventScroll: true }), 600);
    },
  };
}
