import { copyFileSync, cpSync, existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execFileSync } from "child_process";

// Compiles the Icon Composer project (icon.icon) of src-tauri/icons and
// src-tauri/icons-staging into the macOS artefacts the Tauri bundler consumes:
//   Assets.car  -> Liquid Glass icon on macOS 26+ (tauri.conf.json bundle.icon)
//   icon.icns   -> raster fallback for older macOS, also from the same actool run
//
// actool ships with Xcode (macOS only). The platform / deployment target match
// what tauri.conf.json's bundle.macOS.minimumSystemVersion builds against; iOS
// does not need this because xcodebuild compiles gen/apple/icon.icon itself.
// The release set's icon.icon is then mirrored into gen/apple, which is what
// a local `tauri ios` build uses (CI re-syncs it from the selected set anyway).

const sets = process.argv.length > 2 ? process.argv.slice(2) : ["icons", "icons-staging"];

for (const set of sets) {
    const dir = join("src-tauri", set);
    const source = join(dir, "icon.icon");
    if (!existsSync(join(source, "icon.json"))) {
        console.error(`[apple-icons] ${source} is not an Icon Composer project`);
        process.exit(1);
    }

    const tmp = mkdtempSync(join(tmpdir(), "scenarly-apple-icons-"));
    try {
        execFileSync(
            "xcrun",
            [
                "actool", source,
                "--compile", tmp,
                "--platform", "macosx",
                "--minimum-deployment-target", "14.0",
                "--app-icon", "icon",
                "--output-partial-info-plist", join(tmp, "partial.plist"),
                "--output-format", "human-readable-text",
                "--warnings", "--errors",
            ],
            { stdio: "inherit" },
        );
        for (const name of ["Assets.car", "icon.icns"]) copyFileSync(join(tmp, name), join(dir, name));
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }

    console.log(`[apple-icons] compiled Assets.car, icon.icns in ${dir} from ${source}`);
}

if (sets.includes("icons")) {
    const target = join("src-tauri", "gen", "apple", "icon.icon");
    rmSync(target, { recursive: true, force: true });
    cpSync(join("src-tauri", "icons", "icon.icon"), target, { recursive: true });
    console.log(`[apple-icons] synced src-tauri/icons/icon.icon to ${target}`);
}
