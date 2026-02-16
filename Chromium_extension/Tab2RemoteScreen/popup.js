const listEl = document.getElementById('list');
const openOptionsBtn = document.getElementById('openOptions');
const refreshBtn = document.getElementById('refresh');

function render(servers, selectedId){
  listEl.innerHTML = '';
  if(!servers || servers.length === 0){
    const el = document.createElement('div'); el.textContent = 'Aucun serveur configuré.'; listEl.appendChild(el); return;
  }

  servers.forEach(s => {
    const row = document.createElement('div'); row.className = 'item';
    row.dataset.serverId = s.id;
    const statusDot = document.createElement('span'); statusDot.className = 'status-dot unknown';
    const host = document.createElement('div'); host.className = 'host'; host.textContent = s.name ? `${s.name} (${s.host})` : s.host;
    const btn = document.createElement('button'); btn.textContent = '📤 Envoyer'; btn.className = 'primary';
    btn.onclick = () => {
      // get active tab first, then send message and close popup only after message is queued
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0]) return;
        chrome.runtime.sendMessage({ type: 'send-to-server', id: s.id, tabId: tabs[0].id }, () => {
          window.close();
        });
      });
    };
    row.appendChild(statusDot);
    row.appendChild(host);
    row.appendChild(btn);
    listEl.appendChild(row);
  });
}

// Simple health-check: try GET https://host/health or http://host/health depending on host string
function checkServerHealth(host, cb){
  // host may include scheme or not. Normalize.
  let url = host;
  if(!/^https?:\/\//i.test(host)){
    url = 'http://' + host;
  }
  // try /health
  const healthUrl = url.replace(/\/$/, '') + '/health';
  // use fetch with a short timeout
  const controller = new AbortController();
  const timeout = setTimeout(()=> controller.abort(), 3000);
  fetch(healthUrl, { method: 'GET', signal: controller.signal }).then(resp => {
    clearTimeout(timeout);
    if(resp.ok) return cb(true);
    return cb(false);
  }).catch(() => {
    clearTimeout(timeout);
    return cb(false);
  });
}

// Update status dots after rendering
function updateStatuses(){
  chrome.storage.sync.get({ servers: [] }, (cfg) => {
    const servers = cfg.servers || [];
    servers.forEach(s => {
      // find the corresponding row by server id (handles duplicate hosts)
      const row = document.querySelector(`.item[data-server-id="${s.id}"]`);
      if(!row) return;
      const dot = row.querySelector('.status-dot');
      if(!dot) return;
      dot.className = 'status-dot unknown';
      checkServerHealth(s.host, (ok) => {
        dot.className = 'status-dot ' + (ok ? 'online' : 'offline');
      });
    });
  });
}

function load(){
  chrome.storage.sync.get({ servers: [], selectedServerId: null }, (cfg) => {
    render(cfg.servers, cfg.selectedServerId);
    // update statuses after render
    updateStatuses();
  });
}

openOptionsBtn.onclick = () => chrome.runtime.openOptionsPage();
refreshBtn.onclick = load;

load();

// removed global send button — sending is done per-server via the per-row buttons
