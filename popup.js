/**
 * PixelParity - Professional Display Metrics Tool
 * Version: 1.0.0
 * Author: Abdallah Arslan
 *
 * JavaScript Architecture:
 * - config.js: Configuration and constants
 * - utils.js: Utility functions and helpers
 * - metrics-detector.js: Core metrics detection logic
 * - ui-controller.js: UI management and rendering
 * - app.js: Main application orchestrator
 */

import { PixelParityApp } from "./js/app.js";

document.addEventListener("DOMContentLoaded", () => {
	if (window.location.protocol === "chrome-extension:") {
		const app = new PixelParityApp();
		app.init().catch((error) => {
			console.error("Failed to initialize PixelParity:", error);
		});
	}
});
