export function readerSourceURL(path, current) {
  const source = new URL(path, current);
  if (source.origin !== new URL(current).origin || !/^\/releases\/[^/]+\/[^/]+\/(?:index|book-\d+)\.html$/.test(source.pathname)) {
    throw new Error('Invalid reader source');
  }
  return source;
}

export function readerLink(value, source, current) {
  if (!value || value.startsWith('#')) return value;
  const resolved = new URL(value, source);
  const prefix = source.pathname.slice(0, source.pathname.lastIndexOf('/') + 1);
  if (resolved.origin === source.origin && resolved.pathname.startsWith(prefix) && /\/(?:index|book-\d+)\.html$/.test(resolved.pathname)) {
    const work = prefix.split('/').filter(Boolean).at(-1);
    resolved.pathname = '/works/' + work + '/' + resolved.pathname.slice(prefix.length);
  }
  return resolved.href;
}

async function loadCurrentReader() {
  const node = document.getElementById('current-reader-config');
  if (!node) return;
  const message = document.querySelector('[data-reader-load-message]');
  const fallback = document.querySelector('[data-reader-load-fallback]');
  const current = new URL(location.href);
  let recoveryHref = null;
  try {
    const config = JSON.parse(node.textContent);
    if (config.schema_version !== 'patristics-current-reader-1') throw new Error('Invalid reader configuration');
    const source = readerSourceURL(config.source_path, current);
    const recovery = new URL(source); recovery.search = current.search; recovery.hash = current.hash;
    recoveryHref = recovery.href;
    fallback.href = recovery.href;
    const params = current.searchParams;
    if (params.get('topic')) {
      const back = new URL('/topics.html', current);
      for (const key of ['group', 'q', 'read', 'compare']) if (params.has(key)) back.searchParams.set(key, params.get(key));
      back.hash = 'topic-' + params.get('topic');
      for (const link of document.querySelectorAll('.site-header a')) if (new URL(link.href).pathname.endsWith('/topics.html')) link.href = back.href;
    }
    try {
      const size = Number(localStorage.getItem('patristics-ko-reader-font-size-v1'));
      if ([80,90,100,110,120,130,140].includes(size)) document.documentElement.style.setProperty('--reader-text-scale', String(size / 100));
    } catch {}
    const response = await fetch(source.href, {signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Reader unavailable');
    const bytes = await response.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('');
    if (digest !== config.source_sha256) throw new Error('Reader checksum mismatch');
    const saved = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'text/html');
    if (config.required_anchors.some(id => !saved.getElementById(id))) throw new Error('Reader anchor mismatch');
    saved.getElementById('edition-information')?.remove();
    saved.querySelectorAll('script').forEach(script => script.remove());
    for (const element of saved.body.querySelectorAll('[href],[src],[action],[poster],[data-source]')) {
      for (const name of ['href','src','action','poster','data-source']) {
        if (element.hasAttribute(name)) element.setAttribute(name, readerLink(element.getAttribute(name), source, current));
      }
    }
    document.body.replaceChildren(...saved.body.childNodes);
    document.body.className = saved.body.className;
    document.body.dataset.readerSource = source.pathname;
    // Each controller initializes against the hydrated body, including the
    // existing font preference controller, which also works as a module.
    for (const path of config.modules) {
      const module = new URL(path, current);
      if (module.origin !== current.origin || !module.pathname.startsWith('/assets/')) throw new Error('Invalid reader controller');
      await import(module.href);
    }
    let userMoved = false;
    const markIntent = () => { userMoved = true; };
    for (const event of ['wheel','touchmove','keydown','pointerdown']) window.addEventListener(event, markIntent, {once:true, passive:true});
    const settle = () => {
      if (userMoved || !current.hash) return;
      let id; try { id = decodeURIComponent(current.hash.slice(1)); } catch { return; }
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({block:'start'}));
    };
    const observer = new MutationObserver(() => {
      if (document.querySelector('.reader-topic-context,.topic-context-fallback')) { observer.disconnect(); settle(); }
    });
    if (current.searchParams.has('topic') && !document.querySelector('.reader-topic-context,.topic-context-fallback')) {
      observer.observe(document.body, {childList:true, subtree:true});
      setTimeout(() => observer.disconnect(), 10000);
    }
    settle();
    document.body.dataset.readerReady = 'true';
  } catch {
    if (message?.isConnected) message.textContent = '본문을 불러오지 못했습니다. 아래에서 이어 읽을 수 있습니다.';
    if (!fallback?.isConnected && recoveryHref) location.replace(recoveryHref);
  }
}

if (typeof document !== 'undefined') loadCurrentReader();
