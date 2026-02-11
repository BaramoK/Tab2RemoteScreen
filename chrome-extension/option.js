const input = document.getElementById("host");

chrome.storage.sync.get(
  { raspberryHost: "" },
  (config) => input.value = config.raspberryHost
);

document.getElementById("save").onclick = () => {
  chrome.storage.sync.set({
    raspberryHost: input.value
  });
};
