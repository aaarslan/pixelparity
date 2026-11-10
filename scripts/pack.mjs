import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";
import { RUNTIME_FILES, verifyPackage } from "./verify-package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const builds = path.join(root, "builds");
const fixedDosDate = ((2000 - 1980) << 9) | (1 << 5) | 1;
const utf8Flag = 0x0800;
const maximumArchiveBytes = 150 * 1024;

await verifyPackage();
await mkdir(builds, { recursive: true });
const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
const zipPath = path.join(builds, `pixelparity-${manifest.version}.zip`);
const localEntries = [];
const centralEntries = [];
let offset = 0;

if (RUNTIME_FILES.length > 0xffff) throw new Error("Too many ZIP entries.");

for (const name of [...RUNTIME_FILES].sort()) {
  const filename = Buffer.from(name, "utf8");
  if (filename.length > 0xffff) throw new Error(`ZIP entry name is too long: ${name}`);
  const content = await readFile(path.join(dist, name));
  const compressed = deflateRawSync(content, { level: 9 });
  const checksum = crc32(content);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(utf8Flag, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt16LE(fixedDosDate, 12);
  local.writeUInt32LE(checksum, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(content.length, 22);
  local.writeUInt16LE(filename.length, 26);
  localEntries.push(local, filename, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0x0314, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(utf8Flag, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(fixedDosDate, 14);
  central.writeUInt32LE(checksum, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(content.length, 24);
  central.writeUInt16LE(filename.length, 28);
  central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
  central.writeUInt32LE(offset, 42);
  centralEntries.push(central, filename);
  offset += local.length + filename.length + compressed.length;
}

const directory = Buffer.concat(centralEntries);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(RUNTIME_FILES.length, 8);
end.writeUInt16LE(RUNTIME_FILES.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);

const archive = Buffer.concat([...localEntries, directory, end]);
if (archive.length > maximumArchiveBytes)
  throw new Error(
    `ZIP budget exceeded: ${archive.length} bytes (limit ${maximumArchiveBytes})`,
  );
await writeFile(zipPath, archive);
console.log(`Packed reproducible ZIP: ${zipPath} (${archive.length} bytes)`);
