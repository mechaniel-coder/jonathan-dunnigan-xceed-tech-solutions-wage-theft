/* global io */
'use strict';

// ── Utilities ─────────────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const content = () => document.getElementById('content');

let toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function fmt(n) { return Number(n).toLocaleString(); }
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function fmtUptime(s) {
  s = Math.floor(s);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}
function fmtDate(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString();
}
function userId(id) {
  return `<code style="font-size:11px;color:#8b949e">${id}</code>`;
}

// ── Navigation ────────────────────────────────────────────────────────────────
let currentPage = 'overview';
let logsSocket = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPage = btn.dataset.page;
    _guildCache = null; // refresh guild data on each page load
    render(currentPage);
  });

  document.getElementById('restart-btn').addEventListener('click', async () => {
    if (!confirm('Restart the bot? It will reconnect automatically in ~10 seconds.')) return;
    try {
      await api('POST', '/api/restart');
      toast('Bot is restarting...', 'success');
    } catch (e) { toast(e.message, 'error'); }
  });

  loadHeader();
  render('overview');
});

async function loadHeader() {
  try {
    const { bot } = await api('GET', '/api/stats');
    if (bot.avatar) $('#bot-avatar').src = bot.avatar;
    if (bot.tag) {
      $('#bot-tag').textContent = bot.tag;
      document.title = `${bot.tag} Dashboard`;
    }
    const dot = $('#bot-status');
    dot.textContent = bot.ready ? 'Online' : 'Offline';
    dot.className = `status-dot ${bot.ready ? 'online' : 'offline'}`;
  } catch (_) {}
}

function render(page) {
  content().innerHTML = '<div class="loading">Loading...</div>';
  const pages = {
    overview:       renderOverview,
    economy:        renderEconomy,
    levels:         renderLevels,
    settings:       renderSettings,
    autoresponders: renderAutoresponders,
    customcmds:     renderCustomcmds,
    monitors:       renderMonitors,
    automod:        renderAutomod,
    autoroles:      renderAutoroles,
    onboarding:     renderOnboarding,
    reminders:      renderReminders,
    rolepanels:     renderRolePanels,
    giveaways:      renderGiveaways,
    tickets:        renderTickets,
    moderation:     renderModeration,
    logs:           renderLogs,
    coinpkgs:       renderCoinPackages,
    payments:       renderPaymentTransactions,
    ndusers:        renderNextdactylUsers,
    payprocs:       renderPaymentProcessors,
  };
  (pages[page] || renderOverview)();
}

// ── Guild Info Cache ──────────────────────────────────────────────────────────
let _guildCache = null;
async function getGuildInfo() {
  if (_guildCache) return _guildCache;
  try { _guildCache = await api('GET', '/api/guild'); }
  catch { _guildCache = { channels: [], roles: [] }; }
  return _guildCache;
}
function chSel(name, val, channels) {
  const opts = channels.map(c =>
    `<option value="${c.id}" ${val === c.id ? 'selected' : ''}>#${c.name}${c.parent ? ` (${c.parent})` : ''}</option>`
  ).join('');
  return `<select name="${name}"><option value="">— None —</option>${opts}</select>`;
}
function roleSel(name, val, roles) {
  const opts = roles.map(r =>
    `<option value="${r.id}" ${val === r.id ? 'selected' : ''}>@${r.name}</option>`
  ).join('');
  return `<select name="${name}"><option value="">— None —</option>${opts}</select>`;
}

// ── Overview ──────────────────────────────────────────────────────────────────
async function renderOverview() {
  try {
    const { bot, stats } = await api('GET', '/api/stats');
    content().innerHTML = `
      <h2>📊 Overview</h2>
      <div class="card-grid">
        <div class="stat-card"><div class="label">Uptime</div><div class="value" style="font-size:18px">${fmtUptime(bot.uptime)}</div></div>
        <div class="stat-card"><div class="label">Guilds</div><div class="value">${bot.guilds}</div></div>
        <div class="stat-card"><div class="label">Commands</div><div class="value">${bot.commands}</div></div>
        <div class="stat-card"><div class="label">Tracked Users</div><div class="value">${fmt(stats.trackedUsers)}</div></div>
        <div class="stat-card"><div class="label">Economy Users</div><div class="value">${fmt(stats.economyUsers)}</div></div>
        <div class="stat-card"><div class="label">Open Tickets</div><div class="value">${stats.openTickets}</div></div>
        <div class="stat-card"><div class="label">Active Giveaways</div><div class="value">${stats.activeGiveaways}</div></div>
        <div class="stat-card"><div class="label">Total Warnings</div><div class="value">${stats.warnings}</div></div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:14px">
          <img src="${bot.avatar || ''}" style="width:56px;height:56px;border-radius:50%;border:2px solid #00AAFF" onerror="this.style.display='none'">
          <div>
            <div style="font-size:18px;font-weight:700;color:#e6edf3">${bot.tag || '—'}</div>
            <div style="font-size:12px;color:#8b949e;margin-top:4px">Status: <span style="color:${bot.ready ? '#3fb950' : '#f85149'}">${bot.ready ? 'Online' : 'Offline'}</span></div>
          </div>
        </div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load stats: ${e.message}</div>`;
  }
}

// ── Economy ───────────────────────────────────────────────────────────────────
async function renderEconomy() {
  try {
    const [users, shop] = await Promise.all([
      api('GET', '/api/economy'),
      api('GET', '/api/shop'),
    ]);

    const userRows = users.length ? users.map(u => `
      <tr id="eco-${u.user_id}">
        <td>${userId(u.user_id)}</td>
        <td><input class="inline-edit" type="number" value="${u.balance}" id="bal-${u.user_id}"></td>
        <td><input class="inline-edit" type="number" value="${u.bank}" id="bank-${u.user_id}"></td>
        <td><button class="btn btn-primary btn-sm" onclick="saveEconomy('${u.user_id}')">Save</button></td>
      </tr>`).join('') : `<tr><td colspan="4" class="empty">No economy data yet.</td></tr>`;

    const shopRows = shop.length ? shop.map(s => `
      <tr>
        <td>${s.name}</td>
        <td>${fmt(s.price)} 💰</td>
        <td>${s.description || '—'}</td>
        <td>${s.role_id ? userId(s.role_id) : '—'}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteShopItem(${s.id})">Delete</button></td>
      </tr>`).join('') : `<tr><td colspan="5" class="empty">No shop items.</td></tr>`;

    content().innerHTML = `
      <h2>💰 Economy</h2>
      <div class="card" style="margin-bottom:24px">
        <div class="section-header"><h3>User Balances (Top 50)</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>User ID</th><th>Wallet</th><th>Bank</th><th></th></tr></thead>
          <tbody>${userRows}</tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="section-header">
          <h3>Shop Items</h3>
          <button class="btn btn-primary btn-sm" onclick="showAddShop()">+ Add Item</button>
        </div>
        <div id="add-shop-form" style="display:none;margin-bottom:16px;background:#0d1117;border-radius:8px;padding:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <input id="shop-name" placeholder="Item name" maxlength="50">
            <input id="shop-price" type="number" placeholder="Price" min="0">
            <input id="shop-desc" placeholder="Description (optional)">
            <input id="shop-role" placeholder="Role ID (optional)">
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" onclick="addShopItem()">Add Item</button>
            <button class="btn btn-ghost btn-sm" onclick="hideAddShop()">Cancel</button>
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Price</th><th>Description</th><th>Role ID</th><th></th></tr></thead>
          <tbody>${shopRows}</tbody>
        </table></div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load economy: ${e.message}</div>`;
  }
}

window.saveEconomy = async (userId) => {
  try {
    const balance = parseInt(document.getElementById(`bal-${userId}`).value);
    const bank    = parseInt(document.getElementById(`bank-${userId}`).value);
    await api('PUT', `/api/economy/${userId}`, { balance, bank });
    toast('Balance updated!');
  } catch (e) { toast(e.message, 'error'); }
};
window.deleteShopItem = async (id) => {
  if (!confirm('Delete this shop item?')) return;
  try { await api('DELETE', `/api/shop/${id}`); toast('Item deleted!'); renderEconomy(); }
  catch (e) { toast(e.message, 'error'); }
};
window.showAddShop = () => { document.getElementById('add-shop-form').style.display = 'block'; };
window.hideAddShop = () => { document.getElementById('add-shop-form').style.display = 'none'; };
window.addShopItem = async () => {
  try {
    const name    = document.getElementById('shop-name').value.trim();
    const price   = parseInt(document.getElementById('shop-price').value);
    const desc    = document.getElementById('shop-desc').value.trim();
    const role_id = document.getElementById('shop-role').value.trim();
    if (!name || isNaN(price)) return toast('Name and price are required', 'error');
    await api('POST', '/api/shop', { name, price, description: desc || null, role_id: role_id || null });
    toast('Item added!'); renderEconomy();
  } catch (e) { toast(e.message, 'error'); }
};

// ── Levels ────────────────────────────────────────────────────────────────────
async function renderLevels() {
  try {
    const [{ users, config, roles: levelRoles }, guild] = await Promise.all([
      api('GET', '/api/levels'),
      getGuildInfo(),
    ]);
    const cfg = config || {};

    const rows = users.length ? users.map((u, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${userId(u.user_id)}</td>
        <td><input class="inline-edit" type="number" value="${u.level}" id="lvl-${u.user_id}" min="0"></td>
        <td><input class="inline-edit" type="number" value="${u.total_xp}" id="xp-${u.user_id}" min="0"></td>
        <td><button class="btn btn-primary btn-sm" onclick="saveLevel('${u.user_id}')">Save</button></td>
      </tr>`).join('') : `<tr><td colspan="5" class="empty">No level data yet.</td></tr>`;

    const lrRows = levelRoles.length ? levelRoles.map(r => `
      <tr>
        <td>Level ${r.level}</td>
        <td>${userId(r.role_id)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteLevelRole(${r.level})">Remove</button></td>
      </tr>`).join('') : `<tr><td colspan="3" class="empty">No level roles set.</td></tr>`;

    content().innerHTML = `
      <h2>⭐ Levels</h2>

      <div class="card" style="margin-bottom:24px">
        <div class="section-header"><h3>Leveling Configuration</h3></div>
        <form id="leveling-form" style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;align-items:end">
          <div class="form-row">
            <label>Enabled</label>
            <select name="enabled">
              <option value="1" ${cfg.enabled ? 'selected' : ''}>Yes</option>
              <option value="0" ${!cfg.enabled ? 'selected' : ''}>No</option>
            </select>
          </div>
          <div class="form-row">
            <label>Level-up Channel</label>
            ${chSel('level_up_channel_id', cfg.level_up_channel_id, guild.channels)}
          </div>
          <div class="form-row">
            <label>XP Min (per message)</label>
            <input name="xp_min" type="number" min="1" value="${cfg.xp_min ?? 15}">
          </div>
          <div class="form-row">
            <label>XP Max (per message)</label>
            <input name="xp_max" type="number" min="1" value="${cfg.xp_max ?? 25}">
          </div>
          <div class="form-row">
            <label>Cooldown (seconds)</label>
            <input name="cooldown_seconds" type="number" min="0" value="${cfg.cooldown_seconds ?? 20}">
          </div>
          <div class="form-row">
            <label>XP Multiplier</label>
            <input name="xp_multiplier" type="number" step="0.1" min="0.1" value="${cfg.xp_multiplier ?? 1.0}">
          </div>
          <div class="form-actions" style="grid-column:1/-1">
            <button type="submit" class="btn btn-primary">Save Config</button>
          </div>
        </form>
      </div>

      <div class="card" style="margin-bottom:24px">
        <div class="section-header">
          <h3>Level Role Rewards</h3>
          <button class="btn btn-primary btn-sm" onclick="showAddLevelRole()">+ Add</button>
        </div>
        <div id="add-levelrole-form" style="display:none;margin-bottom:12px;background:#0d1117;border-radius:8px;padding:12px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="form-row"><label>Level</label><input id="lr-level" type="number" min="1" placeholder="e.g. 10"></div>
            <div class="form-row"><label>Role</label>${roleSel('lr-role-sel', '', guild.roles)}</div>
          </div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" onclick="addLevelRole()">Add</button>
            <button class="btn btn-ghost btn-sm" onclick="hideLevelRole()">Cancel</button>
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Level</th><th>Role ID</th><th></th></tr></thead>
          <tbody>${lrRows}</tbody>
        </table></div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px">Leaderboard (Top 50)</h3>
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>User ID</th><th>Level</th><th>Total XP</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;

    document.getElementById('leveling-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('PUT', '/api/leveling', {
          enabled:            parseInt(fd.get('enabled')),
          xp_min:             parseInt(fd.get('xp_min')),
          xp_max:             parseInt(fd.get('xp_max')),
          cooldown_seconds:   parseInt(fd.get('cooldown_seconds')),
          xp_multiplier:      parseFloat(fd.get('xp_multiplier')),
          level_up_channel_id: fd.get('level_up_channel_id') || null,
        });
        toast('Leveling config saved!');
      } catch (err) { toast(err.message, 'error'); }
    });
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load levels: ${e.message}</div>`;
  }
}

window.saveLevel = async (uid) => {
  try {
    const level    = parseInt(document.getElementById(`lvl-${uid}`).value);
    const total_xp = parseInt(document.getElementById(`xp-${uid}`).value);
    await api('PUT', `/api/levels/${uid}`, { total_xp, level });
    toast('Level updated!');
  } catch (e) { toast(e.message, 'error'); }
};
window.showAddLevelRole = () => { document.getElementById('add-levelrole-form').style.display = 'block'; };
window.hideLevelRole    = () => { document.getElementById('add-levelrole-form').style.display = 'none'; };
window.addLevelRole = async () => {
  try {
    const level   = parseInt(document.getElementById('lr-level').value);
    const role_id = document.querySelector('[name="lr-role-sel"]').value;
    if (!level || !role_id) return toast('Level and role are required', 'error');
    await api('POST', '/api/levelroles', { level, role_id });
    toast('Level role added!'); renderLevels();
  } catch (e) { toast(e.message, 'error'); }
};
window.deleteLevelRole = async (level) => {
  if (!confirm(`Remove role reward for Level ${level}?`)) return;
  try { await api('DELETE', `/api/levelroles/${level}`); toast('Removed!'); renderLevels(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Settings ──────────────────────────────────────────────────────────────────
async function renderSettings() {
  try {
    const [s, guild] = await Promise.all([
      api('GET', '/api/settings'),
      getGuildInfo(),
    ]);
    content().innerHTML = `
      <h2>⚙️ Guild Settings</h2>
      <div class="card" style="max-width:640px">
        <form id="settings-form">
          <h3 style="margin-bottom:14px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Channels</h3>
          <div class="form-row"><label>Log Channel</label>${chSel('log_channel', s.log_channel, guild.channels)}</div>
          <div class="form-row"><label>Welcome Channel</label>${chSel('welcome_channel', s.welcome_channel, guild.channels)}</div>
          <div class="form-row"><label>Welcome Message</label><textarea name="welcome_message" placeholder="Welcome {user} to {server}! Members: {membercount}">${s.welcome_message || ''}</textarea><small style="color:#8b949e;font-size:11px">Variables: {user} {username} {server} {membercount}</small></div>
          <div class="form-row"><label>Suggestions Channel</label>${chSel('suggestions_channel', s.suggestions_channel, guild.channels)}</div>
          <div class="form-row"><label>Reviews Channel</label>${chSel('reviews_channel', s.reviews_channel, guild.channels)}</div>
          <div class="form-row"><label>Ticket Category ID</label><input name="ticket_category" value="${s.ticket_category || ''}" placeholder="Category channel ID"></div>

          <h3 style="margin:20px 0 14px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Roles</h3>
          <div class="form-row"><label>Staff Role</label>${roleSel('staff_role', s.staff_role, guild.roles)}</div>

          <h3 style="margin:20px 0 14px;color:#8b949e;font-size:12px;text-transform:uppercase;letter-spacing:.05em">Verification</h3>
          <div class="form-row"><label>Verified Role <small style="color:#8b949e;font-weight:normal">(used by /verify setup)</small></label>${roleSel('verified_role', s.verified_role, guild.roles)}</div>
          <div class="form-row"><label>Rules Accept Role <small style="color:#8b949e;font-weight:normal">(default for /verify rules)</small></label>${roleSel('rules_accept_role', s.rules_accept_role, guild.roles)}</div>
          <small style="color:#8b949e;font-size:11px;display:block;margin-top:-8px;margin-bottom:12px">After changing, re-run <code>/verify rules channel:#rules</code> (without a role option) to post a fresh panel with the new role.</small>

          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Save Settings</button>
          </div>
        </form>
      </div>`;

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = Object.fromEntries([...fd.entries()].map(([k,v]) => [k, v.trim() || null]));
      try { await api('PUT', '/api/settings', body); toast('Settings saved!'); }
      catch (err) { toast(err.message, 'error'); }
    });
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load settings: ${e.message}</div>`;
  }
}

// ── Auto-Responders ───────────────────────────────────────────────────────────
async function renderAutoresponders() {
  try {
    const rows = await api('GET', '/api/autoresponders');
    const tableRows = rows.length ? rows.map(r => `
      <tr>
        <td><code>${r.trigger_text}</code></td>
        <td style="max-width:320px;word-break:break-word">${r.response}</td>
        <td><span class="badge ${r.use_embed ? 'badge-green' : 'badge-red'}">${r.use_embed ? 'Embed' : 'Text'}</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteAutoresponder(${r.id}, '${r.trigger_text.replace(/'/g, "\\'")}')">Delete</button></td>
      </tr>`).join('') : `<tr><td colspan="4" class="empty">No auto-responders set up.</td></tr>`;

    content().innerHTML = `
      <h2>💬 Auto-Responders</h2>
      <div class="card">
        <div class="section-header">
          <h3>Keyword Triggers</h3>
          <button class="btn btn-primary btn-sm" onclick="showAddAR()">+ Add</button>
        </div>
        <div id="add-ar-form" style="display:none;margin-bottom:16px;background:#0d1117;border-radius:8px;padding:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="form-row"><label>Trigger (keyword)</label><input id="ar-trigger" placeholder="e.g. hello" maxlength="100"></div>
            <div class="form-row"><label>Type</label>
              <select id="ar-embed">
                <option value="0">Plain text</option>
                <option value="1">Embed</option>
              </select>
            </div>
          </div>
          <div class="form-row"><label>Response</label><textarea id="ar-response" placeholder="Bot reply..." rows="3" maxlength="2000"></textarea></div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" onclick="addAutoresponder()">Add</button>
            <button class="btn btn-ghost btn-sm" onclick="hideAR()">Cancel</button>
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Trigger</th><th>Response</th><th>Type</th><th></th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load auto-responders: ${e.message}</div>`;
  }
}
window.showAddAR = () => { document.getElementById('add-ar-form').style.display = 'block'; };
window.hideAR   = () => { document.getElementById('add-ar-form').style.display = 'none'; };
window.addAutoresponder = async () => {
  try {
    const trigger  = document.getElementById('ar-trigger').value.trim();
    const response = document.getElementById('ar-response').value.trim();
    const use_embed = parseInt(document.getElementById('ar-embed').value);
    if (!trigger || !response) return toast('Trigger and response are required', 'error');
    await api('POST', '/api/autoresponders', { trigger, response, use_embed });
    toast('Auto-responder added!'); renderAutoresponders();
  } catch (e) { toast(e.message, 'error'); }
};
window.deleteAutoresponder = async (id, trigger) => {
  if (!confirm(`Delete auto-responder for "${trigger}"?`)) return;
  try { await api('DELETE', `/api/autoresponders/${id}`); toast('Deleted!'); renderAutoresponders(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Custom Commands ───────────────────────────────────────────────────────────
async function renderCustomcmds() {
  try {
    const rows = await api('GET', '/api/customcmds');
    const tableRows = rows.length ? rows.map(r => `
      <tr>
        <td><code>/${r.name}</code></td>
        <td style="max-width:340px;word-break:break-word">${r.response}</td>
        <td><span class="badge ${r.use_embed ? 'badge-green' : 'badge-red'}">${r.use_embed ? 'Embed' : 'Text'}</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteCustomcmd(${r.id}, '${r.name.replace(/'/g, "\\'")}')">Delete</button></td>
      </tr>`).join('') : `<tr><td colspan="4" class="empty">No custom commands set up.</td></tr>`;

    content().innerHTML = `
      <h2>🔧 Custom Commands</h2>
      <div class="card">
        <div class="section-header">
          <h3>Custom Slash Commands</h3>
          <button class="btn btn-primary btn-sm" onclick="showAddCC()">+ Add</button>
        </div>
        <div id="add-cc-form" style="display:none;margin-bottom:16px;background:#0d1117;border-radius:8px;padding:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="form-row"><label>Command Name</label><input id="cc-name" placeholder="e.g. rules" maxlength="32"></div>
            <div class="form-row"><label>Type</label>
              <select id="cc-embed">
                <option value="0">Plain text</option>
                <option value="1">Embed</option>
              </select>
            </div>
          </div>
          <div class="form-row"><label>Response</label><textarea id="cc-response" placeholder="Command response..." rows="3" maxlength="2000"></textarea></div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" onclick="addCustomcmd()">Add</button>
            <button class="btn btn-ghost btn-sm" onclick="hideCC()">Cancel</button>
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Command</th><th>Response</th><th>Type</th><th></th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load custom commands: ${e.message}</div>`;
  }
}
window.showAddCC = () => { document.getElementById('add-cc-form').style.display = 'block'; };
window.hideCC   = () => { document.getElementById('add-cc-form').style.display = 'none'; };
window.addCustomcmd = async () => {
  try {
    const name      = document.getElementById('cc-name').value.trim();
    const response  = document.getElementById('cc-response').value.trim();
    const use_embed = parseInt(document.getElementById('cc-embed').value);
    if (!name || !response) return toast('Name and response are required', 'error');
    await api('POST', '/api/customcmds', { name, response, use_embed });
    toast('Custom command added!'); renderCustomcmds();
  } catch (e) { toast(e.message, 'error'); }
};
window.deleteCustomcmd = async (id, name) => {
  if (!confirm(`Delete command "/${name}"?`)) return;
  try { await api('DELETE', `/api/customcmds/${id}`); toast('Deleted!'); renderCustomcmds(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Uptime Monitors ───────────────────────────────────────────────────────────
let _monGuild = null;
async function renderMonitors() {
  try {
    const [rows, guild, settings] = await Promise.all([
      api('GET', '/api/monitors'),
      getGuildInfo(),
      api('GET', '/api/monitor-settings'),
    ]);
    _monGuild = guild;
    const tableRows = rows.length ? rows.map(m => {
      const status = m.last_status;
      const badge  = status === 'up'   ? '<span class="badge badge-green">Up</span>'
                   : status === 'down' ? '<span class="badge badge-red">Down</span>'
                   : '<span class="badge">Unknown</span>';
      return `<tr>
        <td>${m.name}</td>
        <td><a href="${m.url}" target="_blank" style="color:#00AAFF">${m.url}</a></td>
        <td>${badge}</td>
        <td>${m.last_checked ? fmtDate(m.last_checked) : '—'}</td>
        <td>${m.alert_channel_id ? userId(m.alert_channel_id) : '—'}</td>
        <td style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-sm" onclick="editMonitor(${m.id}, '${m.name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${m.url}', '${m.alert_channel_id || ''}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteMonitor(${m.id}, '${m.name.replace(/'/g, "\\'")}')">Remove</button>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="6" class="empty">No monitors set up.</td></tr>`;

    const intervalOpts = [1, 2, 5, 10, 15, 30, 60].map(v =>
      `<option value="${v}" ${settings.interval === v ? 'selected' : ''}>${v} minute${v !== 1 ? 's' : ''}</option>`
    ).join('');

    content().innerHTML = `
      <h2>🖥️ Uptime Monitors</h2>
      <div class="card" style="margin-bottom:16px">
        <h3>⚙️ Check Interval</h3>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <label style="color:#8b949e">How often to check each service:</label>
          <select id="mon-interval" style="background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:6px;padding:6px 10px">
            ${intervalOpts}
          </select>
          <button class="btn btn-primary btn-sm" onclick="saveMonitorInterval()">Save</button>
          <span id="interval-saved" style="color:#3fb950;display:none">✓ Saved</span>
        </div>
      </div>
      <div class="card">
        <div class="section-header">
          <h3>Monitored URLs</h3>
          <button class="btn btn-primary btn-sm" onclick="showAddMon()">+ Add</button>
        </div>
        <div id="add-mon-form" style="display:none;margin-bottom:16px;background:#0d1117;border-radius:8px;padding:14px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="form-row"><label>Name</label><input id="mon-name" placeholder="My Server" maxlength="100"></div>
            <div class="form-row"><label>Alert Channel</label>${chSel('mon-ch-sel', '', guild.channels)}</div>
          </div>
          <div class="form-row"><label>URL</label><input id="mon-url" placeholder="https://example.com"></div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" onclick="addMonitor()">Add Monitor</button>
            <button class="btn btn-ghost btn-sm" onclick="hideMon()">Cancel</button>
          </div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>URL</th><th>Status</th><th>Last Check</th><th>Alert Channel</th><th></th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
        <div id="edit-mon-form" style="display:none;margin-top:16px;background:#0d1117;border-radius:8px;padding:14px">
          <h4 style="margin:0 0 12px;color:#e6edf3">✏️ Edit Monitor</h4>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div class="form-row"><label>Name</label><input id="edit-mon-name" maxlength="100"></div>
            <div class="form-row"><label>Alert Channel</label><span id="edit-mon-ch-wrap"></span></div>
          </div>
          <div class="form-row"><label>URL</label><input id="edit-mon-url"></div>
          <div class="form-actions">
            <button class="btn btn-primary btn-sm" onclick="saveMonitor()">Save Changes</button>
            <button class="btn btn-ghost btn-sm" onclick="hideEditMon()">Cancel</button>
          </div>
        </div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load monitors: ${e.message}</div>`;
  }
}
window.showAddMon  = () => { document.getElementById('add-mon-form').style.display = 'block'; };
window.hideMon     = () => { document.getElementById('add-mon-form').style.display = 'none'; };
window.hideEditMon = () => { document.getElementById('edit-mon-form').style.display = 'none'; delete window._editMonId; };
window.editMonitor = (id, name, url, channelId) => {
  window._editMonId = id;
  document.getElementById('edit-mon-name').value = name;
  document.getElementById('edit-mon-url').value  = url;
  const wrap = document.getElementById('edit-mon-ch-wrap');
  if (_monGuild) {
    wrap.innerHTML = chSel('edit-mon-ch-sel', channelId, _monGuild.channels);
  } else {
    wrap.innerHTML = `<input id="edit-mon-ch-sel-fallback" placeholder="Channel ID" value="${channelId}" style="width:100%">`;
  }
  const form = document.getElementById('edit-mon-form');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
window.saveMonitor = async () => {
  const id   = window._editMonId;
  if (!id) return;
  const name = document.getElementById('edit-mon-name').value.trim();
  const url  = document.getElementById('edit-mon-url').value.trim();
  const chEl = document.querySelector('[name="edit-mon-ch-sel"]') || document.getElementById('edit-mon-ch-sel-fallback');
  const alert_channel_id = chEl ? chEl.value || null : null;
  if (!name || !url) return toast('Name and URL are required', 'error');
  try {
    await api('PATCH', `/api/monitors/${id}`, { name, url, alert_channel_id });
    toast('Monitor updated!'); renderMonitors();
  } catch (e) { toast(e.message, 'error'); }
};
window.saveMonitorInterval = async () => {
  try {
    const interval = parseInt(document.getElementById('mon-interval').value, 10);
    await api('PUT', '/api/monitor-settings', { interval });
    const el = document.getElementById('interval-saved');
    el.style.display = 'inline';
    setTimeout(() => { el.style.display = 'none'; }, 2500);
  } catch (e) { toast(e.message, 'error'); }
};
window.addMonitor = async () => {
  try {
    const name             = document.getElementById('mon-name').value.trim();
    const url              = document.getElementById('mon-url').value.trim();
    const alert_channel_id = document.querySelector('[name="mon-ch-sel"]').value || null;
    if (!name || !url) return toast('Name and URL are required', 'error');
    await api('POST', '/api/monitors', { name, url, alert_channel_id });
    toast('Monitor added!'); renderMonitors();
  } catch (e) { toast(e.message, 'error'); }
};
window.deleteMonitor = async (id, name) => {
  if (!confirm(`Remove monitor for "${name}"?`)) return;
  try { await api('DELETE', `/api/monitors/${id}`); toast('Removed!'); renderMonitors(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Auto-Mod ──────────────────────────────────────────────────────────────────
async function renderAutomod() {
  try {
    const { cfg, badwords } = await api('GET', '/api/automod');
    const { channels, roles } = await getGuildInfo();
    content().innerHTML = `
<div class="page-header"><h2>🛡️ Auto-Moderation</h2></div>
<div class="card">
  <h3>General Settings</h3>
  <label class="toggle-row"><span>Enabled</span><input type="checkbox" id="am-enabled" ${cfg.enabled ? 'checked' : ''}></label>
  <label class="toggle-row"><span>Spam Filter</span><input type="checkbox" id="am-spam" ${cfg.spam_enabled ? 'checked' : ''}></label>
  <div class="sub-row">
    <label>Max messages <input type="number" id="am-spam-thresh" value="${cfg.spam_threshold}" min="2" max="30" style="width:70px"></label>
    <label>in (ms) <input type="number" id="am-spam-window" value="${cfg.spam_window_ms}" min="1000" max="60000" style="width:90px"></label>
  </div>
  <label class="toggle-row"><span>Caps Filter (${cfg.caps_percent}%)</span><input type="checkbox" id="am-caps" ${cfg.caps_enabled ? 'checked' : ''}></label>
  <div class="sub-row">
    <label>Caps % <input type="number" id="am-caps-pct" value="${cfg.caps_percent}" min="10" max="100" style="width:70px"></label>
    <label>Min chars <input type="number" id="am-caps-min" value="${cfg.caps_min_length}" min="1" max="200" style="width:70px"></label>
  </div>
  <label class="toggle-row"><span>Block Links</span><input type="checkbox" id="am-links" ${cfg.links_enabled ? 'checked' : ''}></label>
  <label class="toggle-row"><span>Block Server Invites</span><input type="checkbox" id="am-invites" ${cfg.invites_enabled ? 'checked' : ''}></label>
  <label class="toggle-row"><span>Bad Words Filter</span><input type="checkbox" id="am-badwords" ${cfg.badwords_enabled ? 'checked' : ''}></label>
  <label class="toggle-row"><span>Mass Mention Filter</span><input type="checkbox" id="am-mentions" ${cfg.mentions_enabled ? 'checked' : ''}></label>
  <div class="sub-row"><label>Max mentions <input type="number" id="am-mentions-lim" value="${cfg.mentions_limit}" min="2" max="30" style="width:70px"></label></div>
  <hr>
  <h3>Punishment</h3>
  <label>Action:
    <select id="am-action">
      ${['delete','warn','timeout','kick','ban'].map(a => `<option value="${a}" ${cfg.action===a?'selected':''}>${a}</option>`).join('')}
    </select>
  </label>
  <label>Timeout duration (minutes) <input type="number" id="am-to-mins" value="${Math.round((cfg.timeout_duration||300000)/60000)}" min="1" max="40320" style="width:90px"></label>
  <hr>
  <label>Log Channel: ${chSel('am-log-ch', cfg.log_channel, channels)}</label>
  <br><br>
  <button class="btn-primary" onclick="saveAutomod()">💾 Save Auto-Mod Settings</button>
</div>
<div class="card">
  <h3>Bad Words List (${badwords.length})</h3>
  <div style="display:flex;gap:8px;margin-bottom:12px">
    <input type="text" id="bw-input" placeholder="Enter word to block" style="flex:1">
    <button class="btn-primary" onclick="addBadWord()">Add</button>
  </div>
  <div id="bw-list">
    ${badwords.map(b => `<span class="badge badge-red" style="margin:2px">${'*'.repeat(b.word.length)} <button onclick="deleteBadWord(${b.id})" style="background:none;border:none;color:inherit;cursor:pointer">✕</button></span>`).join('') || '<em>No bad words configured</em>'}
  </div>
</div>`;
  } catch (e) { content().innerHTML = `<p class="error">${e.message}</p>`; }
}
window.saveAutomod = async () => {
  try {
    await api('PUT', '/api/automod', {
      enabled:          document.getElementById('am-enabled').checked,
      spam_enabled:     document.getElementById('am-spam').checked,
      spam_threshold:   +document.getElementById('am-spam-thresh').value,
      spam_window_ms:   +document.getElementById('am-spam-window').value,
      caps_enabled:     document.getElementById('am-caps').checked,
      caps_percent:     +document.getElementById('am-caps-pct').value,
      caps_min_length:  +document.getElementById('am-caps-min').value,
      links_enabled:    document.getElementById('am-links').checked,
      invites_enabled:  document.getElementById('am-invites').checked,
      badwords_enabled: document.getElementById('am-badwords').checked,
      mentions_enabled: document.getElementById('am-mentions').checked,
      mentions_limit:   +document.getElementById('am-mentions-lim').value,
      action:           document.getElementById('am-action').value,
      timeout_duration: +document.getElementById('am-to-mins').value * 60000,
      log_channel:      document.querySelector('#am-log-ch').value || null,
    });
    toast('Auto-mod saved!');
  } catch (e) { toast(e.message, 'error'); }
};
window.addBadWord = async () => {
  const word = document.getElementById('bw-input').value.trim();
  if (!word) return toast('Enter a word', 'error');
  try { await api('POST', '/api/automod/badwords', { word }); toast('Word added!'); renderAutomod(); }
  catch (e) { toast(e.message, 'error'); }
};
window.deleteBadWord = async (id) => {
  try { await api('DELETE', `/api/automod/badwords/${id}`); toast('Removed!'); renderAutomod(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Auto-Roles ────────────────────────────────────────────────────────────────
async function renderAutoroles() {
  try {
    const rows = await api('GET', '/api/autoroles');
    const { roles } = await getGuildInfo();
    const roleMap = Object.fromEntries(roles.map(r => [r.id, r.name]));
    content().innerHTML = `
<div class="page-header"><h2>🎭 Auto-Roles on Join</h2></div>
<div class="card">
  <p>These roles are automatically assigned to every member when they join the server.</p>
  <div style="display:flex;gap:8px;margin-bottom:16px">
    ${roleSel('ar-role-sel', '', roles)}
    <button class="btn-primary" onclick="addAutorole()">Add Role</button>
  </div>
  <table class="data-table">
    <thead><tr><th>Role</th><th>Action</th></tr></thead>
    <tbody>
      ${rows.length
        ? rows.map(r => `<tr><td><span class="badge">${roleMap[r.role_id] || r.role_id}</span></td><td><button class="btn-danger btn-sm" onclick="deleteAutorole('${r.role_id}')">Remove</button></td></tr>`).join('')
        : '<tr><td colspan="2"><em>No auto-roles configured</em></td></tr>'}
    </tbody>
  </table>
</div>`;
  } catch (e) { content().innerHTML = `<p class="error">${e.message}</p>`; }
}
window.addAutorole = async () => {
  const role_id = document.querySelector('[name="ar-role-sel"]').value;
  if (!role_id) return toast('Select a role', 'error');
  try { await api('POST', '/api/autoroles', { role_id }); toast('Auto-role added!'); renderAutoroles(); }
  catch (e) { toast(e.message, 'error'); }
};
window.deleteAutorole = async (role_id) => {
  if (!confirm('Remove this auto-role?')) return;
  try { await api('DELETE', `/api/autoroles/${role_id}`); toast('Removed!'); renderAutoroles(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Onboarding ────────────────────────────────────────────────────────────────
async function renderOnboarding() {
  try {
    const cfg = await api('GET', '/api/onboarding');
    const steps = JSON.parse(typeof cfg.steps === 'string' ? cfg.steps : JSON.stringify(cfg.steps || []));
    content().innerHTML = `
<div class="page-header"><h2>🎓 Member Onboarding</h2></div>
<div class="card">
  <p>Configure a DM sent to every new member when they join. Supports <code>{user}</code> <code>{username}</code> <code>{server}</code> <code>{membercount}</code>.</p>
  <label class="toggle-row"><span>Enabled</span><input type="checkbox" id="ob-enabled" ${cfg.enabled ? 'checked' : ''}></label>
  <label class="toggle-row"><span>Send DM on Join</span><input type="checkbox" id="ob-dm" ${cfg.dm_on_join ? 'checked' : ''}></label>
  <hr>
  <h3>Steps (sent in order, each as a separate paragraph)</h3>
  <div id="ob-steps">
    ${steps.map((s, i) => `
      <div class="step-row" id="ob-step-${i}" style="display:flex;gap:8px;margin-bottom:8px">
        <span class="badge" style="padding:4px 8px;align-self:center">${i+1}</span>
        <textarea style="flex:1;min-height:60px" id="ob-step-text-${i}">${escHtml(s)}</textarea>
        <button class="btn-danger btn-sm" onclick="removeOnboardingStep(${i})" style="align-self:start">✕</button>
      </div>`).join('')}
  </div>
  <button class="btn-secondary" onclick="addOnboardingStep()" style="margin-top:8px">+ Add Step</button>
  <br><br>
  <button class="btn-primary" onclick="saveOnboarding()">💾 Save Onboarding</button>
</div>`;
  } catch (e) { content().innerHTML = `<p class="error">${e.message}</p>`; }
}
window.addOnboardingStep = () => {
  const container = document.getElementById('ob-steps');
  const idx = container.children.length;
  const div = document.createElement('div');
  div.className = 'step-row';
  div.id = `ob-step-${idx}`;
  div.style.cssText = 'display:flex;gap:8px;margin-bottom:8px';
  div.innerHTML = `<span class="badge" style="padding:4px 8px;align-self:center">${idx+1}</span><textarea style="flex:1;min-height:60px" id="ob-step-text-${idx}"></textarea><button class="btn-danger btn-sm" onclick="removeOnboardingStep(${idx})" style="align-self:start">✕</button>`;
  container.appendChild(div);
};
window.removeOnboardingStep = (idx) => {
  document.getElementById(`ob-step-${idx}`)?.remove();
};
window.saveOnboarding = async () => {
  try {
    const steps = [];
    document.querySelectorAll('[id^="ob-step-text-"]').forEach(el => {
      const v = el.value.trim();
      if (v) steps.push(v);
    });
    await api('PUT', '/api/onboarding', {
      enabled:    document.getElementById('ob-enabled').checked,
      dm_on_join: document.getElementById('ob-dm').checked,
      steps,
    });
    toast('Onboarding saved!');
  } catch (e) { toast(e.message, 'error'); }
};

// ── Reminders ─────────────────────────────────────────────────────────────────
async function renderReminders() {
  try {
    const rows = await api('GET', '/api/reminders');
    content().innerHTML = `
<div class="page-header"><h2>⏰ Reminders</h2></div>
<div class="card">
  <p>Active reminders across the server. Users can set reminders with <code>/remind me</code>.</p>
  <table class="data-table">
    <thead><tr><th>ID</th><th>User</th><th>Due</th><th>Message</th><th>Action</th></tr></thead>
    <tbody>
      ${rows.length
        ? rows.map(r => `<tr>
            <td>${r.id}</td>
            <td><code>${r.user_id}</code></td>
            <td>${new Date(Number(r.remind_at)).toLocaleString()}</td>
            <td>${escHtml(r.message.slice(0, 80))}</td>
            <td><button class="btn-danger btn-sm" onclick="deleteReminder(${r.id})">Cancel</button></td>
          </tr>`).join('')
        : '<tr><td colspan="5"><em>No active reminders</em></td></tr>'}
    </tbody>
  </table>
</div>`;
  } catch (e) { content().innerHTML = `<p class="error">${e.message}</p>`; }
}
window.deleteReminder = async (id) => {
  if (!confirm('Cancel this reminder?')) return;
  try { await api('DELETE', `/api/reminders/${id}`); toast('Reminder cancelled!'); renderReminders(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Role Panels ───────────────────────────────────────────────────────────────
async function renderRolePanels() {
  try {
    const panels = await api('GET', '/api/rolepanels');
    const panelRows = panels.length ? panels.map(p => {
      const btnList = (p.buttons || []).map(b =>
        `<span class="badge">${escHtml(b.emoji || '')} ${escHtml(b.label)}
          <a href="#" onclick="removeRolePanelButton(${p.id},${b.id});return false;" style="color:var(--red);margin-left:4px">✕</a>
        </span>`
      ).join(' ');
      return `<tr>
        <td>${p.id}</td>
        <td>${escHtml(p.title)}</td>
        <td><span class="code">${p.channel_id}</span></td>
        <td>${btnList || '<em>none</em>'}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deleteRolePanel(${p.id})">Delete</button>
        </td>
      </tr>`;
    }).join('') : `<tr><td colspan="5" class="empty">No role panels created yet.</td></tr>`;

    content().innerHTML = `
      <h2>🎛️ Role Panels</h2>
      <p class="hint">Role panels post an embed with buttons that let members self-assign roles. Use <code>/rolepanel create</code> in Discord to create one.</p>
      <div class="card">
        <table class="data-table">
          <thead><tr><th>ID</th><th>Title</th><th>Channel</th><th>Buttons</th><th>Actions</th></tr></thead>
          <tbody>${panelRows}</tbody>
        </table>
      </div>`;
  } catch (e) { content().innerHTML = `<p class="error">${escHtml(e.message)}</p>`; }
}

window.deleteRolePanel = async (id) => {
  if (!confirm('Delete this role panel? The Discord message will remain but no longer be tracked.')) return;
  try { await api('DELETE', `/api/rolepanels/${id}`); toast('Panel deleted.'); renderRolePanels(); }
  catch (e) { toast(e.message, 'error'); }
};

window.removeRolePanelButton = async (panelId, btnId) => {
  if (!confirm('Remove this button from the panel?')) return;
  try { await api('DELETE', `/api/rolepanels/${panelId}/buttons/${btnId}`); toast('Button removed.'); renderRolePanels(); }
  catch (e) { toast(e.message, 'error'); }
};

async function renderGiveaways() {
  try {
    const rows = await api('GET', '/api/giveaways');
    const tableRows = rows.length ? rows.map(g => `
      <tr>
        <td>${g.prize}</td>
        <td>${g.winner_count}</td>
        <td>${fmt(g.entry_count || 0)}</td>
        <td>${g.ended ? '<span class="badge badge-red">Ended</span>' : '<span class="badge badge-green">Active</span>'}</td>
        <td>${fmtDate(g.end_time * 1 > 1e12 ? new Date(g.end_time) : new Date(g.end_time * 1000))}</td>
        <td>${userId(g.host_id)}</td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">No giveaways found.</td></tr>`;

    content().innerHTML = `
      <h2>🎉 Giveaways</h2>
      <div class="card">
        <div class="table-wrap"><table>
          <thead><tr><th>Prize</th><th>Winners</th><th>Entries</th><th>Status</th><th>End Time</th><th>Host</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load giveaways: ${e.message}</div>`;
  }
}

// ── Tickets ───────────────────────────────────────────────────────────────────
async function renderTickets() {
  try {
    const rows = await api('GET', '/api/tickets');
    const tableRows = rows.length ? rows.map(t => `
      <tr>
        <td>#${t.ticket_number}</td>
        <td>${userId(t.user_id)}</td>
        <td>${t.status === 'open'
          ? '<span class="badge badge-green">Open</span>'
          : '<span class="badge badge-red">Closed</span>'}</td>
        <td>${userId(t.channel_id)}</td>
        <td>${fmtDate(t.created_at)}</td>
        <td>${t.closed_at ? fmtDate(t.closed_at) : '—'}</td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">No tickets found.</td></tr>`;

    content().innerHTML = `
      <h2>🎫 Tickets</h2>
      <div class="card">
        <div class="table-wrap"><table>
          <thead><tr><th>Ticket</th><th>User</th><th>Status</th><th>Channel</th><th>Created</th><th>Closed</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load tickets: ${e.message}</div>`;
  }
}

// ── Moderation ────────────────────────────────────────────────────────────────
async function renderModeration() {
  try {
    const rows = await api('GET', '/api/moderation');
    const tableRows = rows.length ? rows.map(w => `
      <tr>
        <td>${w.id}</td>
        <td>${userId(w.user_id)}</td>
        <td>${userId(w.moderator_id)}</td>
        <td style="max-width:260px;word-break:break-word">${w.reason}</td>
        <td>${fmtDate(w.created_at)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteWarning(${w.id})">Delete</button></td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">No warnings found.</td></tr>`;

    content().innerHTML = `
      <h2>🔨 Moderation</h2>
      <div class="card">
        <div class="section-header"><h3>Warnings (Latest 100)</h3><span style="color:#8b949e;font-size:12px">${rows.length} total</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>User</th><th>Moderator</th><th>Reason</th><th>Date</th><th></th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed to load moderation: ${e.message}</div>`;
  }
}

window.deleteWarning = async (id) => {
  if (!confirm('Delete this warning? This cannot be undone.')) return;
  try { await api('DELETE', `/api/moderation/${id}`); toast('Warning deleted!'); renderModeration(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Live Logs ─────────────────────────────────────────────────────────────────
function renderLogs() {
  content().innerHTML = `
    <div class="section-header" style="margin-bottom:12px">
      <h2 style="margin:0">📜 Live Logs</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="clearLogs()">Clear</button>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#8b949e">
          <input type="checkbox" id="autoscroll" checked> Auto-scroll
        </label>
      </div>
    </div>
    <div id="log-panel"></div>`;

  if (logsSocket) logsSocket.disconnect();
  logsSocket = io({ transports: ['websocket'] });

  logsSocket.on('history', (entries) => {
    entries.forEach(appendLog);
    scrollLogs();
  });
  logsSocket.on('log', (entry) => {
    appendLog(entry);
    if (document.getElementById('autoscroll')?.checked) scrollLogs();
  });
}

function appendLog(entry) {
  const panel = document.getElementById('log-panel');
  if (!panel) return;
  const cls = { error: 'log-error', warn: 'log-warn', info: 'log-info', debug: 'log-debug' }[entry.level] || 'log-info';
  const line = document.createElement('div');
  line.className = `log-line ${cls}`;
  line.textContent = `[${entry.ts || ''}] ${entry.level?.toUpperCase()}: ${entry.message}`;
  panel.appendChild(line);
  // keep max 1000 lines
  while (panel.children.length > 1000) panel.removeChild(panel.firstChild);
}

function scrollLogs() {
  const p = document.getElementById('log-panel');
  if (p) p.scrollTop = p.scrollHeight;
}

window.clearLogs = () => {
  const p = document.getElementById('log-panel');
  if (p) p.innerHTML = '';
};

// ── Coin Packages ─────────────────────────────────────────────────────────────
async function renderCoinPackages() {
  try {
    const pkgs = await api('GET', '/api/coin-packages');
    const rows = pkgs.length ? pkgs.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${escHtml(p.name)}</td>
        <td>${fmt(p.coins)}</td>
        <td>$${(p.price_cents / 100).toFixed(2)}</td>
        <td>${p.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-red">Inactive</span>'}</td>
        <td style="display:flex;gap:6px">
          <button class="btn btn-sm" onclick="togglePkg(${p.id},${p.active ? 0 : 1})">${p.active ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-danger btn-sm" onclick="deletePkg(${p.id})">Delete</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">No packages yet.</td></tr>`;

    content().innerHTML = `
      <h2>🪙 Coin Packages</h2>
      <div class="card">
        <div class="section-header"><h3>Create Package</h3></div>
        <form id="pkg-form" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Name<input name="name" placeholder="Starter Pack" required style="width:160px"></label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Coins<input name="coins" type="number" min="1" placeholder="500" required style="width:100px"></label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:13px">Price (cents)<input name="price_cents" type="number" min="1" placeholder="499" required style="width:110px"></label>
          <button class="btn" type="submit">Add Package</button>
        </form>
      </div>
      <div class="card">
        <div class="section-header"><h3>All Packages</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Name</th><th>Coins</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;

    document.getElementById('pkg-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await api('POST', '/api/coin-packages', {
          name: fd.get('name'),
          coins: Number(fd.get('coins')),
          price_cents: Number(fd.get('price_cents')),
        });
        toast('Package created!');
        renderCoinPackages();
      } catch (err) { toast(err.message, 'error'); }
    });
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed: ${e.message}</div>`;
  }
}

window.togglePkg = async (id, active) => {
  try { await api('PUT', `/api/coin-packages/${id}`, { active }); toast(active ? 'Enabled' : 'Disabled'); renderCoinPackages(); }
  catch (e) { toast(e.message, 'error'); }
};
window.deletePkg = async (id) => {
  if (!confirm('Delete this package?')) return;
  try { await api('DELETE', `/api/coin-packages/${id}`); toast('Deleted'); renderCoinPackages(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Payment Transactions ──────────────────────────────────────────────────────
async function renderPaymentTransactions() {
  try {
    const rows = await api('GET', '/api/payment-transactions');
    const tableRows = rows.length ? rows.map(t => `
      <tr>
        <td>${t.id}</td>
        <td>${userId(t.discord_id)}</td>
        <td><span class="badge badge-blue">${t.processor}</span></td>
        <td><code style="font-size:11px">${escHtml(t.external_id)}</code></td>
        <td>${fmt(t.coins_granted)}</td>
        <td>$${(t.amount_cents / 100).toFixed(2)}</td>
        <td>${t.status === 'completed'
          ? '<span class="badge badge-green">Completed</span>'
          : `<span class="badge badge-red">${escHtml(t.status)}</span>`}</td>
        <td>${fmtDate(t.created_at)}</td>
      </tr>`).join('') : `<tr><td colspan="8" class="empty">No transactions yet.</td></tr>`;

    content().innerHTML = `
      <h2>💳 Payment Transactions</h2>
      <div class="card">
        <div class="section-header"><h3>Latest 100 Transactions</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>ID</th><th>Discord</th><th>Processor</th><th>External ID</th><th>Coins</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>`;
  } catch (e) {
    content().innerHTML = `<div class="loading" style="color:#f85149">Failed: ${e.message}</div>`;
  }
}

// ── Nextdactyl Users ──────────────────────────────────────────────────────────
async function renderNextdactylUsers() {
  // Try Nextdactyl integration first; fall back to local linked_accounts on any failure
  let ndOk = false, statsRes = {}, ndUsers = [];
  try {
    const [sr, ur] = await Promise.all([
      api('GET', '/api/nextdactyl/stats'),
      api('GET', '/api/nextdactyl/users'),
    ]);
    statsRes = sr;
    ndUsers  = ur.users || ur;
    ndOk     = true;
  } catch (_) { /* will fall back below */ }

  if (ndOk) {
    const tableRows = ndUsers.length ? ndUsers.map(u => `
      <tr>
        <td>${userId(u.discordId)}</td>
        <td>${escHtml(u.username || '—')}</td>
        <td>${fmt(u.coins ?? 0)}</td>
        <td style="display:flex;gap:6px">
          <input id="coins-${u.discordId}" type="number" value="${u.coins ?? 0}" min="0" style="width:90px">
          <button class="btn btn-sm" onclick="setCoins('${u.discordId}')">Set</button>
          <button class="btn btn-sm" onclick="addCoins('${u.discordId}')">+Add</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="4" class="empty">No users found.</td></tr>`;

    content().innerHTML = `
      <h2>🖥️ Nextdactyl Users</h2>
      <div class="card" style="display:flex;gap:30px;padding:18px 24px">
        <div><div style="font-size:2rem;font-weight:700;color:var(--accent)">${fmt(statsRes.userCount ?? 0)}</div><div style="color:var(--muted);font-size:13px">Total Users</div></div>
        <div><div style="font-size:2rem;font-weight:700;color:var(--success)">${fmt(statsRes.totalCoins ?? 0)}</div><div style="color:var(--muted);font-size:13px">Total Coins</div></div>
      </div>
      <div class="card">
        <div class="section-header"><h3>All Users</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Discord ID</th><th>Username</th><th>Coins</th><th>Edit</th></tr></thead>
          <tbody>${tableRows}</tbody>
        </table></div>
      </div>`;
    return;
  }

  // ── Fallback: Nextdactyl unreachable — show linked accounts from DB ──────────
  let linked = [];
  try { linked = await api('GET', '/api/linked-accounts'); } catch (_) { /* empty */ }

  const tableRows = linked.length ? linked.map(u => `
    <tr>
      <td>${userId(u.discord_id)}</td>
      <td>${escHtml(u.email || '—')}</td>
      <td>${u.confirmed ? '✅ Confirmed' : '⏳ Pending'}</td>
      <td>${fmtDate(u.linked_at)}</td>
    </tr>`).join('') : `<tr><td colspan="4" class="empty">No linked accounts found.</td></tr>`;

  content().innerHTML = `
    <h2>🖥️ Nextdactyl Users</h2>
    <div class="card" style="border-left:4px solid #f0a500;padding:14px 18px;margin-bottom:16px">
      <strong>⚠️ Nextdactyl integration not connected</strong><br>
      <span style="color:var(--muted);font-size:13px">
        Set <code>NEXTDACTYL_URL</code> and <code>NEXTDACTYL_SYNC_SECRET</code> in your <code>.env</code>
        to enable coin management. Showing Discord-linked accounts from the database instead.
      </span>
    </div>
    <div class="card">
      <div class="section-header"><h3>Linked Accounts (${linked.length})</h3></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Discord ID</th><th>Email</th><th>Status</th><th>Linked At</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>
    </div>`;
}

window.setCoins = async (id) => {
  const val = Number(document.getElementById(`coins-${id}`)?.value);
  try { await api('PUT', `/api/nextdactyl/users/${id}/coins`, { coins: val }); toast('Coins updated!'); renderNextdactylUsers(); }
  catch (e) { toast(e.message, 'error'); }
};
window.addCoins = async (id) => {
  const val = Number(document.getElementById(`coins-${id}`)?.value);
  try { await api('POST', `/api/nextdactyl/users/${id}/coins/add`, { amount: val }); toast(`+${fmt(val)} coins added!`); renderNextdactylUsers(); }
  catch (e) { toast(e.message, 'error'); }
};

// ── Payment Processors ────────────────────────────────────────────────────────
async function renderPaymentProcessors() {
  let cfg = {};
  try { cfg = await api('GET', '/api/payment-config'); } catch { /* empty */ }

  function field(key, label, type = 'text', opts = []) {
    const val = cfg[key] || '';
    const configured = val ? '✅' : '<span style="color:var(--danger)">✗ Not set</span>';
    if (opts.length) {
      const options = opts.map(o => `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');
      return `
        <div class="proc-field">
          <label>${label} ${configured}</label>
          <div style="display:flex;gap:8px">
            <select id="cfg-${key}" style="flex:1">${options}</select>
            <button class="btn btn-sm" onclick="saveConfig('${key}')">Save</button>
          </div>
        </div>`;
    }
    return `
      <div class="proc-field">
        <label>${label} ${configured}</label>
        <div style="display:flex;gap:8px">
          <input id="cfg-${key}" type="${type}" placeholder="${val || 'Not configured'}" style="flex:1;font-family:monospace;font-size:12px">
          <button class="btn btn-sm" onclick="saveConfig('${key}')">Save</button>
        </div>
        ${val ? `<div style="font-size:11px;color:var(--muted);margin-top:2px">Current: <code>${escHtml(val)}</code></div>` : ''}
      </div>`;
  }

  content().innerHTML = `
    <h2>🔑 Payment Processors</h2>
    <p style="color:var(--muted);margin-bottom:24px;font-size:13px">Config is saved to the database and takes effect immediately — no restart needed.</p>

    <div class="card">
      <div class="section-header"><h3><img src="https://img.shields.io/badge/Stripe-635bff?style=flat&logo=stripe&logoColor=white" style="height:20px;vertical-align:middle"> Stripe</h3></div>
      <div class="proc-fields">
        ${field('stripe_secret_key',      'Secret Key',       'password')}
        ${field('stripe_webhook_secret',  'Webhook Secret',   'password')}
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--muted)">
        Webhook URL: <code>${location.origin}/buy/webhook/stripe</code> &mdash; event: <code>checkout.session.completed</code>
      </div>
    </div>

    <div class="card">
      <div class="section-header"><h3><img src="https://img.shields.io/badge/PayPal-003087?style=flat&logo=paypal&logoColor=white" style="height:20px;vertical-align:middle"> PayPal</h3></div>
      <div class="proc-fields">
        ${field('paypal_client_id',      'Client ID',       'text')}
        ${field('paypal_client_secret',  'Client Secret',   'password')}
        ${field('paypal_webhook_id',     'Webhook ID',      'text')}
        ${field('paypal_mode',           'Mode',            'text', ['live', 'sandbox'])}
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--muted)">
        Webhook URL: <code>${location.origin}/buy/webhook/paypal</code> &mdash; event: <code>PAYMENT.CAPTURE.COMPLETED</code>
      </div>
    </div>

    <div class="card">
      <div class="section-header"><h3><img src="https://img.shields.io/badge/Square-3e4348?style=flat&logo=square&logoColor=white" style="height:20px;vertical-align:middle"> Square</h3></div>
      <div class="proc-fields">
        ${field('square_access_token',          'Access Token',          'password')}
        ${field('square_webhook_signature_key', 'Webhook Signature Key', 'password')}
        ${field('square_location_id',           'Location ID',           'text')}
        ${field('square_environment',           'Environment',           'text', ['production', 'sandbox'])}
      </div>
      <div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--muted)">
        Webhook URL: <code>${location.origin}/buy/webhook/square</code> &mdash; event: <code>payment.completed</code>
      </div>
    </div>`;

  // Inject quick styles for proc-fields
  if (!document.getElementById('proc-styles')) {
    const s = document.createElement('style');
    s.id = 'proc-styles';
    s.textContent = `.proc-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}.proc-field label{display:block;font-size:12px;color:var(--muted);margin-bottom:5px}.proc-field input,.proc-field select{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:7px 10px;border-radius:5px}`;
    document.head.appendChild(s);
  }
}

window.saveConfig = async (key) => {
  const input = document.getElementById(`cfg-${key}`);
  const value = input?.value?.trim();
  if (!value) { toast('Enter a value first', 'error'); return; }
  try {
    const r = await api('PUT', `/api/payment-config/${key}`, { value });
    toast(`Saved: ${r.masked}`);
    renderPaymentProcessors();
  } catch (e) { toast(e.message, 'error'); }
};
