import { copyFileSync, existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

// Regenerates the flat raster icons of src-tauri/icons and src-tauri/icons-staging
// from each set's app-icon.png (the 1024px master square).
//
// `tauri icon` cannot be run in place: besides the rasters we want, it also
// emits icon.icns and an ios/ set, which would clobber / duplicate the Icon
// Composer outputs (icon.icon, icon.icns, Assets.car) that macOS and iOS
// actually use. So generate into a temp dir and copy out only what the build
// consumes from here:
//   32x32.png, 128x128.png, 128x128@2x.png  -> tauri.conf.json bundle.icon
//   icon.ico                                -> Windows exe favicon
//   icon.png                                -> master for windows:assets (Store tiles)
// Android launcher mipmaps derive from app-icon.png too; android:icons is
// chained after this in package.json.

const KEEP = ["32x32.png", "128x128.png", "128x128@2x.png", "icon.png", "icon.ico"];

const sets = process.argv.length > 2 ? process.argv.slice(2) : ["icons", "icons-staging"];

for (const set of sets) {
    const dir = join("src-tauri", set);
    const source = join(dir, "app-icon.png");
    if (!existsSync(source)) {
        console.error(`[icons] ${source} not found`);
        process.exit(1);
    }

    const tmp = mkdtempSync(join(tmpdir(), "scenarly-icons-"));
    try {
        execSync(`npx tauri icon "${source}" -o "${tmp}"`, { stdio: "inherit" });
        for (const name of KEEP) copyFileSync(join(tmp, name), join(dir, name));
    } finally {
        rmSync(tmp, { recursive: true, force: true });
    }

    console.log(`[icons] regenerated ${KEEP.join(", ")} in ${dir} from ${source}`);
}
