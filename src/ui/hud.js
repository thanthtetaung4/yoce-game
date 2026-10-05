// Minimal heads-up display: memories found, trials done, current month, the active trial,
// mute toggle, nearby prompt and toasts.
export function createHud({ total, trialsTotal, onMute, muted }) {
  const $ = (s) => document.querySelector(s);
  const hud = $('#hud');
  const count = $('#hud-count');
  const month = $('#hud-month');
  const bar = $('#hud-bar span');
  const muteBtn = $('#mute-btn');
  const prompt = $('#prompt');
  const toast = $('#toast');
  const trials = $('#hud-trials');
  const task = $('#hud-task');
  let toastTimer = 0, lastMonth = '', lastFound = -1;

  const setMuteIcon = (m) => {
    muteBtn.setAttribute('aria-pressed', String(m));
    muteBtn.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
    muteBtn.dataset.muted = m ? '1' : '0';
  };
  setMuteIcon(muted);
  muteBtn.addEventListener('click', () => setMuteIcon(onMute()));

  return {
    show(v) { hud.hidden = !v; if (!v) this.prompt(null); },
    setFound(found) {
      if (found === lastFound) return;
      count.textContent = `${found} of ${total} memories found`;
      if (lastFound >= 0 && found > lastFound) { count.parentElement.classList.remove('is-bump'); void count.offsetWidth; count.parentElement.classList.add('is-bump'); }
      lastFound = found;
    },
    setMonth(label) {
      if (label === lastMonth) return;
      lastMonth = label;
      month.classList.remove('is-in'); void month.offsetWidth;
      month.textContent = label;
      month.classList.add('is-in');
    },
    setTrials(done) { trials.textContent = `${done} of ${trialsTotal} trials`; },
    // The active trial's progress, e.g. "3 / 7 lanterns lit" (null hides it)
    setTask(text, done = false) {
      task.hidden = !text;
      if (text) task.textContent = text;
      task.classList.toggle('is-done', done);
    },
    setProgress(u) { bar.style.transform = `scaleX(${Math.max(0, Math.min(1, u))})`; },
    // the prompt pill is a button: tapping it opens whatever is nearby
    onPromptTap(cb) {
      prompt.addEventListener('click', (e) => { if (prompt.classList.contains('is-visible')) { e.preventDefault(); cb(); } });
    },
    prompt(text) {
      if (text) prompt.textContent = text;
      prompt.classList.toggle('is-visible', !!text);
    },
    toast(text, ms = 2600) {
      toast.textContent = text;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('is-visible'), ms);
    },
  };
}
