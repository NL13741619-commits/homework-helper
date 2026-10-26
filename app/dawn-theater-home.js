(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  if (window.DarkStarOrb) window.DarkStarOrb.mount($('#homeDawnOrb'), { size: 36, theme: 'dawn' });
  const feedCopy = {
    comic: { label: 'DAWN · COMIC THEATER', title: '讓想像，\n成為下一幕。', description: '曙光漫劇片庫籌備中\n第一部作品上架後，就能在這裡觀看。', chapter: '第一個故事，從這裡開始', footer: '漫劇準備中', section: '好故事，值得等待', detail: '從原創故事，到未來的授權小說漫劇。' },
    live: { label: 'DAWN · LIVE ACTION', title: '每個故事，\n都值得被看見。', description: '真人劇片庫籌備中\n取得授權並上架後，即可觀看。', chapter: '用鏡頭，記住每一次心動', footer: '真人劇準備中', section: '等待下一次開映', detail: '這裡將收錄正式上架的真人劇作品。' },
    recommended: { label: 'DAWN · FOR YOU', title: '下一個喜歡，\n在這裡相遇。', description: '目前尚無上架作品\n片庫建立後，這裡會呈現推薦內容。', chapter: '為好奇心，留一個位置', footer: '推薦內容準備中', section: '新的故事，即將相遇', detail: '推薦內容會隨正式上架作品逐步增加。' },
    following: { label: 'DAWN · FOLLOWING', title: '喜歡的創作，\n值得一直追。', description: '目前尚無可關注的創作者\n創作者與作品上架後，就能在這裡發現。', chapter: '與喜歡的故事，再靠近一點', footer: '關注內容準備中', section: '與創作者，一起期待', detail: '未來可在這裡追蹤創作者與作品更新。' }
  };
  const video = $('#home-video');
  video.defaultMuted = false;
  video.muted = false;
  video.volume = 1;
  video.controls = false;
  let authorized = false;
  let activeFeed = 'comic';
  let activeView = 'home';
  let userPaused = false;
  function updateLayout() { document.body.classList.toggle('immersive', activeView === 'home' && ['comic', 'recommended'].includes(activeFeed)); }
  function wantedVideo() { return authorized && activeView === 'home' && ['comic', 'recommended'].includes(activeFeed) && !document.hidden && !$('#search-dialog').open; }
  function syncVideo() {
    if (!wantedVideo()) { video.pause(); return; }
    if (!video.getAttribute('src')) video.src = video.dataset.src;
    if (!userPaused) video.play().catch(() => {
      $('#video-status').textContent = '瀏覽器需要你點一下，才能有聲播放。';
      $('#video-retry').textContent = '▶ 輕觸畫面有聲播放';
      $('#video-retry').hidden = false;
    });
  }
  video.addEventListener('playing', () => { $('#video-status').textContent = video.muted ? '已靜音 · 點「開聲播放」恢復聲音' : '播放中 · 聲音已開啟'; $('#video-retry').hidden = true; userPaused = false; });
  video.addEventListener('pause', () => { if (wantedVideo() && !video.ended) { userPaused = true; $('#video-status').textContent = '已暫停，輕觸畫面繼續。'; } });
  video.addEventListener('waiting', () => { $('#video-status').textContent = '影片緩衝中，請稍候…'; });
  video.addEventListener('error', () => { $('#video-status').textContent = '外部片源暫時無法載入，請重試。'; $('#video-retry').hidden = false; });
  video.addEventListener('ended', () => { $('#video-status').textContent = '本片已播放完畢，目前僅一部測試片。'; $('#video-retry').textContent = '重新播放'; $('#video-retry').hidden = false; userPaused = true; });
  video.addEventListener('volumechange', () => { if (!video.paused) $('#video-status').textContent = video.muted || video.volume === 0 ? '已靜音 · 點「開聲播放」恢復聲音' : '播放中 · 聲音已開啟'; });
  $('#video-sound').addEventListener('click', () => { video.muted = false; video.volume = 1; userPaused = false; syncVideo(); });
  $('#video-retry').addEventListener('click', () => { video.muted = false; video.volume = 1; if (video.error) video.load(); if (video.ended) video.currentTime = 0; userPaused = false; syncVideo(); });
  $('#video-fullscreen').addEventListener('click', () => {
    video.controls = true;
    try {
      const enter = video.requestFullscreen ? video.requestFullscreen() : video.webkitEnterFullscreen ? video.webkitEnterFullscreen() : null;
      if (!video.requestFullscreen && !video.webkitEnterFullscreen) { video.controls = false; $('#video-status').textContent = '此瀏覽器不支援全螢幕，可切換滿版裁切觀看。'; }
      if (enter && enter.catch) enter.catch(() => { video.controls = false; $('#video-status').textContent = '此瀏覽器目前無法進入全螢幕，可使用滿版裁切觀看。'; });
    } catch (_) { video.controls = false; $('#video-status').textContent = '目前無法進入全螢幕，可使用滿版裁切觀看。'; }
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) video.controls = false; });
  video.addEventListener('webkitendfullscreen', () => { video.controls = false; });
  function togglePlayback() {
    if (video.paused || video.ended) { if (video.ended) video.currentTime = 0; userPaused = false; syncVideo(); }
    else { userPaused = true; video.pause(); }
  }
  $('#video-toggle').addEventListener('click', togglePlayback);
  video.addEventListener('click', togglePlayback);
  function updatePlaybackButton() {
    const label = video.paused ? '播放' : '暫停';
    const small = document.createElement('small'); small.textContent = label;
    $('#video-toggle').replaceChildren(document.createTextNode(video.paused ? '▶' : 'Ⅱ'), small);
    $('#video-toggle').setAttribute('aria-label', label + '影片');
  }
  video.addEventListener('play', updatePlaybackButton);
  video.addEventListener('pause', updatePlaybackButton);
  $('#video-fit').addEventListener('click', () => {
    const cover = $('#video-feature').classList.toggle('is-cover');
    $('#video-fit').setAttribute('aria-pressed', String(cover));
    $('#video-fit small').textContent = cover ? '完整畫面' : '滿版裁切';
  });
  function clock(seconds) { if (!Number.isFinite(seconds)) return '00:00'; return Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + Math.floor(seconds % 60).toString().padStart(2, '0'); }
  function updateTime() {
    const duration = Number.isFinite(video.duration) ? video.duration : 596.48;
    $('#video-seek').max = String(duration);
    $('#video-seek').value = String(video.currentTime);
    $('#video-clock').textContent = clock(video.currentTime) + ' / ' + clock(duration);
    $('#video-seek').setAttribute('aria-valuetext', clock(video.currentTime) + '，共 ' + clock(duration));
  }
  video.addEventListener('timeupdate', updateTime);
  video.addEventListener('loadedmetadata', updateTime);
  $('#video-seek').addEventListener('input', () => { if (Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, Number($('#video-seek').value)); });
  document.addEventListener('visibilitychange', syncVideo);
  window.addEventListener('pagehide', () => video.pause());
  window.addEventListener('pageshow', syncVideo);
  const tabs = Array.from(document.querySelectorAll('[data-feed]'));
  function selectFeed(key) {
    const copy = feedCopy[key];
    if (!copy) return;
    activeFeed = key;
    updateLayout();
    const hasVideo = ['comic', 'recommended'].includes(key);
    $('#video-feature').hidden = !hasVideo;
    $('#stage').hidden = hasVideo;
    tabs.forEach((tab) => { const active = tab.dataset.feed === key; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    $('#feed-panel').setAttribute('aria-labelledby', 'tab-' + key);
    $('#stage-label').textContent = copy.label;
    $('#stage-title').replaceChildren(...copy.title.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    $('#stage-description').replaceChildren(...copy.description.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    $('.chapter').textContent = copy.chapter;
    const indicator = document.createElement('i');
    $('.stage-footer span').replaceChildren(indicator, document.createTextNode(' ' + copy.footer));
    $('#section-title').textContent = hasVideo ? '第一部測試動畫，開始播放' : copy.section;
    $('#section-description').textContent = hasVideo ? '先試看完整動畫，未來逐步增加原創與授權漫劇。' : copy.detail;
    syncVideo();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectFeed(tab.dataset.feed));
    tab.addEventListener('keydown', (event) => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault(); tabs[target].focus(); selectFeed(tabs[target].dataset.feed);
    });
  });
  function showView(view) {
    if (!['home', 'theater', 'mine'].includes(view)) view = 'home';
    activeView = view;
    updateLayout();
    ['home', 'theater', 'mine'].forEach((name) => { $('#' + name + '-view').hidden = name !== view; });
    document.querySelectorAll('.bottom-nav button').forEach((button) => {
      const active = button.dataset.view === view; button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    syncVideo();
  }
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { showView(button.dataset.view); location.hash = button.dataset.view; }));
  document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-category]').forEach((item) => { const active = item === button; item.classList.toggle('selected', active); item.setAttribute('aria-pressed', String(active)); });
    $('#sample-card').hidden = button.dataset.category === 'live';
    $('#collection-empty').hidden = button.dataset.category !== 'live';
    $('#collection-title').textContent = { all: '第一部作品，準備中', comic: '漫劇作品，準備中', live: '真人劇作品，準備中' }[button.dataset.category];
  }));
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  showView(location.hash.slice(1));
  $('#stage-action').addEventListener('click', () => { location.href = 'aivault-digital-human.html?avatar=dawn-male'; });
  const dialog = $('#search-dialog');
  $('#open-search').addEventListener('click', () => { dialog.showModal(); syncVideo(); $('#search-input').focus(); });
  dialog.addEventListener('close', syncVideo);
  $('#close-search').addEventListener('click', () => dialog.close());
  $('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#search-input').value.trim();
    const found = !query || /big|buck|bunny|大雄兔|兔|動畫|喜劇/i.test(query);
    $('#search-sample').hidden = !found;
    $('#search-result').textContent = found ? '找到 1 部公開授權測試動畫。' : '目前沒有符合「' + query + '」的作品。';
  });
  ['#sample-card', '#search-sample'].forEach((selector) => $(selector).addEventListener('click', () => { dialog.close(); selectFeed('comic'); showView('home'); userPaused = false; syncVideo(); }));
  if (window.AIVAULT_AUTH_READY) window.AIVAULT_AUTH_READY.then((client) => {
    if (!client) return;
    authorized = true;
    syncVideo();
    if (!window.AIVAULT_USER) return;
    const user = window.AIVAULT_USER;
    $('#account-name').textContent = user.user_metadata?.display_name || user.user_metadata?.full_name || 'AIVAULT 使用者';
  });
})();
