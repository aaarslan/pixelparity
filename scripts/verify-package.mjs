import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

export const RUNTIME_FILES = [
  "_locales/en/messages.json",
  "app.css",
  "assets/icons/icon16.png",
  "assets/icons/icon32.png",
  "assets/icons/icon48.png",
  "assets/icons/icon128.png",
  "bridge.js",
  "manifest.json",
  "popup.html",
  "popup.js",
  "sidepanel.html",
  "sidepanel.js",
];

async function walk(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory())
      files.push(...(await walk(path.join(directory, entry.name), relative)));
    else files.push(relative);
  }
  return files;
}

function pngDimensions(buffer) {
  const signature = buffer.subarray(0, 8).toString("hex");
  if (
    signature !== "89504e470d0a1a0a" ||
    buffer.subarray(12, 16).toString("ascii") !== "IHDR"
  ) {
    throw new Error("Invalid PNG signature");
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

export async function verifyPackage() {
  const actual = (await walk(dist)).sort();
  const expected = [...RUNTIME_FILES].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    const unexpected = actual.filter((file) => !expected.includes(file));
    const missing = expected.filter((file) => !actual.includes(file));
    throw new Error(
      `Runtime allowlist mismatch. Unexpected: ${unexpected.join(", ") || "none"}. Missing: ${missing.join(", ") || "none"}.`,
    );
  }

  const [manifest, packageJson, messages] = await Promise.all([
    readFile(path.join(dist, "manifest.json"), "utf8").then(JSON.parse),
    readFile(path.join(root, "package.json"), "utf8").then(JSON.parse),
    readFile(path.join(dist, "_locales/en/messages.json"), "utf8").then(JSON.parse),
  ]);
  if (manifest.version !== packageJson.version)
    throw new Error("Manifest and package versions do not match.");
  if (manifest.manifest_version !== 3 || manifest.minimum_chrome_version !== "116")
    throw new Error("Manifest must target MV3 and Chrome 116 or newer.");
  if (manifest.default_locale !== "en")
    throw new Error("English must remain the default locale for v2.");
  if (
    manifest.action?.default_popup !== "popup.html" ||
    manifest.side_panel?.default_path !== "sidepanel.html"
  ) {
    throw new Error("Popup or side-panel entry point changed unexpectedly.");
  }
  if (messages.extensionName?.message !== "PixelParity — Viewport & Display Metrics")
    throw new Error("Localized extension title does not match the approved listing.");
  const permissions = [...manifest.permissions].sort();
  const expectedPermissions = ["activeTab", "scripting", "sidePanel", "storage"].sort();
  if (JSON.stringify(permissions) !== JSON.stringify(expectedPermissions))
    throw new Error(`Unexpected permissions: ${permissions.join(", ")}`);
  for (const forbidden of [
    "host_permissions",
    "optional_permissions",
    "optional_host_permissions",
    "background",
    "content_scripts",
    "externally_connectable",
    "web_accessible_resources",
  ]) {
    if (forbidden in manifest) throw new Error(`Forbidden manifest field: ${forbidden}`);
  }
  const expectedCsp =
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'";
  if (manifest.content_security_policy?.extension_pages !== expectedCsp)
    throw new Error("Extension Content Security Policy changed unexpectedly.");

  for (const size of [16, 32, 48, 128]) {
    const dimensions = pngDimensions(
      await readFile(path.join(dist, `assets/icons/icon${size}.png`)),
    );
    if (dimensions.width !== size || dimensions.height !== size)
      throw new Error(
        `icon${size}.png is ${dimensions.width}×${dimensions.height}, expected ${size}×${size}.`,
      );
  }

  for (const file of [
    "app.css",
    "bridge.js",
    "popup.html",
    "popup.js",
    "sidepanel.html",
    "sidepanel.js",
  ]) {
    const content = await readFile(path.join(dist, file), "utf8");
    const withoutMarkupNamespaces = content.replaceAll(
      /http:\/\/www\.w3\.org\/(?:2000\/svg|1998\/Math\/MathML|1999\/xhtml)/g,
      "",
    );
    if (/https?:\/\//i.test(withoutMarkupNamespaces))
      throw new Error(`Unexpected remote URL in ${file}.`);
    if (/sourceMappingURL/i.test(content))
      throw new Error(`Source map reference found in ${file}.`);
  }

  const runtimeBytes = (
    await Promise.all(
      RUNTIME_FILES.map((file) => stat(path.join(dist, file)).then((item) => item.size)),
    )
  ).reduce((total, size) => total + size, 0);
  console.log(
    `Verified ${RUNTIME_FILES.length} runtime files (${runtimeBytes} uncompressed bytes).`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await verifyPackage();
