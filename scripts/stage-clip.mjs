// Stages an EXTERNAL source clip into public/clips/ as a SYMLINK so Remotion's
// staticFile()/Studio dev-server can read it — without copying the (heavy)
// original into the project. The original stays wherever it lives on disk.
//
// Usage:
//   npm run stage-clip -- /abs/path/to/original.mp4 [name-in-clips.mp4]
//
// The second arg is optional; defaults to the original's basename. The value
// you pass to CLIP_SRC in src/SocialVideo/index.tsx is `clips/<that name>`.
import { symlinkSync, mkdirSync, existsSync, rmSync, lstatSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, basename } from "node:path";

const [, , srcArg, nameArg] = process.argv;
if (!srcArg) {
  console.error("Usage: npm run stage-clip -- /abs/path/to/original.mp4 [name.mp4]");
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
const linkPath = join(clipsDir, name);

// Replace any existing symlink/file at the target so re-staging is idempotent.
if (existsSync(linkPath) || lstatSync(linkPath, { throwIfNoEntry: false })) {
  rmSync(linkPath);
}
symlinkSync(original, linkPath);

console.log(`Linked public/clips/${name} → ${original}`);
console.log(`Set CLIP_SRC = "clips/${name}" in src/SocialVideo/index.tsx`);
