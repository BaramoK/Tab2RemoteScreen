# Changelog

## Unreleased

- Rename server script: receiver_to_chromium_v2.py -> Tab2RemoteServer.py
- Update README and examples to reference Tab2RemoteServer.py
 - Rename chrome-extension folder to Tab2RemoteScreen and update artifacts (Tab2RemoteScreen.crx/.pem)
 - Extension: only close originating tab after server confirmation (server must return {"status":"ok"})
 - Extension: make tab-closing behavior configurable in options (closeOnConfirm)
 - Extension: added https host permission and tabs permission to manifest
 - Repository: do not commit extension private key (Chromium_extension/Tab2RemoteScreen.pem); removed from repository and added to .gitignore

## 2.0.0 - (unreleased)

- Major: rename and clean up server script name for clarity
