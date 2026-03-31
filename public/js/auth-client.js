(function () {
  function getAuthToken() {
    return localStorage.getItem('authToken') || '';
  }

  function setAuthToken(token) {
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  const nativeFetch = window.fetch.bind(window);

  window.getAuthToken = getAuthToken;
  window.setAuthToken = setAuthToken;
  window.clearAuthToken = function clearAuthToken() {
    setAuthToken('');
  };

  window.fetch = function patchedFetch(input, init = {}) {
    const headers = new Headers(init.headers || {});
    const token = getAuthToken();
    const url = typeof input === 'string' ? input : input.url;
    const isSameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);

    if (token && isSameOrigin && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return nativeFetch(input, { ...init, headers });
  };

  if (document.body.classList.contains('dashboard-page') && !getAuthToken()) {
    window.location.replace('/login.html');
  }
})();
