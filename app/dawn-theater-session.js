/* Optional account recognition for the public theater; never redirects guests. */
(function () {
  'use strict';
  window.AIVAULT_USER = null;
  function publishUser(user) {
    window.AIVAULT_USER = user && !user.is_anonymous ? user : null;
    document.documentElement.classList.toggle('av-authed', !!window.AIVAULT_USER);
    window.dispatchEvent(new CustomEvent('dawn-account-change', { detail: window.AIVAULT_USER }));
  }
  window.AIVAULT_AUTH_READY = (async function () {
    try {
      const config = window.AIVAULT_AUTH_CONFIG;
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/+esm');
      const client = createClient(config.url, config.key);
      window.AIVAULT_AUTH_CLIENT = client;
      client.auth.onAuthStateChange(function (event, session) {
        // Display identity only. Protected pages and backend authorization remain separate.
        publishUser(session && session.user);
      });
      const session = await client.auth.getSession();
      if (!session.error && session.data.session) {
        const result = await client.auth.getUser();
        publishUser(result.error ? null : result.data.user);
      }
      return client;
    } catch (_) {
      publishUser(null);
      return null;
    }
  })();
})();
