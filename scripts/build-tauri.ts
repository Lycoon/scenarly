import { existsSync, renameSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const apiDir = join("src", "app", "api");
const hiddenApiDir = join("src", "app", "_api");
const adminDir = join("src", "app", "admin");
const hiddenAdminDir = join("src", "app", "_admin");
// Community pages are server-rendered (Showcase) or need the API (Coverage);
// desktop and mobile open them in the browser instead.
const communityDir = join("src", "app", "community");
const hiddenCommunityDir = join("src", "app", "_community");

// Clean .next cache to avoid stale type references to API routes
rmSync(".next", { recursive: true, force: true });

// Prefix with _ so Next.js ignores the API routes during static export
if (existsSync(apiDir)) {
    renameSync(apiDir, hiddenApiDir);
}
if (existsSync(adminDir)) {
    renameSync(adminDir, hiddenAdminDir);
}
if (existsSync(communityDir)) {
    renameSync(communityDir, hiddenCommunityDir);
}

try {
    execSync("npx cross-env TAURI_BUILD=true NEXT_PUBLIC_TAURI_BUILD=true next build", { stdio: "inherit" });
} finally {
    if (existsSync(hiddenApiDir)) {
        renameSync(hiddenApiDir, apiDir);
    }
    if (existsSync(hiddenAdminDir)) {
        renameSync(hiddenAdminDir, adminDir);
    }
    if (existsSync(hiddenCommunityDir)) {
        renameSync(hiddenCommunityDir, communityDir);
    }
}
