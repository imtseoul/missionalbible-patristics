import {dataErrorMessage} from './packed-data.mjs?v=1a75398990a6';
let engine;
self.addEventListener('message',async event=>{
  const {id,state}=event.data;
  try {
    engine??=import('./archive-search-engine.mjs?v=824d96d5bb7a');
    const {archiveResults}=await engine;
    const result=await archiveResults(state,{onProgress:progress=>self.postMessage({id,type:'progress',progress})});
    self.postMessage({id,type:'result',result});
  } catch(error) {
    self.postMessage({id,type:'error',message:dataErrorMessage(error,'검색 자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 검색하세요.')});
  }
});
self.postMessage({type:'ready'});
