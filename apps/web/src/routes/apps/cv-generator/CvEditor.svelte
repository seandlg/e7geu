<script lang="ts">
  import {
    createId,
    type CvDocument,
  } from './model';

  let { cv, onChange }: { cv: CvDocument; onChange: (document: CvDocument) => void } = $props();

  function edit(change: (draft: CvDocument) => void): void {
    const draft = structuredClone(cv);
    change(draft);
    onChange(draft);
  }

  function value(event: Event): string {
    return (event.currentTarget as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  function addExperience(): void {
    edit((draft) => draft.experience.push({
      id: createId('experience'), role: '', company: '', location: '', start: '', end: '', bullets: [''],
    }));
  }

  function addEducation(): void {
    edit((draft) => draft.education.push({
      id: createId('education'), qualification: '', institution: '', location: '', start: '', end: '', detail: '',
    }));
  }

  function addProject(): void {
    edit((draft) => draft.projects.push({ id: createId('project'), name: '', link: '', description: '' }));
  }

  function move<T>(items: T[], index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
  }
</script>

<div class="editor">
  <details open>
    <summary><span>Personal details</span><small>Name, contact and profile</small></summary>
    <div class="section-body grid-two">
      <label class="wide">Document name<input value={cv.title} oninput={(event) => edit((draft) => (draft.title = value(event)))} /></label>
      <label class="wide">Full name<input value={cv.basics.name} placeholder="Ada Lovelace" oninput={(event) => edit((draft) => (draft.basics.name = value(event)))} /></label>
      <label class="wide">Professional title<input value={cv.basics.headline} placeholder="Product designer" oninput={(event) => edit((draft) => (draft.basics.headline = value(event)))} /></label>
      <label>Email<input type="email" value={cv.basics.email} oninput={(event) => edit((draft) => (draft.basics.email = value(event)))} /></label>
      <label>Phone<input value={cv.basics.phone} oninput={(event) => edit((draft) => (draft.basics.phone = value(event)))} /></label>
      <label class="wide">Location<input value={cv.basics.location} placeholder="Berlin, Germany" oninput={(event) => edit((draft) => (draft.basics.location = value(event)))} /></label>
      <label class="wide">Profile<textarea rows="5" value={cv.basics.summary} placeholder="A concise introduction…" oninput={(event) => edit((draft) => (draft.basics.summary = value(event)))}></textarea></label>
      <div class="wide sub-list">
        <div class="sub-heading"><span>Links</span><button type="button" onclick={() => edit((draft) => draft.basics.links.push({ id: createId('link'), label: '', url: '' }))}>Add link</button></div>
        {#each cv.basics.links as link, index (link.id)}
          <div class="inline-row">
            <input aria-label="Link label" value={link.label} placeholder="Portfolio" oninput={(event) => edit((draft) => (draft.basics.links[index].label = value(event)))} />
            <input aria-label="Link URL" value={link.url} placeholder="example.com" oninput={(event) => edit((draft) => (draft.basics.links[index].url = value(event)))} />
            <button class="icon-button danger" type="button" aria-label="Remove link" onclick={() => edit((draft) => draft.basics.links.splice(index, 1))}>×</button>
          </div>
        {/each}
      </div>
    </div>
  </details>

  <details open={cv.experience.length > 0}>
    <summary><span>Experience</span><small>{cv.experience.length} {cv.experience.length === 1 ? 'role' : 'roles'}</small></summary>
    <div class="section-body">
      {#each cv.experience as item, index (item.id)}
        <div class="item-card">
          <div class="item-toolbar"><strong>{item.role || `Role ${index + 1}`}</strong><div><button type="button" aria-label="Move role up" disabled={index === 0} onclick={() => edit((draft) => move(draft.experience, index, -1))}>↑</button><button type="button" aria-label="Move role down" disabled={index === cv.experience.length - 1} onclick={() => edit((draft) => move(draft.experience, index, 1))}>↓</button><button class="danger" type="button" onclick={() => edit((draft) => draft.experience.splice(index, 1))}>Remove</button></div></div>
          <div class="grid-two">
            <label>Role<input value={item.role} oninput={(event) => edit((draft) => (draft.experience[index].role = value(event)))} /></label>
            <label>Company<input value={item.company} oninput={(event) => edit((draft) => (draft.experience[index].company = value(event)))} /></label>
            <label>Start<input value={item.start} placeholder="2022" oninput={(event) => edit((draft) => (draft.experience[index].start = value(event)))} /></label>
            <label>End<input value={item.end} placeholder="Present" oninput={(event) => edit((draft) => (draft.experience[index].end = value(event)))} /></label>
            <label class="wide">Location<input value={item.location} oninput={(event) => edit((draft) => (draft.experience[index].location = value(event)))} /></label>
          </div>
          <div class="sub-list">
            <div class="sub-heading"><span>Accomplishments</span><button type="button" onclick={() => edit((draft) => draft.experience[index].bullets.push(''))}>Add bullet</button></div>
            {#each item.bullets as bullet, bulletIndex}
              <div class="inline-row bullet-row"><textarea rows="2" aria-label={`Accomplishment ${bulletIndex + 1}`} value={bullet} oninput={(event) => edit((draft) => (draft.experience[index].bullets[bulletIndex] = value(event)))}></textarea><button class="icon-button danger" type="button" aria-label="Remove accomplishment" onclick={() => edit((draft) => draft.experience[index].bullets.splice(bulletIndex, 1))}>×</button></div>
            {/each}
          </div>
        </div>
      {/each}
      <button class="add-button" type="button" onclick={addExperience}>+ Add experience</button>
    </div>
  </details>

  <details open={cv.education.length > 0}>
    <summary><span>Education</span><small>{cv.education.length} entries</small></summary>
    <div class="section-body">
      {#each cv.education as item, index (item.id)}
        <div class="item-card">
          <div class="item-toolbar"><strong>{item.qualification || `Education ${index + 1}`}</strong><div><button type="button" disabled={index === 0} onclick={() => edit((draft) => move(draft.education, index, -1))}>↑</button><button type="button" disabled={index === cv.education.length - 1} onclick={() => edit((draft) => move(draft.education, index, 1))}>↓</button><button class="danger" type="button" onclick={() => edit((draft) => draft.education.splice(index, 1))}>Remove</button></div></div>
          <div class="grid-two">
            <label>Qualification<input value={item.qualification} oninput={(event) => edit((draft) => (draft.education[index].qualification = value(event)))} /></label>
            <label>Institution<input value={item.institution} oninput={(event) => edit((draft) => (draft.education[index].institution = value(event)))} /></label>
            <label>Start<input value={item.start} oninput={(event) => edit((draft) => (draft.education[index].start = value(event)))} /></label>
            <label>End<input value={item.end} oninput={(event) => edit((draft) => (draft.education[index].end = value(event)))} /></label>
            <label class="wide">Location<input value={item.location} oninput={(event) => edit((draft) => (draft.education[index].location = value(event)))} /></label>
            <label class="wide">Details<textarea rows="2" value={item.detail} oninput={(event) => edit((draft) => (draft.education[index].detail = value(event)))}></textarea></label>
          </div>
        </div>
      {/each}
      <button class="add-button" type="button" onclick={addEducation}>+ Add education</button>
    </div>
  </details>

  <details open={cv.skills.length > 0}>
    <summary><span>Skills</span><small>{cv.skills.length} skills</small></summary>
    <div class="section-body sub-list">
      {#each cv.skills as skill, index}
        <div class="inline-row"><input aria-label={`Skill ${index + 1}`} value={skill} oninput={(event) => edit((draft) => (draft.skills[index] = value(event)))} /><button class="icon-button danger" type="button" aria-label="Remove skill" onclick={() => edit((draft) => draft.skills.splice(index, 1))}>×</button></div>
      {/each}
      <button class="add-button" type="button" onclick={() => edit((draft) => draft.skills.push(''))}>+ Add skill</button>
    </div>
  </details>

  <details open={cv.projects.length > 0}>
    <summary><span>Projects</span><small>{cv.projects.length} projects</small></summary>
    <div class="section-body">
      {#each cv.projects as item, index (item.id)}
        <div class="item-card">
          <div class="item-toolbar"><strong>{item.name || `Project ${index + 1}`}</strong><div><button type="button" disabled={index === 0} onclick={() => edit((draft) => move(draft.projects, index, -1))}>↑</button><button type="button" disabled={index === cv.projects.length - 1} onclick={() => edit((draft) => move(draft.projects, index, 1))}>↓</button><button class="danger" type="button" onclick={() => edit((draft) => draft.projects.splice(index, 1))}>Remove</button></div></div>
          <label>Name<input value={item.name} oninput={(event) => edit((draft) => (draft.projects[index].name = value(event)))} /></label>
          <label>Link<input value={item.link} oninput={(event) => edit((draft) => (draft.projects[index].link = value(event)))} /></label>
          <label>Description<textarea rows="3" value={item.description} oninput={(event) => edit((draft) => (draft.projects[index].description = value(event)))}></textarea></label>
        </div>
      {/each}
      <button class="add-button" type="button" onclick={addProject}>+ Add project</button>
    </div>
  </details>

  <details open>
    <summary><span>Layout</span><small>Paper and appearance</small></summary>
    <div class="section-body grid-two">
      <label>Template<select value={cv.settings.template} onchange={(event) => edit((draft) => (draft.settings.template = value(event) as CvDocument['settings']['template']))}><option value="classic">Classic</option><option value="modern">Modern</option></select></label>
      <label>Paper<select value={cv.settings.paper} onchange={(event) => edit((draft) => (draft.settings.paper = value(event) as CvDocument['settings']['paper']))}><option value="a4">A4</option><option value="letter">US Letter</option></select></label>
      <label>Density<select value={cv.settings.density} onchange={(event) => edit((draft) => (draft.settings.density = value(event) as CvDocument['settings']['density']))}><option value="relaxed">Relaxed</option><option value="balanced">Balanced</option><option value="compact">Compact</option></select></label>
      <label>Accent<input type="color" value={cv.settings.accent} oninput={(event) => edit((draft) => (draft.settings.accent = value(event)))} /></label>
    </div>
  </details>
</div>

<style>
  .editor { display: grid; gap: 10px; padding: 14px; }
  details { overflow: hidden; border: 1px solid rgb(255 255 255 / 0.1); border-radius: 18px; background: rgb(255 255 255 / 0.055); }
  summary { display: grid; cursor: pointer; padding: 15px 17px; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  summary span { font-size: 0.92rem; font-weight: 750; }
  summary small { margin-top: 2px; color: #64748b; font-size: 0.72rem; }
  .section-body { display: grid; gap: 12px; padding: 0 13px 14px; }
  .grid-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .wide { grid-column: 1 / -1; }
  label { display: grid; gap: 5px; color: #94a3b8; font-size: 0.72rem; font-weight: 650; }
  input, textarea, select { min-width: 0; width: 100%; border: 1px solid rgb(255 255 255 / 0.11); border-radius: 10px; outline: none; background: rgb(2 6 23 / 0.45); padding: 9px 10px; color: white; font: inherit; font-size: 0.82rem; resize: vertical; }
  input:focus, textarea:focus, select:focus { border-color: rgb(125 211 252 / 0.7); box-shadow: 0 0 0 3px rgb(56 189 248 / 0.12); }
  input[type='color'] { height: 38px; padding: 4px; }
  button { cursor: pointer; border: 0; background: none; color: #cbd5e1; font: inherit; }
  button:disabled { cursor: default; opacity: 0.3; }
  .item-card { display: grid; gap: 10px; border: 1px solid rgb(255 255 255 / 0.08); border-radius: 14px; background: rgb(2 6 23 / 0.26); padding: 11px; }
  .item-toolbar, .sub-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .item-toolbar strong { overflow: hidden; font-size: 0.8rem; text-overflow: ellipsis; white-space: nowrap; }
  .item-toolbar div { display: flex; gap: 3px; }
  .item-toolbar button, .sub-heading button { border-radius: 7px; padding: 5px 7px; color: #94a3b8; font-size: 0.7rem; }
  .sub-list { display: grid; gap: 7px; }
  .sub-heading span { color: #94a3b8; font-size: 0.72rem; font-weight: 700; }
  .sub-heading button { color: #7dd3fc; }
  .inline-row { display: flex; align-items: center; gap: 6px; }
  .inline-row > :first-child { flex: 1; }
  .bullet-row { align-items: flex-start; }
  .icon-button { flex: none; width: 32px; height: 32px; border-radius: 9px; background: rgb(255 255 255 / 0.05); }
  .danger { color: #fda4af !important; }
  .add-button { width: 100%; border: 1px dashed rgb(125 211 252 / 0.3); border-radius: 11px; padding: 9px; color: #7dd3fc; font-size: 0.77rem; font-weight: 700; }
  @media (max-width: 420px) { .grid-two { grid-template-columns: 1fr; } .wide { grid-column: auto; } }
</style>
