// helper: send payload to server, wait for confirmation and close the originating tab
// closeOnConfirm (boolean) is a per-server preference; if omitted we'll fall back to the
// previous global preference in storage to remain backwards compatible.
async function sendPayloadAndMaybeClose(tabId, endpoint, body, timeoutMs = 5000, closeOnConfirm){
  const controller = new AbortController();
  const id = setTimeout(()=> controller.abort(), timeoutMs);
  try{
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(id);

    if(!resp.ok){
      console.warn('Serveur répondu avec un status non-ok:', resp.status);
      return false;
    }

    // try to parse JSON and expect { status: 'ok' }
    let j = null;
    try{ j = await resp.json(); }catch(e){ /* ignore parse errors */ }

    if(j && j.status === 'ok'){
      // If caller provided a per-server preference use it. Otherwise fall back to the
      // legacy global preference stored in chrome.storage.sync.
      if(typeof closeOnConfirm === 'boolean'){
        if(closeOnConfirm){ try{ chrome.tabs.remove(tabId); }catch(e){ console.warn('Impossible de fermer l\'onglet', e); } return true; }
        console.log('Confirmation reçue mais préférence serveur: ne pas fermer l\'onglet.');
        return false;
      }

      // fallback to legacy behaviour
      try{
        const cfg = await new Promise(res => chrome.storage.sync.get({ closeOnConfirm: true }, res));
        if(cfg.closeOnConfirm){ try{ chrome.tabs.remove(tabId); }catch(e){ console.warn('Impossible de fermer l\'onglet', e); } return true; }
        else { console.log('Confirmation reçue mais préférence utilisateur globale: ne pas fermer l\'onglet.'); return false; }
      }catch(e){
        console.warn('Erreur lecture préférence closeOnConfirm', e);
        try{ chrome.tabs.remove(tabId); }catch(e){ /* ignore */ }
        return true;
      }
    }

    console.warn('Réponse serveur reçue mais sans confirmation {status: "ok"}', j);
    return false;
  }catch(e){
    clearTimeout(id);
    console.error('Erreur lors de l\'envoi au serveur (ou timeout)', e);
    return false;
  }
}

chrome.action.onClicked.addListener(async (tab) => {
  chrome.storage.sync.get(
    { servers: [], selectedServerId: null, serverHost: "", defaultKiosk: false, closeOnConfirm: true },
    async (config) => {

      let finalUrl = tab.url;

      try {
        // Injecte du JS dans la page pour lire le timestamp
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const video = document.querySelector("video");
            if (!video) return null;
            return Math.floor(video.currentTime);
          }
        });

        const t = result?.result;

        if (t && t > 0) {
          const url = new URL(tab.url);

          // YouTube & compatibles
          if (url.hostname.includes("youtube.com")) {
            url.searchParams.set("t", `${t}s`);
          } else {
            // fallback générique
            url.searchParams.set("t", t);
          }

          finalUrl = url.toString();
        }

      } catch (e) {
        console.warn("Impossible de lire le timestamp", e);
      }

      // Determine selected server. Support legacy single serverHost as well.
      let serverEntry = null;
      if (config.servers && config.servers.length > 0) {
        serverEntry = config.servers.find(s => s.id === config.selectedServerId) || config.servers[0];
        // ensure serverEntry has closeOnConfirm property (fallback to global if missing)
        if(typeof serverEntry.closeOnConfirm === 'undefined') serverEntry.closeOnConfirm = !!config.closeOnConfirm;
      } else if (config.serverHost) {
        serverEntry = { host: config.serverHost, kiosk: config.defaultKiosk, closeOnConfirm: !!config.closeOnConfirm };
      }

      if (!serverEntry || !serverEntry.host) {
        console.warn("Aucun serveur configuré — ouvrez la page d'options pour définir l'adresse.");
        return;
      }

      const endpoint = `http://${serverEntry.host}`;

      // Toujours envoyer du JSON { url, kiosk } — plus simple côté serveur.
      const body = JSON.stringify({ url: finalUrl, kiosk: !!serverEntry.kiosk });

      // send and close tab only if server confirms
      sendPayloadAndMaybeClose(tab.id, endpoint, body, 5000, !!serverEntry.closeOnConfirm).then(didClose => {
        if(didClose) console.log('Serveur confirmé — onglet fermé');
        else console.log('Envoi effectué mais onglet non fermé (pas de confirmation)');
      });
    }
  );
});

// Allow popup to request sending current tab
chrome.runtime.onMessage.addListener((msg, sender, sendResp) => {
  if(msg && msg.type === 'send-current-tab'){
    (async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if(tabs && tabs[0]){
        // Reuse same logic as when action is clicked
        chrome.action.onClicked.dispatch(tabs[0]);
      }
    })();
  }

  if(msg && msg.type === 'send-to-server' && msg.id){
    (async () => {
      // prefer provided tabId (popup passed it) to avoid race when popup closes
      let tab;
      if(msg.tabId){
        const t = await chrome.tabs.get(msg.tabId).catch(()=>null);
        if(t) tab = t;
      }
      if(!tab){
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if(!tabs || !tabs[0]) return;
        tab = tabs[0];
      }

      // read timestamp similar to action handler
      let finalUrl = tab.url;
      try{
        const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
          const video = document.querySelector('video'); if(!video) return null; return Math.floor(video.currentTime);
        }});
        const t = result?.result;
        if(t && t > 0){ const url = new URL(tab.url); if(url.hostname.includes('youtube.com')) url.searchParams.set('t', `${t}s`); else url.searchParams.set('t', t); finalUrl = url.toString(); }
      }catch(e){ console.warn('Impossible de lire le timestamp', e); }

      // get server by id
      chrome.storage.sync.get({ servers: [] }, (cfg) => {
        const s = (cfg.servers || []).find(x => x.id === msg.id);
        if(!s || !s.host) { console.warn('Serveur introuvable'); return; }
        const endpoint = `http://${s.host}`;
        const body = JSON.stringify({ url: finalUrl, kiosk: !!s.kiosk });
        // same: only close the tab if server confirms (use server-specific preference)
        sendPayloadAndMaybeClose(tab.id, endpoint, body, 5000, !!s.closeOnConfirm).then(didClose => {
          if(didClose) console.log('Envoyé à', s.host, '- serveur confirmé, onglet fermé');
          else console.log('Envoyé à', s.host, '- pas de confirmation, onglet conservé');
        });
      });
    })();
  }
});
