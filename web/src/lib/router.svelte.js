// A tiny History API router. Plain <a href="/projects/1"> links just work (clicks are intercepted).
export const route = $state({ path: location.pathname, search: location.search });

function sync() {
  route.path = location.pathname;
  route.search = location.search;
}

export function navigate(to, { replace = false } = {}) {
  if (to === location.pathname + location.search) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  sync();
}

export const getParam = (key) => new URLSearchParams(route.search).get(key);

export function setParam(key, value, { replace = false } = {}) {
  const p = new URLSearchParams(location.search);
  if (value == null) p.delete(key);
  else p.set(key, String(value));
  const qs = p.toString();
  navigate(location.pathname + (qs ? `?${qs}` : ''), { replace });
}

export const openTask = (id) => setParam('task', id);
export const closeTask = () => setParam('task', null, { replace: true });

export function startRouter() {
  window.addEventListener('popstate', sync);
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
    e.preventDefault();
    navigate(a.pathname + a.search + a.hash);
  });
}

/** Maps a pathname to a page name plus params. */
export function matchRoute(path) {
  const clean = path.replace(/\/+$/, '') || '/';
  if (clean === '/') return { name: 'dashboard' };
  if (clean === '/login') return { name: 'login' };
  if (clean === '/register') return { name: 'register' };
  if (clean === '/projects') return { name: 'projects' };
  if (clean === '/tasks') return { name: 'tasks' };
  if (clean === '/settings') return { name: 'settings' };
  const m = clean.match(/^\/projects\/(\d+)(?:\/(board|list|timeline|overview|team))?$/);
  if (m) return { name: 'project', id: Number(m[1]), tab: m[2] || 'board' };
  return { name: 'notfound' };
}
