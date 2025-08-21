import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { minify as minifyHtml } from "html-minifier-terser";
import imagemin from "imagemin";
import imageminPngquant from "imagemin-pngquant";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const srcDir = root;
const distDir = path.join(root, "dist");

async function clean() {
	await rm(distDir, { recursive: true, force: true });
	await mkdir(distDir, { recursive: true });
}

async function buildJS() {
	await esbuild.build({
		entryPoints: [path.join(srcDir, "popup.js")],
		bundle: true,
		format: "esm",
		target: ["chrome100"],
		minify: true,
		sourcemap: false,
		outfile: path.join(distDir, "popup.js"),
		legalComments: "none",
		define: {
			"process.env.NODE_ENV": '"production"',
		},
		pure: ["console.log", "console.error", "console.warn"],
	});
}

async function buildCSS() {
	await esbuild.build({
		entryPoints: [path.join(srcDir, "popup.css")],
		bundle: false,
		loader: { ".css": "css" },
		minify: true,
		outfile: path.join(distDir, "popup.css"),
	});
}

async function buildHTML() {
	const htmlPath = path.join(srcDir, "popup.html");
	const html = await readFile(htmlPath, "utf8");
	const minified = await minifyHtml(html, {
		collapseWhitespace: true,
		removeComments: true,
		removeRedundantAttributes: true,
		removeEmptyAttributes: true,
		minifyCSS: true,
		minifyJS: true,
		keepClosingSlash: true,
	});
	await writeFile(path.join(distDir, "popup.html"), minified);
}

async function writeManifest() {
	const manifestPath = path.join(srcDir, "manifest.json");
	const json = JSON.parse(await readFile(manifestPath, "utf8"));
	await writeFile(path.join(distDir, "manifest.json"), JSON.stringify(json));
}

async function copyAndOptimizeIcons() {
	const srcIconsDir = path.join(srcDir, "assets", "icons");
	const outIconsDir = path.join(distDir, "assets", "icons");
	await mkdir(outIconsDir, { recursive: true });

	const files = (await readdir(srcIconsDir)).filter((f) => f.endsWith(".png"));
	const inputs = files.map((f) => path.join(srcIconsDir, f));

	const optimized = await imagemin(inputs, {
		destination: outIconsDir,
		plugins: [imageminPngquant({ quality: [0.6, 0.8], strip: true })],
	});

	const optimizedNames = new Set(
		optimized.map((o) => path.basename(o.sourcePath)),
	);
	await Promise.all(
		files
			.filter((f) => !optimizedNames.has(f))
			.map((f) => cp(path.join(srcIconsDir, f), path.join(outIconsDir, f))),
	);
}

async function build() {
	await clean();
	await Promise.all([buildJS(), buildCSS(), writeManifest()]);
	await buildHTML();
	await copyAndOptimizeIcons();
	console.log("Build complete ->", distDir);
}

build().catch((err) => {
	console.error(err);
	process.exit(1);
});
