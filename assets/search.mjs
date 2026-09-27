// Current search UI; app.mjs stays unchanged for frozen edition reproduction.
export function findPassages(rows, query, work = '') {
  const terms = query.normalize('NFC').trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return rows.filter(row => (!work || row.work_id === work) && terms.every(term => row.text.normalize('NFC').includes(term)));
}

if (typeof document !== 'undefined') {
  const form = document.getElementById('search-form');
  if (form) {
    let rows;
    const results = document.getElementById('search-results');
    const status = document.getElementById('search-status');
    form.addEventListener('submit', async event => {
      event.preventDefault(); results.replaceChildren(); status.textContent = '본문을 찾고 있습니다.';
      try {
        if (!rows) { const response = await fetch('search-index.json', {cache: 'no-cache'}); if (!response.ok) throw new Error(); rows = await response.json(); }
        const query = form.elements.query.value;
        if (!query.trim()) { status.textContent = '검색어를 입력하세요.'; return; }
        const found = findPassages(rows, query, form.elements.work.value);
        status.textContent = found.length ? `${found.length}개 구절을 찾았습니다. 한국어 본문 단어 검색 결과입니다.` : '수록된 한국어 본문에서 검색어를 찾지 못했습니다.';
        for (const row of found) {
          const item = document.createElement('li');
          const heading = document.createElement('h3'); const link = document.createElement('a');
          link.href = row.path; link.textContent = `${row.author} · ${row.title} ${row.display_location || row.location}`;
          heading.append(link); const body = document.createElement('p'); body.textContent = row.text;
          item.append(heading, body); results.append(item);
        }
      } catch { status.textContent = '검색 자료를 읽지 못했습니다. 아래 문헌 목록에서 본문을 열어 주세요.'; }
    });
  }
}
