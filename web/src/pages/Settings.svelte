<script>
  import Avatar from '../components/Avatar.svelte';
  import { api } from '../lib/api.js';
  import { auth, toast } from '../lib/state.svelte.js';
  import { PROJECT_COLORS } from '../lib/utils.js';

  let name = $state(auth.user.name);
  let title = $state(auth.user.title ?? '');
  let color = $state(auth.user.color);
  let saving = $state(false);
  let profileError = $state('');

  let current = $state('');
  let next = $state('');
  let pwBusy = $state(false);
  let pwError = $state('');

  async function saveProfile(e) {
    e.preventDefault();
    profileError = '';
    saving = true;
    try {
      auth.user = (await api.patch('/auth/me', { name, title: title.trim() || null, color })).user;
      toast('Profile saved');
    } catch (err) { profileError = err.message; }
    saving = false;
  }

  async function changePassword(e) {
    e.preventDefault();
    pwError = '';
    pwBusy = true;
    try {
      await api.post('/auth/me/password', { current, next });
      current = '';
      next = '';
      toast('Password changed');
    } catch (err) { pwError = err.message; }
    pwBusy = false;
  }
</script>

<div class="page">
  <div class="page-head"><div><h1>Settings</h1><p class="sub">Your profile and sign-in details.</p></div></div>

  <div class="cols">
    <form class="card" onsubmit={saveProfile}>
      <div class="card-head"><h3>Profile</h3></div>
      <div class="card-body stack">
        <div class="who"><Avatar name={name || '?'} {color} size={56} />
          <div><b>{auth.user.email}</b><p class="muted">Your email is your sign-in and can't be changed here.</p></div></div>
        {#if profileError}<div class="form-error" role="alert">{profileError}</div>{/if}
        <div class="field"><label for="sname">Name</label><input id="sname" class="input" bind:value={name} maxlength="80" required /></div>
        <div class="field"><label for="stitle">Job title</label><input id="stitle" class="input" bind:value={title} maxlength="80" placeholder="Product manager" /></div>
        <div class="field"><span class="label">Avatar color</span>
          <div class="swatches" role="radiogroup" aria-label="Avatar color">
            {#each PROJECT_COLORS as c (c)}
              <button type="button" class="sw" class:on={color === c} style="background:{c}" role="radio" aria-checked={color === c} aria-label={c} onclick={() => (color = c)}></button>
            {/each}
          </div>
        </div>
        <div><button class="btn btn-primary" disabled={saving || !name.trim()}>Save profile</button></div>
      </div>
    </form>

    <form class="card" onsubmit={changePassword}>
      <div class="card-head"><h3>Password</h3></div>
      <div class="card-body stack">
        {#if pwError}<div class="form-error" role="alert">{pwError}</div>{/if}
        <div class="field"><label for="cur">Current password</label><input id="cur" class="input" type="password" autocomplete="current-password" bind:value={current} required /></div>
        <div class="field"><label for="new">New password</label><input id="new" class="input" type="password" autocomplete="new-password" bind:value={next} minlength="8" required />
          <span class="hint">Use at least 8 characters.</span></div>
        <div><button class="btn btn-primary" disabled={pwBusy || !current || next.length < 8}>Change password</button></div>
      </div>
    </form>
  </div>
</div>

<style>
  .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; max-width: 980px; align-items: start; }
  h3 { font-size: 14px; font-weight: 700; }
  .who { display: flex; align-items: center; gap: 14px; }
  .who p { font-size: 12.5px; }
  .swatches { display: flex; gap: 8px; flex-wrap: wrap; }
  .sw { width: 26px; height: 26px; border-radius: 8px; border: 0; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12); }
  .sw.on { outline: 2px solid var(--text); outline-offset: 2px; }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
</style>
