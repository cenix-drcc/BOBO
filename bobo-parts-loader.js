/* GitHub browser upload limits require byte-identical runtime chunks.
 * This is transport packaging, NOT encryption or asset protection. */
(() => {
  const originalFetch = window.fetch.bind(window);
  const base = new URL('.', document.currentScript.src);
  let manifest;
  window.fetch = async function(input, options) {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const name = url.pathname.slice(base.pathname.length);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || !['index.pck', 'index.wasm'].includes(name)) {
      return originalFetch(input, options);
    }
    manifest ||= originalFetch(new URL('web-manifest.json', base)).then(async r => {
      if (!r.ok) throw new Error('资源清单加载失败，请刷新重试。');
      return r.json();
    });
    const entry = (await manifest)[name];
    const bytes = new Uint8Array(entry.size);
    let offset = 0;
    for (const part of entry.parts) {
      const response = await originalFetch(new URL(part, base), options);
      if (!response.ok) throw new Error(`资源加载失败：${part} (${response.status})`);
      const chunk = new Uint8Array(await response.arrayBuffer());
      bytes.set(chunk, offset);
      offset += chunk.length;
      const notice = document.getElementById('status-notice');
      if (notice) { notice.style.display='block'; notice.textContent='正在加载绘本，首次打开请稍候…'; }
    }
    if (offset !== entry.size) throw new Error('资源不完整，请刷新重试。');
    return new Response(bytes, {headers:{'Content-Type':name.endsWith('.wasm')?'application/wasm':'application/octet-stream','Content-Length':String(entry.size)}});
  };
})();
