(() => {
  'use strict';

  const STORE_KEY = 'nowlater.v1';
  const $ = (id) => document.getElementById(id);

  // ---------- Icons ----------
  const ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M15 3l6 6-4 1-4 4 1 5-2 2-4-4-5 5-1-1 5-5-4-4 2-2 5 1 4-4z"/></svg>',
    notes: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    link: '<svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  };

  // ---------- State ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.tasks)) return { activeList: s.activeList === 'work' ? 'work' : 'personal', tasks: s.tasks };
      }
    } catch (_) { /* fall through */ }
    return { activeList: 'personal', tasks: [] };
  }

  const state = load();
  let saveFailed = false;

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      saveFailed = false;
    } catch (_) {
      if (!saveFailed) toast('Could not save on this device');
      saveFailed = true;
    }
  }

  const byId = (id) => state.tasks.find((t) => t.id === id);

  function newTask(fields) {
    const now = Date.now();
    return Object.assign({
      id: uid(), list: state.activeList, title: '', notes: '', links: [],
      pinned: false, done: false, createdAt: now, pinnedAt: null, completedAt: null,
    }, fields);
  }

  // ---------- Rendering ----------
  const els = {
    tabs: document.querySelector('.tabs'),
    nowList: $('nowList'), laterList: $('laterList'),
    nowEmpty: $('nowEmpty'), laterEmpty: $('laterEmpty'),
    nowCount: $('nowCount'), laterCount: $('laterCount'),
    doneCount: $('doneCount'),
  };

  function taskRow(t, { completed = false } = {}) {
    const li = document.createElement('li');
    li.className = 'task';
    li.dataset.id = t.id;

    const check = document.createElement('button');
    check.className = 'check';
    check.setAttribute('role', 'checkbox');
    check.setAttribute('aria-checked', String(t.done));
    check.setAttribute('aria-label', t.done ? 'Mark not done' : 'Mark done');
    check.innerHTML = '<span>' + ICON.check + '</span>';
    check.addEventListener('click', () => (completed ? restoreTask(t.id, li) : completeTask(t.id, li)));

    const body = document.createElement('button');
    body.className = 'task-body';
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = t.title || 'Untitled';
    body.appendChild(title);

    const meta = document.createElement('span');
    meta.className = 'task-meta';
    const emails = t.links.filter((l) => l.type === 'email').length;
    const others = t.links.length - emails;
    if (t.notes.trim()) meta.insertAdjacentHTML('beforeend', '<span>' + ICON.notes + 'Notes</span>');
    if (emails) meta.insertAdjacentHTML('beforeend', '<span>' + ICON.mail + emails + '</span>');
    if (others) meta.insertAdjacentHTML('beforeend', '<span>' + ICON.link + others + '</span>');
    if (completed && t.completedAt) {
      const s = document.createElement('span');
      s.textContent = 'Done ' + relDate(t.completedAt);
      meta.appendChild(s);
    }
    if (meta.childNodes.length) body.appendChild(meta);
    body.addEventListener('click', () => openDetail(t.id));

    li.append(check, body);

    if (completed) {
      const del = document.createElement('button');
      del.className = 'trash';
      del.setAttribute('aria-label', 'Delete task');
      del.innerHTML = ICON.trash;
      del.addEventListener('click', () => deleteTask(t.id, true));
      li.appendChild(del);
    } else {
      const pin = document.createElement('button');
      pin.className = 'pin';
      pin.setAttribute('aria-pressed', String(t.pinned));
      pin.setAttribute('aria-label', t.pinned ? 'Unpin (move to Later)' : 'Pin (move to Now)');
      pin.innerHTML = ICON.pin;
      pin.addEventListener('click', () => togglePin(t.id));
      li.appendChild(pin);
    }
    return li;
  }

  function sortNow(a, b) { return (b.pinnedAt || 0) - (a.pinnedAt || 0); }
  function sortLater(a, b) { return b.createdAt - a.createdAt; }

  let enteringId = null;

  function render() {
    const list = state.activeList;
    els.tabs.dataset.active = list;
    document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.list === list)));

    ['personal', 'work'].forEach((l) => {
      const n = state.tasks.filter((t) => t.list === l && !t.done).length;
      document.querySelector(`[data-count="${l}"]`).textContent = n ? n : '';
    });

    const open = state.tasks.filter((t) => t.list === list && !t.done);
    const now = open.filter((t) => t.pinned).sort(sortNow);
    const later = open.filter((t) => !t.pinned).sort(sortLater);

    fill(els.nowList, now);
    fill(els.laterList, later);
    els.nowEmpty.hidden = now.length > 0;
    els.laterEmpty.hidden = later.length > 0;
    els.nowCount.textContent = now.length || '';
    els.laterCount.textContent = later.length || '';
    els.doneCount.textContent = state.tasks.filter((t) => t.list === list && t.done).length;

    if (!$('completedSheet').hidden) renderCompleted();
    enteringId = null;
  }

  function fill(ul, tasks) {
    ul.replaceChildren(...tasks.map((t) => {
      const row = taskRow(t);
      if (t.id === enteringId) row.classList.add('entering');
      return row;
    }));
  }

  function relDate(ts) {
    const d = new Date(ts), today = new Date();
    const days = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 864e5);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  }

  // ---------- Actions ----------
  function addTask(title, pinned) {
    const t = newTask({ title, pinned, pinnedAt: pinned ? Date.now() : null });
    state.tasks.push(t);
    enteringId = t.id;
    save(); render();
    return t;
  }

  function togglePin(id) {
    const t = byId(id); if (!t) return;
    t.pinned = !t.pinned;
    t.pinnedAt = t.pinned ? Date.now() : null;
    enteringId = id;
    save(); render();
  }

  function completeTask(id, row) {
    const t = byId(id); if (!t) return;
    const chk = row && row.querySelector('.check');
    if (chk) chk.setAttribute('aria-checked', 'true');
    const finish = () => {
      t.done = true; t.completedAt = Date.now();
      save(); render();
      toast('Completed “' + (t.title || 'Untitled') + '”', 'Undo', () => {
        t.done = false; t.completedAt = null; enteringId = t.id; save(); render();
      });
    };
    if (row) { row.classList.add('leaving'); setTimeout(finish, 260); } else finish();
  }

  function restoreTask(id, row) {
    const t = byId(id); if (!t) return;
    const finish = () => {
      t.done = false; t.completedAt = null; enteringId = id;
      save(); render();
      toast('Moved back to ' + (t.pinned ? 'Now' : 'Later'));
    };
    if (row) { row.classList.add('leaving'); setTimeout(finish, 260); } else finish();
  }

  function deleteTask(id, withUndo) {
    const idx = state.tasks.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const [removed] = state.tasks.splice(idx, 1);
    save(); render();
    if (withUndo) toast('Deleted “' + (removed.title || 'Untitled') + '”', 'Undo', () => {
      state.tasks.splice(Math.min(idx, state.tasks.length), 0, removed); save(); render();
    });
  }

  // ---------- Tabs & composer ----------
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    state.activeList = b.dataset.list; save(); render();
  }));

  const composerPin = $('composerPin');
  const composerInput = $('composerInput');
  composerPin.addEventListener('click', () => {
    const on = composerPin.getAttribute('aria-pressed') !== 'true';
    composerPin.setAttribute('aria-pressed', String(on));
    composerPin.setAttribute('aria-label', on ? 'Adding to Now' : 'Add to Now');
    composerInput.placeholder = on ? 'Add a task for now' : 'Add a task';
    composerInput.focus();
  });
  $('composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = composerInput.value.trim();
    if (!title) return;
    addTask(title, composerPin.getAttribute('aria-pressed') === 'true');
    composerInput.value = '';
  });

  // ---------- Sheets ----------
  function openSheet(id) {
    const s = $(id);
    s.hidden = false;
    document.body.style.overflow = 'hidden';
    history.pushState({ sheet: id }, '');
  }
  function closeSheet(id, fromPop) {
    const s = $(id);
    if (s.hidden) return;
    s.hidden = true;
    if (document.querySelectorAll('.sheet-backdrop:not([hidden])').length === 0) document.body.style.overflow = '';
    if (!fromPop && history.state && history.state.sheet === id) history.back();
  }
  // Android back button closes the open sheet instead of leaving the app.
  window.addEventListener('popstate', () => {
    const open = [...document.querySelectorAll('.sheet-backdrop:not([hidden])')];
    const top = open[open.length - 1];
    if (top) { if (top.id === 'detailSheet') commitDetail(); closeSheet(top.id, true); }
  });
  document.querySelectorAll('.sheet-backdrop').forEach((bd) => bd.addEventListener('click', (e) => {
    if (e.target !== bd) return;
    if (bd.id === 'detailSheet') commitDetail();
    closeSheet(bd.id);
  }));

  // ---------- Detail sheet ----------
  let detailId = null;
  const dTitle = $('detailTitle'), dNotes = $('detailNotes');

  function setSeg(seg, val) {
    seg.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === val)));
  }

  function autosize() { dTitle.style.height = 'auto'; dTitle.style.height = dTitle.scrollHeight + 'px'; }

  function openDetail(id, opts = {}) {
    const t = byId(id); if (!t) return;
    detailId = id;
    dTitle.value = t.title;
    dNotes.value = t.notes;
    setSeg($('detailList'), t.list);
    setSeg($('detailWhen'), t.pinned ? 'now' : 'later');
    $('detailWhen').style.display = t.done ? 'none' : '';
    $('detailTitleLabel').textContent = t.done ? 'Completed task' : 'Task';
    $('detailMeta').textContent = 'Added ' + relDate(t.createdAt) + (t.done && t.completedAt ? ' · Completed ' + relDate(t.completedAt) : '');
    hideLinkForm();
    renderLinks();
    openSheet('detailSheet');
    requestAnimationFrame(autosize);
    if (opts.focusTitle) setTimeout(() => { dTitle.focus(); dTitle.select(); }, 250);
  }

  function commitDetail() {
    const t = byId(detailId); if (!t) return;
    const title = dTitle.value.replace(/\s*\n\s*/g, ' ').trim();
    if (title) t.title = title;
    t.notes = dNotes.value;
    save(); render();
  }

  dTitle.addEventListener('input', autosize);
  dTitle.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dTitle.blur(); } });
  dTitle.addEventListener('change', commitDetail);
  dNotes.addEventListener('change', commitDetail);
  let notesTimer;
  dNotes.addEventListener('input', () => { clearTimeout(notesTimer); notesTimer = setTimeout(commitDetail, 600); });

  $('detailList').addEventListener('click', (e) => {
    const b = e.target.closest('button'); const t = byId(detailId); if (!b || !t) return;
    t.list = b.dataset.val; setSeg($('detailList'), t.list); save(); render();
  });
  $('detailWhen').addEventListener('click', (e) => {
    const b = e.target.closest('button'); const t = byId(detailId); if (!b || !t) return;
    const pin = b.dataset.val === 'now';
    if (pin !== t.pinned) { t.pinned = pin; t.pinnedAt = pin ? Date.now() : null; }
    setSeg($('detailWhen'), b.dataset.val); save(); render();
  });
  $('detailClose').addEventListener('click', () => { commitDetail(); closeSheet('detailSheet'); });
  $('detailDelete').addEventListener('click', () => {
    const t = byId(detailId); if (!t) return;
    closeSheet('detailSheet');
    deleteTask(t.id, true);
  });

  // ---------- Links ----------
  const EMAIL_HOSTS = /(^|\.)(mail\.google\.com|outlook\.(live|office|office365)\.com|outlook\.com|mail\.yahoo\.com|mail\.proton\.me|icloud\.com)$/i;

  function isEmailUrl(u) {
    try { const url = new URL(u); return url.protocol === 'mailto:' || url.protocol === 'message:' || EMAIL_HOSTS.test(url.hostname); }
    catch (_) { return false; }
  }

  function normalizeUrl(raw) {
    let s = raw.trim();
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
    try {
      const u = new URL(s);
      if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return null;
      return u.href;
    } catch (_) { return null; }
  }

  function gmailSearchUrl(q) {
    return 'https://mail.google.com/mail/u/0/#search/' + encodeURIComponent(q.trim());
  }

  function describe(url) {
    try {
      const u = new URL(url);
      if (u.protocol === 'mailto:') return u.pathname;
      if (/mail\.google\.com$/.test(u.hostname)) {
        const m = u.hash.match(/^#search\/(.+)$/);
        return m ? 'Gmail search: ' + decodeURIComponent(m[1]) : 'Gmail message';
      }
      if (/outlook/.test(u.hostname)) return 'Outlook message';
      return u.hostname.replace(/^www\./, '') + (u.pathname.length > 1 ? u.pathname : '');
    } catch (_) { return url; }
  }

  function renderLinks() {
    const t = byId(detailId);
    const ul = $('linkList');
    ul.replaceChildren(...(t ? t.links : []).map((l) => {
      const li = document.createElement('li');
      li.className = 'link-item';
      const a = document.createElement('a');
      a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      const icon = document.createElement('span');
      icon.className = 'link-icon';
      icon.innerHTML = l.type === 'email' ? ICON.mail : ICON.link;
      const text = document.createElement('span');
      text.className = 'link-text';
      const strong = document.createElement('strong');
      strong.textContent = l.label || (l.type === 'email' ? 'Email' : describe(l.url));
      const small = document.createElement('small');
      small.textContent = describe(l.url);
      text.append(strong, small);
      a.append(icon, text);
      const del = document.createElement('button');
      del.className = 'trash';
      del.setAttribute('aria-label', 'Remove link');
      del.innerHTML = ICON.x;
      del.addEventListener('click', () => {
        t.links = t.links.filter((x) => x.id !== l.id);
        save(); renderLinks(); render();
      });
      li.append(a, del);
      return li;
    }));
  }

  let linkType = 'link';
  let emailMode = 'url';
  const linkForm = $('linkForm'), linkUrl = $('linkUrl'), linkSearch = $('linkSearch'), linkLabel = $('linkLabel'), linkHint = $('linkHint');

  function showLinkForm(type) {
    linkType = type;
    emailMode = 'url';
    linkUrl.value = ''; linkSearch.value = ''; linkLabel.value = '';
    $('emailMode').hidden = type !== 'email';
    updateEmailMode();
    $('linkActions').hidden = true;
    linkForm.hidden = false;
    setTimeout(() => (emailMode === 'url' ? linkUrl : linkSearch).focus(), 50);
  }
  function hideLinkForm() { linkForm.hidden = true; $('linkActions').hidden = false; }

  function updateEmailMode() {
    $('emailMode').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.val === emailMode)));
    const search = linkType === 'email' && emailMode === 'search';
    linkUrl.hidden = search;
    linkSearch.hidden = !search;
    linkLabel.placeholder = linkType === 'email' ? 'Label, e.g. “Dana’s quote”' : 'Label (optional)';
    if (linkType !== 'email') linkHint.textContent = '';
    else if (search) linkHint.textContent = 'Saves a Gmail search that finds this email. Use sender and subject words, e.g. from:dana subject:invoice.';
    else linkHint.textContent = 'Paste the email’s web link (open it in Gmail or Outlook on the web and copy the address bar), or a mailto: address.';
  }

  $('linkActions').addEventListener('click', (e) => { const b = e.target.closest('[data-add]'); if (b) showLinkForm(b.dataset.add); });
  $('emailMode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    emailMode = b.dataset.val; updateEmailMode();
    (emailMode === 'url' ? linkUrl : linkSearch).focus();
  });
  $('linkCancel').addEventListener('click', hideLinkForm);
  linkForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = byId(detailId); if (!t) return;
    let url;
    if (linkType === 'email' && emailMode === 'search') {
      if (!linkSearch.value.trim()) { linkSearch.focus(); return; }
      url = gmailSearchUrl(linkSearch.value);
    } else {
      url = normalizeUrl(linkUrl.value);
      if (!url) { linkHint.textContent = 'That doesn’t look like a valid link.'; linkUrl.focus(); return; }
    }
    t.links.push({ id: uid(), type: linkType === 'email' || isEmailUrl(url) ? 'email' : 'link', url, label: linkLabel.value.trim() });
    save(); hideLinkForm(); renderLinks(); render();
  });

  // ---------- Completed sheet ----------
  function renderCompleted() {
    const list = state.activeList;
    const done = state.tasks.filter((t) => t.list === list && t.done).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    $('completedLabel').textContent = 'Completed · ' + (list === 'work' ? 'Work' : 'Personal');
    $('completedList').replaceChildren(...done.map((t) => taskRow(t, { completed: true })));
    $('completedEmpty').hidden = done.length > 0;
    $('clearCompleted').disabled = done.length === 0;
    $('clearCompleted').textContent = done.length === 1 ? 'Delete 1 completed task'
      : done.length ? `Delete all ${done.length} completed tasks` : 'Delete all completed';
  }
  $('openCompleted').addEventListener('click', () => { renderCompleted(); openSheet('completedSheet'); });
  $('completedClose').addEventListener('click', () => closeSheet('completedSheet'));
  $('clearCompleted').addEventListener('click', () => {
    const list = state.activeList;
    const n = state.tasks.filter((t) => t.list === list && t.done).length;
    if (!n) return;
    const name = list === 'work' ? 'Work' : 'Personal';
    if (!confirm(`Permanently delete ${n} completed ${name} task${n === 1 ? '' : 's'}? This can't be undone.`)) return;
    state.tasks = state.tasks.filter((t) => !(t.list === list && t.done));
    save(); render();
    toast(`Deleted ${n} completed task${n === 1 ? '' : 's'}`);
  });

  // ---------- Backup menu ----------
  $('openMenu').addEventListener('click', () => { openSheet('menuSheet'); updateStorageNote(); });
  $('menuClose').addEventListener('click', () => closeSheet('menuSheet'));
  $('exportBtn').addEventListener('click', () => {
    const data = JSON.stringify({ app: 'now-later', version: 1, exportedAt: new Date().toISOString(), tasks: state.tasks }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const stamp = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    a.href = URL.createObjectURL(blob);
    a.download = `${stamp}_NowLaterBackup.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const tasks = Array.isArray(data) ? data : data.tasks;
      if (!Array.isArray(tasks)) throw new Error('bad');
      const clean = tasks.filter((t) => t && typeof t.title === 'string').map((t) => newTask({
        id: typeof t.id === 'string' ? t.id : uid(),
        list: t.list === 'work' ? 'work' : 'personal',
        title: t.title, notes: typeof t.notes === 'string' ? t.notes : '',
        links: Array.isArray(t.links) ? t.links.filter((l) => l && normalizeUrl(String(l.url || ''))).map((l) => ({
          id: typeof l.id === 'string' ? l.id : uid(), type: l.type === 'email' ? 'email' : 'link',
          url: normalizeUrl(String(l.url)), label: typeof l.label === 'string' ? l.label : '',
        })) : [],
        pinned: !!t.pinned, done: !!t.done,
        createdAt: Number(t.createdAt) || Date.now(), pinnedAt: Number(t.pinnedAt) || null, completedAt: Number(t.completedAt) || null,
      }));
      const existing = new Set(state.tasks.map((t) => t.id));
      const added = clean.filter((t) => !existing.has(t.id));
      state.tasks.push(...added);
      save(); render(); closeSheet('menuSheet');
      toast(`Imported ${added.length} task${added.length === 1 ? '' : 's'}` + (clean.length > added.length ? ` (${clean.length - added.length} already here)` : ''));
    } catch (_) {
      toast('That file isn’t a Now & Later backup');
    }
  });

  async function updateStorageNote() {
    const note = $('storageNote');
    try {
      if (navigator.storage && navigator.storage.persisted) {
        const p = await navigator.storage.persisted();
        note.textContent = p ? 'Storage is protected from automatic cleanup.' : 'Install the app to your home screen so Android keeps your tasks safe.';
      }
    } catch (_) { note.textContent = ''; }
  }

  // ---------- Toast ----------
  let toastTimer;
  function toast(text, actionLabel, onAction) {
    const el = $('toast'), btn = $('toastAction');
    $('toastText').textContent = text;
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || '';
    btn.onclick = () => { el.hidden = true; clearTimeout(toastTimer); onAction && onAction(); };
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 5000 : 2500);
  }

  // ---------- Share target (Android "Share" menu → new task) ----------
  function handleShare() {
    const p = new URLSearchParams(location.search);
    if (!p.has('title') && !p.has('text') && !p.has('url')) return;
    const title = (p.get('title') || '').trim();
    let text = (p.get('text') || '').trim();
    let url = (p.get('url') || '').trim();
    if (!url) {
      const m = text.match(/https?:\/\/\S+/);
      if (m) { url = m[0]; text = text.replace(m[0], '').trim(); }
    }
    history.replaceState(null, '', location.pathname);

    const firstLine = text.split('\n').find((l) => l.trim()) || '';
    const name = (title || firstLine || (url ? describe(url) : 'New task')).slice(0, 300);
    const notes = text && text !== firstLine ? text : (title && text ? text : '');
    const t = addTask(name, false);
    t.notes = notes;
    const nurl = url && normalizeUrl(url);
    if (nurl) t.links.push({ id: uid(), type: isEmailUrl(nurl) ? 'email' : 'link', url: nurl, label: title && title !== name ? title : '' });
    save(); render();
    openDetail(t.id, { focusTitle: true });
  }

  // ---------- Boot ----------
  render();
  handleShare();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (_) {}
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();
