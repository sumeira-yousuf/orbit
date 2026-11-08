<script>
  import Avatar from '../components/Avatar.svelte';
  import Icon from '../components/Icon.svelte';
  import { api } from '../lib/api.js';
  import { auth, toast, confirmDialog } from '../lib/state.svelte.js';
  import { navigate } from '../lib/router.svelte.js';

  let { project, members, myRole, onchange } = $props();
  const isOwner = $derived(myRole === 'owner');

  let email = $state('');
  let role = $state('member');
  let busy = $state(false);
  let error = $state('');

  async function add(e) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const { member } = await api.post(`/projects/${project.id}/members`, { email, role });
      toast(`${member.name} joined the project`);
      email = '';
      onchange();
    } catch (err) { error = err.message; }
    busy = false;
  }

  async function setRole(m, next) {
    try { await api.patch(`/projects/${project.id}/members/${m.id}`, { role: next }); toast('Access updated'); }
    catch (err) { toast(err.message, 'error'); }
    onchange();
  }

  async function remove(m) {
    const self = m.id === auth.user.id;
    const ok = await confirmDialog({
      title: self ? `Leave ${project.name}?` : `Remove ${m.name}?`,
      message: self ? 'You will lose access to this project. The project owner can add you back.'
        : `${m.name} loses access to this project. Tasks assigned to them become unassigned.`,
      confirmLabel: self ? 'Leave project' : 'Remove', danger: true,
    });
    if (!ok) return;
    try {
      await api.del(`/projects/${project.id}/members/${m.id}`);
      toast(self ? 'You left the project' : `${m.name} was removed`);
      if (self) navigate('/projects');
      onchange();
    } catch (err) { toast(err.message, 'error'); }
  }
</script>

<div class="wrap">
  <div class="card">
    <div class="card-head"><h3>People on this project</h3><span class="sub">{members.length} {members.length === 1 ? 'member' : 'members'}</span></div>
    <ul class="list">
      {#each members as m (m.id)}
        <li>
          <Avatar name={m.name} color={m.color} size={36} />
          <div class="who grow">
            <b class="truncate">{m.name}{#if m.id === auth.user.id}<span class="muted you">(you)</span>{/if}</b>
            <span class="muted truncate">{m.title ? `${m.title}, ` : ''}{m.email}</span>
          </div>
          {#if m.role === 'owner'}
            <span class="pill plain" style="--c:var(--brand)">Owner</span>
          {:else if isOwner}
            <select class="select role" aria-label="Access for {m.name}" value={m.role} onchange={(e) => setRole(m, e.currentTarget.value)}>
              <option value="member">Can edit</option>
              <option value="viewer">View only</option>
            </select>
            <button class="btn btn-ghost btn-icon btn-sm" aria-label="Remove {m.name}" title="Remove" onclick={() => remove(m)}><Icon name="x" size={16} /></button>
          {:else}
            <span class="pill plain" style="--c:var(--text-3)">{m.role === 'member' ? 'Can edit' : 'View only'}</span>
            {#if m.id === auth.user.id}<button class="btn btn-sm" onclick={() => remove(m)}>Leave</button>{/if}
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  {#if isOwner}
    <div class="card add">
      <div class="card-head"><h3>Add someone</h3></div>
      <form class="card-body stack" onsubmit={add}>
        <p class="muted">They need an Orbit account first. Enter the email they signed up with.</p>
        {#if error}<div class="form-error" role="alert">{error}</div>{/if}
        <div class="field">
          <label for="memail">Email</label>
          <input id="memail" class="input" type="email" bind:value={email} placeholder="name@company.com" required />
        </div>
        <div class="field">
          <label for="mrole">Access</label>
          <select id="mrole" class="select" bind:value={role}>
            <option value="member">Can edit tasks</option>
            <option value="viewer">View only</option>
          </select>
        </div>
        <button class="btn btn-primary" disabled={busy || !email.trim()}>Add to project</button>
      </form>
    </div>
  {/if}
</div>

<style>
  .wrap { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; }
  h3 { font-size: 14px; font-weight: 700; }
  .list { padding: 8px 20px 12px; }
  .list li { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--surface-3); }
  .list li:last-child { border-bottom: 0; }
  .who { display: grid; line-height: 1.35; min-width: 0; }
  .who .muted { font-size: 12.5px; }
  .you { margin-left: 6px; font-weight: 500; }
  .role { width: 140px; height: 32px; }
  @media (max-width: 1000px) { .wrap { grid-template-columns: 1fr; } }
</style>
