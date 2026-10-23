(function () {
  'use strict';
  const root = new URL('.', document.currentScript.src);
  const config = window.AIVAULT_AUTH_CONFIG;
  function login() {
    document.documentElement.classList.remove('av-authed');
    document.documentElement.style.visibility = 'hidden';
    const target = new URL('index.html', root);
    target.searchParams.set('next', location.pathname + location.search);
    location.replace(target.href);
  }
  window.AIVAULT_AUTH_READY = (async function () {
    try {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/+esm');
      const client = createClient(config.url, config.key);
      const { data, error } = await client.auth.getUser();
      if (error || !data.user || data.user.is_anonymous) { login(); return null; }
      window.AIVAULT_AUTH_CLIENT = client;
      window.AIVAULT_USER = data.user;
      document.documentElement.classList.add('av-authed');
      document.documentElement.style.visibility = '';
      client.auth.onAuthStateChange(function (event, session) {
        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) login();
      });
      window.addEventListener('pageshow', async function (event) {
        if (!event.persisted) return;
        document.documentElement.style.visibility = 'hidden';
        try {
          const result = await client.auth.getUser();
          if (result.error || !result.data.user) { login(); return; }
          document.documentElement.style.visibility = '';
        } catch (_) { login(); }
      });
      return client;
    } catch (_) { login(); return null; }
  })();
})();
