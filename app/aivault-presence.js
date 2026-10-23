/* AIVAULT 在線心跳 v2（協作城真人人物）。只送「目前所在工坊代號」；名稱由資料庫依帳號產生，不含 email。
   關閉：localStorage.presenceOff='1'。不改動頁面任何行為；失敗一律靜默。 */
(function () {
  try { if (localStorage.getItem('presenceOff') === '1' || window.__avPresence) return; window.__avPresence = 1; } catch (_) { return; }
  var URL_ = 'https://svtkpdmqemidlasowqew.supabase.co', KEY = 'sb-svtkpdmqemidlasowqew-auth-token';
  var ANON = 'sb_publishable_ijiUkIvCMv-44aDAWx0t3A_iX1Viscf';
  /* af6：送出目前功能頁的代號（檔名去掉 aivault- 與 .html，只留 a-z0-9，16 字內）；協作城依首頁按鈕的連結對應到工坊。首頁本身＝逛街 */
  function slug(p) { p = String(p || '').split(/[?#]/)[0].split('/').pop().replace(/\.html?$/i, '').replace(/^aivault-/, ''); return p.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16); }
  function ws() { var s = slug(location.pathname); if (!s || /^(home|homeoriginaldark|index|login|town)$/.test(s)) return ''; return s; }
  function sess() { try { var j = JSON.parse(localStorage.getItem(KEY) || 'null'); return j && (j.currentSession || j); } catch (_) { return null; } }
  function beat() {
    if (document.hidden) return; var s = sess(); if (!s || !s.access_token || (s.expires_at && s.expires_at * 1000 < Date.now())) return;
    fetch(URL_ + '/rest/v1/aivault_presence?on_conflict=user_id', { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ workshop: ws() }) }).catch(function () {});
  }
  setTimeout(beat, 1500); setInterval(beat, 45000); document.addEventListener('visibilitychange', function () { if (!document.hidden) beat(); });
})();
