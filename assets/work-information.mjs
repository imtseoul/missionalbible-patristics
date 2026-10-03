export function readerReturn(work, value, base) {
  if (!/^[a-z0-9-]+$/.test(work) || !value) return null;
  let url, current;
  try { current = new URL(base); url = new URL(value, current); } catch { return null; }
  const prefix = '/works/' + work + '/';
  if (url.origin !== current.origin || url.username || url.password || !url.pathname.startsWith(prefix)) return null;
  if (!/^(?:index|book-\d+)\.html$/.test(url.pathname.slice(prefix.length))) return null;
  return url;
}

export function workInformationURL(work, from, base) {
  if (!/^[a-z0-9-]+$/.test(work)) throw new Error('문헌 식별자를 확인해 주세요.');
  const url = new URL('/works/' + work + '/information.html', base);
  const reader = readerReturn(work, from, base);
  if (reader) url.searchParams.set('from', reader.pathname + reader.search + reader.hash);
  return url;
}

if (typeof document !== 'undefined') {
  const page = document.querySelector('.work-information-page');
  if (page) {
    const back = readerReturn(page.dataset.workId, new URL(location.href).searchParams.get('from'), location.href);
    if (back) {
      const link = page.querySelector('[data-information-reader]');
      link.href = back.href;
      link.textContent = back.hash ? '읽던 대목으로 돌아가기' : '본문으로 돌아가기';
    }
  }
}
