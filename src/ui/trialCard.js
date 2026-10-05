// The card shown at a rune stone (intro) and when a trial is finished (outro).
export function createTrialCard() {
  const el = document.getElementById('trial');
  const kicker = el.querySelector('.trial__kicker');
  const title = el.querySelector('.memory__title');
  const text = el.querySelector('.trial__text');
  const how = el.querySelector('.trial__how');
  const go = el.querySelector('.trial__go');
  const later = el.querySelector('.trial__later');
  let resolve = null, lastFocus = null;

  function close(result) {
    if (!resolve) return;
    const r = resolve;
    resolve = null;
    el.classList.remove('is-open');
    setTimeout(() => { if (!resolve) el.hidden = true; }, 380);
    lastFocus?.focus?.({ preventScroll: true });
    r(result);
  }
  go.addEventListener('click', () => close('go'));
  later.addEventListener('click', () => close('later'));
  el.addEventListener('click', (e) => { if (e.target === el) close('later'); });
  window.addEventListener('keydown', (e) => { if (resolve && e.key === 'Escape') close('later'); });

  return {
    get open() { return !!resolve; },
    // Resolves with 'go' or 'later'
    show({ kicker: k, title: t, text: x, how: h = '', button, outro = false }) {
      lastFocus = document.activeElement;
      kicker.textContent = k;
      title.textContent = t;
      text.textContent = x;
      how.textContent = h;
      go.textContent = button;
      el.classList.toggle('is-outro', outro);
      el.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-open')));
      go.focus({ preventScroll: true });
      return new Promise((r) => { resolve = r; });
    },
  };
}
