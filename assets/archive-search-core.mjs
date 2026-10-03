export const PAGE_SIZE=25;
export const useLabels={quotation:'직접 인용',paraphrase:'의역',exposition:'해설',possible_allusion:'가능한 암시',reference:'참조'};
export const originLabels={body_reference:'본문 근거',editorial_reference:'편집자 참조',translation_note_reference:'번역 주석 참조'};
export const speakerLabels={author:'저자의 논의',reported_view:'보고된 상대 견해',quoted_witness:'인용된 증언'};
export const compositionLabels={adapted:'표현 조정',composite:'복합 인용',interrupted:'인용 사이에 해설'};
const modes=['ko','grc','lat','scripture'];
const uses=Object.keys(useLabels);
const cut=value=>Array.from(String(value||'')).slice(0,200).join('');

export function searchState(value) {
  const url=new URL(value);const params=url.searchParams;
  const page=Number(params.get('page'));
  return {query:cut(params.get('text')),work:params.get('work')||'',mode:modes.includes(params.get('mode'))?params.get('mode'):'ko',
    exact:params.get('exact')==='1',page:Number.isSafeInteger(page)&&page>0&&page<100000?page:1,
    relation:uses.includes(params.get('relation'))?params.get('relation'):'',numbering:params.get('numbering')==='conventional'?'conventional':'edition'};
}

export function searchURL(base,state) {
  const current=new URL(base),url=new URL('/index.html',current);
  if(['/', '/index.html'].includes(current.pathname))for(const key of ['find','lang'])if(current.searchParams.has(key))url.searchParams.set(key,current.searchParams.get(key));
  const values={text:cut(state.query).trim(),work:state.work||'',mode:state.mode!=='ko'?state.mode:'',exact:state.exact?'1':'',
    page:state.page>1?String(state.page):'',relation:state.relation||'',numbering:state.numbering==='conventional'?'conventional':''};
  for(const [key,value] of Object.entries(values))if(value)url.searchParams.set(key,value);else url.searchParams.delete(key);
  url.hash='body-search';return url;
}

export function searchReaderURL(path,base,state) {
  const reader=new URL(path,base),back=searchURL(base,state);
  if(reader.origin!==back.origin||!/^\/works\/[a-z0-9-]+\/(?:index|book-\d+)\.html$/.test(reader.pathname))throw new Error('본문 주소를 확인해 주세요.');
  reader.searchParams.set('search',back.pathname+back.search+back.hash);return reader;
}

export function searchReturnURL(current) {
  const url=new URL(current);const value=url.searchParams.get('search');if(!value)return null;
  let back;try{back=new URL(value,url);}catch{return null;}
  if(back.origin!==url.origin||back.username||back.password||back.pathname!=='/index.html')return null;
  return searchURL(back.href,searchState(back.href));
}

export function foldSearch(text) {
  return String(text).normalize('NFKD').replace(/\p{M}/gu,'').normalize('NFC').toLocaleLowerCase('ko').replace(/ς/g,'σ').replace(/\s+/g,' ').trim();
}

export function passageSearchText(row,mode) {
  if(mode==='ko')return row.ko;
  if(!row.languages.includes(mode))return '';
  if(!row.language_ranges)return row.original;
  return row.language_ranges.filter(range=>range[0]===mode).map(range=>row.original.slice(range[1],range[2])).join(' … ');
}

export function textMatches(text,query,exact=false) {
  const value=foldSearch(text),needle=foldSearch(query);if(!needle)return false;
  return exact?value.includes(needle):needle.split(' ').every(term=>value.includes(term));
}

const identity=text=>foldSearch(text).replace(/[\s.]/g,'');
export function workReference(works,query,selected='',numbering='edition') {
  let text=identity(query),scheme=numbering;
  if(text.includes('통상')){scheme='conventional';text=text.replace('통상','');}
  if(text.includes('harvey')){scheme='edition';text=text.replace('harvey','');}
  // Keep reference separators for number parsing after matching the name.
  let original=foldSearch(query).replace(/통상|harvey/gi,'').trim();
  const matches=[];
  for(const work of works) {
    if(selected&&work.id!==selected)continue;
    const names=[work.title,...(work.aliases||[]),...(work.authors||[])].filter(Boolean).sort((a,b)=>b.length-a.length);
    if(selected)names.unshift('');
    for(const name of names) {
      const normalizedName=identity(name),whole=identity(original),at=whole.indexOf(normalizedName);
      if(at<0)continue;
      const prefix=whole.slice(0,at);
      if(prefix&&!(work.authors||[]).some(author=>identity(author)===prefix))continue;
      // Locate the numeric tail in the original input, where dots still separate levels.
      const tail=original.match(/(§?\s*\d+(?:\s*(?:[.:]|권|장|절)\s*\d+)*(?:권|장|절)?(?:\s*서두)?)\s*$/)?.[1];
      if(!tail)continue;
      const stem=identity(original.slice(0,original.length-tail.length));
      if(stem!==normalizedName&&!(work.authors||[]).some(author=>stem===identity(author)+normalizedName))continue;
      const parts=tail.match(/\d+/g).map(Number);
      if(parts.some(number=>number<1)||parts.length>3)return {invalid:true,scheme,works:[work.id],parts};
      matches.push(work.id);break;
    }
  }
  const tail=original.match(/(§?\s*\d+(?:\s*(?:[.:]|권|장|절)\s*\d+)*(?:권|장|절)?(?:\s*서두)?)\s*$/)?.[1];
  return matches.length?{works:[...new Set(matches)],parts:tail.match(/\d+/g).map(Number),preface:tail.includes('서두'),scheme}:null;
}

export function conventionalLabel(reference,query) {
  const numbers=[reference.book,reference.chapter,query.parts[2]].filter(value=>value!==undefined);
  let qualifier='대응 대목';
  if(reference.mapping_status==='beginning_of_conventional_section_only')qualifier='앞부분';
  else if(reference.mapping_status==='ending_of_conventional_section_only')qualifier='뒷부분';
  else if(reference.mapping_status==='edition_section_includes_partial_conventional_section'&&(!query.parts[2]||reference.partial_section===query.parts[2]))qualifier='일부 포함';
  return '통상 '+numbers.join('.')+(query.preface?' 서두':'')+' · '+qualifier;
}

export function referenceMatches(row,query) {
  if(query.invalid)return [];
  if(query.scheme==='edition') {
    if(query.preface)return row.location.startsWith(query.parts[0]+'.praef')||row.id==='athanasius-incarnation:10.0'&&query.parts[0]===10?[{label:row.label}]:[];
    return query.parts.every((number,index)=>row.numbers[index]===number)?[{label:row.label}]:[];
  }
  return (row.conventional||[]).filter(ref=>{
    if(Number(ref.book)!==query.parts[0])return false;
    if(query.preface)return ref.division==='preface';
    if(query.parts[1]!==undefined&&Number(ref.chapter)!==query.parts[1])return false;
    return query.parts[2]===undefined||(ref.sections||[ref.section]).map(Number).includes(query.parts[2]);
  }).map(reference=>({label:conventionalLabel(reference,query),reference}));
}

export function pageSlice(rows,page,size=PAGE_SIZE) {
  const pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(pages,Math.max(1,page));
  return {page,pages,total:rows.length,start:(page-1)*size,end:Math.min(rows.length,page*size),rows:rows.slice((page-1)*size,page*size)};
}

export function plainExcerpt(text,preferred='') {
  if(preferred&&text.includes(preferred))return (text.indexOf(preferred)>0?'… ':'')+preferred+(text.indexOf(preferred)+preferred.length<text.length?' …':'');
  const letters=Array.from(text);return letters.length>280?letters.slice(0,280).join('')+'…':text;
}
