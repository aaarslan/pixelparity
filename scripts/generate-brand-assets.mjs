import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(path.join(root, "assets/brand/pixelparity-mark.svg"));
const destination = path.join(root, "assets/icons");
await mkdir(destination, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(source, { density: 384 })
    .resize(size, size, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toFile(path.join(destination, `icon${size}.png`));
}
console.log("Generated square 16, 32, 48, and 128 px PixelParity icons.");
