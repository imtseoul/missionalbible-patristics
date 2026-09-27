export function installPhraseHover(root) {
  const units = [...root.querySelectorAll('[data-align]')];
  const groups = new Map();
  for (const unit of units) {
    const key = unit.dataset.align;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(unit);
  }
  let active = null;
  function select(key) {
    if (key === active) return;
    for (const unit of groups.get(active) || []) unit.classList.remove('is-aligned');
    active = groups.has(key) ? key : null;
    for (const unit of groups.get(active) || []) unit.classList.add('is-aligned');
  }
  function unitAt(node) {
    const unit = node?.closest?.('[data-align]');
    return unit && root.contains(unit) ? unit : null;
  }
  root.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    select(unitAt(event.target)?.dataset.align);
  });
  root.addEventListener('pointerout', event => {
    if (event.pointerType === 'touch') return;
    select(unitAt(event.relatedTarget)?.dataset.align);
  });
  root.addEventListener('pointerdown', event => {
    const unit = unitAt(event.target);
    if (!unit) select(null);
    else if (event.pointerType === 'touch') select(unit.dataset.align);
  });
  root.addEventListener('focusin', event => {
    const unit = unitAt(event.target);
    if (unit) select(unit.dataset.align);
  });
  root.addEventListener('focusout', event => {
    select(unitAt(event.relatedTarget)?.dataset.align);
  });
  root.addEventListener('keydown', event => {
    const unit = unitAt(event.target);
    if (!unit) return;
    if (event.key === 'Escape') { select(null); return; }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const siblings = [...unit.closest('p').querySelectorAll('[data-align]')];
    const position = siblings.indexOf(unit);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1 :
      Math.max(0, Math.min(siblings.length - 1, position + (event.key === 'ArrowRight' ? 1 : -1)));
    event.preventDefault();
    for (const item of siblings) item.tabIndex = -1;
    siblings[next].tabIndex = 0;
    siblings[next].focus();
    select(siblings[next].dataset.align);
  });
}

if (typeof document !== 'undefined') installPhraseHover(document);
