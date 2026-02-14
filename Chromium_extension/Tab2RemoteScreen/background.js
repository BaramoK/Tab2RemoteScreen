chrome.action.onClicked.addListener(async (tab) => {
  chrome.storage.sync.get(
    { servers: [], selectedServerId: null, serverHost: "", defaultKiosk: false },
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
      } else if (config.serverHost) {
        serverEntry = { host: config.serverHost, kiosk: config.defaultKiosk };
      }

      if (!serverEntry || !serverEntry.host) {
        console.warn("Aucun serveur configuré — ouvrez la page d'options pour définir l'adresse.");
        return;
      }

      const endpoint = `http://${serverEntry.host}`;

      // Toujours envoyer du JSON { url, kiosk } — plus simple côté serveur.
      const body = JSON.stringify({ url: finalUrl, kiosk: !!serverEntry.kiosk });

      fetch(endpoint, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body
      }).then(r => {
        console.log("Envoyé", finalUrl, "kiosk=", !!serverEntry.kiosk);
      }).catch(console.error);
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
        fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then(()=> console.log('Envoyé à', s.host)).catch(console.error);
      });
    })();
  }
});
