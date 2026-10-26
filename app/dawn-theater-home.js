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
  const tabs = Array.from(document.querySelectorAll('[data-feed]'));
  function selectFeed(key) {
    const copy = feedCopy[key];
    if (!copy) return;
    tabs.forEach((tab) => { const active = tab.dataset.feed === key; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    $('#feed-panel').setAttribute('aria-labelledby', 'tab-' + key);
    $('#stage-label').textContent = copy.label;
    $('#stage-title').replaceChildren(...copy.title.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    $('#stage-description').replaceChildren(...copy.description.split('\n').flatMap((line, index) => index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
    $('.chapter').textContent = copy.chapter;
    const indicator = document.createElement('i');
    $('.stage-footer span').replaceChildren(indicator, document.createTextNode(' ' + copy.footer));
    $('#section-title').textContent = copy.section;
    $('#section-description').textContent = copy.detail;
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
    ['home', 'theater', 'mine'].forEach((name) => { $('#' + name + '-view').hidden = name !== view; });
    document.querySelectorAll('.bottom-nav button').forEach((button) => {
      const active = button.dataset.view === view; button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { showView(button.dataset.view); location.hash = button.dataset.view; }));
  document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-category]').forEach((item) => { const active = item === button; item.classList.toggle('selected', active); item.setAttribute('aria-pressed', String(active)); });
    $('#collection-title').textContent = { all: '第一部作品，準備中', comic: '漫劇作品，準備中', live: '真人劇作品，準備中' }[button.dataset.category];
  }));
  window.addEventListener('hashchange', () => showView(location.hash.slice(1)));
  showView(location.hash.slice(1));
  $('#stage-action').addEventListener('click', () => { location.href = 'aivault-digital-human.html?avatar=dawn-male'; });
  const dialog = $('#search-dialog');
  $('#open-search').addEventListener('click', () => { dialog.showModal(); $('#search-input').focus(); });
  $('#close-search').addEventListener('click', () => dialog.close());
  $('#search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#search-input').value.trim();
    $('#search-result').textContent = query ? '目前沒有符合「' + query + '」的作品。片庫尚在籌備中，作品上架後即可搜尋。' : '請輸入劇名或題材；目前片庫尚在籌備中。';
  });
  if (window.AIVAULT_AUTH_READY) window.AIVAULT_AUTH_READY.then((client) => {
    if (!client || !window.AIVAULT_USER) return;
    const user = window.AIVAULT_USER;
    $('#account-name').textContent = user.user_metadata?.display_name || user.user_metadata?.full_name || 'AIVAULT 使用者';
  });
})();
