# 🖥️ Tab2RemoteScreen

**Tab2RemoteScreen** lets you send the current browser tab from your desktop Chrome to a remote screen (mini‑PC, HTPC, kiosk, single‑board computer…) running Chromium.

Perfect for:

- 📺 TVs & external displays  
 - Media screens (single‑board computers, mini‑PCs)
- 🧑‍🏫 Presentations  
- 🎥 Watching YouTube / Vimeo / Twitch on another screen  

✅ Supports **video timestamp transfer** (YouTube, HTML5 video, VODs)

---

## ✨ Features

- 🚀 One‑click send from Chrome  
- ⏱ Preserves video playback time when possible  
- 🧠 Single‑window or multi‑window Chromium management  
- 🌐 Lightweight HTTP server (no framework)  
- 🖥 Works with X11 or Wayland  
 - Optimized for embedded displays
- 🔐 No cloud, fully local  

---

## 🧩 How It Works

```
Chrome Extension ──► HTTP POST ──► Remote Server ──► Chromium
```

1. Click the extension icon  
2. The current tab URL is captured  
3. If a video is playing, its timestamp is added  
4. The URL is sent to the remote server
5. Chromium opens the page at the same moment  

---

# Server – Setup

## 1️⃣ Install Dependencies

```bash
sudo apt install chromium python3
```

---

## ⚙️ Start Server

```bash
python3 receiver_to_chromium_v2.py \
  --behavior replace        # replace | multi | reuse
  --chromium-cmd chromium
  --x11                     # disable Wayland
  --chromium-arg="--kiosk"
```

---

## ✅ Health Check

```bash
curl http://localhost:8080/health
```

---

# 🌐 Chrome Extension – Setup

```
1. Open chrome://extensions
2. Enable Developer mode
3. Click "Load unpacked"
4. Select the chrome-extension/ folder
5. Open extension options
6. Set your server address (host:port):
   xxx.xxx.xxx.xxx:012345
```

Click the extension icon to send the tab 🚀

---

# 🚀 Basic Launch

```bash
./receiver_to_chromium_v2.py
```

### Default Values

- Host: `0.0.0.0`  
- Port: `8080`  
- Behavior: `replace`  
- Wayland enabled  
- `DISPLAY=:0`  
- Auto‑maximize enabled  

---

# ⚙️ Available Options

---

## 🌐 Network

### `--host`

IP address to bind the HTTP server to:

```bash
--host 0.0.0.0
```

### `--port`

Listening port:

```bash
--port 8080
```

---

## 🧠 Chromium Window Behavior

### `--behavior`

Controls how Chromium instances are handled:

```bash
--behavior multi
--behavior replace
--behavior reuse
```

| Mode      | Description |
|-----------|------------|
| `multi`   | Opens a new Chromium window on every POST |
| `replace` | Closes the previous window and launches a new one (default) |
| `reuse`   | Falls back to `replace` (true reuse via CDP not implemented) |

---

## 🌍 Display (Wayland / X11)

### ✅ Wayland (default)

Automatically adds:

```
--enable-features=UseOzonePlatform
--ozone-platform=wayland
```

### ❌ Force X11

```bash
--x11
```

Disables Wayland/Ozone flags.

---

### `--display`

Sets the `DISPLAY` environment variable:

```bash
--display :0
```

To avoid setting `DISPLAY` at all:

```bash
--display ""
```

---

## 🖥️ Window Maximization

### ❌ Disable automatic maximize

```bash
--no-maximize
```

### ⏱ Delay before maximize (wlrctl)

```bash
--maximize-delay 1.2
```

Default: `0.8` seconds

---

## 📦 Maximum HTTP Body Size

```bash
--max-body 4096
```

Default: `4096` bytes  
If exceeded → HTTP `413` error.

---

## 🌐 Chromium Configuration

### `--chromium-cmd`

Specify the Chromium binary manually:

```bash
--chromium-cmd /usr/bin/chromium
```

If not provided, the script tries:

- `chromium`
- `chromium-browser`

---

### `--chromium-arg` (repeatable ✅)

Adds additional Chromium arguments.

Examples:

```bash
--chromium-arg="--kiosk"
--chromium-arg="--incognito"
--chromium-arg="--disable-infobars"
```

Full example:

```bash
./receiver_to_chromium_v2.py \
  --behavior replace \
  --chromium-arg="--kiosk" \
  --chromium-arg="--incognito"
```

---

# 🧪 Full Examples

## Kiosk Mode (Wayland)

```bash
./receiver_to_chromium_v2.py \
  --behavior replace \
  --chromium-arg="--kiosk"
```

---

## Multi‑Window Mode with X11

```bash
./receiver_to_chromium_v2.py \
  --behavior multi \
  --x11
```

---

## Localhost‑Only Server

```bash
./receiver_to_chromium_v2.py \
  --host 127.0.0.1 \
  --port 9090
```

---

# 🧾 Quick Summary

```bash
--host
--port
--behavior [multi|replace|reuse]
--chromium-cmd
--x11
--display
--no-maximize
--maximize-delay
--max-body
--chromium-arg   # repeatable
```

---

# ⏱ Video Timestamp Support

Tab2RemoteScreen automatically detects HTML5 video playback.

### ✅ Supported Platforms

- YouTube  
- Vimeo  
- Twitch VOD  
- Generic HTML5 video  

### ❌ Not Supported

- Live streams (by design)

### Example Generated URL

```
https://www.youtube.com/watch?v=xxxx&t=127s
```

---

# 🔐 Security Notes

- Designed for **local network usage**
- No authentication by default
- You may:
  - Restrict binding to `127.0.0.1`
  - Add a token header if exposed externally

---

# 🚀 Roadmap / Ideas

- 🔄 Play / Pause synchronization  
- 📺 Multi‑screen sync  
- 🔐 Auth token support  
- 🖱 Remote control (keyboard / mouse)  
- 📱 Mobile sender  
- 🧠 Chromium DevTools reuse mode  

---

# 🧑‍💻 License

MIT ❤️  

---

# 🙌 Credits

Created for personal media & presentation workflows on small displays and kiosks.  

**Contributions welcome!** 🚀
