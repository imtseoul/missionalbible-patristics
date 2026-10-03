// Current search UI; app.mjs stays unchanged for frozen edition reproduction.
import {markedText, matchExcerpts} from './text-matches.mjs?v=921656645ade';
import {passageDestination} from './passage-jump.mjs?v=e9831b8b0ca5';
import {workInformationURL} from './work-information.mjs?v=544c00bd4fdd';

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
    const informationLink=(work,path)=>{
      const link=document.createElement('a');link.className='search-information-link';link.textContent='문헌 자료 정보';
      link.href=workInformationURL(work,path,location.href).href;return link;
    };
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const version = ++submission;
      const query = form.elements.query.value;
      const work = form.elements.work.value;
      results.replaceChildren();
      if (!query.trim()) { status.textContent = '검색어를 입력하세요.'; return; }
      status.textContent = '본문을 찾고 있습니다.';
      try {
        if(/\d/.test(query)) {
          const jump=passageDestination((await import('./reading-locations.mjs?v=51ba43a4af0c')).default.works,query,work);
          if(version!==submission)return;
          if(jump) {
            if(jump.ambiguous){status.textContent='여러 문헌에 해당합니다. 문헌을 선택하거나 저자 이름을 함께 입력하세요.';return;}
            if(jump.missing){status.textContent='이 문헌에서 해당 장절을 찾지 못했습니다. 장절을 확인해 주세요.';return;}
            const item=document.createElement('li'),heading=document.createElement('h3'),link=document.createElement('a');
            link.href=jump.path;link.textContent=jump.title+' '+jump.label+' 바로 읽기';heading.append(link);item.append(heading,informationLink(jump.work,jump.path));results.append(item);
            status.textContent='수록된 대목으로 바로 이동할 수 있습니다.';return;
          }
        }
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
          item.append(heading, body, informationLink(row.work_id,row.path)); fragment.append(item);
        }
        results.append(fragment);
      } catch {
        source = null;
        if (version === submission) status.textContent = '검색 자료를 읽지 못했습니다. 아래 문헌 목록에서 본문을 열어 주세요.';
      }
    });
  }
}
