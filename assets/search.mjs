// Current search UI; app.mjs stays unchanged for frozen edition reproduction.
import {markedText, matchExcerpts} from './text-matches.mjs';

export function findPassages(rows, query, work = '') {
  const terms = query.normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return rows.filter(row => (!work || row.work_id === work) && terms.every(term => row.text.normalize('NFC').includes(term)));
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('search-form');
  if (form) {
    let source, submission = 0;
    const results = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const version = ++submission;
      const query = form.elements.query.value;
      const work = form.elements.work.value;
      results.replaceChildren();
      if (!query.trim()) { status.textContent = '검색어를 입력하세요.'; return; }
      status.textContent = '본문을 찾고 있습니다.';
      try {
        source ??= fetch('search-index.json', {cache: 'no-cache'}).then(response => {
          if (!response.ok) throw new Error();
          return response.json();
        });
        const rows = await source;
        if (version !== submission) return;
        const found = findPassages(rows, query, work);
        status.textContent = found.length ? `${found.length}개 구절을 찾았습니다. 검색어가 나온 부분을 표시합니다.` : '수록된 한국어 본문에서 검색어를 찾지 못했습니다.';
        const fragment = document.createDocumentFragment();
        for (const row of found) {
          const item = document.createElement('li');
          const heading = document.createElement('h3');
          const link = document.createElement('a');
          link.href = row.path;
          link.append(markedText(document, `${row.author} · ${row.title} ${row.display_location || row.location}`, query));
          heading.append(link);
          const body = document.createElement('p');
          const excerpts = matchExcerpts(row.text, query);
          if (excerpts[0].start > 0) body.append('… ');
          excerpts.forEach((excerpt, i) => {
            if (i) body.append(' … ');
            body.append(markedText(document, excerpt.text, query));
          });
          if (excerpts.at(-1).end < row.text.length) body.append(' …');
          item.append(heading, body); fragment.append(item);
        }
        results.append(fragment);
      } catch {
        source = null;
        if (version === submission) status.textContent = '검색 자료를 읽지 못했습니다. 아래 문헌 목록에서 본문을 열어 주세요.';
      }
    });
  }
}
