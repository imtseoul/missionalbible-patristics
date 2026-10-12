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

  // 원어 표시는 기본으로 켜 두고, 끈 상태만 저장한다. 원어 검색에서 들어오면 저장값과 관계없이 보인다.
  const originalKey = 'patristics-ko-reader-original-v1';
  let showOriginal = true;
  try { showOriginal = localStorage.getItem(originalKey) !== 'hidden'; } catch { /* Storage may be blocked. */ }
  try {
    const search = new URL(location.href).searchParams.get('search');
    const mode = search ? new URL(search, location.href).searchParams.get('mode') : '';
    if (mode === 'grc' || mode === 'lat') showOriginal = true;
  } catch { /* Keep the stored preference. */ }
  function applyOriginal() {
    document.documentElement.classList?.toggle('hide-original', !showOriginal);
  }
  applyOriginal();

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

    if (document.querySelector('.passage .original') && !controls.querySelector('.original-toggle')) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'original-toggle';
      toggle.textContent = '원어';
      const sync = () => {
        toggle.setAttribute('aria-pressed', String(showOriginal));
        toggle.setAttribute('aria-label', showOriginal ? '원어 숨기기' : '원어 보이기');
      };
      toggle.addEventListener('click', () => {
        const top = Math.max(0, toolbar.getBoundingClientRect().bottom);
        const visible = [...document.querySelectorAll('.passage')].filter(element => {
          const rect = element.getBoundingClientRect();
          return rect.bottom > top && rect.top < window.innerHeight;
        });
        const anchor = visible.find(element => element.getBoundingClientRect().top >= top) || visible[0];
        const before = anchor?.getBoundingClientRect().top;
        showOriginal = !showOriginal;
        applyOriginal();
        sync();
        if (anchor) window.scrollBy(0, anchor.getBoundingClientRect().top - before);
        try {
          if (showOriginal) localStorage.removeItem(originalKey);
          else localStorage.setItem(originalKey, 'hidden');
        } catch { /* Keep the choice for this page only. */ }
      });
      sync();
      controls.prepend(toggle);
    }
    smaller.addEventListener('click', () => change(Math.max(sizes[0], size - 10)));
    larger.addEventListener('click', () => change(Math.min(sizes[sizes.length - 1], size + 10)));
    reset.addEventListener('click', () => change(100));
    window.addEventListener('storage', event => {
      if (event.key === key || event.key === null) change(event.newValue, false);
      if (event.key === originalKey || event.key === null) {
        showOriginal = event.newValue !== 'hidden';
        applyOriginal();
        const toggle = controls.querySelector('.original-toggle');
        if (toggle) toggle.setAttribute('aria-pressed', String(showOriginal));
      }
    });
    display();
    controls.hidden = false;
    // 원어 표시와 글자 크기를 '보기' 메뉴 하나로 접는다. 도구 줄에는 현재 장, 인용, 출처, 보기만 남는다.
    const view = document.createElement('details');
    view.className = 'view-settings';
    const viewToggle = document.createElement('summary');
    viewToggle.textContent = '보기';
    viewToggle.setAttribute('aria-label', '보기 설정: 원어 표시와 글자 크기');
    const viewPanel = document.createElement('div');
    viewPanel.className = 'view-settings-panel';
    controls.replaceWith(view);
    viewPanel.append(controls);
    view.append(viewToggle, viewPanel);
    document.addEventListener('pointerdown', event => { if (view.open && !view.contains(event.target)) view.open = false; }, {passive: true});
    view.addEventListener('keydown', event => { if (event.key === 'Escape' && view.open) { view.open = false; viewToggle.focus(); event.stopPropagation(); } });
    toolbar.classList.add('has-font-controls');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once: true});
  else setup();
})();
