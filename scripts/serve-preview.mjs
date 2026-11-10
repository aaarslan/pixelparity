import { cp, mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const preview = path.join(root, ".store-preview");
const port = Number(process.env.PIXELPARITY_PREVIEW_PORT ?? 8765);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid preview port.");
await mkdir(preview, { recursive: true });
const sourceFiles = ["workbench.html", "workbench.css", "fixture.html"];
const runtimeFiles = ["app.css", "overlay.js", "capture-bridge.js", "bridge.js"];
await Promise.all([
  ...sourceFiles.map((name) =>
    cp(path.join(root, "store/source", name), path.join(preview, name)),
  ),
  ...runtimeFiles.map((name) =>
    cp(path.join(root, "dist", name), path.join(preview, name)),
  ),
]);
await esbuild.build({
  entryPoints: [path.join(root, "store/source/workbench.tsx")],
  outfile: path.join(preview, "workbench.js"),
  bundle: true,
  format: "esm",
  minify: false,
  sourcemap: false,
  target: ["chrome116"],
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});
const files = new Set([...sourceFiles, ...runtimeFiles, "workbench.js"]);
const server = createServer(async (request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { allow: "GET, HEAD" });
      response.end();
      return;
    }
    const pathname = new URL(request.url ?? "/", `http://127.0.0.1:${port}`).pathname;
    if (pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }
    const filename = pathname === "/" ? "workbench.html" : pathname.slice(1);
    if (!files.has(filename)) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    const content = await readFile(path.join(preview, filename));
    const type = filename.endsWith(".js")
      ? "text/javascript"
      : filename.endsWith(".css")
        ? "text/css"
        : "text/html";
    response.writeHead(200, {
      "content-type": `${type}; charset=utf-8`,
      "cache-control": "no-store",
      "content-length": content.length,
      "x-content-type-options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Preview asset could not be read. Restart the preview after building.");
  }
});
server.on("error", (error) => {
  console.error(`Preview server failed: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(
    `PixelParity local interface preview: http://127.0.0.1:${port}/?section=layout&theme=dark&panel=420`,
  );
  console.log(
    "Actual shipping UI and page helpers; Chrome APIs are simulated. Screenshot capture requires the installed extension.",
  );
});
