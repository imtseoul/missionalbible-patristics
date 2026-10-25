import {foldSearch,pageSlice} from './archive-search-core.mjs?v=81ebd941d0ad';

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

export async function correctionPage(index,state,loadWork) {
  const sequence=index.sequence.filter(group=>!state.work||group.work_id===state.work);
  if(foldSearch(state.query).trim()) {
    const works=[...new Set(sequence.map(group=>group.work_id))];
    const loaded=new Map(await Promise.all(works.map(async wid=>[wid,await loadWork(wid)])));
    const rows=sequence.flatMap(group=>loaded.get(group.work_id).slice(group.start,group.start+group.count));
    return pageSlice(filterCorrections(rows,state),state.page);
  }
  const references=sequence.flatMap(group=>Array.from({length:group.count},(_,offset)=>({work:group.work_id,index:group.start+offset})));
  const slice=pageSlice(references,state.page);
  const needed=[...new Set(slice.rows.map(row=>row.work))];
  const loaded=new Map(await Promise.all(needed.map(async wid=>[wid,await loadWork(wid)])));
  return {...slice,rows:slice.rows.map(row=>loaded.get(row.work)[row.index])};
}
