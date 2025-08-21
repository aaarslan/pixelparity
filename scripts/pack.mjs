import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const buildsDir = path.join(root, "builds");

async function pack() {
	await mkdir(buildsDir, { recursive: true });
	const manifest = JSON.parse(
		await readFile(path.join(distDir, "manifest.json"), "utf8"),
	);
	const version = manifest.version || "0.0.0";
	const zipPath = path.join(buildsDir, `pixelparity-${version}.zip`);

	const output = createWriteStream(zipPath);
	const archive = archiver("zip", { zlib: { level: 9 } });

	const done = new Promise((resolve, reject) => {
		output.on("close", resolve);
		archive.on("warning", reject);
		archive.on("error", reject);
	});

	archive.pipe(output);
	archive.directory(`${distDir}/`, false);
	await archive.finalize();
	await done;
	console.log("Packed ->", zipPath);
}

pack().catch((err) => {
	console.error(err);
	process.exit(1);
});
