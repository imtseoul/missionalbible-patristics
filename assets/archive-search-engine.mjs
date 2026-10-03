import index from './archive-search-index.mjs?v=9d563b22713c';
import {parseScriptureQuery,scriptureIntersects} from './scripture-search.mjs?v=e127e538461b';
import {passageSearchText,textMatches,workReference,referenceMatches} from './archive-search-core.mjs?v=c183809f9954';
const works=new Map(index.works.map(work=>[work.id,work]));
const loaded=new Map(),attempts=new Map();
let scripture,scriptureAttempts=0;
const scriptureModule='./archive-scripture.mjs?v=54d36ccfca2b';
async function loadWork(work) {
  if(!loaded.has(work.id)) {
    const attempt=attempts.get(work.id)||0;
    loaded.set(work.id,import('./archive-readings/'+work.id+'.mjs?v='+work.version+(attempt?'&retry='+attempt:'')).then(module=>{
      const data=module.default;
      if(data.work!==work.id||data.source_sha256!==work.source_sha256||data.passages.length!==work.passages)throw new Error('문헌의 자료 판본이 맞지 않습니다. 새로고침 후 다시 검색하세요.');
      return data.passages;
    }).catch(error=>{loaded.delete(work.id);attempts.set(work.id,attempt+1);throw error;}));
  }
  return loaded.get(work.id);
}
async function loadWorks(selected,onProgress,signal) {
  const result=new Array(selected.length);let cursor=0,done=0;
  onProgress?.({loaded:0,total:selected.length});
  await Promise.all(Array.from({length:Math.min(6,selected.length)},async()=>{
    while(cursor<selected.length){signal?.throwIfAborted();const i=cursor++;result[i]={work:selected[i],rows:await loadWork(selected[i])};onProgress?.({loaded:++done,total:selected.length});}
  }));
  return result;
}
async function scriptureData() {
  if(!scripture)scripture=import(scriptureModule+(scriptureAttempts?(scriptureModule.includes('?')?'&':'?')+'retry='+scriptureAttempts:'')).then(module=>{
    const data=module.default;
    if(data.schema_version!=='patristics-archive-scripture-1'||index.works.some(work=>data.source_bindings[work.id]!==work.source_sha256))throw new Error('성경 색인과 문헌 판본이 맞지 않습니다. 새로고침 후 다시 검색하세요.');
    return data;
  }).catch(error=>{scripture=null;scriptureAttempts++;throw error;});
  return scripture;
}

export async function archiveResults(state,{onProgress,signal}={}) {
  const selected=index.works.filter(work=>!state.work||work.id===state.work);
  const biblical=state.mode==='scripture'||state.mode==='ko'&&!state.exact?parseScriptureQuery(state.query):null;
  if(state.mode==='scripture'&&!biblical)return {kind:'invalid-scripture',rows:[]};
  if(biblical) {
    const data=await scriptureData();
    const references=data.references.filter(reference=>(!state.work||reference.work===state.work)&&(!state.relation||reference.use===state.relation)&&scriptureIntersects(reference,biblical));
    const byPassage=new Map();
    for(const reference of references){if(!byPassage.has(reference.passage))byPassage.set(reference.passage,[]);byPassage.get(reference.passage).push(reference);}
    const wanted=new Set(references.map(reference=>reference.work));
    const corpus=await loadWorks(selected.filter(work=>wanted.has(work.id)),onProgress,signal);
    return {kind:'scripture',query:biblical,rows:corpus.flatMap(({work,rows})=>rows.filter(row=>byPassage.has(row.id)).map(row=>({work,row,references:byPassage.get(row.id)})))};
  }
  const reference=state.mode==='ko'&&!state.exact?workReference(index.works,state.query,state.work,state.numbering):null;
  if(reference?.invalid)return {kind:'invalid-reference',rows:[]};
  if(reference?.works.length>1)return {kind:'ambiguous-reference',rows:[],candidates:reference.works.map(id=>works.get(id))};
  const wanted=reference?selected.filter(work=>reference.works.includes(work.id)):selected;
  const corpus=await loadWorks(wanted,onProgress,signal);
  if(reference) {
    return {kind:'reference',reference,rows:corpus.flatMap(({work,rows})=>rows.flatMap(row=>{
      const matches=referenceMatches(row,reference);return matches.length?[{work,row,numberMatches:matches}]:[];
    }))};
  }
  return {kind:'text',rows:corpus.flatMap(({work,rows})=>rows.flatMap(row=>{
    const matches=text=>textMatches(text,state.query,state.exact,state.match,state.exclude);
    if(state.mode==='notes') {
      const noteMatches=row.notes.map((text,index)=>({text,index})).filter(note=>matches(note.text));
      return noteMatches.length?[{work,row,noteMatches,text:noteMatches.map(note=>note.text).join('\n')}]:[];
    }
    const text=passageSearchText(row,state.mode);return text&&matches(text)?[{work,row,text}]:[];
  }))};
}

