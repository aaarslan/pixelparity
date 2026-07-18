import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";
import { RUNTIME_FILES, verifyPackage } from "./verify-package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const builds = path.join(root, "builds");
const fixedDate = new Date("2000-01-01T00:00:00.000Z");

await verifyPackage();
await mkdir(builds, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
const zipPath = path.join(builds, `pixelparity-${manifest.version}.zip`);
const output = createWriteStream(zipPath, { flags: "w" });
const archive = new ZipArchive({ zlib: { level: 9 } });

const completion = new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("warning", reject);
  archive.on("error", reject);
});

archive.pipe(output);
for (const name of [...RUNTIME_FILES].sort()) {
  archive.append(await readFile(path.join(dist, name)), {
    name,
    date: fixedDate,
    mode: 0o644,
  });
}
await archive.finalize();
await completion;

const { size } = await import("node:fs/promises").then(({ stat }) => stat(zipPath));
if (size > 150 * 1024) throw new Error(`ZIP budget exceeded: ${size} bytes (limit 153600)`);
console.log(`Packed reproducible ZIP: ${zipPath} (${size} bytes)`);
