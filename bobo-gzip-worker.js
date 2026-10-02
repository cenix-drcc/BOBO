/* Old browser gzip fallback. MIT fflate is bundled locally, never fetched from a CDN. */
importScripts('fflate-0.8.3.js');
self.onmessage = event => {
  try {
    const bytes = fflate.gunzipSync(new Uint8Array(event.data));
    self.postMessage({bytes:bytes.buffer},[bytes.buffer]);
  } catch (error) { self.postMessage({error:String(error)}); }
};
