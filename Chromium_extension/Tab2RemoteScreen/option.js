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
    sel.onclick = () => { 
      // Persist selected server and update UI to reflect selection
      chrome.storage.sync.set({ selectedServerId: s.id }, () => {
        renderServers(servers, s.id);
      });
    };
    const del = document.createElement('button'); del.textContent = '✖'; del.style.background = 'transparent'; del.onclick = () => {
      // Remove server from list and persist change. If the removed server was selected,
      // pick a new default (first server) or clear selection.
      const idx = servers.findIndex(x=>x.id===s.id);
      if(idx>=0){
        const wasSelected = servers[idx].id === selectedId;
        servers.splice(idx,1);
        const newSelected = wasSelected ? (servers[0] ? servers[0].id : null) : selectedId;
        chrome.storage.sync.set({ servers: servers, selectedServerId: newSelected }, () => {
          renderServers(servers, newSelected);
        });
      }
    };
    row.appendChild(sel); row.appendChild(label); row.appendChild(del);
    serversListEl.appendChild(row);
  });

  // After rendering list, populate the form fields for the selected server (if any)
  const selected = (servers || []).find(x=>x.id === selectedId) || null;
  populateForm(selected);
}

function populateForm(selectedServer){
  if(selectedServer){
    newName.value = selectedServer.name || '';
    newHost.value = selectedServer.host || '';
    newKiosk.checked = !!selectedServer.kiosk;
    // per-server closeOnConfirm
    const c = typeof selectedServer.closeOnConfirm === 'undefined' ? false : !!selectedServer.closeOnConfirm;
    closeOnConfirmEl.checked = c;
    // per-server streamlink option
    const s = typeof selectedServer.useStreamlink === 'undefined' ? false : !!selectedServer.useStreamlink;
    newStreamlinkEl.checked = s;
  } else {
    newName.value = '';
    newHost.value = '';
    newKiosk.checked = false;
    closeOnConfirmEl.checked = false;
    newStreamlinkEl.checked = false;
  }
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

// per-server "close on confirm" checkbox
const closeOnConfirmEl = document.getElementById('closeOnConfirm');
closeOnConfirmEl.onchange = () => {
  // Persist change to the currently selected server
  chrome.storage.sync.get({ servers: [], selectedServerId: null }, (cfg) => {
    const selId = cfg.selectedServerId;
    if(!selId) return showStatus();
    const idx = (cfg.servers || []).findIndex(x=>x.id === selId);
    if(idx >= 0){
      cfg.servers[idx].closeOnConfirm = !!closeOnConfirmEl.checked;
      chrome.storage.sync.set({ servers: cfg.servers }, () => {
        renderServers(cfg.servers, selId);
        showStatus('Enregistré');
      });
    }
  });
};

// per-server "use streamlink" checkbox
const newStreamlinkEl = document.getElementById('newStreamlink');
newStreamlinkEl.onchange = () => {
  chrome.storage.sync.get({ servers: [], selectedServerId: null }, (cfg) => {
    const selId = cfg.selectedServerId;
    if(!selId) return showStatus();
    const idx = (cfg.servers || []).findIndex(x=>x.id === selId);
    if(idx >= 0){
      cfg.servers[idx].useStreamlink = !!newStreamlinkEl.checked;
      chrome.storage.sync.set({ servers: cfg.servers }, () => {
        renderServers(cfg.servers, selId);
        showStatus('Enregistré');
      });
    }
  });
};

addBtn.onclick = () => {
  const hostVal = newHost.value.trim(); if(!hostVal) return showStatus('Hôte requis');
  chrome.storage.sync.get({ servers: [] }, (cfg) => {
    const s = { id: makeId(), name: newName.value.trim(), host: hostVal, kiosk: !!newKiosk.checked, closeOnConfirm: !!closeOnConfirmEl.checked };
    s.useStreamlink = !!newStreamlinkEl.checked;
    cfg.servers.push(s);
    // Persist the new server and select it
    chrome.storage.sync.set({ servers: cfg.servers, selectedServerId: s.id }, () => {
      renderServers(cfg.servers, s.id);
      showStatus('Ajouté');
    });
  });
};

saveAllBtn.onclick = () => {
  // If a server is selected, update its values. Otherwise just show status.
  chrome.storage.sync.get({ servers: [], selectedServerId: null }, (cfg) => {
    const selId = cfg.selectedServerId;
    if(selId){
      const idx = (cfg.servers || []).findIndex(x=>x.id === selId);
      if(idx >= 0){
        cfg.servers[idx].name = newName.value.trim();
        cfg.servers[idx].host = newHost.value.trim();
        cfg.servers[idx].kiosk = !!newKiosk.checked;
        cfg.servers[idx].closeOnConfirm = !!closeOnConfirmEl.checked;
        cfg.servers[idx].useStreamlink = !!newStreamlinkEl.checked;
        chrome.storage.sync.set({ servers: cfg.servers }, () => {
          renderServers(cfg.servers, selId);
          showStatus('Enregistré');
        });
        return;
      }
    }
    showStatus();
  });
};

resetBtn.onclick = () => {
  chrome.storage.sync.set({ servers: [], selectedServerId: null, serverHost: '' }, () => {
    renderServers([]);
    populateForm(null);
    showStatus('Réinitialisé');
  });
};








