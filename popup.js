import { PixelParityApp } from "./js/app.js";

document.addEventListener("DOMContentLoaded", () => {
	if (window.location.protocol === "chrome-extension:") {
		const app = new PixelParityApp();
		app.init().catch((error) => {
			console.error("Failed to initialize PixelParity:", error);
		});
	}
});
