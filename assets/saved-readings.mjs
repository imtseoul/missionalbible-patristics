export const SAVED_KEY='patristics.saved-readings.v1';
export const REMOVED_KEY='patristics.saved-readings.removed.v1';
export const SAVED_LIMIT=200;
const PARAMETERS=['topic','group','q','read','compare','pane','guide'];

export function savedEntry(value,base) {
  if(!value||typeof value!=='object'||typeof value.id!=='string'||!/^[A-Za-z0-9:._-]{1,180}$/.test(value.id))return null;
  try {
    const url=new URL(value.path,base);
    if(/^\/works\/[a-z0-9-]+\/$/.test(url.pathname))url.pathname+='index.html';
    if(url.origin!==new URL(base).origin||!/^\/works\/[a-z0-9-]+\/(?:index|book-\d+)\.html$/.test(url.pathname)||!/^#p-[A-Za-z0-9._-]+$/.test(url.hash))return null;
    const work=url.pathname.split('/')[2];if(value.work!==work)return null;
    for(const key of [...url.searchParams.keys()])if(!PARAMETERS.includes(key))url.searchParams.delete(key);
    for(const key of PARAMETERS)if((url.searchParams.get(key)||'').length>220)return null;
    const fields={};
    for(const [key,max] of [['title',240],['author',160],['label',240],['citation',2400],['note',4000]]) {
      const text=value[key]??'';if(typeof text!=='string'||text.length>max)return null;fields[key]=text;
    }
    if(!fields.title||!fields.label)return null;
    return {id:value.id,work,...fields,path:url.pathname+url.search+url.hash};
  }catch{return null;}
}

export function storageProblem(storage) {
  try {(storage??localStorage).getItem(SAVED_KEY);return '';}catch{return '저장 목록에 접근하지 못했습니다. 브라우저의 저장 설정을 확인하세요.';}
}

export function readSaved(storage,base,key=SAVED_KEY) {
  try {storage??=localStorage;base??=location.href;const raw=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(raw)?raw.map(x=>savedEntry(x,base)).filter(Boolean).slice(0,SAVED_LIMIT):[];}catch{return [];}
}

export function readRemoved(storage,base) {return readSaved(storage,base,REMOVED_KEY);}

export function removeSaved(id,storage,base) {
  try {
    storage??=localStorage;base??=location.href;const entries=readSaved(storage,base),removed=entries.find(x=>x.id===id);
    if(!removed)return null;
    storage.setItem(REMOVED_KEY,JSON.stringify([removed,...readRemoved(storage,base).filter(x=>x.id!==id)].slice(0,20)));
    saveReadings(entries.filter(x=>x.id!==id),storage);return removed;
  }catch{throw new Error('목록에서 빼지 못했습니다. 브라우저의 저장 공간과 설정을 확인하세요.');}
}

export function mergeSaved(current,incoming) {
  const ids=new Set(current.map(x=>x.id)),result=[...current];
  for(const item of incoming)if(!ids.has(item.id)){ids.add(item.id);result.push(item);}
  if(result.length>SAVED_LIMIT)throw new Error('대목은 200개까지 저장할 수 있습니다. 목록을 내보낸 뒤 필요한 대목을 정리하세요.');
  return result;
}

export function parseSavedFile(text,base) {
  if(text.length>3000000)throw new Error('목록 파일은 3MB 이하로 선택하세요.');
  let data;try{data=JSON.parse(text);}catch{throw new Error('JSON 형식의 모아 읽기 파일을 선택하세요.');}
  if(data?.schema_version!=='patristics-saved-readings-1'||!Array.isArray(data.entries)||data.entries.length>SAVED_LIMIT)throw new Error('이 사이트에서 내보낸 모아 읽기 파일을 선택하세요.');
  const entries=data.entries.map(x=>savedEntry(x,base));
  if(entries.some(x=>!x))throw new Error('목록에 올바르지 않은 본문 주소나 메모가 있습니다. 원래 파일을 확인하세요.');
  return mergeSaved([],entries);
}

export function saveReadings(entries,storage) {
  try {(storage??localStorage).setItem(SAVED_KEY,JSON.stringify(entries));}catch{throw new Error('저장하지 못했습니다. 브라우저의 저장 공간과 설정을 확인하세요.');}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('saved-readings-change'));
}

export function savedFile(entries) {return JSON.stringify({schema_version:'patristics-saved-readings-1',entries},null,2)+'\n';}
