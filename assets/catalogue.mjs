// Native anchors still reach every author when JavaScript is unavailable.
const catalogue = document.getElementById('author-catalogue');
const sections = [...document.querySelectorAll('[data-author]')];
const links = [...document.querySelectorAll('[data-author-filter]')];
const counter = document.getElementById('catalogue-count');

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
}

if (catalogue && counter) {
  showAuthor();
  for (const link of links) link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const next = link.getAttribute('href');
    if (location.hash !== next) history.pushState(null, '', next);
    showAuthor();
    const target = window.matchMedia('(max-width: 720px)').matches
      ? document.querySelector('.library-layout') : document.getElementById('library');
    target.scrollIntoView({block: 'start'});
  });
  window.addEventListener('hashchange', showAuthor);
  window.addEventListener('popstate', showAuthor);
}
