chrome.action.onClicked.addListener(async (tab) => {
  chrome.storage.sync.get(
    { raspberryHost: "pimok:7777" },
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

      const endpoint = `http://${config.raspberryHost}`;

      fetch(endpoint, {
        method: "POST",
        body: finalUrl
      }).then(r => {
        console.log("Envoyé", finalUrl);
      }).catch(console.error);
    }
  );
});
