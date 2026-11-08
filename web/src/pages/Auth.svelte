<script>
  import { signIn, signUp } from '../lib/state.svelte.js';
  import { navigate } from '../lib/router.svelte.js';
  import SegBar from '../components/SegBar.svelte';
  import HealthPill from '../components/HealthPill.svelte';
  import { focusOnMount } from '../lib/utils.js';

  let { mode = 'login' } = $props();
  const isLogin = $derived(mode === 'login');

  let name = $state('');
  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state('');
  const showDemo = import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO === 'true';

  async function submit(e, creds) {
    e?.preventDefault();
    error = '';
    busy = true;
    try {
      if (creds) await signIn(creds.email, creds.password);
      else if (isLogin) await signIn(email, password);
      else await signUp(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      error = err.message;
    }
    busy = false;
  }

  // A glimpse of the product: the same segmented bar used on the dashboard.
  const sample = [
    { name: 'Website relaunch', color: '#0b8f7e', counts: { done: 7, in_review: 2, in_progress: 3, todo: 4, backlog: 3 }, health: 'at_risk', reason: '' },
    { name: 'Mobile app 2.0', color: '#3d86c6', counts: { done: 3, in_review: 1, in_progress: 3, todo: 4, backlog: 3 }, health: 'on_track', reason: '' },
    { name: 'Spring campaign', color: '#8a63d2', counts: { done: 4, in_review: 1, in_progress: 3, todo: 4, backlog: 1 }, health: 'off_track', reason: '' },
  ];
</script>

<div class="auth">
  <aside class="brand">
    <div class="logo">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="9.5" fill="none" stroke="#fff" stroke-width="3" /><circle cx="25.2" cy="8.6" r="4.2" fill="#3fd3bd" /></svg>
      Orbit
    </div>
    <div class="pitch">
      <h2>See what's slipping before it slips.</h2>
      <p>Boards, timelines and workload in one place, with project health worked out from your real deadlines.</p>
      <div class="peek" aria-hidden="true">
        {#each sample as p (p.name)}
          <div class="prow">
            <span class="pn"><i style="background:{p.color}"></i>{p.name}</span>
            <SegBar counts={p.counts} height={9} />
            <HealthPill health={p.health} />
          </div>
        {/each}
      </div>
    </div>
    <p class="fine">Orbit is a project manager for small teams.</p>
  </aside>

  <main class="panel">
    <form class="form" onsubmit={submit}>
      <h1>{isLogin ? 'Sign in to Orbit' : 'Create your account'}</h1>
      <p class="sub">{isLogin ? 'Welcome back. Pick up where your team left off.' : 'It takes a minute. No credit card, no setup.'}</p>

      {#if error}<div class="form-error" role="alert">{error}</div>{/if}

      {#if !isLogin}
        <div class="field"><label for="a-name">Your name</label>
          <input id="a-name" class="input" bind:value={name} autocomplete="name" required maxlength="80" use:focusOnMount /></div>
      {/if}
      <div class="field"><label for="a-email">Email</label>
        <input id="a-email" class="input" type="email" bind:value={email} autocomplete="email" required use:focusOnMount={isLogin} /></div>
      <div class="field"><label for="a-pass">Password</label>
        <input id="a-pass" class="input" type="password" bind:value={password} required minlength={isLogin ? 1 : 8}
          autocomplete={isLogin ? 'current-password' : 'new-password'} />
        {#if !isLogin}<span class="hint">Use at least 8 characters.</span>{/if}</div>

      <button class="btn btn-primary big" disabled={busy}>{busy ? 'One moment...' : isLogin ? 'Sign in' : 'Create account'}</button>

      {#if isLogin && showDemo}
        <button type="button" class="btn big" disabled={busy} onclick={() => submit(null, { email: 'demo@orbit.app', password: 'demo1234' })}>Explore with the demo account</button>
      {/if}

      <p class="swap">
        {#if isLogin}New to Orbit? <a href="/register">Create an account</a>{:else}Already have an account? <a href="/login">Sign in</a>{/if}
      </p>
    </form>
  </main>
</div>

<style>
  .auth { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); min-height: 100vh; }
  .brand { display: flex; flex-direction: column; padding: 36px 56px; background: var(--side); color: #fff; }
  .logo { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .pitch { margin: auto 0; max-width: 520px; }
  h2 { font-size: 40px; line-height: 1.1; letter-spacing: -0.03em; font-weight: 700; text-wrap: balance; }
  .pitch > p { margin: 16px 0 32px; color: var(--side-text); font-size: 16px; line-height: 1.55; max-width: 44ch; }
  .peek { display: grid; gap: 4px; padding: 10px 18px; border-radius: 14px; background: var(--side-2); border: 1px solid var(--side-3); }
  .prow { display: grid; grid-template-columns: 148px 1fr auto; align-items: center; gap: 14px; padding: 11px 0; }
  .prow + .prow { border-top: 1px solid var(--side-3); }
  .pn { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13.5px; white-space: nowrap; }
  .pn i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
  .peek :global(.seg) { background: rgba(255, 255, 255, 0.1); }
  .fine { color: #6f8a9b; font-size: 13px; }

  .panel { display: grid; place-items: center; padding: 32px 24px; background: var(--surface); }
  .form { display: grid; gap: 16px; width: min(380px, 100%); }
  h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
  .sub { color: var(--text-2); margin-top: -8px; margin-bottom: 4px; }
  .big { height: 42px; font-size: 14px; }
  .swap { text-align: center; color: var(--text-2); margin-top: 4px; }
  .swap a { color: var(--brand-600); font-weight: 700; }
  .swap a:hover { text-decoration: underline; }

  @media (max-width: 900px) {
    .auth { grid-template-columns: 1fr; }
    .brand { display: none; }
    .panel { min-height: 100vh; }
  }
</style>
