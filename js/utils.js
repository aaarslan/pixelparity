export function getTimestamp() {
	return new Date().toISOString().replace("T", " ").split(".")[0];
}

export function escapeHtml(value) {
	return String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

export function prefersDarkMode() {
	return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}
