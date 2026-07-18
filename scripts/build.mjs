import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const target = ["chrome116"];

async function buildJavaScript() {
  const shared = {
    bundle: true,
    minify: true,
    sourcemap: false,
    target,
    legalComments: "none",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  };

  await Promise.all([
    esbuild.build({
      ...shared,
      entryPoints: [path.join(root, "src/popup/main.tsx")],
      outfile: path.join(dist, "popup.js"),
      format: "esm",
    }),
    esbuild.build({
      ...shared,
      entryPoints: [path.join(root, "src/sidepanel/main.tsx")],
      outfile: path.join(dist, "sidepanel.js"),
      format: "esm",
    }),
    esbuild.build({
      ...shared,
      entryPoints: [path.join(root, "src/bridge/index.ts")],
      outfile: path.join(dist, "bridge.js"),
      format: "iife",
    }),
  ]);
}

async function buildCss() {
  await esbuild.build({
    entryPoints: [path.join(root, "src/styles.css")],
    outfile: path.join(dist, "app.css"),
    bundle: true,
    minify: true,
    target,
    legalComments: "none",
  });
}

async function copyRuntimeFiles() {
  const iconsDirectory = path.join(dist, "assets/icons");
  await mkdir(iconsDirectory, { recursive: true });
  await Promise.all([
    cp(path.join(root, "manifest.json"), path.join(dist, "manifest.json")),
    cp(path.join(root, "src/popup.html"), path.join(dist, "popup.html")),
    cp(path.join(root, "src/sidepanel.html"), path.join(dist, "sidepanel.html")),
    cp(path.join(root, "_locales"), path.join(dist, "_locales"), { recursive: true }),
    ...[16, 32, 48, 128].map((size) =>
      cp(
        path.join(root, `assets/icons/icon${size}.png`),
        path.join(iconsDirectory, `icon${size}.png`),
      ),
    ),
  ]);
}

async function assertBundleBudgets() {
  const entryFiles = ["popup.js", "sidepanel.js", "bridge.js"];
  const sizes = await Promise.all(
    entryFiles.map(async (file) => ({
      file,
      bytes: Buffer.byteLength(await readFile(path.join(dist, file))),
    })),
  );
  const oversized = sizes.filter(({ bytes }) => bytes > 75 * 1024);
  if (oversized.length > 0) {
    throw new Error(
      `JavaScript entry budget exceeded: ${oversized.map(({ file, bytes }) => `${file} (${bytes} bytes)`).join(", ")}`,
    );
  }
  console.log(
    `JavaScript entries: ${sizes.map(({ file, bytes }) => `${file} ${bytes} B`).join(", ")}`,
  );
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await Promise.all([buildJavaScript(), buildCss(), copyRuntimeFiles()]);
await assertBundleBudgets();
console.log(`Built PixelParity into ${dist}`);
