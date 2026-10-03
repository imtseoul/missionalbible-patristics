export function copyControl(label, resolveText, accessibleLabel=label) {
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.className='copy-control';button.setAttribute('aria-label',accessibleLabel);
  const status=document.createElement('span');status.className='sr-only';status.setAttribute('role','status');
  button.append(status);
  const say=(text,state='')=>{status.textContent=text;button.dataset.copyState=state;};
  button.addEventListener('click',async()=>{
    if(button.disabled)return;button.disabled=true;say('복사할 내용을 준비합니다.','loading');
    try {
      const value=String(await resolveText());
      if(!value.trim())throw new Error('Empty copy value');
      try {await navigator.clipboard.writeText(value);say('복사했습니다.','copied');button.firstChild.textContent='복사됨';setTimeout(()=>{button.firstChild.textContent=label;},2500);}
      catch {
        let panel=button.parentElement.querySelector('.copy-fallback');
        if(!panel){panel=document.createElement('details');panel.className='copy-fallback';const summary=document.createElement('summary');summary.textContent='직접 복사';panel.append(summary);button.parentElement.append(panel);}
        panel.open=true;let field=panel.querySelector('textarea');
        if(!field){field=document.createElement('textarea');field.readOnly=true;field.setAttribute('aria-label',accessibleLabel+'할 내용');panel.append(field);}
        field.value=value;field.focus();field.select();say('선택된 내용을 복사하세요.','manual');
      }
    } catch {say('내용을 불러오지 못했습니다. 다시 눌러 주세요.','error');button.firstChild.textContent='다시 시도';button.title='내용을 불러오지 못했습니다. 다시 눌러 주세요.';}
    finally {button.disabled=false;}
  });
  return button;
}
