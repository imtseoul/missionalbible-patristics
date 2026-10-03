import {archiveResults} from './archive-search-engine.mjs?v=824d96d5bb7a';

const cancelled=()=>Object.assign(new Error('검색을 취소했습니다.'),{name:'AbortError'});

export function createArchiveSearchClient(WorkerFactory=globalThis.Worker) {
  let worker=null,ready=false,pending=null,sequence=0,timer=null;
  const stopWorker=()=>{clearTimeout(timer);timer=null;worker?.terminate();worker=null;ready=false;};
  const cancel=()=>{
    const previous=pending;pending=null;previous?.controller.abort();stopWorker();previous?.reject(cancelled());
  };
  const run=(state,{onProgress}={})=>{
    if(pending)cancel();
    const id=++sequence;
    return new Promise((resolve,reject)=>{
      const controller=new AbortController();pending={id,state,resolve,reject,onProgress,controller};
      const fallback=()=>archiveResults(state,{signal:controller.signal,onProgress:progress=>{
        if(pending?.id===id)pending.onProgress?.(progress);
      }}).then(result=>{if(pending?.id===id){pending=null;resolve(result);}},error=>{if(pending?.id===id){pending=null;reject(error);}});
      if(!WorkerFactory){fallback();return;}
      try {
        if(!worker) {
          worker=new WorkerFactory(new URL('./archive-search-worker.mjs?v=c308f255fcc6',import.meta.url),{type:'module'});
          const created=worker;
          worker.addEventListener('message',event=>{
            if(worker!==created)return;
            const data=event.data;
            if(data.type==='ready'){
              ready=true;clearTimeout(timer);timer=null;
              if(pending)created.postMessage({id:pending.id,state:pending.state});
              return;
            }
            if(!pending||data.id!==pending.id)return;
            if(data.type==='progress'){pending.onProgress?.(data.progress);return;}
            const current=pending;pending=null;
            if(data.type==='result')current.resolve(data.result);
            else {stopWorker();current.reject(new Error(data.message||'검색 자료를 읽지 못했습니다. 다시 검색하세요.'));}
          });
          worker.addEventListener('error',()=>{
            if(worker!==created)return;
            const current=pending;pending=null;stopWorker();
            current?.reject(new Error('검색을 실행하지 못했습니다. 연결을 확인한 뒤 다시 검색하세요.'));
          });
        }
        if(ready)worker.postMessage({id,state});
        else timer=setTimeout(()=>{
          if(pending?.id!==id)return;
          stopWorker();fallback();
        },1200);
      } catch {
        stopWorker();fallback();
      }
    });
  };
  return {run,cancel};
}
