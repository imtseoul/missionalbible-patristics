// Current reading and discovery pages share one unobtrusive return-to-top button.
import knownWorks from './reader-metadata-index.mjs?v=52805ad10444';
const archivedWork=location.pathname.match(/^\/releases\/[a-z0-9.-]+\/([a-z0-9-]+)\/(?:index|book-\d+)\.html$/)?.[1];
if(archivedWork&&Object.hasOwn(knownWorks,archivedWork)&&!document.querySelector('.edition-history-link')) {
  const link=document.createElement('a');link.className='edition-history-link';link.href='/works/'+archivedWork+'/information.html#history';link.textContent='이 문헌의 판본·교정 이력';
  document.querySelector('.reader-footer')?.prepend(link);
}
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
