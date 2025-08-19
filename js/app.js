import { CONFIG } from "./config.js";
import { MetricsDetector } from "./metrics-detector.js";
import { UIController } from "./ui-controller.js";
import { getTimestamp } from "./utils.js";
export class PixelParityApp {
	constructor() {
		this.metricsDetector = new MetricsDetector();
		this.uiController = new UIController();
		this.isInitialized = false;
	}
	async init() {
		try {
			this.uiController.init();
			this.setupEventListeners();
			this.updateKeyboardShortcutDisplay();
			await this.loadSettings();
			await this.detectAndRenderMetrics();
			this.isInitialized = true;
		} catch (error) {
			console.error("Initialization error:", error);
			this.handleError(error);
		}
	}
	setupEventListeners() {
		this.addClickListener("settingsBtn", () =>
			this.uiController.toggleSettings(),
		);
		this.addClickListener("closeSettingsBtn", () =>
			this.uiController.toggleSettings(),
		);
		this.addClickListener("refreshBtn", () => this.refreshMetrics());
		this.addChangeListener("themeToggle", () =>
			this.uiController.toggleTheme(),
		);
		this.addChangeListener("compactModeToggle", () =>
			this.uiController.toggleCompactMode(),
		);
		this.addClickListener("retryBtn", () => this.detectAndRenderMetrics());
		this.addClickListener("copyJsonBtn", () => this.copyAsJson());
		this.addClickListener("copyCssBtn", () => this.copyAsCss());
		this.addClickListener("copyTableBtn", () => this.copyAsTable());
		this.setupKeyboardShortcuts();
	}
	setupKeyboardShortcuts() {
		document.addEventListener("keydown", (e) => {
			const isMac = navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
			const modifier = isMac ? e.metaKey : e.ctrlKey;
			if (!modifier) return;
			switch (e.key.toLowerCase()) {
				case "j":
					e.preventDefault();
					this.copyAsJson();
					break;
				case "s":
					e.preventDefault();
					this.copyAsCss();
					break;
				case "t":
					e.preventDefault();
					this.copyAsTable();
					break;
				case "r":
					e.preventDefault();
					this.refreshMetrics();
					break;
				case "d":
					e.preventDefault();
					this.uiController.toggleTheme();
					break;
			}
		});
	}
	async loadSettings() {
		return new Promise((resolve) => {
			chrome.storage.sync.get([CONFIG.STORAGE_KEYS.COMPACT_MODE], (result) => {
				if (result[CONFIG.STORAGE_KEYS.COMPACT_MODE]) {
					document.body.classList.add("compact-mode");
					if (this.uiController.elements.compactModeToggle) {
						this.uiController.elements.compactModeToggle.checked = true;
					}
				}
				resolve();
			});
		});
	}
	async detectAndRenderMetrics() {
		try {
			this.uiController.showLoading();
			await this.sleep(300);
			const metrics = await this.metricsDetector.detectMetrics();
			chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.LAST_METRICS]: metrics });
			this.uiController.renderMetrics(metrics);
		} catch (error) {
			this.handleError(error);
		}
	}
	async refreshMetrics() {
		const refreshBtn = this.uiController.elements.refreshBtn;
		if (refreshBtn) {
			refreshBtn.classList.add("active");
		}

		// Save scroll position before refresh
		const mainContainer = document.querySelector('.app-main');
		const scrollPosition = mainContainer ? mainContainer.scrollTop : 0;

		try {
			await this.detectAndRenderMetrics();
			
			// Restore scroll position after refresh
			if (mainContainer) {
				mainContainer.scrollTop = scrollPosition;
			}
		} catch (error) {
			this.handleError(error);
		} finally {
			if (refreshBtn) {
				setTimeout(() => {
					refreshBtn.classList.remove("active");
				}, 1000);
			}
		}
	}
	handleError(error) {
		console.error("PixelParity Error:", error);
		let message = "Unable to detect metrics";
		if (error.message.includes("No active tab")) {
			message = "No active tab found";
		} else if (error.message.includes("Cannot access metrics")) {
			message = "Cannot access metrics on this page";
		} else if (error.message.includes("Failed to extract")) {
			message = "Failed to extract metrics from page";
		}
		this.uiController.showError(message);
	}
	async copyAsJson() {
		this.animateButton('copyJsonBtn');
		try {
			const metrics = await this.metricsDetector.getLastMetrics();
			if (!metrics) throw new Error("No metrics available");
			const json = JSON.stringify(
				metrics,
				CONFIG.EXPORT_TEMPLATES.JSON_REPLACER,
				CONFIG.EXPORT_TEMPLATES.JSON_SPACE,
			);
			await navigator.clipboard.writeText(json);
			this.showCopyFeedback("JSON copied to clipboard");
		} catch (error) {
			console.error("Copy error:", error);
			this.showCopyFeedback("Failed to copy JSON", true);
		}
	}
	async copyAsCss() {
		this.animateButton('copyCssBtn');
		try {
			const metrics = await this.metricsDetector.getLastMetrics();
			if (!metrics) throw new Error("No metrics available");
			const cssVars = this.generateCssVariables(metrics);
			await navigator.clipboard.writeText(cssVars);
			this.showCopyFeedback("CSS variables copied to clipboard");
		} catch (error) {
			console.error("Copy error:", error);
			this.showCopyFeedback("Failed to copy CSS", true);
		}
	}
	async copyAsTable() {
		this.animateButton('copyTableBtn');
		try {
			const metrics = await this.metricsDetector.getLastMetrics();
			if (!metrics) throw new Error("No metrics available");
			const table = this.generateTable(metrics);
			await navigator.clipboard.writeText(table);
			this.showCopyFeedback("Table copied to clipboard");
		} catch (error) {
			console.error("Copy error:", error);
			this.showCopyFeedback("Failed to copy table", true);
		}
	}
	generateCssVariables(metrics) {
		const header = CONFIG.EXPORT_TEMPLATES.CSS_HEADER.replace(
			"{{timestamp}}",
			getTimestamp(),
		);
		const vars = [
			`  /* Viewport */`,
			`  --viewport-width: ${metrics.viewport.width}px;`,
			`  --viewport-height: ${metrics.viewport.height}px;`,
			`  --viewport-aspect-ratio: ${metrics.viewport.aspectRatio};`,
			``,
			`  /* Screen */`,
			`  --screen-width: ${metrics.screen.width}px;`,
			`  --screen-height: ${metrics.screen.height}px;`,
			`  --screen-available-width: ${metrics.screen.availWidth}px;`,
			`  --screen-available-height: ${metrics.screen.availHeight}px;`,
			``,
			`  /* Display */`,
			`  --device-pixel-ratio: ${metrics.display.devicePixelRatio};`,
			`  --zoom-level: ${metrics.display.zoomLevel}%;`,
			``,
			`  /* Typography */`,
			`  --root-font-size: ${metrics.typography.rootFontSize}px;`,
			`  --body-font-size: ${metrics.typography.bodyFontSize}px;`,
			``,
			`  /* REM Values */`,
			`  --viewport-width-rem: ${metrics.viewport.widthRem}rem;`,
			`  --viewport-height-rem: ${metrics.viewport.heightRem}rem;`,
		].join("\n");
		return `${header}${vars}\n${CONFIG.EXPORT_TEMPLATES.CSS_FOOTER}`;
	}
	generateTable(metrics) {
		const rows = [
			["Metric", "Value"],
			["---", "---"],
			["Viewport", `${metrics.viewport.width} × ${metrics.viewport.height}px`],
			["Screen", `${metrics.screen.width} × ${metrics.screen.height}px`],
			[
				"Available",
				`${metrics.screen.availWidth} × ${metrics.screen.availHeight}px`,
			],
			["Zoom Level", `${metrics.display.zoomLevel}%`],
			["Pixel Ratio", `${metrics.display.devicePixelRatio}x`],
			["Aspect Ratio", metrics.viewport.aspectRatio],
			["Root Font", `${metrics.typography.rootFontSize}px`],
			["Orientation", metrics.screen.orientation],
		];
		return rows
			.map((row) => row.join(CONFIG.EXPORT_TEMPLATES.TABLE_DELIMITER))
			.join("\n");
	}
	addClickListener(elementKey, handler) {
		const element = this.uiController.elements[elementKey];
		if (element) {
			element.addEventListener("click", handler);
		}
	}
	addChangeListener(elementKey, handler) {
		const element = this.uiController.elements[elementKey];
		if (element) {
			element.addEventListener("change", handler);
		}
	}
	animateButton(elementKey) {
		const element = this.uiController.elements[elementKey];
		if (element) {
			element.style.transform = 'scale(0.95)';
			setTimeout(() => {
				element.style.transform = '';
			}, 150);
		}
	}

	updateKeyboardShortcutDisplay() {
		const isMac = navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
		const modifier = isMac ? "⌘" : "Ctrl+";
		
		const shortcuts = [
			{ element: document.querySelector('#copyJsonBtn kbd'), key: 'J' },
			{ element: document.querySelector('#copyCssBtn kbd'), key: 'S' },
			{ element: document.querySelector('#copyTableBtn kbd'), key: 'T' }
		];
		
		shortcuts.forEach(({ element, key }) => {
			if (element) {
				element.textContent = `${modifier}${key}`;
			}
		});
	}

	showCopyFeedback(message, isError = false) {
		// Create or update feedback element
		let feedback = document.getElementById('copyFeedback');
		if (!feedback) {
			feedback = document.createElement('div');
			feedback.id = 'copyFeedback';
			feedback.style.cssText = `
				position: fixed;
				top: 16px;
				right: 16px;
				padding: 8px 12px;
				border-radius: 6px;
				font-size: 14px;
				font-weight: 500;
				z-index: 1000;
				transition: all 150ms ease;
				pointer-events: none;
			`;
			document.body.appendChild(feedback);
		}
		
		feedback.textContent = message;
		feedback.style.backgroundColor = isError ? 'var(--color-error)' : 'var(--color-success)';
		feedback.style.color = 'white';
		feedback.style.opacity = '1';
		feedback.style.transform = 'translateY(0)';
		
		// Auto-hide after 2 seconds
		setTimeout(() => {
			feedback.style.opacity = '0';
			feedback.style.transform = 'translateY(-10px)';
		}, 2000);
	}

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
