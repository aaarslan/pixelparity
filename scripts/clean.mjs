import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const directory of ["dist", ".store-preview", "coverage"]) {
  await rm(path.join(root, directory), { recursive: true, force: true });
}
console.log(
  "Removed generated runtime, preview, and coverage directories; release archives were preserved.",
);
