/* Long audio is scheduled by the browser, never supplied by Godot's frame loop.
 * Original user MP3s are unchanged. Only the current voice buffer is retained.
 */
(() => {
  'use strict';
  let context, musicBuffer, voiceBuffer, musicSource, voiceSource;
  let musicWanted = false, voiceWanted = false, voicePaused = false, voiceFinished = false;
  let voiceName = '', offset = 0, started = 0, generation = 0, musicGain = .3;
  let musicNode, voiceNode;
  const metrics = {backend:'browser-buffer', voiceName:'', voiceBuffers:0, musicBuffers:0};
  function init() {
    if (context) return context;
    const Type = window.AudioContext || window.webkitAudioContext;
    if (!Type) throw Error('此浏览器不支持声音播放，请使用系统 Safari。');
    try {context = new Type({sampleRate:32000,latencyHint:'playback'});} catch (_) {context = new Type();}
    metrics.sampleRate=context.sampleRate;
    musicNode = context.createGain(); musicNode.gain.value = musicGain; musicNode.connect(context.destination);
    voiceNode = context.createGain(); voiceNode.gain.value = Math.pow(10,-3/20); voiceNode.connect(context.destination);
    return context;
  }
  function haltVoice() {
    if (!voiceSource) return;
    const source=voiceSource; voiceSource=null; source.onended=null;
    try {source.stop();} catch (_) {} source.disconnect();
  }
  function runVoice() {
    if (!voiceWanted || voicePaused || !voiceBuffer || voiceSource) return;
    init();
    if (offset >= voiceBuffer.duration) offset=0;
    const source=context.createBufferSource(); source.buffer=voiceBuffer; source.connect(voiceNode);
    voiceSource=source; started=context.currentTime;
    source.onended=()=>{
      if (voiceSource !== source) return;
      voiceSource=null; source.disconnect(); offset=0;
      voiceWanted=false; voicePaused=false; voiceFinished=true;
    };
    source.start(0,offset);
  }
  function runMusic() {
    if (!musicWanted || !musicBuffer || musicSource) return;
    init(); const source=context.createBufferSource(); source.buffer=musicBuffer;
    source.loop=true; source.connect(musicNode); source.start(); musicSource=source;
    metrics.musicStartedAt=context.currentTime;
  }
  function unlock() {
    if (!context) return;
    context.resume().catch(()=>{}); runMusic(); runVoice();
  }
  // iOS requires a gesture. Do not claim automatic audible playback before it.
  for (const type of ['pointerdown','touchend','keydown']) document.addEventListener(type,unlock,{capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)unlock();});
  window.BoboNativeAudio = {
    metrics,
    async prepareMusic(bytes) {
      init(); musicBuffer=await context.decodeAudioData(bytes); metrics.musicBuffers=1; runMusic();
    },
    async prepareVoice(name,bytes) {
      if (name===voiceName && voiceBuffer) return;
      const ticket=++generation; init();
      const buffer=await context.decodeAudioData(bytes);
      if(ticket!==generation)return;
      haltVoice(); voiceWanted=false; voicePaused=false; voiceFinished=false; offset=0;
      voiceBuffer=buffer; voiceName=name; metrics.voiceName=name; metrics.voiceBuffers=1;
    },
    hasVoice(name) {return name===voiceName && !!voiceBuffer;},
    playVoice(name) {
      if(name!==voiceName || !voiceBuffer)return false;
      haltVoice(); offset=0; voiceWanted=true; voicePaused=false; voiceFinished=false;
      unlock(); return true;
    },
    setVoicePaused(paused) {
      if(voicePaused===paused)return;
      if(paused && voiceSource) offset=Math.min(voiceBuffer.duration,offset+context.currentTime-started);
      voicePaused=paused; if(paused)haltVoice();else runVoice();
    },
    stopVoice() {haltVoice();offset=0;voiceWanted=false;voicePaused=false;voiceFinished=false;},
    isVoiceFinished() {return voiceFinished;},
    playMusic() {musicWanted=true; init(); unlock();return true;},
    stopMusic() {musicWanted=false;if(musicSource){musicSource.stop();musicSource.disconnect();musicSource=null;}},
    setMusicGain(value) {
      musicGain=Math.max(0,Math.min(1,value)); if(!context)return;
      const now=context.currentTime; const gain=musicNode.gain;
      gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value,now); gain.linearRampToValueAtTime(musicGain,now+.08);
    },
    status() {
      return {backend:metrics.backend,context:context?.state||'uninitialized',
        voice:{name:voiceName,playing:!!voiceSource,paused:voicePaused,finished:voiceFinished,
          position:offset+(voiceSource?context.currentTime-started:0),seconds:voiceBuffer?.duration||0},
        music:{playing:!!musicSource,position:musicSource?(context.currentTime-metrics.musicStartedAt)%musicBuffer.duration:0,gain:musicGain},
        buffers:{voice:metrics.voiceBuffers,music:metrics.musicBuffers}};
    },
  };
})();
