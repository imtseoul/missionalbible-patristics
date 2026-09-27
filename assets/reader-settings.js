// Restore before the body is laid out, including on long documents and deep links.
(() => {
  const key = 'patristics-ko-reader-font-size-v1';
  const sizes = [80, 90, 100, 110, 120, 130, 140];
  const normalize = value => sizes.includes(Number(value)) ? Number(value) : 100;
  let size = 100;
  try { size = normalize(localStorage.getItem(key)); } catch { /* Page controls still work. */ }

  function apply() {
    document.documentElement.style.setProperty('--reader-text-scale', String(size / 100));
  }
  apply();

  function setup() {
    const controls = document.querySelector('.font-controls');
    if (!controls) return;
    const toolbar = controls.closest('.reader-tools');
    const smaller = controls.querySelector('[data-font-action="smaller"]');
    const larger = controls.querySelector('[data-font-action="larger"]');
    const reset = controls.querySelector('[data-font-action="reset"]');
    const output = controls.querySelector('[data-font-size]');

    function display() {
      output.textContent = `${size}%`;
      smaller.disabled = size === sizes[0];
      larger.disabled = size === sizes[sizes.length - 1];
    }

    function change(next, save = true) {
      const top = Math.max(0, toolbar.getBoundingClientRect().bottom);
      const visible = [...document.querySelectorAll('.passage, .reader-notes li')]
        .map(element => ({element, rect: element.getBoundingClientRect()}))
        .filter(item => item.rect.bottom > top && item.rect.top < window.innerHeight);
      const anchor = visible.find(item => item.rect.top >= top) || visible[0];
      const before = anchor?.rect.top;
      size = normalize(next);
      apply();
      display();
      if (anchor) window.scrollBy(0, anchor.element.getBoundingClientRect().top - before);
      if (save) {
        try {
          if (size === 100) localStorage.removeItem(key);
          else localStorage.setItem(key, String(size));
        } catch { /* Storage may be blocked; keep the current reading size. */ }
      }
    }

    smaller.addEventListener('click', () => change(Math.max(sizes[0], size - 10)));
    larger.addEventListener('click', () => change(Math.min(sizes[sizes.length - 1], size + 10)));
    reset.addEventListener('click', () => change(100));
    window.addEventListener('storage', event => {
      if (event.key === key || event.key === null) change(event.newValue, false);
    });
    display();
    controls.hidden = false;
    toolbar.classList.add('has-font-controls');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once: true});
  else setup();
})();
