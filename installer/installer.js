// QyestCraft installer: puts the QyestCraft app on a Quest from an Android phone (Chrome + USB cable).
// Uses ya-webadb (@yume-chan/*, MIT) to talk ADB over WebUSB. Everything happens in the browser;
// the only download is QyestCraft.apk from this same site.
import { Adb, AdbDaemonTransport } from "@yume-chan/adb";
import { AdbDaemonWebUsbDeviceManager } from "@yume-chan/adb-daemon-webusb";
import AdbWebCredentialStore from "@yume-chan/adb-credential-web";

const APK_URL = "QyestCraft.apk";
const REMOTE_PATH = "/data/local/tmp/qyestcraft.apk";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const bar = $("bar");
const connectBtn = $("connect");
const installBtn = $("install");

let adb = null;

function status(text, kind = "") {
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

function progress(fraction) {
  bar.hidden = fraction == null;
  if (fraction != null) bar.value = Math.max(0, Math.min(1, fraction));
}

function friendlyError(e) {
  const m = String(e && e.message ? e.message : e);
  if (/Unable to claim interface|claimInterface|in use|busy/i.test(m))
    return "Something else on the phone is using the headset's USB connection. Close other ADB/Quest apps, unplug, plug back in, and try again.";
  if (/denied|NotAllowed|cancel/i.test(m)) return "No headset was picked. Tap Connect and choose the Quest.";
  if (/auth/i.test(m)) return "Put the headset on and tap Allow on the \"Allow USB debugging?\" message, then try again.";
  return m;
}

if (!AdbDaemonWebUsbDeviceManager.BROWSER) {
  status("This browser can't use USB. Open this page in Chrome on an Android phone.", "error");
  connectBtn.disabled = true;
}

connectBtn.addEventListener("click", async () => {
  try {
    connectBtn.disabled = true;
    status("Pick your Quest in the list…");
    const device = await AdbDaemonWebUsbDeviceManager.BROWSER.requestDevice();
    if (!device) {
      status("No headset was picked. Make sure Developer Mode is on and the cable is plugged in.", "error");
      return;
    }
    status("Put the headset on: tap \"Always allow from this computer\", then Allow.");
    const connection = await device.connect();
    const transport = await AdbDaemonTransport.authenticate({
      serial: device.serial,
      connection,
      credentialStore: new AdbWebCredentialStore("QyestCraft installer"),
    });
    adb = new Adb(transport);
    const model = (await adb.subprocess.noneProtocol.spawnWaitText(["getprop", "ro.product.model"])).trim();
    status(`Connected to ${model || "your headset"}. Now tap Install.`, "ok");
    installBtn.disabled = false;
    transport.disconnected.then(() => {
      adb = null;
      installBtn.disabled = true;
      connectBtn.disabled = false;
      status("Headset disconnected. Plug it back in and tap Connect.");
    });
  } catch (e) {
    status(friendlyError(e), "error");
  } finally {
    if (!adb) connectBtn.disabled = false;
  }
});

async function downloadApk() {
  const res = await fetch(APK_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Couldn't download QyestCraft (${res.status}). Try again in a minute.`);
  const total = Number(res.headers.get("content-length")) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total) {
      progress(got / total);
      status(`Downloading QyestCraft… ${Math.round(got / 1048576)} / ${Math.round(total / 1048576)} MB`);
    }
  }
  return new Blob(chunks);
}

installBtn.addEventListener("click", async () => {
  if (!adb) return;
  installBtn.disabled = true;
  connectBtn.disabled = true;
  try {
    status("Downloading QyestCraft…");
    progress(0);
    const apk = await downloadApk();

    status("Copying it to the headset… (keep the cable plugged in)");
    let sent = 0;
    const counted = apk.stream().pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          sent += chunk.length;
          progress(sent / apk.size);
          controller.enqueue(chunk);
        },
      }),
    );
    const sync = await adb.sync();
    try {
      await sync.write({ filename: REMOTE_PATH, file: counted, permission: 0o644 });
    } finally {
      await sync.dispose();
    }

    status("Installing… (this can take a minute)");
    progress(null);
    const out = await adb.subprocess.noneProtocol.spawnWaitText(["pm", "install", "-r", REMOTE_PATH]);
    await adb.subprocess.noneProtocol.spawnWaitText(["rm", "-f", REMOTE_PATH]);
    if (!/Success/.test(out)) {
      if (/INSTALL_FAILED_UPDATE_INCOMPATIBLE/.test(out))
        throw new Error("An old QyestCraft signed with a different key is installed. Uninstall it on the headset first (App Library → Unknown Sources), then try again.");
      throw new Error("Install failed: " + out.trim());
    }
    status("Done! On the headset: App Library → filter (top right) → Unknown Sources → QyestCraft.", "ok");
    $("after").hidden = false;
  } catch (e) {
    status(friendlyError(e), "error");
  } finally {
    progress(null);
    installBtn.disabled = !adb;
    connectBtn.disabled = !!adb;
  }
});
