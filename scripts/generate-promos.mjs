import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "store/assets/promos");
const brand = await readFile(path.join(root, "assets/brand/pixelparity-mark.svg"));

function artwork(width, height, compact) {
  const text = compact
    ? `<text x="90" y="61" fill="#f8fafc" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="29" font-weight="700" letter-spacing="-1">PixelParity</text><text x="32" y="132" fill="#fff" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="35" font-weight="700" letter-spacing="-1.2">Inspect. Align.</text><text x="32" y="177" fill="#7dd3fc" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="35" font-weight="700" letter-spacing="-1.2">Capture.</text><path d="M32 202H111" stroke="#46617d"/><text x="32" y="230" fill="#c1cde0" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="13">Your local layout toolkit.</text>`
    : `<text x="205" y="133" fill="#f8fafc" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="43" font-weight="700" letter-spacing="-1.5">PixelParity</text><text x="84" y="277" fill="#fff" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="69" font-weight="700" letter-spacing="-2.8">Inspect. Align. <tspan fill="#7dd3fc">Capture.</tspan></text><text x="88" y="342" fill="#c1cde0" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="27" font-weight="400">Precision for every viewport.</text><path d="M88 397H940" stroke="#425572" stroke-opacity=".6"/><text x="88" y="444" fill="#d6e1f0" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="18">Live measurements</text><circle cx="311" cy="438" r="3" fill="#7dd3fc"/><text x="340" y="444" fill="#d6e1f0" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="18">Layout grids</text><circle cx="505" cy="438" r="3" fill="#7dd3fc"/><text x="534" y="444" fill="#d6e1f0" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="18">Local screenshots</text><text x="89" y="488" fill="#8fa4c1" font-family="Inter,DejaVu Sans,Arial,sans-serif" font-size="14">No accounts. No telemetry.</text>`;
  const geometry = compact
    ? `<path d="M339 87v137M285 155h139" stroke="#7dd3fc" stroke-opacity=".14"/><rect x="312" y="128" width="54" height="54" rx="3" fill="none" stroke="#7dd3fc" stroke-opacity=".25"/><circle cx="339" cy="155" r="4" fill="#7dd3fc" fill-opacity=".5"/>`
    : `<g transform="translate(1035 93)"><path d="M92 0v375M-48 187h288" stroke="#7dd3fc" stroke-opacity=".22"/><rect x="-14" y="82" width="212" height="212" rx="7" fill="none" stroke="#7dd3fc" stroke-opacity=".28"/><rect x="38" y="134" width="108" height="108" rx="3" fill="#1b3d6b" fill-opacity=".4" stroke="#93c5fd" stroke-opacity=".6"/><path d="M24 69H-27v51m185-51h51v51M24 307H-27v-51m185 51h51v-51" fill="none" stroke="#7dd3fc" stroke-width="2" stroke-opacity=".7"/><circle cx="92" cy="187" r="7" fill="#7dd3fc"/><path d="M-41 332h53m21 0h27m21 0h97" stroke="#7dd3fc" stroke-opacity=".2"/></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="base" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101d35"/><stop offset=".62" stop-color="#0a1325"/><stop offset="1" stop-color="#113258"/></linearGradient><radialGradient id="glow"><stop stop-color="#315d98" stop-opacity=".5"/><stop offset="1" stop-color="#315d98" stop-opacity="0"/></radialGradient><pattern id="grid" width="${compact ? 22 : 32}" height="${compact ? 22 : 32}" patternUnits="userSpaceOnUse"><path d="M${compact ? 22 : 32} 0H0v${compact ? 22 : 32}" fill="none" stroke="#8fc2ee" stroke-opacity=".06"/></pattern></defs><rect width="100%" height="100%" fill="url(#base)"/><ellipse cx="${width * 0.83}" cy="${height * 0.45}" rx="${width * 0.48}" ry="${height * 0.86}" fill="url(#glow)"/><rect width="100%" height="100%" fill="url(#grid)"/><path d="M0 0H${width}" stroke="#7dd3fc" stroke-opacity=".55" stroke-width="3"/>${geometry}${text}</svg>`;
}

await mkdir(path.dirname(destination), { recursive: true });
const staged = await mkdtemp(path.join(path.dirname(destination), ".promos-stage-"));
const backup = `${staged}-previous`;
let previousMoved = false;
try {
  for (const item of [
    {
      filename: "small-tile-440x280.png",
      width: 440,
      height: 280,
      compact: true,
      iconSize: 66,
      left: 23,
      top: 20,
    },
    {
      filename: "marquee-1400x560.png",
      width: 1400,
      height: 560,
      compact: false,
      iconSize: 132,
      left: 68,
      top: 48,
    },
  ]) {
    const icon = await sharp(brand, { density: 384 })
      .resize(item.iconSize, item.iconSize)
      .png()
      .toBuffer();
    const output = path.join(staged, item.filename);
    await sharp(Buffer.from(artwork(item.width, item.height, item.compact)))
      .composite([{ input: icon, left: item.left, top: item.top }])
      .removeAlpha()
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(output);
    const metadata = await sharp(output).metadata();
    if (
      metadata.width !== item.width ||
      metadata.height !== item.height ||
      metadata.hasAlpha
    )
      throw new Error(`Invalid promotional image: ${item.filename}`);
  }
  try {
    await rename(destination, backup);
    previousMoved = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(staged, destination);
  } catch (error) {
    if (previousMoved) await rename(backup, destination);
    throw error;
  }
  if (previousMoved) await rm(backup, { recursive: true, force: true });
  console.log(`Generated 440×280 and 1400×560 promotional artwork in ${destination}.`);
} finally {
  await rm(staged, { recursive: true, force: true });
}
