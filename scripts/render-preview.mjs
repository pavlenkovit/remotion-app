// Renders any composition (e.g. a Dictionary-<slug> preview) into
// out/renders/<composition-id>.mp4 — a scratch area for remotion renders that
// are NOT the staticFile mockups (those go to public/mockups/) and NOT the
// final video (out/final/).
//
// Usage: npm run render:preview Dictionary-cook
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const id = process.argv[2];
if (!id) {
  console.error("Usage: npm run render:preview <composition-id>");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out/renders");
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `${id}.mp4`);

console.log(`Rendering ${id} → ${out}`);
execFileSync("npx", ["remotion", "render", id, out], {
  stdio: "inherit",
  cwd: root,
});
