# 🖥️ Tab2RemoteScreen

Tab2RemoteScreen makes it easy to send the current browser tab from a desktop Chrome to a remote display (mini‑PC, HTPC, kiosk, or single‑board computer) running Chromium.

Use cases:

- 📺 TVs and external displays
- 🧑‍🏫 Presentations
- 🎥 Watching YouTube, Vimeo or Twitch VODs on another screen

It supports transferring video timestamps when possible so playback resumes at the same position on the remote screen.

---

## ✨ Features

- 🚀 One‑click send from Chrome
- ⏱ Keeps video playback time when available
- 🧠 Single‑window or multi‑window Chromium control
- 🌐 Lightweight HTTP server (no external framework)
- 🖥 Works on X11 and Wayland (optimized for embedded displays)
- 🔐 Local network only — no cloud dependency

---

# 🧩 How it works

Chrome extension → HTTP POST → Server → Chromium

1. Click the extension icon
2. Extension captures the current tab URL
3. If a video is playing, the extension includes the playback timestamp
4. The URL (and optional timestamp) is sent to the server
5. The server launches Chromium on the remote device and opens the URL

---

# ⚙️ Server — Quick setup

1. Install dependencies (example for Debian/Ubuntu):

```bash
sudo apt install chromium python3
```

2. Start the server (example):

```bash
python3 Tab2RemoteServer.py \
  --behavior replace \
  --chromium-cmd chromium \
  --x11 \
  --chromium-arg="--kiosk"
```

Check the server health:

```bash
curl http://localhost:8080/health
```

Default launch (uses sensible defaults):

```bash
./Tab2RemoteServer.py
```

Default values:

- Host: 0.0.0.0
- Port: 8080
- Behavior: replace
- Wayland enabled by default
- DISPLAY=:0
- Auto‑maximize enabled

---

# 🌐 Chrome extension — Installation

1. Open chrome://extensions in Chrome
2. Enable Developer mode
3. Click "Load unpacked" and select the Tab2RemoteScreen/ folder
4. Open the extension options and set your server address (host:port)

Click the extension icon to send the current tab to the remote screen.

---

## ⚙️ Optional: systemd service

You can run the server as a systemd service on Linux. Example unit file (/etc/systemd/system/tab2remoteserver.service):

```ini
[Unit]
Description=Tab2RemoteServer
After=network.target

[Service]
Type=simple
User=media
WorkingDirectory=/opt/Tab2RemoteScreen
ExecStart=/usr/bin/python3 /opt/Tab2RemoteScreen/Tab2RemoteServer.py --host 0.0.0.0 --port 8080 --behavior replace
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

After creating the unit file:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now tab2remoteserver.service
sudo journalctl -u tab2remoteserver -f
```

---


## ⚙️ Command line options

Network

- --host: IP address to bind (default: 0.0.0.0)
- --port: Listening port (default: 8080)

Chromium window behavior

- --behavior [multi|replace|reuse]
  - multi: open a new Chromium window for each POST
  - replace: close the previous window and launch a new one (default)
  - reuse: currently falls back to replace (true reuse via CDP not implemented)

Display (Wayland / X11)

- Wayland is used by default. When using Wayland the script adds:

  --enable-features=UseOzonePlatform
  --ozone-platform=wayland

- --x11: force X11 (disables Wayland/Ozone flags)
- --display: set the DISPLAY environment variable (e.g. --display :0). Use --display "" to avoid setting DISPLAY.

Window maximization

- --no-maximize: disable automatic maximize
- --maximize-delay <seconds>: delay before maximize (default: 0.8)

HTTP limits

- --max-body <bytes>: maximum HTTP body size (default: 4096). Exceeding this returns HTTP 413.

Chromium configuration

- --chromium-cmd <path>: path to Chromium binary. If omitted, the script tries `chromium` then `chromium-browser`.
- --chromium-arg: repeatable, adds extra arguments to Chromium (examples: --chromium-arg="--kiosk", --chromium-arg="--incognito").

---

## Examples

Kiosk mode (Wayland):

```bash
./Tab2RemoteServer.py \
  --behavior replace \
  --chromium-arg="--kiosk"
```

Multi‑window mode with X11:

```bash
./Tab2RemoteServer.py \
  --behavior multi \
  --x11
```

Localhost‑only server:

```bash
./Tab2RemoteServer.py \
  --host 127.0.0.1 \
  --port 9090
```

---

## ⏱ Video timestamp support

The extension detects HTML5 video playback and appends a timestamp when possible. Supported sources include YouTube, Vimeo, Twitch VODs and generic HTML5 video. Live streams are not supported.

Example generated URL:

```
https://www.youtube.com/watch?v=xxxx&t=127s
```

---

## 🔐 Security notes

- This tool is designed for local network use. There is no authentication by default.
- If you expose the server externally, consider binding to 127.0.0.1 behind a reverse proxy, or implement a token header.

---
## 🚀 Roadmap

- Play/pause synchronization
- Multi‑screen synchronization
- Authentication token support
- Remote control (keyboard/mouse)
- Mobile sender app
- Chromium DevTools reuse mode (true reuse)

---

## 🧾 License

MIT 💕

---

## 🙌 Credits

Built for personal media and presentation workflows on small displays and kiosks. Contributions are welcome.
