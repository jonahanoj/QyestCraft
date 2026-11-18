# QyestCraft

Minecraft Java Edition (26.3 + NeoForge + Mynecraft) in VR, running standalone on a Meta Quest.

- **Install page:** https://jonahanoj.github.io/QyestCraft/ — open it in Chrome on an Android phone (or a PC), plug the Quest in with a USB-C cable, tap Connect, then Install. Run it again later to update the app.
- **Updating mods:** put jars in [`mods/`](mods/) (upload on GitHub, delete the old one). The game downloads the changes the next time Play is pressed.

## What's in here

| Part | Where | Built by |
|---|---|---|
| Launcher app (QyestCraft.apk) | `launcher/` changes on top of [cff1028/FoldCraftLauncher](https://github.com/cff1028/FoldCraftLauncher) @ `9e1d25c` (FCL Quest VR 0.1.1) | `.github/workflows/launcher.yml` → release `launcher` |
| Vivecraft (Quest OpenXR, NeoForge 26.3) | [cff1028/VivecraftMod](https://github.com/cff1028/VivecraftMod) @ `871c83f` (26.3-1.3.18-OpenXR) | `.github/workflows/vivecraft-neoforge.yml` → release `vivecraft-26.3-openxr-neoforge` |
| Modpack (Minecraft 26.3, NeoForge 26.3.0.101, mods) | `pack/pack.json`, `mods/` | `.github/workflows/pages.yml` → GitHub Pages `/pack` |
| Install page | `site/`, `installer/` (bundles [ya-webadb](https://github.com/yume-chan/ya-webadb) 2.6.4, MIT) | `.github/workflows/pages.yml` |

Sodium is pulled from Modrinth at a pinned version (`0.9.3-beta.5`) and checked against Modrinth's SHA-512.

Launcher changes: own app id (`com.jonahanoj.qyestcraft`) and name, asks to install the Mynecraft pack on first start and turns on VR for it, signed with this repo's own key (the fork's committed signing keys are deleted before building).

## Repo secrets

| Secret | What |
|---|---|
| `QYESTCRAFT_KEYSTORE_B64`, `QYESTCRAFT_KEYSTORE_PASSWORD` | App signing key. Every update must use the same key. Without them the launcher workflow only does a compile check. |
| `MICROSOFT_CLIENT_ID` | Azure app (client) ID for Microsoft sign-in, approved by Mojang for Minecraft. |
