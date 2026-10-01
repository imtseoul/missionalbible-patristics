// Current reading and discovery pages share one unobtrusive return-to-top button.
const header = document.querySelector('.site-header');
if (header) {
  new ResizeObserver(()=>document.documentElement.style.setProperty('--site-header-height',header.getBoundingClientRect().height+'px')).observe(header);
  header.id = 'page-top';
  header.tabIndex = -1;
  const top = document.createElement('button');
  top.className = 'back-to-top'; top.type = 'button'; top.hidden = true;
  top.setAttribute('aria-label', '맨 위로');
  const ns = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(ns, 'svg');
  icon.setAttribute('viewBox', '0 0 20 20'); icon.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path'); path.setAttribute('d', 'M10 16V4m-5 5 5-5 5 5');
  icon.append(path); top.append(icon, document.createTextNode('맨 위로')); document.body.append(top);
  const update = () => { top.hidden = window.scrollY < Math.max(360, window.innerHeight * 0.75); };
  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => { update(); scheduled = false; });
    }
  }, {passive: true});
  window.addEventListener('resize', update);
  window.addEventListener('pageshow', update);
  top.addEventListener('click', () => {
    header.focus({preventScroll: true});
    window.scrollTo({top: 0, left: 0, behavior: 'auto'});
    top.hidden = true;
  });
  update();
}
