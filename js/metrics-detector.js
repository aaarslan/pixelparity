import { CONFIG } from "./config.js";

export class MetricsDetector {
	async detectMetrics() {
		const [tab] = await chrome.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (!tab || !tab.id) {
			throw new Error(
				"No active tab found. Please select a tab and try again.",
			);
		}
		if (this.isRestrictedUrl(tab.url)) {
			throw new Error("Cannot access metrics on protected browser pages.");
		}

		// Execute in-page function to compute metrics on demand and return value directly.
		const [{ result }] = await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => {
				try {
					const safeGetComputedStyle = (element, property) =>
						window.getComputedStyle(element)[property];
					const calculateZoom = () =>
						Math.round((window.devicePixelRatio || 1) * 100);
					const docElement = document.documentElement;
					const body = document.body;
					if (!docElement || !body) return null;
					const rootFontSize =
						parseFloat(safeGetComputedStyle(docElement, "fontSize")) || 16;
					const vwRem = (window.innerWidth / rootFontSize).toFixed(2);
					const vhRem = (window.innerHeight / rootFontSize).toFixed(2);
					const metrics = {
						viewport: {
							width: window.innerWidth,
							height: window.innerHeight,
							aspectRatio: (window.innerWidth / window.innerHeight).toFixed(2),
							widthRem: vwRem,
							heightRem: vhRem,
						},
						screen: {
							width: window.screen.width,
							height: window.screen.height,
							availWidth: window.screen.availWidth,
							availHeight: window.screen.availHeight,
							colorDepth: window.screen.colorDepth,
							orientation: window.screen.orientation?.type || "unknown",
						},
						document: {
							width: Math.max(body.scrollWidth, docElement.scrollWidth),
							height: Math.max(body.scrollHeight, docElement.scrollHeight),
						},
						typography: {
							rootFontSize,
							bodyFontSize:
								parseFloat(safeGetComputedStyle(body, "fontSize")) ||
								rootFontSize,
						},
						display: {
							devicePixelRatio: window.devicePixelRatio || 1,
							zoomLevel: calculateZoom(),
						},
						meta: { url: window.location.href, timestamp: Date.now() },
					};
					return metrics;
				} catch (_err) {
					return null;
				}
			},
		});

		if (!result) {
			throw new Error("Failed to extract metrics from page.");
		}

		// Cache last metrics for copy/export actions in the popup context only.
		await chrome.storage.local.set({
			[CONFIG.STORAGE_KEYS.LAST_METRICS]: result,
		});
		return result;
	}

	async getLastMetrics() {
		const result = await chrome.storage.local.get([
			CONFIG.STORAGE_KEYS.LAST_METRICS,
		]);
		return result[CONFIG.STORAGE_KEYS.LAST_METRICS] || null;
	}

	isRestrictedUrl(url) {
		if (!url) return true;
		const restrictedProtocols = [
			"chrome://",
			"chrome-extension://",
			"edge://",
			"about:",
		];
		const chromeWebStoreUrl = "https://chromewebstore.google.com/";
		if (url.startsWith(chromeWebStoreUrl)) return true;
		return restrictedProtocols.some((protocol) => url.startsWith(protocol));
	}
}
