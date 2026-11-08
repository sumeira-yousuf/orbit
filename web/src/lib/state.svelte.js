import { api, setToken, getToken, onUnauthorized } from './api.js';
import { todayStr } from './utils.js';

/* ───────────── Auth ───────────── */
export const auth = $state({ user: null, ready: false });

export async function bootstrapAuth() {
  if (getToken()) {
    try {
      auth.user = (await api.get('/auth/me')).user;
    } catch {
      setToken(null);
    }
  }
  auth.ready = true;
}

export async function signIn(email, password) {
  const res = await api.post('/auth/login', { email, password });
  setToken(res.token);
  auth.user = res.user;
}

export async function signUp(name, email, password) {
  const res = await api.post('/auth/register', { name, email, password });
  setToken(res.token);
  auth.user = res.user;
}

export function signOut() {
  setToken(null);
  auth.user = null;
  projectsState.list = [];
  projectsState.loaded = false;
}

onUnauthorized(() => {
  if (auth.user) {
    signOut();
    toast('Your session expired. Sign in again.', 'error');
  }
});

/* ───────────── Change signal ─────────────
   Any component that mutates data calls bump(); pages that read bus.v reload their data. */
export const bus = $state({ v: 0 });
export const bump = () => { bus.v += 1; };

/* ───────────── Projects (sidebar + task creation need these everywhere) ───────────── */
export const projectsState = $state({ list: [], loaded: false });

export async function refreshProjects() {
  try {
    projectsState.list = (await api.get(`/projects?today=${todayStr()}`)).projects;
  } catch { /* the page that needs them shows its own error */ }
  projectsState.loaded = true;
}

/* ───────────── Toasts ───────────── */
export const toasts = $state([]);
let toastId = 0;
export function toast(message, type = 'ok') {
  const id = ++toastId;
  toasts.push({ id, message, type });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i >= 0) toasts.splice(i, 1);
  }, type === 'error' ? 6000 : 3200);
}

/* ───────────── Confirm dialog ───────────── */
export const confirmState = $state({ open: false, title: '', message: '', confirmLabel: 'Confirm', danger: false, resolve: null });
export function confirmDialog({ title, message = '', confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    Object.assign(confirmState, { open: true, title, message, confirmLabel, danger, resolve });
  });
}

/* ───────────── Modals opened from anywhere ───────────── */
export const ui = $state({ newTask: null, newProject: false, menuOpen: false });
export const openNewTask = (opts = {}) => { ui.newTask = opts; };
