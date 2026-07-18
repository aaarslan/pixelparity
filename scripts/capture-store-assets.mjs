import { createServer } from "node:http";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import puppeteer from "puppeteer";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preview = path.join(root, ".store-preview");
const screenshots = path.join(root, "store/assets/screenshots");
const promos = path.join(root, "store/assets/promos");
await rm(preview, { recursive: true, force: true });
await Promise.all([
  mkdir(preview, { recursive: true }),
  mkdir(screenshots, { recursive: true }),
  mkdir(promos, { recursive: true }),
]);

const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    if (pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const filename = pathname === "/" ? "preview.html" : path.basename(pathname);
    const content = await readFile(path.join(preview, filename));
    const type = filename.endsWith(".js")
      ? "text/javascript"
      : filename.endsWith(".css")
        ? "text/css"
        : "text/html";
    response.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
if (!address || typeof address === "string")
  throw new Error("Store preview server failed.");
const previewOrigin = `http://127.0.0.1:${address.port}`;

await esbuild.build({
  entryPoints: [path.join(root, "store/source/preview.tsx")],
  outfile: path.join(preview, "preview.js"),
  bundle: true,
  format: "esm",
  minify: true,
  target: ["chrome116"],
  define: { "process.env.NODE_ENV": '"production"' },
});
await Promise.all([
  cp(path.join(root, "store/source/preview.html"), path.join(preview, "preview.html")),
  cp(path.join(root, "store/source/preview.css"), path.join(preview, "preview.css")),
  cp(path.join(root, "src/styles.css"), path.join(preview, "app.css")),
]);

const executablePath =
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : await puppeteer.executablePath());
const browser = await puppeteer.launch({ executablePath, headless: true });
const page = await browser.newPage();
page.on("console", (message) =>
  console.log(`[store preview] ${message.type()}: ${message.text()}`),
);
page.on("pageerror", (error) => console.error(`[store preview] ${error.message}`));
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

const scenarios = [
  ["popup", "01-quick-metrics.png"],
  ["live", "02-live-inspector.png"],
  ["details", "03-zoom-dpr-visual-viewport.png"],
  ["breakpoints", "04-breakpoint-profiles.png"],
  ["export", "05-baseline-and-exports.png"],
];

for (const [scenario, filename] of scenarios) {
  const url = `${previewOrigin}/preview.html?scenario=${scenario}`;
  await page.goto(url, { waitUntil: "networkidle0" });
  const selector =
    scenario === "breakpoints"
      ? "#profile-editor-title"
      : scenario === "export"
        ? ".export-card"
        : "[data-metric=layout-viewport]";
  await page.waitForSelector(".app-shell");
  try {
    await page.waitForSelector(selector, { timeout: 5_000 });
  } catch (error) {
    console.error(
      `[store preview] ${scenario} did not reach ${selector}: ${await page.evaluate(() => document.body.innerText)}`,
    );
    throw error;
  }
  const raw = path.join(preview, filename);
  await page.screenshot({ path: raw, type: "png" });
  await sharp(raw)
    .resize(1280, 800, { fit: "fill" })
    .png({ compressionLevel: 9, effort: 10 })
    .toFile(path.join(screenshots, filename));
}
await browser.close();
await new Promise((resolve, reject) =>
  server.close((error) => (error ? reject(error) : resolve())),
);

function promoSvg(width, height, compact) {
  const markSize = compact ? 82 : 142;
  const markX = compact ? 30 : 92;
  const markY = (height - markSize) / 2;
  const titleX = markX + markSize + (compact ? 22 : 54);
  const titleSize = compact ? 30 : 66;
  const subtitleSize = compact ? 15 : 28;
  const titleY = height / 2 - (compact ? 8 : 18);
  const panel = compact
    ? ""
    : `<g transform="translate(${width - 420} 118)"><rect width="314" height="324" rx="22" fill="#0c1728" stroke="#67e8f9" stroke-opacity=".35"/><rect x="24" y="30" width="124" height="92" rx="12" fill="#142238"/><text x="38" y="58" fill="#9fb0c7" font-family="Arial" font-size="12">VIEWPORT</text><text x="38" y="92" fill="#fff" font-family="Arial" font-size="24" font-weight="700">1280 × 720</text><rect x="164" y="30" width="126" height="92" rx="12" fill="#18376a"/><text x="178" y="58" fill="#9fb0c7" font-family="Arial" font-size="12">ZOOM</text><text x="178" y="92" fill="#fff" font-family="Arial" font-size="24" font-weight="700">125%</text><rect x="24" y="140" width="266" height="62" rx="12" fill="#142238"/><rect x="38" y="163" width="188" height="8" rx="4" fill="#2563eb"/><rect x="38" y="180" width="226" height="6" rx="3" fill="#2a3d5a"/><rect x="24" y="220" width="266" height="72" rx="12" fill="#142238"/><circle cx="48" cy="247" r="6" fill="#4adea8"/><text x="64" y="252" fill="#d7e3f4" font-family="Arial" font-size="14">Live • tab scoped</text></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#071121"/><stop offset="0.58" stop-color="#1249a3"/><stop offset="1" stop-color="#2563eb"/></linearGradient><pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0v24" fill="none" stroke="#67e8f9" stroke-opacity=".12"/></pattern></defs><rect width="${width}" height="${height}" fill="url(#bg)"/><rect width="${width}" height="${height}" fill="url(#grid)"/><g transform="translate(${markX} ${markY}) scale(${markSize / 128})"><rect x="16" y="16" width="96" height="96" rx="22" fill="#2563eb" stroke="#93c5fd" stroke-width="2"/><path fill="#dbeafe" d="M38 36h36v14H52v14h22v14H52v24H38z"/><path fill="#fff" d="M52 36h24c12 0 22 9 22 21s-10 21-22 21h-2V64h2c4 0 8-3 8-7s-4-7-8-7H52z"/><rect x="84" y="36" width="14" height="14" fill="#67e8f9"/></g><text x="${titleX}" y="${titleY}" fill="#fff" font-family="Inter,Arial,sans-serif" font-size="${titleSize}" font-weight="750" letter-spacing="-1">PixelParity</text><text x="${titleX}" y="${titleY + (compact ? 27 : 52)}" fill="#bdebf5" font-family="Inter,Arial,sans-serif" font-size="${subtitleSize}" font-weight="550">Live viewport &amp; display metrics</text>${panel}</svg>`;
}

await sharp(Buffer.from(promoSvg(440, 280, true)))
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(path.join(promos, "small-tile-440x280.png"));
await sharp(Buffer.from(promoSvg(1400, 560, false)))
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(path.join(promos, "marquee-1400x560.png"));

console.log(
  `Created five screenshots in ${screenshots} and two promotional images in ${promos}.`,
);
