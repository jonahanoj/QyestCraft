#!/usr/bin/env python3
"""Builds the QyestCraft modpack site (GitHub Pages).

Output: <out>/pack/server-manifest.json and <out>/pack/overrides/mods/*.jar

The launcher reads server-manifest.json every time the game is started and
downloads any jar whose SHA-1 changed, and deletes jars that were removed.
So: drop a jar into the repo's mods/ folder -> this runs -> your friend gets it
the next time he presses Play.
"""
import hashlib
import json
import os
import shutil
import sys
import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UA = {"User-Agent": "jonahanoj/QyestCraft pack builder (github actions)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def sha(data, algo):
    h = hashlib.new(algo)
    h.update(data)
    return h.hexdigest()


def neoforge_exists(version):
    meta = fetch("https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml")
    versions = [v.text for v in ET.fromstring(meta).iter("version")]
    return version in versions, [v for v in versions if v.startswith(version.split(".")[0] + "." + version.split(".")[1] + ".")][-8:]


def main():
    out = sys.argv[1]
    site_url = sys.argv[2].rstrip("/")  # e.g. https://jonahanoj.github.io/QyestCraft
    cfg = json.load(open(os.path.join(ROOT, "pack", "pack.json")))

    ok, recent = neoforge_exists(cfg["neoforge"])
    if not ok:
        sys.exit(f"NeoForge {cfg['neoforge']} is not on maven.neoforged.net. Recent ones: {recent}")

    mods_out = os.path.join(out, "pack", "overrides", "mods")
    os.makedirs(mods_out, exist_ok=True)
    jars = {}

    # 1. jars dropped into the repo's mods/ folder
    for name in sorted(os.listdir(os.path.join(ROOT, "mods"))):
        if name.lower().endswith(".jar"):
            data = open(os.path.join(ROOT, "mods", name), "rb").read()
            jars[name] = data
            print(f"repo mod   {name}  {len(data)} bytes")

    # 2. our own Vivecraft build (GitHub release of this repo)
    for m in cfg.get("extra_mods", []):
        data = fetch(m["url"])
        jars[m["file"]] = data
        print(f"release    {m['file']}  {len(data)} bytes")

    # 3. Modrinth mods pinned to an exact version, checked against Modrinth's sha512
    for m in cfg.get("modrinth", []):
        q = urllib.parse.urlencode({"loaders": json.dumps([m["loader"]]), "game_versions": json.dumps([m["game_version"]])})
        versions = json.loads(fetch(f"https://api.modrinth.com/v2/project/{m['project']}/version?{q}"))
        match = [v for v in versions if m["version_contains"] in v["version_number"]]
        if not match:
            sys.exit(f"{m['project']}: no version containing {m['version_contains']!r}. Available: {[v['version_number'] for v in versions]}")
        f = next(f for f in match[0]["files"] if f["primary"]) if any(f["primary"] for f in match[0]["files"]) else match[0]["files"][0]
        data = fetch(f["url"])
        if sha(data, "sha512") != f["hashes"]["sha512"]:
            sys.exit(f"{f['filename']}: sha512 mismatch, refusing to publish")
        jars[f["filename"]] = data
        print(f"modrinth   {f['filename']}  {len(data)} bytes")

    files = []
    for name, data in sorted(jars.items()):
        open(os.path.join(mods_out, name), "wb").write(data)
        files.append({"path": "mods/" + name, "hash": sha(data, "sha1")})

    version = sha("".join(f["hash"] for f in files).encode(), "sha1")[:8]
    manifest = {
        "name": cfg["name"],
        "author": cfg["author"],
        "version": version,
        "description": cfg["description"],
        "fileApi": site_url + "/pack",
        "files": files,
        "addons": [
            {"id": "game", "version": cfg["minecraft"]},
            {"id": "neoforge", "version": cfg["neoforge"]},
        ],
    }
    json.dump(manifest, open(os.path.join(out, "pack", "server-manifest.json"), "w"), indent=2)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
