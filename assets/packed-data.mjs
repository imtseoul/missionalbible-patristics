// A JSON module keeps the same values after transport compression.
export function dataErrorMessage(error, fallback='자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.') {
  const message=typeof error?.message==='string'?error.message:'';
  return /^[가-힣]/u.test(message)?message:fallback;
}

export async function unpackBytes(bytes, expected='') {
  const raw=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  let data=raw;
  if(raw[0]===0x1f&&raw[1]===0x8b) {
    if(typeof DecompressionStream==='undefined')throw new Error('이 브라우저에서는 압축 자료를 열 수 없습니다. 최신 브라우저 또는 고정판 읽기를 이용하세요.');
    data=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  if(expected) {
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');
    if(digest!==expected)throw new Error('자료가 온전히 도착하지 않았습니다. 새로고침 후 다시 시도하세요.');
  }
  return data;
}

export async function unpackJSON(encoded,expected) {
  const bytes=Uint8Array.from(atob(encoded),letter=>letter.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await unpackBytes(bytes,expected)));
}
