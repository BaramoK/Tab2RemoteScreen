const input = document.getElementById("host");
const kioskCb = document.getElementById("kiosk");

chrome.storage.sync.get(
  { serverHost: "", defaultKiosk: false },
  (config) => {
    input.value = config.serverHost;
    kioskCb.checked = !!config.defaultKiosk;
  }
);

document.getElementById("save").onclick = () => {
  chrome.storage.sync.set({
    serverHost: input.value,
    defaultKiosk: kioskCb.checked
  });
};
