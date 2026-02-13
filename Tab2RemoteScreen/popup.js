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
    row.appendChild(host); row.appendChild(btn);
    listEl.appendChild(row);
  });
}

function load(){
  chrome.storage.sync.get({ servers: [], selectedServerId: null }, (cfg) => {
    render(cfg.servers, cfg.selectedServerId);
  });
}

openOptionsBtn.onclick = () => chrome.runtime.openOptionsPage();
refreshBtn.onclick = load;

load();

// removed global send button — sending is done per-server via the per-row buttons
