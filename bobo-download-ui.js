/* Download overlay only. Gameplay remains in Godot; no account/save additions. */
(() => {
  const base = new URL('.', document.currentScript.src || location.href);
  const root = document.createElement('div');
  root.id = 'bobo-course-overlay'; root.hidden = true;
  root.innerHTML = `<section class="bobo-download-paper" role="dialog" aria-modal="true" aria-labelledby="bobo-download-title">
    <div class="bobo-download-kicker">BOBO 家 / 把小世界装进绘本</div>
    <h2 id="bobo-download-title">正在下载全课程</h2>
    <p class="bobo-download-message">动物朋友正在赶来…</p>
    <div class="bobo-progress-scene"><div class="bobo-mini-elephant" role="img" aria-label="向右奔跑的小象"></div>
      <div class="bobo-course-track" role="progressbar" aria-label="全课程下载进度" aria-valuemin="0" aria-valuemax="100"><div class="bobo-course-fill"></div></div>
    </div>
    <div class="bobo-progress-numbers"><strong>0%</strong><span>已完成 0 / 20</span></div>
    <p class="bobo-download-detail">完整下载后，下次打开会优先使用浏览器缓存。</p>
    <div class="bobo-download-actions"><button class="bobo-retry" hidden>继续下载</button><button class="bobo-cancel">取消下载</button></div>
  </section>
  <section class="bobo-download-success" role="dialog" aria-modal="true" aria-labelledby="bobo-success-title" hidden>
    <img class="bobo-family" alt="小象、小熊、狐狸和熊猫相伴在一起" />
    <h2 id="bobo-success-title">下载成功</h2><p>请开始学习吧</p><button class="bobo-ack">我知道啦！</button>
  </section>`;
  document.body.append(root);
  const find = s => root.querySelector(s), paper=find('.bobo-download-paper'), success=find('.bobo-download-success');
  find('.bobo-family').src = new URL('download-family-v1.webp',base);
  const sprite=find('.bobo-mini-elephant'); sprite.style.backgroundImage=`url("${new URL('download-elephant-v3.webp',base)}")`;
  let frame=0, previousFocus, handlers={}, ticker;
  const positions=['0% 0%','50% 0%','100% 0%','0% 100%','50% 100%','100% 100%'];
  function stop() {clearInterval(ticker);ticker=null;sprite.classList.remove('running');}
  function start() {stop(); sprite.classList.add('running');ticker=setInterval(()=>{frame=(frame+1)%6;sprite.style.backgroundPosition=positions[frame];},135);}
  function open() { if(root.hidden) previousFocus=document.activeElement; root.hidden=false; }
  function close() {stop();root.hidden=true;previousFocus?.focus?.();handlers={};}
  find('.bobo-cancel').onclick=()=>handlers.cancel?.();
  find('.bobo-retry').onclick=()=>handlers.retry?.();
  find('.bobo-ack').onclick=close;
  // The mask owns input while open; keyboard cannot flip underlying book pages.
  document.addEventListener('keydown',event=>{
    if(root.hidden)return;
    if(event.key==='Tab') {
      const buttons=[...root.querySelectorAll('button')].filter(b=>!b.hidden && !b.closest('[hidden]'));
      const i=buttons.indexOf(document.activeElement);
      buttons[(i+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();
    } else if(event.key==='Escape') {if(!success.hidden)close();else handlers.cancel?.();}
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  window.BoboDownloadUI={
    begin(cancel) {open();paper.hidden=false;success.hidden=true;handlers={cancel};find('.bobo-retry').hidden=true;find('.bobo-download-message').textContent='动物朋友正在赶来…';start();find('.bobo-cancel').focus();},
    progress(ratio,count,total,name) {
      const pct=Math.min(100,Math.floor(ratio*100));
      find('.bobo-course-track').setAttribute('aria-valuenow',pct);
      find('.bobo-course-fill').style.width=pct+'%';
      // Frame drawings are never warped; only the mascot's position changes.
      sprite.style.left=`calc(${pct}% - ${pct/100*104}px)`;
      find('.bobo-progress-numbers strong').textContent=pct+'%';
      find('.bobo-progress-numbers span').textContent=`已完成 ${count} / ${total}`;
      find('.bobo-download-message').textContent=name ? `正在下载：${name}` : '正在检查已下载的资源…';
    },
    error(message,retry) {stop();find('.bobo-download-message').textContent=message;find('.bobo-retry').hidden=false;handlers.retry=()=>{find('.bobo-retry').hidden=true;start();retry();};find('.bobo-retry').focus();},
    success() {stop();open();paper.hidden=true;success.hidden=false;handlers={};find('.bobo-ack').focus();},
    close,
  };
})();
