export function installReaderToolbar(tools) {
  if (!tools || tools.querySelector('.reader-controls')) return;
  const media = matchMedia('(max-width: 720px)');
  const disclosure = document.createElement('details');
  disclosure.className = 'reader-controls';
  const toggle = document.createElement('summary');
  toggle.className = 'reader-controls-toggle';
  const title = document.createElement('span');
  title.className = 'reader-controls-title';
  title.textContent = document.querySelector('.work-heading h1')?.textContent || '본문 읽기';
  // The collapsed bar keeps the current chapter in view; reader-features updates it while reading.
  const place = document.createElement('span');
  place.className = 'reader-controls-location';
  place.textContent = tools.querySelector('.reader-current-location')?.textContent || '';
  const action = document.createElement('span');
  action.className = 'reader-controls-action';
  action.textContent = '읽기 도구';
  toggle.append(title, place, action);
  const panel = document.createElement('div');
  panel.className = 'reader-tools-panel';
  panel.append(...tools.childNodes);
  disclosure.append(toggle, panel);
  tools.append(disclosure);
  tools.classList.add('reader-tools-compact');
  document.body.classList.add('has-compact-reader');

  const measure = () => {
    const root = document.documentElement;
    const header = document.querySelector('.site-header');
    const context = document.querySelector('.reader-topic-context');
    root.style.setProperty('--site-header-height', (media.matches ? 0 : header?.getBoundingClientRect().height || 0) + 'px');
    root.style.setProperty('--topic-context-height', (media.matches ? 0 : context?.getBoundingClientRect().height || 0) + 'px');
    root.style.setProperty('--reader-tools-height', tools.getBoundingClientRect().height + 'px');
    tools.style.setProperty('--reader-panel-top', Math.max(0, toggle.getBoundingClientRect().bottom) + 'px');
  };
  const close = () => { if (media.matches) disclosure.open = false; };
  const adapt = () => {
    if (media.matches) {
      if (!disclosure.isConnected) { panel.append(...tools.childNodes); tools.append(disclosure); }
      disclosure.open = panel.contains(document.activeElement);
    } else if (disclosure.isConnected) {
      disclosure.replaceWith(...panel.childNodes);
    }
    measure();
  };
  disclosure.addEventListener('toggle', measure);
  tools.addEventListener('keydown', event => {
    if (event.key === 'Escape' && media.matches && disclosure.open) {
      close(); toggle.focus(); event.stopPropagation();
    }
  });
  tools.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (link && link.hash && link.origin === location.origin && link.pathname === location.pathname) close();
  });
  document.addEventListener('pointerdown', event => {
    if (!tools.contains(event.target)) close();
  }, {passive: true});
  media.addEventListener('change', adapt);
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', () => { if (media.matches && disclosure.open) measure(); }, {passive: true});
  new ResizeObserver(measure).observe(tools);
  adapt();
}
