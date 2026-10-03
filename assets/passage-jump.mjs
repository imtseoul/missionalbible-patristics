const normalized=text=>String(text).normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/g,'');
export function passageDestination(works, query, selected='') {
  const text=normalized(query);let recognized=null;const matches=new Map();
  for(const work of works) {
    if(selected&&work.id!==selected)continue;
    const names=[work.title,...work.aliases].filter(Boolean).sort((a,b)=>b.length-a.length);if(selected)names.unshift('');
    for(const name of names) {
      const alias=normalized(name),at=text.indexOf(alias);if(at<0)continue;
      const prefix=text.slice(0,at);if(prefix&&!work.authors.some(a=>normalized(a)===prefix))continue;
      const suffix=text.slice(at+alias.length);if(!suffix||!/^§?\d+(?:(?:권|장|절|[.:\-])\d+)*(?:권|장|절)?$/.test(suffix))continue;
      if(suffix.includes('권')&&!work.books)continue;
      const numbers=suffix.match(/\d+/g);if(Number(numbers[0])<1)continue;
      const location=numbers.map(n=>String(Number(n))).join('.');recognized={work:work.id,location};
      const row=work.locations.find(p=>p[0]===location)||work.locations.find(p=>p[0].startsWith(location+'.'));
      if(row)matches.set(work.id+':'+row[0],{work:work.id,title:work.author+' · '+work.title,label:row[0],path:'works/'+work.id+'/'+row[1]});
    }
  }
  if(matches.size===1)return [...matches.values()][0];
  if(matches.size>1)return {ambiguous:true};
  return recognized?{...recognized,missing:true}:null;
}
