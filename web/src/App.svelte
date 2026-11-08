<script>
  import { onMount } from 'svelte';
  import Sidebar from './components/Sidebar.svelte';
  import Topbar from './components/Topbar.svelte';
  import Toasts from './components/Toasts.svelte';
  import ConfirmHost from './components/ConfirmHost.svelte';
  import TaskDrawer from './components/TaskDrawer.svelte';
  import TaskCreateModal from './components/TaskCreateModal.svelte';
  import ProjectModal from './components/ProjectModal.svelte';
  import Auth from './pages/Auth.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Projects from './pages/Projects.svelte';
  import Project from './pages/Project.svelte';
  import MyTasks from './pages/MyTasks.svelte';
  import Settings from './pages/Settings.svelte';
  import { auth, bootstrapAuth, ui, bus, refreshProjects } from './lib/state.svelte.js';
  import { route, matchRoute, navigate, startRouter, getParam, closeTask } from './lib/router.svelte.js';

  const page = $derived(matchRoute(route.path));
  const taskId = $derived(Number(getParam('task')) || null);
  const isAuthPage = $derived(page.name === 'login' || page.name === 'register');

  onMount(async () => {
    startRouter();
    await bootstrapAuth();
  });

  // Route guards
  $effect(() => {
    if (!auth.ready) return;
    if (!auth.user && !isAuthPage) navigate('/login', { replace: true });
    else if (auth.user && isAuthPage) navigate('/', { replace: true });
  });

  // Keep the sidebar's project list fresh whenever something changes.
  $effect(() => {
    bus.v;
    if (auth.user) refreshProjects();
  });

  const titles = { dashboard: 'Dashboard', projects: 'Projects', tasks: 'My tasks', settings: 'Settings', login: 'Sign in', register: 'Create account', notfound: 'Not found' };
  $effect(() => {
    document.title = `${titles[page.name] ?? 'Project'} | Orbit`;
  });
</script>

{#if !auth.ready}
  <div class="boot" aria-label="Loading"><div class="skeleton" style="width:44px;height:44px;border-radius:50%"></div></div>
{:else if !auth.user}
  {#if isAuthPage}<Auth mode={page.name} />{/if}
{:else}
  <div class="shell">
    <Sidebar />
    <div class="main">
      <Topbar />
      {#if page.name === 'dashboard'}<Dashboard />
      {:else if page.name === 'projects'}<Projects />
      {:else if page.name === 'tasks'}<MyTasks />
      {:else if page.name === 'settings'}<Settings />
      {:else if page.name === 'project'}
        {#key page.id}<Project id={page.id} tab={page.tab} />{/key}
      {:else if !isAuthPage}
        <div class="page"><div class="card"><div class="empty"><h3>Page not found</h3><p>That address doesn't match anything in Orbit.</p><a class="btn btn-primary" href="/">Go to the dashboard</a></div></div></div>
      {/if}
    </div>
  </div>

  {#if taskId}{#key taskId}<TaskDrawer id={taskId} onclose={closeTask} />{/key}{/if}
  {#if ui.newTask}<TaskCreateModal {...ui.newTask} onclose={() => (ui.newTask = null)} />{/if}
  {#if ui.newProject}<ProjectModal onclose={() => (ui.newProject = false)} />{/if}
{/if}

<ConfirmHost />
<Toasts />

<style>
  .shell { display: flex; min-height: 100vh; }
  .main { flex: 1; min-width: 0; }
  .boot { display: grid; place-items: center; min-height: 100vh; }
</style>
