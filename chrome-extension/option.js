const serversListEl = document.getElementById('serversList');
const addBtn = document.getElementById('add');
const saveAllBtn = document.getElementById('saveAll');
const resetBtn = document.getElementById('reset');
const statusEl = document.getElementById('status');
const newName = document.getElementById('newName');
const newHost = document.getElementById('newHost');
const newKiosk = document.getElementById('newKiosk');

function showStatus(msg = '✓ Enregistré'){
  statusEl.textContent = msg;
  statusEl.style.display = 'inline-block';
  setTimeout(()=> statusEl.style.display = 'none', 2000);
}

function makeId(){ return Math.random().toString(36).slice(2,9); }

function renderServers(servers, selectedId){
  serversListEl.innerHTML = '';
  servers.forEach(s => {
    const row = document.createElement('div');
    row.style.display = 'flex'; row.style.gap = '8px'; row.style.alignItems = 'center';
    const label = document.createElement('div'); label.textContent = s.name ? `${s.name} (${s.host})` : s.host; label.style.flex = '1';
    const sel = document.createElement('input'); sel.type = 'radio'; sel.name = 'selected'; sel.checked = s.id === selectedId;
    sel.onclick = () => { chrome.storage.sync.set({ selectedServerId: s.id }); };
    const del = document.createElement('button'); del.textContent = '✖'; del.style.background = 'transparent'; del.onclick = () => {
      const idx = servers.findIndex(x=>x.id===s.id); if(idx>=0){ servers.splice(idx,1); renderServers(servers); }
    };
    row.appendChild(sel); row.appendChild(label); row.appendChild(del);
    serversListEl.appendChild(row);
  });
}

chrome.storage.sync.get({ servers: [], selectedServerId: null }, (cfg) => {
  // Legacy migration: if single server stored as serverHost, convert it to servers array
  chrome.storage.sync.get({ serverHost: '' }, (legacy) => {
    if(legacy.serverHost && (!cfg.servers || cfg.servers.length === 0)){
      const migrated = [{ id: makeId(), name: '', host: legacy.serverHost, kiosk: false }];
      chrome.storage.sync.set({ servers: migrated, selectedServerId: migrated[0].id }, () => {
        renderServers(migrated, migrated[0].id);
      });
    } else {
      renderServers(cfg.servers || [], cfg.selectedServerId);
    }
  });
});

addBtn.onclick = () => {
  const hostVal = newHost.value.trim(); if(!hostVal) return showStatus('Hôte requis');
  chrome.storage.sync.get({ servers: [] }, (cfg) => {
    const s = { id: makeId(), name: newName.value.trim(), host: hostVal, kiosk: !!newKiosk.checked };
    cfg.servers.push(s);
    chrome.storage.sync.set({ servers: cfg.servers }, () => {
      renderServers(cfg.servers);
      newName.value = ''; newHost.value = ''; newKiosk.checked = false;
      showStatus('Ajouté');
    });
  });
};

saveAllBtn.onclick = () => {
  // Nothing special — servers are already saved on add/delete; but ensure status
  showStatus();
};

resetBtn.onclick = () => {
  chrome.storage.sync.set({ servers: [], selectedServerId: null, serverHost: '' }, () => {
    renderServers([]);
    showStatus('Réinitialisé');
  });
};


