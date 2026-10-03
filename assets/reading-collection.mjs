import {readSaved,saveReadings,mergeSaved,parseSavedFile,savedFile,removeSaved,storageProblem} from './saved-readings.mjs?v=cc89cfac9055';
import {canonicalSaved} from './passage-tools.mjs?v=070533f82482';
import {copyControl} from './copy-control.mjs?v=1b32deb2f89c';

export function installReadingCollection() {
  const target=document.querySelector('#saved-readings');if(!target)return;
  const count=target.querySelector('[data-saved-count]'),list=target.querySelector('[data-saved-list]'),status=target.querySelector('[data-saved-status]');
  const exportButton=target.querySelector('[data-saved-export]'),importInput=target.querySelector('[data-saved-import]');
  const copy=copyControl('목록 복사',()=>savedFile(readSaved()),'저장한 목록과 메모 복사');exportButton.after(copy);
  let undo=null;
  const render=()=>{
    const entries=readSaved();count.textContent=entries.length+'개 대목';exportButton.disabled=!entries.length;copy.disabled=!entries.length;list.replaceChildren();
    const problem=storageProblem();if(problem)status.textContent=problem;
    if(!entries.length){const empty=document.createElement('p');empty.textContent='본문이나 주제 읽기에서 저장을 누르면 여기에 모입니다.';list.append(empty);return;}
    for(const entry of entries) {
      const row=document.createElement('article');row.className='saved-reading';
      const heading=document.createElement('h3'),link=document.createElement('a');link.href=entry.path;link.textContent=entry.title+' '+entry.label;heading.append(link);
      const author=document.createElement('p');author.className='saved-author';author.textContent=entry.author;
      const field=document.createElement('label');field.textContent='내 메모';const note=document.createElement('textarea');note.value=entry.note;note.rows=2;note.maxLength=4000;note.setAttribute('aria-label',entry.title+' '+entry.label+' 메모');field.append(note);
      const message=document.createElement('span');message.setAttribute('role','status');message.className='saved-note-status';
      const commit=()=>{try{const entries=readSaved(),selected=entries.find(x=>x.id===entry.id);if(!selected)throw new Error('이 대목이 목록에서 제거됐습니다.');selected.note=note.value;saveReadings(entries);message.textContent='메모를 저장했습니다.';}catch(error){message.textContent=error.message;}};
      note.addEventListener('change',commit);
      const actions=document.createElement('div');actions.className='saved-actions';
      const save=document.createElement('button');save.type='button';save.textContent='메모 저장';save.addEventListener('click',commit);
      const remove=document.createElement('button');remove.type='button';remove.textContent='목록에서 빼기';remove.addEventListener('click',()=>{
        try{undo=removeSaved(entry.id);render();if(undo)showUndo();else status.textContent='이미 목록에서 빠졌습니다.';}catch(error){status.textContent=error.message;}
      });
      actions.append(save,copyControl('인용 복사',()=>entry.citation),remove);row.append(heading,author,field,actions,message);list.append(row);
    }
  };
  const showUndo=()=>{
    status.replaceChildren(document.createTextNode('목록에서 뺐습니다. '));
    const button=document.createElement('button');button.type='button';button.textContent='되돌리기';
    button.addEventListener('click',()=>{try{saveReadings(mergeSaved(readSaved(),[undo]));undo=null;render();status.textContent='대목과 메모를 복원했습니다.';}catch(error){status.textContent=error.message;}});status.append(button);button.focus();
  };
  let downloadURL;
  exportButton.addEventListener('click',()=>{
    if(downloadURL)URL.revokeObjectURL(downloadURL);
    const data=savedFile(readSaved()),url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));
    downloadURL=url;const link=document.createElement('a');link.href=url;link.download='patristics-saved-readings.json';link.textContent='목록 파일 저장';
    status.replaceChildren(document.createTextNode('다운로드가 시작되지 않으면 '),link,document.createTextNode('을 누르거나 목록 복사를 이용하세요.'));link.click();
  });
  importInput.addEventListener('change',async()=>{
    const file=importInput.files[0];if(!file)return;status.textContent='목록을 확인하는 중입니다.';importInput.disabled=true;
    try {
      if(file.size>3000000)throw new Error('목록 파일은 3MB 이하로 선택하세요.');
      const candidates=parseSavedFile(await file.text(),location.href),incoming=await Promise.all(candidates.map(canonicalSaved));
      const before=readSaved(),merged=mergeSaved(before,incoming);saveReadings(merged);render();status.textContent=(merged.length-before.length)+'개 대목을 추가했습니다. 이미 저장된 대목과 메모는 유지했습니다.';
    }catch(error){status.textContent=error.message;}
    finally{importInput.disabled=false;importInput.value='';}
  });
  const reveal=()=>{if(location.hash==='#saved-readings'){target.open=true;target.scrollIntoView({block:'start'});}};
  window.addEventListener('hashchange',reveal);window.addEventListener('pageshow',render);
  window.addEventListener('storage',()=>{if(!target.contains(document.activeElement))render();});
  render();reveal();
}
