// Native anchors still reach every author when JavaScript is unavailable.
import {installRecentReading} from './reading-progress.mjs?v=56a23c1dd8f1';
import {catalogueMatch} from './catalogue-search.mjs?v=71d83a0edc6e';
const catalogue = document.getElementById('author-catalogue');
const sections = [...document.querySelectorAll('[data-author]')];
const links = [...document.querySelectorAll('[data-author-filter]')];
const counter = document.getElementById('catalogue-count');
const authorNavigation = document.getElementById('author-navigation');
const authorToggle = document.querySelector('.author-browse-toggle');
const compactViewport = window.matchMedia('(max-width: 720px)');
let authorsExpanded = false;
const filterForm=document.querySelector('.catalogue-filter');
const filterQuery=document.querySelector('#catalogue-query');
const filterLanguage=document.querySelector('#catalogue-language');
const filterStatus=document.querySelector('[data-catalogue-status]');
const empty=document.querySelector('.catalogue-empty');
const resetButtons=[...document.querySelectorAll('[data-catalogue-reset]')];
const works=[...document.querySelectorAll('[data-work-id]')];
function restoreFilters(){
  if(!filterForm)return;
  const params=new URL(location.href).searchParams;
  filterQuery.value=(params.get('find')||'').slice(0,200);
  filterLanguage.value=['grc','lat','mixed'].includes(params.get('lang'))?params.get('lang'):'';
}
function persistFilters(){
  const url=new URL(location.href);
  for(const [key,value] of [['find',filterQuery.value.trim()],['lang',filterLanguage.value]]) {
    if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
  }
  history.replaceState(history.state,'',url);
}


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
  for(const link of document.querySelectorAll('.browse-switch a')) {
    const selected=link.hash==='#library';
    if(selected)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
  }
  const selected = sections.some(section => section.dataset.author === hash) ? hash : 'all';
  let count = 0;
  for (const section of sections) {
    for(const work of section.querySelectorAll('[data-work-id]'))work.hidden=!catalogueMatch(work.dataset.catalogueWords,work.dataset.languages.split(' ').filter(Boolean),filterQuery?.value||'',filterLanguage?.value||'');
    section.hidden = selected !== 'all' && section.dataset.author !== selected || !section.querySelector('[data-work-id]:not([hidden])');
    if (!section.hidden) count += section.querySelectorAll('[data-work-id]:not([hidden])').length;
  }
  for (const link of links) {
    if (link.dataset.authorFilter === selected) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  catalogue.classList.toggle('is-filtered', selected !== 'all'||!!filterQuery?.value.trim()||!!filterLanguage?.value);
  counter.textContent = `${count}편`;
  if(filterStatus){
    const filtered=selected!=='all'||!!filterQuery.value.trim()||!!filterLanguage.value;
    filterStatus.hidden=!filtered;filterStatus.textContent=`전체 ${works.length}편 중 ${count}편`;
    resetButtons[0].hidden=!filtered;empty.hidden=count>0;
  }
  updateAuthorMenu();
}

if (catalogue && counter) {
  installRecentReading();
  restoreFilters();showAuthor();
  if(filterForm){
    filterForm.hidden=false;
    const filter=()=>{persistFilters();showAuthor();};
    filterForm.addEventListener('submit',event=>{event.preventDefault();filter();});
    filterQuery.addEventListener('input',event=>{if(!event.isComposing)filter();});filterQuery.addEventListener('compositionend',filter);
    filterLanguage.addEventListener('change',filter);
    filterQuery.addEventListener('keydown',event=>{if(event.key==='Escape'){filterQuery.value='';filter();}});
    for(const button of resetButtons)button.addEventListener('click',()=>{filterQuery.value='';filterLanguage.value='';const url=new URL(location.href);url.hash='library';history.pushState(null,'',url);filter();filterQuery.focus();});
  }
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
  window.addEventListener('hashchange',()=>{restoreFilters();showAuthor();});
  window.addEventListener('popstate',()=>{restoreFilters();showAuthor();});
  authorToggle?.addEventListener('click', () => {
    authorsExpanded = !authorsExpanded;
    updateAuthorMenu();
  });
  compactViewport.addEventListener('change', () => {
    authorsExpanded = false;
    updateAuthorMenu();
  });
}
