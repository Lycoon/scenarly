import { generateAppleJWT } from "../src/lib/apple-sign-in";

// Prints the client secret of the web Services ID, to paste into AUTH_APPLE_SECRET.
// The apps' own client secret (the bundle id) is signed by the server at runtime.
const config = {
    teamId: process.env.AUTH_APPLE_TEAM_ID!,
    clientId: process.env.AUTH_APPLE_ID!,
    keyId: process.env.AUTH_APPLE_KEY_ID!,
    privateKey: process.env.AUTH_APPLE_PRIVATE_KEY!,
};

const missing = Object.entries(config).filter(([, v]) => !v);

if (missing.length > 0) {
    console.error(`❌ Missing env vars: ${missing.map((m) => m[0]).join(", ")}`);
    process.exit(1);
}

generateAppleJWT(config)
    .then((token) => console.log(`\n✅ Apple JWT:\n\n${token}\n`))
    .catch((err) => console.error("❌ Error:", err));
