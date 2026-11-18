package com.tungsten.fcl.qyestcraft;

import android.content.Context;
import android.widget.Toast;

import com.tungsten.fcl.game.FCLGameRepository;
import com.tungsten.fcl.setting.Profile;
import com.tungsten.fcl.setting.Profiles;
import com.tungsten.fcl.setting.VersionSetting;
import com.tungsten.fcl.ui.download.modpack.ModpackInstaller;
import com.tungsten.fclcore.mod.Modpack;
import com.tungsten.fclcore.mod.server.ServerModpackManifest;
import com.tungsten.fclcore.task.GetTask;
import com.tungsten.fclcore.task.Schedulers;
import com.tungsten.fclcore.task.Task;
import com.tungsten.fclcore.util.gson.JsonUtils;
import com.tungsten.fcllibrary.component.dialog.FCLAlertDialog;

import java.net.URL;

/**
 * QyestCraft: on start, if the "Mynecraft" game isn't installed yet, offer to install it
 * (Minecraft 26.3 + NeoForge + the mods from the QyestCraft pack). After that the normal
 * server-modpack auto-update keeps the mods in sync every time the game is launched.
 */
public final class QyestCraftSetup {

    public static final String PACK_URL = "https://jonahanoj.github.io/QyestCraft/pack/server-manifest.json";
    public static final String GAME_NAME = "Mynecraft";

    private static boolean offered;

    private QyestCraftSetup() {
    }

    public static void offerInstallIfMissing(Context context) {
        if (offered) return;
        offered = true;
        try {
            Profile profile = Profiles.getSelectedProfile();
            FCLGameRepository repository = profile.getRepository();
            Task.supplyAsync(() -> {
                if (!repository.isLoaded()) repository.refreshVersions();
                return repository.hasVersion(GAME_NAME);
            }).whenComplete(Schedulers.androidUIThread(), (installed, e) -> {
                if (e == null && !Boolean.TRUE.equals(installed)) ask(context, profile);
            }).start();
        } catch (Throwable t) {
            // never block the launcher from opening
        }
    }

    private static void ask(Context context, Profile profile) {
        FCLAlertDialog.Builder builder = new FCLAlertDialog.Builder(context);
        builder.setAlertLevel(FCLAlertDialog.AlertLevel.INFO);
        builder.setCancelable(false);
        builder.setTitle("Install Mynecraft?");
        builder.setMessage("This downloads Minecraft 26.3, NeoForge and the Mynecraft mods (with VR). "
                + "It takes a few minutes on Wi-Fi. Sign in with your Microsoft account first if you haven't.");
        builder.setPositiveButton("Install", () -> download(context, profile));
        builder.setNegativeButton("Later", null);
        builder.create().show();
    }

    private static void download(Context context, Profile profile) {
        try {
            new GetTask(new URL(PACK_URL)).whenComplete(Schedulers.androidUIThread(), (result, e) -> {
                ServerModpackManifest manifest = e == null ? JsonUtils.fromMaybeMalformedJson(result, ServerModpackManifest.class) : null;
                if (manifest == null) {
                    Toast.makeText(context, "Couldn't reach the Mynecraft pack. Check Wi-Fi and reopen the app.", Toast.LENGTH_LONG).show();
                    offered = false;
                    return;
                }
                Modpack modpack = manifest.toModpack(null);
                Task<?> install = ModpackInstaller.getModpackInstallTask(context, profile, manifest, modpack, GAME_NAME)
                        .thenRunAsync(Schedulers.androidUIThread(), () -> {
                            VersionSetting vs = profile.getRepository().specializeVersionSetting(GAME_NAME);
                            if (vs != null) vs.setVrEnabled(true);
                            profile.setSelectedVersion(GAME_NAME);
                        });
                ModpackInstaller.installModpack(context, install, false);
            }).start();
        } catch (Exception ex) {
            Toast.makeText(context, String.valueOf(ex.getMessage()), Toast.LENGTH_LONG).show();
        }
    }
}
