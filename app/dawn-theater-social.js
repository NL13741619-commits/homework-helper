(function () {
 'use strict';
 const $=s=>document.querySelector(s);
 const video=$('#home-video');
 const endpoint='https://svtkpdmqemidlasowqew.supabase.co/functions/v1/dawn-theater-api';
 const movie={id:'big-buck-bunny',title:'Big Buck Bunny',subtitle:'大雄兔',poster:'assets/theater/big-buck-bunny-poster.jpg',duration:596.48};
 let savingProgress=false;
 let accountLoaded=false, stateQueue=Promise.resolve();
 let user=null, profile=null, state=null, commentLikes=new Set(), publicData={comments:[],total:0,saved:0,liked:0};
 let tab='history', filter='all', kind='all', editing=false, selected=new Set(), reply=null, image=null, lastSaved=0, resumePending=false, accountEpoch=0, loadPromise;
 const cleanTime=n=>Math.floor(n/60).toString().padStart(2,'0')+':'+Math.floor(n%60).toString().padStart(2,'0');
 function toast(message){$('#theater-toast').textContent=message;$('#theater-toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{$('#theater-toast').hidden=true;},4000);}
 function loginUrl(){const url=new URL('../index.html',location.href);url.searchParams.set('auth','1');url.searchParams.set('next',new URL('aivault-home.html#mine',location.href).href);return url.href;}
 function showSheet(id){$(id).showModal();if(id==='#comments-sheet')document.body.classList.add('comments-open');}
 function needLogin(){if(user)return true;showSheet('#login-sheet');return false;}
 async function api(input){
  if(!user)throw Error('請先登入');
  const session=await window.AIVAULT_AUTH_CLIENT?.auth.getSession();
  const token=session?.data?.session?.access_token;if(!token)throw Error('登入已過期，請重新登入');
  const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(input),signal:AbortSignal.timeout(20000)});
  const result=await response.json();if(!response.ok)throw Error(response.status===401?'請重新登入':response.status===429?'操作太頻繁，請稍後再試':'暫時無法儲存，請稍後重試');return result;
 }
 function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
 function updateButtons(){
  $('#save-video').setAttribute('aria-pressed',String(!!state?.saved));$('#like-video').setAttribute('aria-pressed',String(!!state?.liked));
  $('#saved-count').textContent=String(publicData.saved);$('#liked-count').textContent=String(publicData.liked);$('#comment-count').textContent=String(publicData.total);
 }
 async function loadPublic(){
  try{const r=await fetch(endpoint,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();publicData=await r.json();updateButtons();if($('#comments-sheet').open)renderComments();}
  catch{$('#comments-load-state').textContent='留言暫時無法載入，請點重新整理。';}
 }
 async function accountChanged(){
  const epoch=++accountEpoch;accountLoaded=false;user=window.AIVAULT_USER;profile=null;state=null;commentLikes=new Set();lastSaved=0;resumePending=false;
  updateButtons();renderMine();if($('#comments-sheet').open)renderComments();
  if(!user)return;
  try{const result=await api({action:'account'});if(epoch!==accountEpoch)return;profile=result.profile;state=result.state.find(v=>v.video_id===movie.id)||null;commentLikes=new Set(result.commentLikes);resumePending=!!state?.watched_at&&!state.completed;accountLoaded=true;renderMine();updateButtons();if($('#comments-sheet').open)renderComments();}
  catch(error){toast(error.message);}
 }
 function patchState(patch){const epoch=accountEpoch;stateQueue=stateQueue.catch(()=>{}).then(async()=>{if(epoch!==accountEpoch)return;const result=await api({action:'state',...patch});if(epoch!==accountEpoch)return;state=result.state;renderMine();updateButtons();});return stateQueue;}
 async function toggleState(field,button){if(!needLogin())return;button.disabled=true;try{await patchState({[field]:!state?.[field]});await loadPublic();}catch(error){toast(error.message);}finally{button.disabled=false;}}
 $('#save-video').addEventListener('click',()=>toggleState('saved',$('#save-video')));
 $('#like-video').addEventListener('click',()=>toggleState('liked',$('#like-video')));
 $('#share-video').addEventListener('click',async()=>{
  const url=new URL('aivault-home.html',location.href).href;
  try{if(navigator.share)await navigator.share({title:movie.title,text:'在曙光劇場看《大雄兔》',url});else{await navigator.clipboard.writeText(url);toast('影片連結已複製');}}
  catch(error){if(error.name==='AbortError')return;$('#share-url').value=url;showSheet('#share-sheet');}
 });
 $('#open-comments').addEventListener('click',()=>{showSheet('#comments-sheet');renderComments();loadPublic();});
 document.querySelectorAll('[data-close-sheet]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
 document.querySelectorAll('[data-login-link]').forEach(a=>{a.href=loginUrl();});
 $('#comments-sheet').addEventListener('close',()=>document.body.classList.remove('comments-open'));
 $('#comments-refresh').addEventListener('click',loadPublic);
 function renderComments(){
  $('#comments-total').textContent=publicData.total+' 則留言';$('#comments-load-state').textContent=publicData.total>100?'顯示最新 100 則留言':'';
  $('#comment-login-hint').hidden=!!user;$('#comment-submit').disabled=!user;
  const list=$('#comments-list');list.replaceChildren();
  if(!publicData.comments.length){list.append(element('p','social-empty','還沒有留言，來聊聊這個故事吧。'));return;}
  const byParent=new Map();const ids=new Set(publicData.comments.map(c=>c.id));
  for(const c of publicData.comments){const parent=c.parent_id&&ids.has(c.parent_id)?c.parent_id:null;if(!byParent.has(parent))byParent.set(parent,[]);byParent.get(parent).push(c);}
  function card(c,depth=0){
   const row=element('article','comment-row');const avatar=element('span','comment-avatar',(c.display_name||'劇友').slice(0,1));const content=element('div','comment-content');
   content.append(element('strong','comment-author',c.display_name),element('p','comment-body',c.body));
   if(c.image_url){const img=element('img','comment-image');img.src=c.image_url;img.alt='留言附圖';img.loading='lazy';content.append(img);}
   const meta=element('div','comment-meta');meta.append(element('time','',new Date(c.created_at).toLocaleDateString('zh-TW')));
   const replyBtn=element('button','','回覆');replyBtn.type='button';replyBtn.onclick=()=>{if(!needLogin())return;reply=c;$('#reply-to').textContent='回覆 '+c.display_name+' ×';$('#reply-to').hidden=false;$('#comment-body').focus();};meta.append(replyBtn);content.append(meta);
   const like=element('button','comment-like', (commentLikes.has(c.id)?'♥':'♡')+' '+c.likes);like.type='button';like.setAttribute('aria-label','喜歡這則留言');like.setAttribute('aria-pressed',String(commentLikes.has(c.id)));
   like.onclick=async()=>{if(!needLogin())return;like.disabled=true;try{const liked=!commentLikes.has(c.id);await api({action:'commentLike',commentId:c.id,liked});if(liked)commentLikes.add(c.id);else commentLikes.delete(c.id);await loadPublic();}catch(e){toast(e.message);}finally{like.disabled=false;}};
   row.append(avatar,content,like);
   const children=byParent.get(c.id)||[];
   if(children.length&&depth<4){const details=element('details','comment-replies');details.append(element('summary','','展開 '+children.length+' 則回覆'));for(const child of children)details.append(card(child,depth+1));content.append(details);}
   return row;
  }
  for(const c of byParent.get(null)||[])list.append(card(c));
 }
 $('#reply-to').onclick=()=>{reply=null;$('#reply-to').hidden=true;};
 $('#comment-emoji').onclick=()=>{$('#emoji-picker').hidden=!$('#emoji-picker').hidden;};
 for(const emoji of ['😊','❤️','👏','😂','🤔','🔥','🥰','👍']){const b=element('button','',emoji);b.type='button';b.onclick=()=>{$('#comment-body').value+=emoji;$('#emoji-picker').hidden=true;$('#comment-body').focus();};$('#emoji-picker').append(b);}
 $('#comment-picture').onclick=()=>{if(needLogin())$('#comment-image-input').click();};
 $('#comment-image-input').onchange=async event=>{
  const file=event.target.files[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){toast('請選擇 10MB 以下的 JPG、PNG 或 WebP 圖片');return;}
  const url=URL.createObjectURL(file);
  try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(1,640/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);image=canvas.toDataURL('image/jpeg',.75);if(image.length>1300000)throw Error();$('#comment-image-preview').src=image;$('#comment-image-wrap').hidden=false;}
  catch{toast('圖片無法處理，請換一張');}finally{URL.revokeObjectURL(url);event.target.value='';}
 };
 $('#remove-comment-image').onclick=()=>{image=null;$('#comment-image-wrap').hidden=true;};
 $('#comment-form').onsubmit=async event=>{
  event.preventDefault();if(!needLogin())return;const body=$('#comment-body').value.trim();if(!body&&!image)return;
  $('#comment-submit').disabled=true;
  try{await api({action:'comment',body,parentId:reply?.id,image});$('#comment-body').value='';reply=null;image=null;$('#reply-to').hidden=true;$('#comment-image-wrap').hidden=true;await loadPublic();toast('留言已發布');}
  catch(error){toast(error.message);}finally{$('#comment-submit').disabled=!user;}
 };
 async function saveProgress(force=false){
  if(!user||!accountLoaded||video.currentTime<1||savingProgress)return;if(!force&&Date.now()-lastSaved<15000)return;lastSaved=Date.now();savingProgress=true;
  try{await patchState({position:Math.min(movie.duration,video.currentTime)});}catch{lastSaved=Date.now();$('#history-note').textContent='觀看紀錄暫未同步，連線恢復後會再試。';}finally{savingProgress=false;}
 }
 video.addEventListener('timeupdate',()=>saveProgress());video.addEventListener('pause',()=>saveProgress(true));video.addEventListener('ended',()=>saveProgress(true));
 function resume(){if(resumePending&&video.readyState>=1){resumePending=false;video.currentTime=Math.min(state.position_seconds,movie.duration-1);}}
 video.addEventListener('loadedmetadata',resume);
 $('#resume-history').onclick=()=>{resumePending=true;resume();location.hash='home';toast('已回到上次觀看位置');};
 function renderMine(){
  $('#profile-name').textContent=user?(profile?.display_name||user.user_metadata?.display_name||user.user_metadata?.full_name||'曙光劇友'):'未註冊';
  $('#profile-bio').textContent=user?(profile?.bio||'介紹一下自己吧'):'訪客模式 · 登入後保存紀錄';
  $('#profile-avatar').textContent=user?$('#profile-name').textContent.slice(0,1):'☀';
  $('#mine-login').hidden=!!user;$('#history-login').hidden=!!user;$('#history-toolbar').hidden=!user;$('#resume-history').hidden=!user||!state?.watched_at||state.completed;
  $('#history-note').textContent=user?'觀看進度、收藏與喜歡會隨帳號保存。':'登入後可查看觀看歷史、收藏與喜歡。';
  const grid=$('#mine-grid');grid.replaceChildren();if(!user)return;
  const query=$('#history-search').value.trim().toLowerCase();
  let visible=tab==='history'?!!state?.watched_at:tab==='saved'?!!state?.saved:tab==='liked'?!!state?.liked:false;
  if(tab==='history'&&filter==='completed'&&!state?.completed)visible=false;
  if(tab==='history'&&filter==='unfinished'&&state?.completed)visible=false;
  if(kind==='live')visible=false;
  if(query&&!('big buck bunny 大雄兔 動畫 喜劇'.includes(query)))visible=false;
  if(!visible){grid.append(element('p','social-empty',tab==='works'?'你還沒有發布作品。':'這裡還沒有作品。'));$('#delete-history').hidden=true;return;}
  const card=element('article','mine-movie');const button=element('button','movie-open');button.type='button';
  const img=element('img');img.src=movie.poster;img.alt=movie.title;const badge=element('span','movie-badge','動畫');button.append(img,badge);
  button.onclick=()=>{if(editing){if(selected.has(movie.id))selected.delete(movie.id);else selected.add(movie.id);renderMine();return;}resumePending=!!state?.watched_at;resume();location.hash='home';};
  if(editing){const mark=element('span','selection-mark',selected.has(movie.id)?'✓':'○');button.append(mark);}
  card.append(button,element('strong','',movie.title));
  card.append(element('small','',tab==='history'?(state.completed?'已看完':'觀看至 '+Math.floor(state.position_seconds/movie.duration*100)+'%'):'公開授權測試動畫'));
  grid.append(card);$('#delete-history').hidden=!editing||!selected.size;
 }
 document.querySelectorAll('[data-mine-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.mineTab;editing=false;selected.clear();$('#history-edit').textContent='編輯';document.querySelectorAll('[data-mine-tab]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-selected',String(x===b));});$('#history-filters').hidden=tab!=='history';$('#history-edit').hidden=tab!=='history';renderMine();});
 document.querySelectorAll('[data-history-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.historyFilter;document.querySelectorAll('[data-history-filter]').forEach(x=>x.classList.toggle('selected',x===b));renderMine();});
 $('#history-search').oninput=renderMine;$('#history-search-toggle').onclick=()=>{$('#history-search').hidden=!$('#history-search').hidden;if(!$('#history-search').hidden)$('#history-search').focus();};
 $('#history-edit').onclick=()=>{editing=!editing;selected.clear();$('#history-edit').textContent=editing?'完成':'編輯';renderMine();};
 $('#delete-history').onclick=async()=>{try{await patchState({clearHistory:true});editing=false;selected.clear();$('#history-edit').textContent='編輯';renderMine();toast('已移除觀看紀錄');}catch(e){toast(e.message);}};
 $('#history-filter').onclick=()=>showSheet('#filter-sheet');
 $('#history-kind').onchange=()=>{kind=$('#history-kind').value;renderMine();};
 $('#profile-edit').onclick=()=>{if(!needLogin())return;$('#edit-name').value=profile?.display_name||$('#profile-name').textContent;$('#edit-bio').value=profile?.bio||'';showSheet('#profile-sheet');};
 async function saveProfile(overrides){const result=await api({action:'profile',displayName:profile?.display_name||$('#profile-name').textContent,bio:profile?.bio||'',genres:profile?.preferences?.genres||[],...overrides});profile=result.profile;renderMine();}
 $('#profile-form').onsubmit=async e=>{e.preventDefault();if(!needLogin())return;try{await saveProfile({displayName:$('#edit-name').value,bio:$('#edit-bio').value});$('#profile-sheet').close();toast('個人資料已保存');}catch(error){toast(error.message);}};
 $('#open-preferences').onclick=()=>{if(!needLogin())return;document.querySelectorAll('[name=genre]').forEach(c=>c.checked=profile?.preferences?.genres?.includes(c.value)||false);showSheet('#preferences-sheet');};
 $('#preferences-form').onsubmit=async e=>{e.preventDefault();try{await saveProfile({genres:[...document.querySelectorAll('[name=genre]:checked')].map(v=>v.value)});$('#preferences-sheet').close();toast('看劇偏好已保存');}catch(error){toast(error.message);}};
 $('#open-settings').onclick=()=>showSheet('#settings-sheet');$('#open-help').onclick=()=>showSheet('#help-sheet');$('#open-download').onclick=()=>showSheet('#download-sheet');
 let light=true;try{light=localStorage.getItem('dawn-theater-theme')!=='dark';}catch{}
 function applyTheme(){document.body.classList.toggle('theater-light',light);$('#theme-toggle').textContent=light?'☾':'☀';$('#theme-toggle').setAttribute('aria-label',light?'切換深色模式':'切換亮色模式');$('#settings-theme').textContent=light?'目前：亮色模式':'目前：深色模式';}
 function toggleTheme(){light=!light;try{localStorage.setItem('dawn-theater-theme',light?'light':'dark');}catch{}applyTheme();}
 $('#theme-toggle').onclick=toggleTheme;$('#settings-theme').onclick=toggleTheme;applyTheme();
 $('#logout-account').onclick=async()=>{if(!user){toast('目前為訪客模式');return;}try{const r=await window.AIVAULT_AUTH_CLIENT.auth.signOut();if(r.error)throw r.error;$('#settings-sheet').close();toast('已登出，仍可繼續觀看');}catch{toast('登出失敗，請重試');}};
 $('#feedback-form').onsubmit=async e=>{e.preventDefault();if(!needLogin())return;try{await api({action:'feedback',body:$('#feedback-body').value});$('#feedback-body').value='';toast('意見已保存，謝謝你的回饋');}catch(error){toast(error.message);}};
 $('#download-file').onclick=async()=>{
  const button=$('#download-file');button.disabled=true;$('#download-status').textContent='正在準備下載，影片約 249MB，請保持頁面開啟…';
  try{const response=await fetch(video.dataset.src,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error();const blob=await response.blob();const url=URL.createObjectURL(blob);const a=element('a');a.href=url;a.download='Big-Buck-Bunny-CC-BY-3.0.mp4';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);$('#download-status').textContent='已交給瀏覽器下載，請到系統下載項目查看。';}
  catch{$('#download-status').textContent='瀏覽器無法直接下載，請開啟原始影片後使用瀏覽器的儲存功能。';$('#download-original').hidden=false;}finally{button.disabled=false;}
 };
 $('#episode-list').onclick=()=>showSheet('#episodes-sheet');$('#episode-one').onclick=()=>{$('#episodes-sheet').close();location.hash='home';};
 $('#video-speed').onclick=()=>showSheet('#speed-sheet');document.querySelectorAll('[data-speed]').forEach(b=>b.onclick=()=>{video.playbackRate=Number(b.dataset.speed);$('#video-speed').textContent=b.dataset.speed+'×';$('#speed-sheet').close();});
 window.addEventListener('pagehide',()=>{ if(user&&accountLoaded&&video.currentTime>1) saveProgress(true); });
 $('#theater-toast').addEventListener('click',()=>$('#theater-toast').hidden=true);
 window.addEventListener('dawn-account-change',accountChanged);
 if(window.AIVAULT_AUTH_READY)loadPromise=window.AIVAULT_AUTH_READY.then(accountChanged);
 loadPublic();renderMine();
})();
