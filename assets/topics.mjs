import {markedText} from './text-matches.mjs';

// Every topic and passage link is present in HTML; JavaScript narrows the index.
const input = document.querySelector('#topic-query');
const form = document.querySelector('.topic-search');
const clear = document.querySelector('#topic-clear');
const empty = document.querySelector('.topic-empty');
const mobile = document.querySelector('.topic-mobile-categories');
const links = [...document.querySelectorAll('[data-topic-group]')];
const sections = [...document.querySelectorAll('.topic-section')];
const normalize = text => text.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g, ' ').trim();
const entries = [...document.querySelectorAll('.topic-entry')].map(element => ({
  element, group: element.dataset.group, words: normalize(element.textContent),
  disclosure: element.querySelector('details'),
  visibleWords: normalize(element.querySelector('summary').textContent),
  targets: [...element.querySelectorAll('h3, .topic-description, .topic-size, .topic-attribution, .source-work p, .source-author, .source-relation, .source-locations a')].map(node => ({node, text: node.textContent})),
  markedQuery: '', autoOpened: false,
}));
const names = new Map([['all', '전체 주제'], ...sections.map(s => [s.dataset.section, s.querySelector('h2').textContent])]);
let group = 'all';

function render() {
  const terms = normalize(input.value).split(' ').filter(Boolean);
  let count = 0;
  for (const entry of entries) {
    const matches = (group === 'all' || entry.group === group) && terms.every(term => entry.words.includes(term));
    entry.element.hidden = !matches;
    if (matches) count++;
    const query = matches ? input.value : '';
    if (entry.markedQuery !== query) {
      for (const {node, text} of entry.targets) node.replaceChildren(markedText(document, text, query, {normalization: 'NFKC', caseSensitive: false}));
      entry.markedQuery = query;
    }
    const revealMatch = matches && terms.length > 0 && !terms.every(term => entry.visibleWords.includes(term));
    if (revealMatch && !entry.disclosure.open) {
      entry.autoOpened = true; entry.disclosure.open = true;
    } else if (!revealMatch && entry.autoOpened) {
      entry.autoOpened = false; entry.disclosure.open = false;
    }
  }
  for (const section of sections) section.hidden = !section.querySelector('.topic-entry:not([hidden])');
  for (const link of links) {
    if (link.dataset.topicGroup === group) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  document.querySelector('[data-current-category]').textContent = names.get(group);
  document.querySelector('[data-result-category]').textContent = names.get(group);
  document.querySelector('[data-result-count]').textContent = `${count}개 주제${terms.length ? ' 검색됨' : ''}`;
  empty.hidden = count > 0;
  clear.hidden = !input.value;
}

function followHash(scroll = false) {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const entry = entries.find(item => item.element.id === id);
  const section = sections.find(item => item.querySelector('h2').id === id);
  if (entry || section || id === 'topics-all' || !id) {
    group = entry?.group || section?.dataset.section || 'all';
    input.value = '';
    if (entry) entry.disclosure.open = true;
    render();
    if (scroll && entry) entry.element.scrollIntoView({block: 'start'});
  }
}

form.hidden = false;
form.addEventListener('submit', event => event.preventDefault());
input.addEventListener('input', event => { if (!event.isComposing) render(); });
input.addEventListener('compositionend', render);
input.addEventListener('keydown', event => {
  if (event.key === 'Escape') { input.value = ''; render(); }
});
clear.addEventListener('click', () => { input.value = ''; render(); input.focus(); });
document.querySelector('#topic-reset').addEventListener('click', () => {
  group = 'all'; input.value = ''; history.pushState(null, '', '#topics-all'); render(); input.focus();
});
for (const link of links) link.addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault();
  group = link.dataset.topicGroup;
  history.pushState(null, '', link.getAttribute('href'));
  mobile.open = false;
  render();
  // The result heading stays visible when switching categories from a scrolled page.
  document.querySelector('.topics-main').scrollIntoView({block: 'start'});
});
for (const entry of entries) entry.disclosure.addEventListener('toggle', () => {
  if (entry.disclosure.open && !entry.element.hidden && !input.value.trim()) history.replaceState(null, '', '#'+entry.element.id);
});
window.addEventListener('hashchange', () => followHash(true));
window.addEventListener('popstate', () => followHash(true));
followHash(true);
render();
