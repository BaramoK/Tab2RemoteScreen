const input = document.getElementById("host");
const kioskCb = document.getElementById("kiosk");
const saveBtn = document.getElementById("save");
const resetBtn = document.getElementById("reset");
const statusEl = document.getElementById("status");

function showStatus(msg = '✓ Enregistré'){
  statusEl.textContent = msg;
  statusEl.style.display = 'inline-block';
  setTimeout(()=> statusEl.style.display = 'none', 2000);
}

chrome.storage.sync.get(
  { serverHost: "", defaultKiosk: false },
  (config) => {
    input.value = config.serverHost || '';
    kioskCb.checked = !!config.defaultKiosk;
  }
);

saveBtn.onclick = () => {
  chrome.storage.sync.set({
    serverHost: input.value.trim(),
    defaultKiosk: kioskCb.checked
  }, () => showStatus());
};

resetBtn.onclick = () => {
  // Reset to defaults
  input.value = '';
  kioskCb.checked = false;
  chrome.storage.sync.set({ serverHost: '', defaultKiosk: false }, () => showStatus('Réinitialisé'));
};

// Allow pressing Enter in the host field to save
input.addEventListener('keydown', (e) => { if(e.key === 'Enter') saveBtn.click(); });
