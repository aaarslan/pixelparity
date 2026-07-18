import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const screenshots = path.join(root, "store/assets/screenshots");
const outputDirectory = path.join(root, "store/demo");
const output = path.join(outputDirectory, "pixelparity-v2-demo.mp4");
const images = [
  "01-quick-metrics.png",
  "02-live-inspector.png",
  "03-zoom-dpr-visual-viewport.png",
  "04-breakpoint-profiles.png",
  "05-baseline-and-exports.png",
].map((name) => path.join(screenshots, name));

await mkdir(outputDirectory, { recursive: true });
const temporary = await mkdtemp(path.join(os.tmpdir(), "pixelparity-demo-"));
const listPath = path.join(temporary, "slides.ffconcat");
const lines = ["ffconcat version 1.0"];
for (const image of images)
  lines.push(`file '${image.replaceAll("'", "'\\''")}'`, "duration 6");
lines.push(`file '${images.at(-1).replaceAll("'", "'\\''")}'`);
await writeFile(listPath, `${lines.join("\n")}\n`);

await new Promise((resolve, reject) => {
  const child = spawn(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-vf",
      "fps=30,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      "-t",
      "30",
      output,
    ],
    { stdio: "inherit" },
  );
  child.on("error", reject);
  child.on("exit", (code) =>
    code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)),
  );
});

await rm(temporary, { recursive: true, force: true });
console.log(`Created 30-second captioned demo video: ${output}`);
