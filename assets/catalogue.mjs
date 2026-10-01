// Native anchors still reach every author when JavaScript is unavailable.
const catalogue = document.getElementById('author-catalogue');
const sections = [...document.querySelectorAll('[data-author]')];
const links = [...document.querySelectorAll('[data-author-filter]')];
const counter = document.getElementById('catalogue-count');
const authorNavigation = document.getElementById('author-navigation');
const authorToggle = document.querySelector('.author-browse-toggle');
const compactViewport = window.matchMedia('(max-width: 720px)');
let authorsExpanded = false;

function updateAuthorMenu() {
  if (!authorToggle || !authorNavigation) return;
  authorToggle.hidden = !compactViewport.matches;
  authorNavigation.hidden = compactViewport.matches && !authorsExpanded;
  authorToggle.setAttribute('aria-expanded', String(authorsExpanded));
  const selected = links.find(link => link.hasAttribute('aria-current'));
  authorToggle.querySelector('[data-current-author]').textContent = selected?.querySelector('span').textContent || '전체 문헌';
}

function showAuthor() {
  const hash = location.hash.slice(1);
  const selected = sections.some(section => section.dataset.author === hash) ? hash : 'all';
  let count = 0;
  for (const section of sections) {
    section.hidden = selected !== 'all' && section.dataset.author !== selected;
    if (!section.hidden) count += section.querySelectorAll('[data-work-id]').length;
  }
  for (const link of links) {
    if (link.dataset.authorFilter === selected) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  catalogue.classList.toggle('is-filtered', selected !== 'all');
  counter.textContent = `${count}편`;
  updateAuthorMenu();
}

if (catalogue && counter) {
  showAuthor();
  for (const link of links) link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const next = link.getAttribute('href');
    if (location.hash !== next) history.pushState(null, '', next);
    authorsExpanded = false;
    showAuthor();
    const target = window.matchMedia('(max-width: 720px)').matches
      ? document.querySelector('.library-layout') : document.getElementById('library');
    target.scrollIntoView({block: 'start'});
  });
  window.addEventListener('hashchange', showAuthor);
  window.addEventListener('popstate', showAuthor);
  authorToggle?.addEventListener('click', () => {
    authorsExpanded = !authorsExpanded;
    updateAuthorMenu();
  });
  compactViewport.addEventListener('change', () => {
    authorsExpanded = false;
    updateAuthorMenu();
  });
}
