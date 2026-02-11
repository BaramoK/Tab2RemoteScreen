# 🖥️ Tab2Screen

**Tab2Screen** lets you send the current browser tab from your desktop Chrome to a remote screen (Raspberry Pi, mini‑PC, HTPC, kiosk…) running Chromium.
Perfect for:
- 📺 TVs & external displays
- 🍓 Raspberry Pi media screens
- 🧑‍🏫 Presentations
- 🎥 Watching YouTube/Vimeo/Twitch on another screen

✅ Supports **video timestamp transfer** (YouTube, HTML5 video, VODs).
---
## ✨ Features
- 🚀 One‑click send from Chrome
- ⏱ Preserves video playback time when possible
- 🧠 Single-window or multi-window Chromium management
- 🌐 Lightweight HTTP server (no framework)
- 🖥 Works with X11 or Wayland
- 🍓 Optimized for Raspberry Pi
- 🔐 No cloud, fully local
---
## 🧩 How It Works
Chrome Extension ──► HTTP POST ──► Raspberry Pi ──► Chromium

        
1. Click the extension icon
2. The current tab URL is captured
3. If a video is playing, its timestamp is added
4. The URL is sent to the Raspberry Pi
5. Chromium opens the page at the same moment
---

## 📦 Project Structure
ab2screen/
├── receiver_to_chromium_v2.py   # HTTP server + Chromium launcher
├── chrome-extension/
│   ├── manifest.json
│   ├── background.js
│   ├── options.html
│   └── options.js

---
## 🍓 Raspberry Pi – Server Setup

### 1️⃣ Install dependencies
sudo apt install chromium python3
--behavior replace        # replace | multi | reuse
--chromium-cmd chromium
--x11                     # disable Wayland
--chromium-arg="--kiosk"

curl http://raspberry:8080/health

🌐 Chrome Extension – Setup
Open chrome://extensions
Enable Developer mode
Click Load unpacked
Select the chrome-extension/ folder
Open extension options
Set your Raspberry Pi address: 
xxx.xxx.xxx.xxx:012345

Click the extension icon to send the tab 🚀

⏱ Video Timestamp Support
Tab2Screen automatically detects HTML5 video playback:
Copier le tableau

Platform Support
YouTube✅
Vimeo✅
Twitch VOD✅
Generic HTML5 video✅

Live streams ❌ (by design)

Example generated URL:
https://www.youtube.com/watch?v=xxxx&t=127s

🔐 Security Notes
Designed for local network usage
No authentication by default
You may restrict binding to 127.0.0.1 or add a token header if exposed

🚀 Roadmap / Ideas
🔄 Play / Pause synchronization
📺 Multi-screen sync
🔐 Auth token support
🖱 Remote control (keyboard / mouse)
📱 Mobile sender
🧠 Chromium DevTools reuse mode

🧑‍💻 License
MIT ❤️

🙌 Credits
Created for personal media & presentation workflows on Raspberry Pi.
Contributions welcome!
