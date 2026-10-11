export function createLoadingUI({onCancel,onRetry}){
 const panel=document.createElement('section');panel.id='map-loading';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','载入地图');
 panel.style.cssText='position:fixed;inset:0;z-index:70;background:#173f43ed;display:none;align-items:center;justify-content:center;padding:24px;color:#fff8e8';
 const box=document.createElement('div');box.style.cssText='max-width:420px;width:100%;text-align:center;font-size:15px;line-height:1.7';
 box.innerHTML='<h2 style="font-size:28px">准备行动</h2><p id="map-loading-status" aria-live="polite"></p><button id="map-loading-retry" class="primary" style="display:none;margin:12px">重试</button><button id="map-loading-cancel" class="secondary" style="margin:12px">返回大厅</button>';
 panel.appendChild(box);document.body.appendChild(panel);box.querySelector('#map-loading-cancel').onclick=onCancel;box.querySelector('#map-loading-retry').onclick=onRetry;
 return {show(name){panel.style.display='flex';box.querySelector('h2').textContent=name;box.querySelector('p').textContent='解压当前地图 · 不需要联网';box.querySelector('#map-loading-retry').style.display='none';},stage(text){box.querySelector('p').textContent=text;},hide(){panel.style.display='none';},error(message){box.querySelector('p').textContent='载入失败：'+message;box.querySelector('#map-loading-retry').style.display='inline-block';}};
}
