chrome.action.onClicked.addListener(async (tab) => {
  chrome.storage.sync.get(
    { serverHost: "", defaultKiosk: false },
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

      // If no host is configured, don't attempt to send anything.
      if (!config.serverHost) {
        console.warn("Aucun serveur configuré — ouvrez la page d'options pour définir l'adresse.");
        return;
      }

      const endpoint = `http://${config.serverHost}`;

      // Toujours envoyer du JSON { url, kiosk } — plus simple côté serveur.
      const body = JSON.stringify({ url: finalUrl, kiosk: !!config.defaultKiosk });

      fetch(endpoint, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body
      }).then(r => {
        console.log("Envoyé", finalUrl, "kiosk=", !!config.defaultKiosk);
      }).catch(console.error);
    }
  );
});
