// Keep original text intact while matching normalized Korean and Greek strings.
const segmenter = new Intl.Segmenter('ko', {granularity: 'grapheme'});
const fold = (text, {normalization = 'NFC', caseSensitive = true} = {}) => {
  const normalized = text.normalize(normalization);
  return caseSensitive ? normalized : normalized.toLocaleLowerCase('ko');
};
export const queryTerms = (query, options = {}) => [...new Set(fold(query, options).trim().split(/\s+/).filter(Boolean))];

export function matchRanges(text, query, options = {}) {
  const terms = queryTerms(query, options);
  if (!terms.length) return [];
  let normalized = '';
  const offsets = [];
  for (const {segment, index} of segmenter.segment(text)) {
    const value = fold(segment, options);
    normalized += value;
    for (let i = 0; i < value.length; i++) offsets.push([index, index + segment.length]);
  }
  const found = [];
  for (const term of terms) {
    let start = normalized.indexOf(term);
    while (start !== -1) {
      found.push([offsets[start][0], offsets[start + term.length - 1][1]]);
      start = normalized.indexOf(term, start + 1);
    }
  }
  const merged = [];
  for (const range of found.sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

export function markedText(document, text, query, options = {}) {
  const fragment = document.createDocumentFragment();
  let cursor = 0;
  for (const [start, end] of matchRanges(text, query, options)) {
    fragment.append(document.createTextNode(text.slice(cursor, start)));
    const mark = document.createElement('mark');
    mark.className = 'search-match'; mark.textContent = text.slice(start, end);
    fragment.append(mark); cursor = end;
  }
  fragment.append(document.createTextNode(text.slice(cursor)));
  return fragment;
}

export function matchExcerpts(text, query, options = {}) {
  if (text.length <= 360) return [{text, start: 0, end: text.length}];
  // Include the first occurrence of every query term, even when they are far apart.
  const seeds = queryTerms(query, options).map(term => matchRanges(text, term, options)[0]).filter(Boolean);
  if (!seeds.length) return [{text, start: 0, end: text.length}];
  const boundaries = [...segmenter.segment(text)].map(item => item.index).concat(text.length);
  const windows = seeds.map(([start, end]) => {
    start = Math.max(0, start - 80); end = Math.min(text.length, end + 120);
    // Include whole words near each context edge, without splitting graphemes.
    for (let n = 0; start > 0 && n < 20 && !/\s/.test(text[start - 1]); n++) start--;
    for (let n = 0; end < text.length && n < 20 && !/\s/.test(text[end]); n++) end++;
    start = boundaries.findLast(index => index <= start);
    end = boundaries.find(index => index >= end);
    return [start, end];
  }).sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of windows) {
    const last = merged.at(-1);
    if (last && range[0] <= last[1] + 20) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged.map(([start, end]) => ({text: text.slice(start, end), start, end}));
}
