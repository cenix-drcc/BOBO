/* BOBO: compressed first screen, then one animal pack on demand. No CDN dependency. */
(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const base = new URL('.', document.currentScript.src);
  const version = 'slim-v2-20261002';
  const cacheName = 'bobo-web-resources-v2';
  let manifestPromise;
  let startupPromise;
  let engine;
  const inFlight = new Map();
  const mounted = new Map();
  const metrics = {version, downloadedBytes: 0, cacheHits: 0, animals: []};
  const progress = new Map();
  const panel = document.createElement('div');
  panel.id = 'bobo-loading';
  panel.style.cssText = 'position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;background:rgba(248,244,234,.55);color:#384b43;font:18px system-ui;text-align:center;padding:24px;';
  const text = document.createElement('div');
  const actions = document.createElement('div');
  const card = document.createElement('div');
  card.style.cssText = 'background:#f8f4ea;padding:28px;max-width:460px;border-radius:8px;box-shadow:0 4px 24px #384b4326';
  const bar = document.createElement('progress'); bar.max = 100; bar.value = 0;
  bar.style.cssText = 'width:100%;height:14px;margin-top:22px;accent-color:#66816a';
  bar.setAttribute('aria-label','资源下载进度');
  card.append(text, bar, actions); panel.append(card); document.body.append(panel);
  function show(message) { panel.style.display = 'flex'; text.textContent = message; actions.replaceChildren(); }
  function hide() { panel.style.display = 'none'; }
  function url(name) { return new URL(name, base).href; }
  function manifest() {
    if (manifestPromise) return manifestPromise;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),45000);
    return manifestPromise ||= nativeFetch(url('web-manifest.json') + '?v=' + version, {cache:'no-cache',signal:controller.signal})
      .then(r => { if (!r.ok) throw Error('资源目录无法连接（HTTP ' + r.status + '）'); return r.json(); })
      .catch(e => { manifestPromise = null; throw e; }).finally(() => clearTimeout(timeout));
  }
  function report(name, done, total, title) {
    progress.set(name, {done, total});
    let d = 0, t = 0; for (const p of progress.values()) { d += p.done; t += p.total; }
    const mb = n => (n / 1048576).toFixed(1);
    if (actions.childElementCount) return; // Another parallel download must not overwrite an error dialog.
    text.textContent = title + '\n' + mb(d) + ' / ' + mb(t) + ' MB · ' + (t ? Math.floor(d / t * 100) : 0) + '%';
    bar.value = t ? Math.floor(d / t * 100) : 0;
    text.style.whiteSpace = 'pre-line';
    if (t && d === t) text.textContent += '\n下载完成，正在展开书页…';
  }
  async function compressedResponse(entry, title) {
    let cache;
    try { cache = await caches.open(cacheName); } catch (_) { /* Private browsing / quota: network fallback. */ }
    const address = url(entry.file);
    let response;
    try { response = cache && await cache.match(address); } catch (_) {}
    if (response) { metrics.cacheHits++; report(entry.file, entry.bytes, entry.bytes, title); return response; }
    const controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), 45000);
    try {
      response = await nativeFetch(address, {signal:controller.signal, cache:'default'});
      if (!response.ok) throw Error('资源下载失败（HTTP ' + response.status + '）');
      clearTimeout(timer);
      const reader = response.body.getReader();
      const chunks = []; let received = 0;
      while (true) {
        timer = setTimeout(() => controller.abort(), 45000);
        const part = await reader.read(); clearTimeout(timer);
        if (part.done) break;
        chunks.push(part.value); received += part.value.length;
        report(entry.file, received, entry.bytes, title);
      }
      if (received !== entry.bytes) throw Error('资源下载不完整，请重试');
      const blob = new Blob(chunks, {type:'application/gzip'});
      const bytes = await blob.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2,'0')).join('');
      if (digest !== entry.sha256) throw Error('资源校验失败，请重试');
      metrics.downloadedBytes += received;
      response = new Response(blob, {headers:{'Content-Type':'application/gzip'}});
      try { if (cache) await cache.put(address, response.clone()); } catch (_) {}
      return response;
    } finally { clearTimeout(timer); }
  }
  async function decoded(entry, type, title) {
    const response = await compressedResponse(entry, title);
    // Stream decompression; no 36-part concatenation / giant uncompressed JS array.
    const headers = {'Content-Type':type,'Content-Length':String(entry.rawBytes)};
    if (typeof DecompressionStream === 'function') return new Response(response.body.pipeThrough(new DecompressionStream('gzip')), {headers});
    const input = await response.arrayBuffer();
    const output = await new Promise((resolve,reject) => {
      const worker = new Worker(url('bobo-gzip-worker.js'));
      const timer = setTimeout(() => { worker.terminate(); reject(Error('资源解压超时，请重试')); }, 120000);
      worker.onmessage = event => { clearTimeout(timer); worker.terminate(); event.data.error ? reject(Error(event.data.error)) : resolve(event.data.bytes); };
      worker.onerror = event => { clearTimeout(timer); worker.terminate(); reject(Error(event.message)); };
      worker.postMessage(input,[input]);
    });
    return new Response(output,{headers});
  }
  async function retryable(work, title) {
    for (;;) {
      try { return await work(); }
      catch (error) {
        show(title + '\n' + (error.name === 'AbortError' ? '连接超时，当前网络无法稳定下载 GitHub 资源。' : error.message) + '\n请检查网络后重试。切换网络不会丢失已缓存的完整文件。');
        text.style.whiteSpace = 'pre-line';
        await new Promise((resolve, reject) => {
          const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.style.cssText = 'margin:20px;padding:12px 24px;font:inherit'; retry.onclick = resolve;
          const cancel = document.createElement('button'); cancel.textContent = '返回'; cancel.style.cssText = retry.style.cssText; cancel.onclick = () => reject(error);
          actions.append(retry, cancel);
        });
        show(title);
      }
    }
  }
  window.fetch = async (input, options) => {
    const address = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const name = address.pathname.slice(base.pathname.length);
    if (address.origin !== base.origin || !address.pathname.startsWith(base.pathname) || !['index.wasm','index.pck'].includes(name)) return nativeFetch(input, options);
    // Both Godot startup fetches share one retry flow. Separate dialogs would
    // strand one promise if WASM and PCK fail together on an unstable network.
    startupPromise ||= retryable(async () => {
      const m = await manifest();
      progress.clear();
      for (const entry of [m.engine, m.core]) progress.set(entry.file, {done:0,total:entry.bytes});
      const title='正在打开绘本，仅加载封面和目录…'; show(title);
      const [wasm,pck]=await Promise.all([decoded(m.engine,'application/wasm',title),decoded(m.core,'application/octet-stream',title)]);
      return {'index.wasm':wasm,'index.pck':pck};
    }, '打开绘本失败').catch(error=>{startupPromise=null;throw error;});
    return (await startupPromise)[name].clone();
  };
  window.BOBOWeb = {
    metrics,
    qaEnabled: new URLSearchParams(location.search).get('qa') === '1',
    installProbe(callback) { this.probeCallback = callback; },
    probeData(json) { metrics.probe = JSON.parse(json); },
    attach(instance) { engine = instance; },
    ready() { metrics.firstScreenReady = true; hide(); console.info('BOBO_FIRST_SCREEN_READY', version, metrics.downloadedBytes); },
    pageReady(info) { metrics.page = info; console.info('BOBO_PAGE_READY', JSON.stringify(info)); },
    loadAnimal(name, callback) {
      if (mounted.has(name)) { callback(true, mounted.get(name)); return; }
      if (inFlight.has(name)) { inFlight.get(name).then(path => callback(true,path), () => callback(false,'')); return; }
      const promise = retryable(async () => {
        const m = await manifest(); const entry = m.animals[name];
        if (!entry) throw Error('没有对应的动物资源');
        progress.clear(); progress.set(entry.file, {done:0,total:entry.bytes});
        show('正在翻到' + name + '这一页…');
        const response = await decoded(entry, 'application/octet-stream', '正在翻到' + name + '这一页…');
        const buffer = new Uint8Array(await response.arrayBuffer());
        if (buffer.byteLength !== entry.rawBytes) throw Error('解压后的资源不完整');
        const path = '/bobo-' + entry.id + '.pck';
        engine.copyToFS(path, buffer);
        mounted.set(name, path); metrics.animals.push(name);
        console.info('BOBO_ANIMAL_DOWNLOADED', name, entry.bytes);
        return path;
      }, '这一页未能加载');
      inFlight.set(name, promise);
      promise.then(path => { hide(); callback(true,path); }, error => { console.error(error); hide(); callback(false,''); }).finally(() => inFlight.delete(name));
    },
  };
})();
