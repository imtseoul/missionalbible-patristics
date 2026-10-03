export function normalizedCatalogueText(text) {
  return String(text||'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('ko').replace(/\s+/g,' ').trim();
}

export function catalogueMatch(words,languages,query,language='') {
  const text=normalizedCatalogueText(words),compact=text.replace(/\s/g,'');
  const terms=normalizedCatalogueText(query).split(' ').filter(Boolean);
  return terms.every(term=>text.includes(term)||compact.includes(term))
    && (!language || language==='mixed'&&languages.length>1 || languages.includes(language));
}
