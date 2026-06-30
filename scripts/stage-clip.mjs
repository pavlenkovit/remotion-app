// Stages a source clip into public/clips/ so Remotion's staticFile()/dev-server
// can read it. It COPIES the file: Remotion's bundler and static server don't
// handle symlinked media (webpack hashing crashes, and the server 404s on a
// symlink). public/clips is git-ignored, so the copy is never committed — the
// original stays wherever it lives on disk.
//
// Usage:
//   npm run stage-clip -- /abs/path/to/original.mov [name-in-clips.mov]
//
// The second arg is optional; defaults to the original's basename. Use that name
// (under "clips/") as the "clip" field in src/SocialVideo/videos/<slug>.json.
import { copyFileSync, mkdirSync, existsSync, rmSync, lstatSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";

const [, , srcArg, nameArg] = process.argv;
if (!srcArg) {
  console.error("Usage: npm run stage-clip -- /abs/path/to/original.mov [name.mov]");
  process.exit(1);
}

const original = resolve(srcArg);
if (!existsSync(original)) {
  console.error(`No such file: ${original}`);
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clipsDir = join(root, "public/clips");
mkdirSync(clipsDir, { recursive: true });

const name = nameArg ?? basename(original);
const dest = join(clipsDir, name);

// Replace anything already at the target so re-staging is idempotent.
if (lstatSync(dest, { throwIfNoEntry: false })) {
  rmSync(dest);
}
copyFileSync(original, dest);

console.log(`Copied ${original} → public/clips/${name}`);
console.log(`Set "clip": "clips/${name}" in src/SocialVideo/videos/<slug>.json`);
