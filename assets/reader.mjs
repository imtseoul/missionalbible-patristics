const chapterMenu = document.querySelector('.chapter-menu');
chapterMenu?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => { chapterMenu.open = false; });
});

const notes = document.getElementById('translation-notes');
function revealNotes() {
  if (!notes || !location.hash) return;
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (target !== notes && !notes.contains(target)) return;
  notes.open = true;
  target.scrollIntoView({block: 'start'});
  if (target !== notes) target.focus({preventScroll: true});
}
document.querySelectorAll('[data-note-link], a[href="#translation-notes"]').forEach(link => {
  link.addEventListener('click', () => { if (notes) notes.open = true; });
});
function markChapter() {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const chapter = document.getElementById(id)?.closest('[data-chapter]')?.dataset.chapter;
  document.querySelectorAll('[data-chapter-link]').forEach(link => {
    if (chapter && link.dataset.chapterLink === chapter) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
window.addEventListener('hashchange', () => { revealNotes(); markChapter(); });
revealNotes();
markChapter();
