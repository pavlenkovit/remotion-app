// Pre-bake a volume change into an audio file. Needed because <Html5Audio>'s
// `volume` prop is ignored during render and this project's bundled ffmpeg has
// no working `volume` filter — so we scale the PCM samples ourselves.
//
// Usage: node scripts/soften-audio.mjs <input> <output.wav> <gain>
//   e.g. node scripts/soften-audio.mjs public/sounds/click.wav public/sounds/click-soft.wav 0.5
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [, , input, output, gainArg] = process.argv;
if (!input || !output || !gainArg) {
  console.error("Usage: node scripts/soften-audio.mjs <input> <output.wav> <gain>");
  process.exit(1);
}
const gain = Number(gainArg);
if (!(gain > 0)) {
  console.error(`Invalid gain: ${gainArg}`);
  process.exit(1);
}

// Decode to a canonical pcm_s16le wav first (works for mp3/wav/etc).
const dec = join(mkdtempSync(join(tmpdir(), "soften-")), "dec.wav");
execFileSync("npx", ["remotion", "ffmpeg", "-y", "-i", input, "-c:a", "pcm_s16le", dec], { stdio: "ignore" });

const b = readFileSync(dec);
let off = 12, fmt = null, dataOff = -1, dataLen = 0;
while (off + 8 <= b.length) {
  const id = b.toString("ascii", off, off + 4);
  const sz = b.readUInt32LE(off + 4);
  if (id === "fmt ") fmt = b.subarray(off + 8, off + 8 + sz);
  if (id === "data") { dataOff = off + 8; dataLen = sz; break; }
  off += 8 + sz + (sz & 1);
}
if (!fmt || dataOff < 0) throw new Error("could not parse wav chunks");
const ch = fmt.readUInt16LE(2);
const rate = fmt.readUInt32LE(4);
const bps = fmt.readUInt16LE(14);
if (bps !== 16) throw new Error(`expected 16-bit PCM, got ${bps}-bit`);

const peak = (buf) => {
  let p = 0;
  for (let i = 0; i + 1 < buf.length; i += 2) p = Math.max(p, Math.abs(buf.readInt16LE(i)));
  return p / 32768;
};

const pcm = Buffer.from(b.subarray(dataOff, dataOff + dataLen));
const before = peak(pcm);
for (let i = 0; i + 1 < pcm.length; i += 2) {
  pcm.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(pcm.readInt16LE(i) * gain))), i);
}

const h = Buffer.alloc(44);
h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8);
h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
h.writeUInt32LE(rate, 24); h.writeUInt32LE((rate * ch * bps) / 8, 28); h.writeUInt16LE((ch * bps) / 8, 32); h.writeUInt16LE(bps, 34);
h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
writeFileSync(output, Buffer.concat([h, pcm]));

console.log(`${input} -> ${output}  (${ch}ch ${rate}Hz, gain ${gain}: peak ${before.toFixed(3)} -> ${peak(pcm).toFixed(3)})`);
