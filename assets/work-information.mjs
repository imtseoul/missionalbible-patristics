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
    const status=page.querySelector('[data-download-status]');
    for(const button of page.querySelectorAll('[data-download-text]')) {
      button.hidden=false;
      button.addEventListener('click',async()=>{
        button.disabled=true;status.textContent='TXT 파일을 준비하고 있습니다.';
        try {
          const url=new URL(button.dataset.downloadText,location.href);
          if(url.origin!==location.origin||!url.pathname.startsWith('/works/'+page.dataset.workId+'/'))throw new Error('파일 주소를 확인해 주세요.');
          const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error('파일을 불러오지 못했습니다. 아래 압축 파일 링크를 이용하거나 다시 시도하세요.');
          const bytes=await unpackBytes(await response.arrayBuffer(),button.dataset.textSha);
          const objectURL=URL.createObjectURL(new Blob([bytes],{type:'text/plain;charset=utf-8'}));
          const link=document.createElement('a');link.href=objectURL;link.download=button.dataset.downloadName;link.hidden=true;document.body.append(link);link.click();link.remove();
          setTimeout(()=>URL.revokeObjectURL(objectURL),60000);
          status.textContent='TXT 파일을 준비했습니다. 브라우저의 다운로드 목록을 확인하세요.';
        }catch(error){status.textContent=dataErrorMessage(error,'파일을 준비하지 못했습니다. 연결을 확인한 뒤 다시 시도하거나 압축 파일 링크를 이용하세요.');}
        finally{button.disabled=false;}
      });
    }
    for(const list of page.querySelectorAll('[data-history-changes]')) {
      const entries=[...list.children];if(entries.length<=25)continue;let shown=25;
      const more=document.createElement('button');more.type='button';more.className='history-more';list.after(more);
      const update=()=>{entries.forEach((entry,index)=>entry.hidden=index>=shown);more.hidden=shown>=entries.length;more.textContent='다음 '+Math.min(25,entries.length-shown)+'개 대목 보기';};
      more.addEventListener('click',()=>{const first=entries[shown];shown+=25;update();first.tabIndex=-1;first.focus({preventScroll:true});first.scrollIntoView({block:'start'});});update();
    }
    const corrections=page.querySelector('[data-correction-work]');
    if(corrections) {
      const content=corrections.querySelector('[data-correction-content]');let ready=false,loading=false;
      const load=async()=>{
        if(!corrections.open||ready||loading)return;loading=true;
        content.replaceChildren();const message=document.createElement('p');message.setAttribute('role','status');message.textContent='교정 기록을 불러오는 중입니다.';content.append(message);
        try {
          const url=new URL('../../data/corrections.json',location.href);url.searchParams.set('v',corrections.dataset.correctionSha||'');
          const response=await fetch(url,{cache:'no-cache'});if(!response.ok)throw new Error('교정 기록을 읽지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.');
          const raw=await unpackBytes(await response.arrayBuffer(),corrections.dataset.correctionSha||'');
          const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
          const records=data.filter(row=>row.work_id===page.dataset.workId).flatMap(row=>row.corrections.map(correction=>({location:row.location,...correction})));
          const list=document.createElement('ol');list.className='correction-records';let shown=0;
          const more=document.createElement('button');more.type='button';more.className='history-more';
          const reveal=()=>{
            const end=Math.min(records.length,shown+25);
            for(const row of records.slice(shown,end)) {
              const item=document.createElement('li'),label=document.createElement('h3');label.textContent=row.work_location||row.location;item.append(label);
              const reason=document.createElement('p');reason.textContent=row.reason||'원자료에 기록된 교정입니다.';item.append(reason);
              for(const [key,title] of [['before','이전 표기'],['after','교정 표기']])if(typeof row[key]==='string') {
                const detail=document.createElement('p');detail.className='correction-text';detail.textContent=title+': '+row[key];item.append(detail);
              }
              if(row.evidence_url){let url;try{url=new URL(row.evidence_url);}catch{}if(url&&['http:','https:'].includes(url.protocol)){const source=document.createElement('a');source.href=url.href;source.target='_blank';source.rel='noopener';source.textContent='원문 근거';item.append(source);}}
              list.append(item);
            }
            shown=end;more.hidden=shown>=records.length;more.textContent='다음 '+Math.min(25,records.length-shown)+'개 교정 보기';message.textContent=records.length+'개 교정 중 '+shown+'개를 표시합니다.';
          };
          more.addEventListener('click',reveal);content.append(list,more);reveal();ready=true;
        }catch(error){message.textContent=dataErrorMessage(error);const retry=document.createElement('button');retry.type='button';retry.textContent='다시 불러오기';retry.addEventListener('click',load);content.append(retry);}
        finally{loading=false;}
      };
      corrections.addEventListener('toggle',load);
    }
  }
}
import {unpackBytes,dataErrorMessage} from './packed-data.mjs?v=1a75398990a6';
