/* BOBO: compressed first screen, then one animal pack on demand. No CDN dependency. */
(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  const base = new URL('.', document.currentScript.src || location.href);
  const version = 'mobile-startup-v9-20261004';
  const cacheName = 'bobo-web-resources-v2';
  let manifestPromise;
  let startupPromise;
  let engine;
  let engineEntry;
  let startupTimer;
  const inFlight = new Map();
  const mounted = new Map();
  const memoryCache = new Map(); // Only used when persistent storage is unavailable.
  const states = {};
  let statusCallback, allTask, resourceOwner;
  const metrics = {version, downloadedBytes: 0, cacheHits: 0, animals: [], phases: []};
  const pendingWrites = new Map();
  let cacheDisabled = false, cachePromise;
  // Some mobile/private-mode implementations leave CacheStorage promises
  // unresolved. Persistence is an optimization, never a startup dependency.
  async function storage(work) {
    if(cacheDisabled)return null;
    let timer;
    try { return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('cache-timeout')),1500);})]); }
    catch(error){cacheDisabled=true;metrics.cacheFallback=error.message;return null;}
    finally{clearTimeout(timer);}
  }
  async function openCache() {
    if(cacheDisabled)return null;
    return cachePromise ||= storage(()=>caches.open(cacheName));
  }
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
  function show(message) { window.BoboBoot?.handoff(); panel.style.display = 'flex'; text.textContent = message; actions.replaceChildren(); }
  function hide() { panel.style.display = 'none'; }
  // Safari on iPadOS 15 lacks WASM SIMD. Test the feature, not the device name.
  function supportsSimd() {
    try {
      return WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,3,2,1,0,10,9,1,7,0,65,0,253,15,26,11]));
    } catch (_) { return false; }
  }
  function phase(stage) {
    if(metrics.firstScreenReady || metrics.startupError || actions.childElementCount)return;
    if(metrics.startupPhase!==stage)metrics.phases.push({stage,ms:Math.round(performance.now())});
    metrics.startupPhase=stage;
    const complete=progress.size && [...progress.values()].every(p=>p.done===p.total);
    if(!complete && stage!=='init')return;
    const label={verify:'正在校验绘本资源…',decode:'正在解压绘本资源…',compile:'正在编译绘本引擎…',init:'正在准备封面与目录…'}[stage];
    if(label){text.textContent=label+'\n资源下载已完成，请稍候。';text.style.whiteSpace='pre-line';}
  }
  function resources(entry){return [entry,...(entry.narration?[entry.narration]:[])];}
  async function pageAvailable(entry){return (await Promise.all(resources(entry).map(available))).every(Boolean);}
  async function prepareVoice(name,entry) {
    if(!entry.narration || !window.BoboNativeAudio || BoboNativeAudio.hasVoice(name))return;
    const response=await compressedResponse(entry.narration,'正在准备这一页的朗读…');
    await BoboNativeAudio.prepareVoice(name,await response.arrayBuffer());
  }
  async function prepareMusic() {
    const m=await manifest();if(!m.music || !window.BoboNativeAudio)return;
    const response=await compressedResponse(m.music,'正在准备背景音乐…',null,true);
    await BoboNativeAudio.prepareMusic(await response.arrayBuffer());
    metrics.musicReady=true;
  }
  function fail(error) {
    if (metrics.firstScreenReady) return;
    clearTimeout(startupTimer);
    const reason = error instanceof Error ? error.message : String(error || '未知启动错误');
    metrics.startupError = reason;
    show('绘本暂时未能打开\n' + reason + '\n请重新加载。旧设备建议使用系统可提供的最新 Safari。');
    text.style.whiteSpace = 'pre-line'; bar.style.display = 'none';
    const retry = document.createElement('button');
    retry.textContent = '重新加载'; retry.style.cssText = 'margin-top:20px;padding:12px 24px;font:inherit';
    retry.onclick = () => location.reload(); actions.append(retry);
  }
  async function prepareEngine() {
    show('正在连接绘本资源目录…');
    if(typeof WebAssembly!=='object' || typeof BigInt64Array!=='function' || typeof WebAssembly.Tag!=='function')throw Error('浏览器内核缺少 WebAssembly / BigInt / 异常处理能力。请更新浏览器；安卓可尝试最新版 Chrome，iPad 请使用更新后的 Safari。');
    const testCanvas=document.createElement('canvas');
    const gl=testCanvas.getContext('webgl2');
    if(!gl)throw Error('浏览器无法启用 WebGL2。请关闭其他标签后重试；安卓可尝试最新版 Chrome，iPad 请使用 Safari。');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const m = await retryable(manifest, '资源目录未能加载');
    const simd = supportsSimd();
    const compatible = !simd || new URLSearchParams(location.search).get('compat') === '1';
    engineEntry = compatible ? m.engineCompat : m.engine;
    if (!engineEntry) throw Error('此浏览器需要兼容引擎，但当前发布缺少该资源。');
    metrics.simdSupported = simd;
    metrics.engineVariant = compatible ? 'compat-no-simd' : (m.engine.simd===false?'standard-2d':'standard-simd');
    metrics.lowEndMode=compatible;
    metrics.renderPixelRatio=window.devicePixelRatio||1;
    metrics.engineFile = engineEntry.file;
    show(compatible ? '正在打开绘本，使用旧设备兼容模式…' : '正在打开绘本…');
    // Fetch the large verified resources alongside the engine glue instead
    // of adding another full network round trip before their download starts.
    startResources();
    const src = compatible ? 'index.compat.js' : 'index.js';
    await new Promise((resolve,reject) => {
      const script = document.createElement('script'); script.src = url(src) + '?v=' + version;
      const timer = setTimeout(() => { script.remove(); reject(Error('引擎脚本下载超时，请检查网络后重试。')); }, 45000);
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); reject(Error('引擎脚本未能下载，请检查网络后重试。')); };
      document.head.append(script);
    });
    window.addEventListener('error', event => { if (event.error) fail(event.error); });
    window.addEventListener('unhandledrejection', event => fail(event.reason));
    startupTimer = setTimeout(() => {
      if (metrics.firstScreenReady || metrics.startupError || actions.childElementCount) return;
      show('展开书页耗时较长，正在等待设备完成启动…\n若长时间没有变化，可以重新加载或关闭其他浏览器标签。');
      text.style.whiteSpace = 'pre-line';
      const retry = document.createElement('button'); retry.textContent = '重新加载';
      retry.style.cssText = 'margin-top:20px;padding:12px 24px;font:inherit';
      retry.onclick = () => location.reload(); actions.append(retry);
    }, 180000);
    return engineEntry;
  }
  function url(name) { return new URL(name, base).href; }
  function notify() { metrics.downloadStates = states; statusCallback?.(JSON.stringify(states)); }
  function state(name, status, ratio=0) { states[name]={status,ratio}; notify(); }
  function cancelled(signal) { if(signal?.aborted) throw new DOMException('用户取消下载','AbortError'); }
  async function available(entry) {
    if(memoryCache.has(entry.file))return true;
    const cache=await openCache();
    return !!(cache && await storage(()=>cache.match(url(entry.file))));
  }
  async function refreshStates() {
    const m=await manifest();
    await Promise.all(Object.entries(m.animals).map(async ([name,entry])=>{
      const found=await pageAvailable(entry);
      if(states[name]?.status!=='downloading')state(name,found?'downloaded':'unloaded',found?1:0);
    }));
  }
  function manifest() {
    if (manifestPromise) return manifestPromise;
    // The build embeds its matching manifest: no extra serial request or
    // mixed old/new release while GitHub Pages caches are being refreshed.
    if(window.BoboEmbeddedManifest?.version===version)return manifestPromise=Promise.resolve(window.BoboEmbeddedManifest);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),45000);
    return manifestPromise ||= nativeFetch(url('web-manifest.json') + '?v=' + version, {cache:'no-cache',signal:controller.signal})
      .then(r => { if (!r.ok) throw Error('资源目录无法连接（HTTP ' + r.status + '）'); return r.json(); })
      .catch(e => { manifestPromise = null; throw e; }).finally(() => clearTimeout(timeout));
  }
  function report(name, done, total, title) {
    if (metrics.startupError) return;
    if(resourceOwner?.mode==='single'){
      progress.set(name,{done,total});
      let d=0,t=0;for(const p of progress.values()){d+=p.done;t+=p.total;}
      state(resourceOwner.name,'downloading',t?d/t:0);
      if(metrics.page?.state==='catalog')return;
    }
    if(resourceOwner?.entry.file===name) {
      const owner=resourceOwner; state(owner.name,'downloading',total?done/total:0);
      owner.update?.(done);
      if(owner.mode==='all' || metrics.page?.state==='catalog')return;
    }
    progress.set(name, {done, total});
    let d = 0, t = 0; for (const p of progress.values()) { d += p.done; t += p.total; }
    const mb = n => (n / 1048576).toFixed(1);
    if (actions.childElementCount) return; // Another parallel download must not overwrite an error dialog.
    text.textContent = title + '\n' + mb(d) + ' / ' + mb(t) + ' MB · ' + (t ? Math.floor(d / t * 100) : 0) + '%';
    bar.value = t ? Math.floor(d / t * 100) : 0;
    text.style.whiteSpace = 'pre-line';
    if (t && d === t) text.textContent += '\n下载完成，正在校验资源…';
  }
  async function compressedResponse(entry, title, signal, quiet=false) {
    cancelled(signal);
    const address = url(entry.file);
    let response;
    // Read the verified in-memory result before waiting on any disk write.
    if(memoryCache.has(entry.file))response=new Response(memoryCache.get(entry.file));
    const cache=response?null:await openCache();
    if(!response && cache)response=await storage(()=>cache.match(address));
    if (response) { cancelled(signal);metrics.cacheHits++; if(!quiet)report(entry.file, entry.bytes, entry.bytes, title); return response; }
    const controller = new AbortController();
    const abort=()=>controller.abort(); signal?.addEventListener('abort',abort,{once:true});
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
        if(!quiet)report(entry.file, received, entry.bytes, title);
      }
      if (received !== entry.bytes) throw Error('资源下载不完整，请重试');
      const blob = new Blob(chunks, {type:entry.mime||'application/gzip'});
      const bytes = await blob.arrayBuffer();
      if(!quiet)phase('verify');
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2,'0')).join('');
      if (digest !== entry.sha256) throw Error('资源校验失败，请重试');
      cancelled(signal);
      metrics.downloadedBytes += received;
      response = new Response(blob, {headers:{'Content-Type':entry.mime||'application/gzip'}});
      // Disk persistence must not hold up decoding/engine initialization.
      memoryCache.set(entry.file,blob);
      if(cache){const write=storage(async()=>{await cache.put(address,response.clone());return true;}).then(ok=>{if(ok)memoryCache.delete(entry.file);}).finally(()=>pendingWrites.delete(address));pendingWrites.set(address,write);}
      cancelled(signal);
      return response;
    } finally { clearTimeout(timer);signal?.removeEventListener('abort',abort); }
  }
  async function decoded(entry, type, title, signal) {
    const response = await compressedResponse(entry, title, signal);
    phase('decode');
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
  function startResources() {
    // Both Godot startup fetches share one retry flow. Separate dialogs would
    // strand one promise if WASM and PCK fail together on an unstable network.
    startupPromise ||= retryable(async () => {
      const m = await manifest();
      progress.clear();
      const selectedEngine = engineEntry || m.engine;
      for (const entry of [selectedEngine, m.core]) progress.set(entry.file, {done:0,total:entry.bytes});
      const title=metrics.engineVariant==='compat-no-simd' ? '正在打开绘本，旧设备兼容模式，仅加载封面和目录…' : '正在打开绘本，仅加载封面和目录…'; show(title);
      const [wasm,pck]=await Promise.all([decoded(selectedEngine,'application/wasm',title),decoded(m.core,'application/octet-stream',title)]);
      phase('compile');
      return {'index.wasm':wasm,'index.pck':pck};
    }, '打开绘本失败').catch(error=>{startupPromise=null;throw error;});
    // The glue can fail while prefetch is active; keep its promise handled.
    startupPromise.catch(()=>{});
    return startupPromise;
  }
  window.fetch = async (input, options) => {
    const address = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const name = address.pathname.slice(base.pathname.length);
    if (address.origin !== base.origin || !address.pathname.startsWith(base.pathname) || !['index.wasm','index.pck'].includes(name)) return nativeFetch(input, options);
    startResources();
    const responses=await startupPromise;
    const response=responses[name];
    delete responses[name]; // Do not keep an unread tee branch holding a full decompressed WASM/PCK.
    if(response) return response;
    const m=await manifest();
    return decoded(name==='index.wasm'?(engineEntry || m.engine):m.core,name==='index.wasm'?'application/wasm':'application/octet-stream','正在打开绘本…');
  };
  window.BOBOWeb = {
    metrics,
    prepareEngine,
    fail,
    phase,
    get lowEndMode(){return !!metrics.lowEndMode;},
    qaEnabled: new URLSearchParams(location.search).get('qa') === '1',
    installProbe(callback) { this.probeCallback = callback; },
    probeData(json) { metrics.probe = JSON.parse(json); },
    attach(instance) { engine = instance; },
    ready() { clearTimeout(startupTimer); delete metrics.startupError; metrics.firstScreenReady = true; metrics.phases.push({stage:'ready',ms:Math.round(performance.now())}); hide(); refreshStates().catch(console.error); prepareMusic().catch(error=>{metrics.audioError=error.message;console.warn('BOBO_MUSIC_PENDING',error.message);}); console.info('BOBO_FIRST_SCREEN_READY', version, metrics.engineVariant, metrics.downloadedBytes); },
    pageReady(info) { metrics.page = info; console.info('BOBO_PAGE_READY', JSON.stringify(info)); },
    installStatusCallback(callback) {statusCallback=callback;notify();},
    refreshStates() {refreshStates().catch(console.error);},
    downloadAll() {
      if(allTask || inFlight.size)return;
      const task={controller:new AbortController()}; allTask=task;
      metrics.allDownloadCompleted=false;
      const ui=window.BoboDownloadUI;
      const signal=task.controller.signal;
      let waitingReject;
      const cancel=()=>{task.controller.abort();waitingReject?.(new DOMException('用户取消下载','AbortError'));ui.close();};
      ui.begin(cancel);
      (async()=>{
        const m=await manifest();cancelled(signal);
        const entries=Object.entries(m.animals),total=entries.reduce((sum,[,e])=>sum+resources(e).reduce((n,r)=>n+r.bytes,0),0);
        let count=0,done=0;
        // Count actual cached files first, not visited pages or localStorage flags.
        const pending=[];
        for(const [name,entry] of entries){
          cancelled(signal);
          if(await pageAvailable(entry)){done+=resources(entry).reduce((n,r)=>n+r.bytes,0);count++;state(name,'downloaded',1);}
          else pending.push([name,entry]);
        }
        ui.progress(done/total,count,entries.length,'');
        for(const [name,entry] of pending){
          cancelled(signal);
          const size=resources(entry).reduce((n,r)=>n+r.bytes,0);
          let partDone=0;
          for(;;){
            state(name,'downloading',0);
            resourceOwner={mode:'all',name,entry,update:n=>ui.progress((done+partDone+n)/total,count,entries.length,name)};
            ui.progress(done/total,count,entries.length,name);
            try{
              partDone=0;
              for(const asset of resources(entry)){
                resourceOwner.entry=asset;
                await compressedResponse(asset,'正在下载全课程',signal);
                partDone+=asset.bytes;
              }
              break;
            }
            catch(error){
              if(signal.aborted)throw error;
              await new Promise((resolve,reject)=>{waitingReject=reject;ui.error(error.name==='AbortError'?'连接暂时中断，可以继续下载。':error.message,resolve);}).finally(()=>waitingReject=null);
              cancelled(signal);
            }
          }
          done+=size;count++;state(name,'downloaded',1);ui.progress(done/total,count,entries.length,name);
        }
        cancelled(signal);metrics.allDownloadCompleted=true;ui.success();
      })().catch(error=>{
        if(!signal.aborted){console.error(error);ui.close();}
      }).finally(async()=>{
        if(allTask===task){allTask=null;resourceOwner=null;await refreshStates().catch(console.error);}
      });
    },
    loadAnimal(name, callback) {
      if(allTask){callback(false,'');return;}
      if (mounted.has(name) && (!window.BoboNativeAudio || BoboNativeAudio.hasVoice(name))) { callback(true, mounted.get(name)); return; }
      if (inFlight.has(name)) { inFlight.get(name).then(path => callback(true,path), () => callback(false,'')); return; }
      const promise = retryable(async () => {
        const m = await manifest(); const entry = m.animals[name];
        if (!entry) throw Error('没有对应的动物资源');
        resourceOwner={mode:'single',name,entry};state(name,'downloading',0);
        progress.clear(); for(const asset of resources(entry))progress.set(asset.file, {done:0,total:asset.bytes});
        if(metrics.page?.state!=='catalog')show('正在翻到' + name + '这一页…');
        let path=mounted.get(name);
        if(!path){
          const response = await decoded(entry, 'application/octet-stream', '正在翻到' + name + '这一页…');
          const buffer = new Uint8Array(await response.arrayBuffer());
          if (buffer.byteLength !== entry.rawBytes) throw Error('解压后的资源不完整');
          path = '/bobo-' + entry.id + '.pck';
          engine.copyToFS(path, buffer);
        }else report(entry.file,entry.bytes,entry.bytes,'正在准备这一页的朗读…');
        await prepareVoice(name,entry);
        mounted.set(name, path); metrics.animals.push(name);
        state(name,'downloaded',1);
        console.info('BOBO_ANIMAL_DOWNLOADED', name, entry.bytes);
        return path;
      }, '这一页未能加载');
      inFlight.set(name, promise);
      promise.then(path => { hide(); callback(true,path); }, error => { console.error(error); hide(); callback(false,''); }).finally(() => {inFlight.delete(name);resourceOwner=null;refreshStates().catch(console.error);});
    },
  };
})();
