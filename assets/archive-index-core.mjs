import {foldSearch} from './archive-search-core.mjs?v=c183809f9954';

export function matchesIndex(value,query) {
  const text=foldSearch(value);return foldSearch(query).split(' ').filter(Boolean).every(term=>text.includes(term));
}

export function correctionRecords(data,index) {
  if(!Array.isArray(data))throw new Error('교정 자료의 형식을 확인해 주세요.');
  return data.flatMap(group=>{
    const work=index.works[group.work_id];
    if(!work||!Array.isArray(group.corrections))throw new Error('교정 기록의 문헌 정보가 맞지 않습니다.');
    const position=index.locations[group.work_id+':'+group.location];
    return group.corrections.map((correction,number)=>({
      ...correction,work_id:group.work_id,work,location:group.location,label:position?.label||group.location,path:position?.path||null,
      key:group.work_id+':'+group.location+':'+number,
      search:foldSearch([work.author,work.title,position?.label,group.location,correction.patch_id,correction.before,correction.after,correction.reason].filter(value=>typeof value==='string').join(' '))
    }));
  });
}

export function correctionState(value) {
  const url=new URL(value),page=Number(url.searchParams.get('page'));
  return {query:Array.from(url.searchParams.get('q')||'').slice(0,200).join(''),work:url.searchParams.get('work')||'',page:Number.isSafeInteger(page)&&page>0&&page<100000?page:1};
}

export function correctionURL(base,state) {
  const url=new URL('/corrections.html',base);
  for(const [key,value] of Object.entries({q:state.query.trim(),work:state.work,page:state.page>1?String(state.page):''}))if(value)url.searchParams.set(key,value);
  return url;
}

export function filterCorrections(rows,state) {
  return rows.filter(row=>(!state.work||row.work_id===state.work)&&matchesIndex(row.search,state.query));
}
