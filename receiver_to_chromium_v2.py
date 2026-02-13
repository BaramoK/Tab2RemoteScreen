#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import argparse
import json
import os
import shutil
import subprocess
import threading
import time
from urllib.parse import urlparse


def is_valid_url(url: str) -> tuple[bool, str]:
    url = (url or "").strip()
    if not url:
        return False, "URL vide"
    if len(url) > 2048:
        return False, "URL trop longue"

    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        return False, "Schéma non autorisé (http/https uniquement)"
    if not p.netloc:
        return False, "Hôte manquant"
    return True, "ok"


def find_chromium(cmd_hint: str | None) -> str:
    candidates = [cmd_hint] if cmd_hint else []
    candidates += ["chromium", "chromium-browser"]
    for c in candidates:
        if not c:
            continue
        path = shutil.which(c) if not os.path.isabs(c) else c
        if path and os.path.exists(path):
            return path
    raise FileNotFoundError("Chromium introuvable. Installe-le ou passe --chromium-cmd.")


class ChromiumManager:
    """
    Gère un unique Chromium lancé par ce service.
    behavior:
      - multi   : ouvre un nouveau chromium à chaque POST (comme avant)
      - replace : ferme celui lancé précédemment puis relance
      - reuse   : (non implémenté proprement ici) -> fallback replace
    """
    def __init__(
        self,
        chromium_path: str,
        behavior: str = "replace",
        use_wayland: bool = True,
        display: str | None = ":0",
        maximize: bool = True,
        maximize_delay: float = 0.8,
        user_data_dir: str = "/tmp/receiver_chromium_profile",
        extra_args: list[str] | None = None,
    ):
        self.chromium_path = chromium_path
        self.behavior = behavior
        self.use_wayland = use_wayland
        self.display = display
        self.maximize = maximize
        self.maximize_delay = maximize_delay
        self.user_data_dir = user_data_dir
        self.extra_args = extra_args or []

        self._lock = threading.Lock()
        self._proc: subprocess.Popen | None = None


    def _launch(self, url: str, kiosk: bool = False) -> subprocess.Popen:
        env = os.environ.copy()
        if self.display is not None:
            env["DISPLAY"] = self.display

        cmd = [self.chromium_path]

        if self.use_wayland:
            cmd += ["--enable-features=UseOzonePlatform", "--ozone-platform=wayland"]

        # Profil dédié pour ne pas casser/locker ton profil principal
        #cmd += [f"--user-data-dir={self.user_data_dir}"]

        # Mode d'ouverture :
        # - En mode normal on utilise --app=<url> + --start-maximized (fenêtre minimaliste)
        # - En mode kiosk on lance Chromium en plein écran avec --kiosk et l'URL en argument
        if kiosk:
            # En kiosk, on passe l'URL en argument (positionnel) et les flags --kiosk
            # et --start-fullscreen pour maximiser la compatibilité entre environnements
            # (certains builds/WM exigent --start-fullscreen pour un vrai plein écran).
            # Utilise aussi un profil dédié et désactive quelques popups qui peuvent
            # empêcher le plein écran immédiat.
            kiosk_flags = [
                "--kiosk",
                "--start-fullscreen",
                # Ne pas forcer user-data-dir (préférence utilisateur)
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-session-crashed-bubble",
                "--disable-infobars",
                # Réduire les logs/activités réseau liées aux services Google (GCM/push/etc.)
                # qui génèrent des erreurs comme DEPRECATED_ENDPOINT lorsque Chromium
                # n'est pas configuré pour un user profile complet.
                "--disable-background-networking",
                "--disable-component-update",
                "--disable-sync",
                "--disable-background-mode",
                "--disable-features=PushMessaging",
                "--disable-gcm"
            ]
            cmd += kiosk_flags + [url]
        else:
            cmd += [f'--app={url}', "--start-maximized"]

        # Args supplémentaires optionnels
        # En mode kiosk, filtrer certains args qui contredisent kiosk (ex: --start-maximized, --app=...)
        args_to_add = []
        if kiosk:
            for a in self.extra_args:
                if a == "--start-maximized":
                    continue
                if a == "--start-fullscreen":
                    continue
                if a.startswith("--app="):
                    continue
                args_to_add.append(a)
        else:
            args_to_add = list(self.extra_args)

        cmd += args_to_add

        print(f"[LAUNCH] launching Chromium (kiosk={kiosk}): {' '.join(cmd)}")
        # Chromium écrit beaucoup de logs/errors sur stderr (ex: GCM DEPRECATED_ENDPOINT)
        # qui ne sont pas utiles pour l'utilisateur de ce service. Redirigeons les
        # sorties de Chromium vers /dev/null pour garder la sortie du serveur propre.
        try:
            proc = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            # fallback non-bloquant: si redirection impossible, lancer sans redirection
            proc = subprocess.Popen(cmd, env=env)

        if self.maximize and not kiosk:
            # wlrctl: optionnel, pas bloquant
            def _maximize_later():
                time.sleep(self.maximize_delay)
                try:
                    if shutil.which("wlrctl"):
                        subprocess.run(["wlrctl", "window", "maximize"], check=False)
                except Exception:
                    pass

            threading.Thread(target=_maximize_later, daemon=True).start()

        return proc


    def open_url(self, url: str, kiosk: bool = False) -> str:
        with self._lock:
            if self.behavior == "multi":
                self._launch(url, kiosk=kiosk)
                return "opened-new"

            if self.behavior == "reuse":
                # Réutilisation “propre” nécessite CDP/DevTools, donc on fallback en replace.
                self.behavior = "replace"

            # behavior == replace
            self._terminate_locked()
            self._proc = self._launch(url, kiosk=kiosk)
            return "replaced"

    def _terminate_locked(self):
        if not self._proc:
            return

        proc = self._proc
        self._proc = None

        try:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
        except Exception:
            pass

    def shutdown(self):
        with self._lock:
            self._terminate_locked()


class Handler(BaseHTTPRequestHandler):
    server_version = "ReceiverToChromium/2.1"

    def log_message(self, fmt, *args):
        # logs plus discrets
        print(f"[HTTP] {self.address_string()} - {fmt % args}")

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > self.server.max_body:
            raise ValueError("Body trop gros")
        return self.rfile.read(length)

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"ok")
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path not in ("/open", "/"):
            self.send_response(404)
            self.end_headers()
            return

        try:
            body = self._read_body()
            ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()

            kiosk = False
            url = None
            payload = None
            if ctype == "application/json":
                payload = json.loads(body.decode("utf-8", errors="replace"))
                url = (payload.get("url") or "").strip()
                kiosk = bool(payload.get("kiosk", False))
            else:
                # legacy: body could be the raw URL string
                url = body.decode("utf-8", errors="replace").strip()

            # debug log: what we received
            try:
                if payload is not None:
                    print(f"[HTTP] POST JSON received: url={url!r}, kiosk={kiosk}")
                else:
                    print(f"[HTTP] POST raw received: url={url!r}")
            except Exception:
                pass

            ok, reason = is_valid_url(url)
            if not ok:
                self.send_response(400)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(json.dumps({"error": reason}).encode("utf-8"))
                return

            # si le client n'a pas précisé kiosk, on tombe sur la valeur par défaut du serveur
            if not kiosk and getattr(self.server, "default_kiosk", False):
                kiosk = True

            result = self.server.chromium_mgr.open_url(url, kiosk=kiosk)

            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok", "action": result, "url": url}).encode("utf-8"))

        except ValueError as e:
            self.send_response(413)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"server error: {type(e).__name__}: {e}"}).encode("utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Receiver URL -> Chromium (single-window modes)")
    parser.add_argument("--host", default="0.0.0.0", help="IP d'écoute (ex: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8080, help="Port d'écoute")

    parser.add_argument("--behavior", choices=["multi", "replace", "reuse"], default="replace",
                        help="multi: nouvelle fenêtre à chaque POST | replace: remplace la fenêtre | reuse: fallback replace")
    parser.add_argument("--chromium-cmd", default=None, help="Commande chromium (ex: /usr/bin/chromium)")
    parser.add_argument("--x11", dest="wayland", action="store_false", help="Forcer X11 (désactive ozone/wayland)")
    parser.set_defaults(wayland=True)
    parser.add_argument("--display", default=":0", help='DISPLAY (ex ":0"), vide pour ne pas définir')
    parser.add_argument("--no-maximize", action="store_true", help="Ne pas tenter de maximiser")
    parser.add_argument("--maximize-delay", type=float, default=0.8, help="Délai avant wlrctl maximize")
    parser.add_argument("--max-body", type=int, default=4096, help="Taille max du body (bytes)")
    #parser.add_argument("--user-data-dir", default="/tmp/receiver_chromium_profile",
    #                    help="Profil dédié pour ce service (évite d'impacter ton profil perso)")
    parser.add_argument("--chromium-arg", action="append", default=[],
                        help='Argument Chromium additionnel (répétable), ex: --chromium-arg="--kiosk"')
    parser.add_argument("--default-kiosk", action="store_true",
                        help="Ouvrir en mode kiosk par défaut si le payload ne précise pas 'kiosk'")

    args = parser.parse_args()

    chromium_path = find_chromium(args.chromium_cmd)
    display = args.display if args.display != "" else None

    chromium_mgr = ChromiumManager(
        chromium_path=chromium_path,
        behavior=args.behavior,
        use_wayland=args.wayland,
        display=display,
        maximize=not args.no_maximize,
        maximize_delay=args.maximize_delay,
        #user_data_dir=args.user_data_dir,
        extra_args=args.chromium_arg,
    )

    server = ThreadingHTTPServer((args.host, args.port), Handler)
    server.max_body = args.max_body
    server.chromium_mgr = chromium_mgr
    server.default_kiosk = args.default_kiosk

    print(f"✅ Serveur en écoute sur http://{args.host}:{args.port}")
    print(f"➡️  Chromium: {chromium_path}")
    print(f"🧠 behavior: {args.behavior}")
    print(f"🔒 default kiosk: {args.default_kiosk}")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("🛑 Ctrl+C reçu, arrêt…")
    finally:
        # ferme chromium (si lancé)
        try:
            server.chromium_mgr.shutdown()
        except Exception:
            pass

        # ferme le serveur
        try:
            server.server_close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
