// Минимальный клиентский роутер на History API. Каждый маршрут — это
// {pattern, mount(container, params, query)}, где pattern — путь вида
// "/students/:id/edit". mount() может вернуть функцию очистки (unmount),
// которая вызывается перед монтированием следующей страницы.

function compilePattern(pattern) {
  const paramNames = [];
  const regexSource = pattern
    .split('/')
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith(':')) {
        paramNames.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return { regex: new RegExp(`^/${regexSource}/?$`), paramNames };
}

export function createRouter(routes, container, { afterRender } = {}) {
  const compiled = routes.map((route) => ({ ...route, ...compilePattern(route.pattern) }));
  let currentCleanup = null;
  let notFoundHandler = null;

  function match(path) {
    for (const route of compiled) {
      const result = route.regex.exec(path);
      if (!result) continue;
      const params = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(result[index + 1]);
      });
      return { route, params };
    }
    return null;
  }

  async function render() {
    const url = new URL(window.location.href);
    const path = url.pathname;
    const query = Object.fromEntries(url.searchParams.entries());

    if (typeof currentCleanup === 'function') {
      currentCleanup();
      currentCleanup = null;
    }
    container.replaceChildren();

    const matched = match(path);
    if (!matched) {
      if (notFoundHandler) currentCleanup = notFoundHandler(container) || null;
      if (afterRender) afterRender();
      return;
    }

    currentCleanup = (await matched.route.mount(container, matched.params, query)) || null;
    if (afterRender) afterRender();
  }

  function navigate(path, { replace = false } = {}) {
    if (replace) {
      window.history.replaceState(null, '', path);
    } else {
      window.history.pushState(null, '', path);
    }
    render();
  }

  function onClick(event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest('a');
    if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (!anchor.hasAttribute('href') || anchor.getAttribute('href').startsWith('#')) return;

    event.preventDefault();
    navigate(url.pathname + url.search);
  }

  function start() {
    window.addEventListener('popstate', render);
    document.addEventListener('click', onClick);
    return render();
  }

  function stop() {
    window.removeEventListener('popstate', render);
    document.removeEventListener('click', onClick);
  }

  function notFound(handler) {
    notFoundHandler = handler;
  }

  return { start, stop, navigate, notFound, match };
}
