export function getTimestamp() {
	return new Date().toISOString().replace("T", " ").split(".")[0];
}

export function prefersDarkMode() {
	return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
}
