import { CONFIG } from "./config.js";
import { prefersDarkMode } from "./utils.js";
export class UIController {
	constructor() {
		this.elements = {};
	}
	init() {
		this.cacheElements();
		this.applyStoredTheme();
	}
	cacheElements() {
		const selectors = {
			loadingState: "#loadingState",
			errorState: "#errorState",
			successState: "#successState",
			appMain: ".app-main",
			metricsGrid: "#metricsGrid",
			breakpointsGrid: "#breakpointsGrid",
			settingsBtn: "#settingsBtn",
			refreshBtn: "#refreshBtn",
			closeSettingsBtn: "#closeSettingsBtn",
			retryBtn: "#retryBtn",
			copyJsonBtn: "#copyJsonBtn",
			copyCssBtn: "#copyCssBtn",
			copyTableBtn: "#copyTableBtn",
			settingsPanel: "#settingsPanel",
			themeToggle: "#themeToggle",
			compactModeToggle: "#compactModeToggle",
			errorMessage: "#errorMessage",
		};
		for (const [key, selector] of Object.entries(selectors)) {
			this.elements[key] = document.querySelector(selector);
		}
	}
	showLoading() {
		this.hideAllStates();
		this.elements.loadingState.classList.remove("hidden");
		this.elements.loadingState.removeAttribute("aria-hidden");
		if (this.elements.appMain) {
			this.elements.appMain.scrollTop = 0;
		}
	}
	showError(message = "Unable to detect metrics") {
		this.hideAllStates();
		this.elements.errorState.classList.remove("hidden");
		this.elements.errorState.removeAttribute("aria-hidden");
		if (this.elements.errorMessage) {
			this.elements.errorMessage.textContent = message;
		}
		if (this.elements.appMain) {
			this.elements.appMain.scrollTop = 0;
		}
		this.elements.retryBtn?.focus?.({ preventScroll: true });
	}
	showSuccess() {
		this.hideAllStates();
		this.elements.successState.classList.remove("hidden");
		this.elements.successState.removeAttribute("aria-hidden");
		if (this.elements.appMain) {
			this.elements.appMain.scrollTop = 0;
		}
		this.elements.copyJsonBtn?.focus?.({ preventScroll: true });
	}
	hideAllStates() {
		["loadingState", "errorState", "successState"].forEach((stateKey) => {
			const element = this.elements[stateKey];
			if (element) {
				element.classList.add("hidden");
				element.setAttribute("aria-hidden", "true");
			}
		});
	}
	renderMetrics(metrics) {
		this.renderMetricsGrid(metrics);
		this.renderBreakpoints(metrics);
		this.showSuccess();
	}
	renderMetricsGrid(metrics) {
		const cards = [
			{
				label: "Viewport",
				value: `${metrics.viewport.width} × ${metrics.viewport.height}`,
				unit: "px",
			},
			{
				label: "Zoom Level",
				value: `${metrics.display.zoomLevel}`,
				unit: "%",
			},
			{
				label: "Pixel Ratio",
				value: `${metrics.display.devicePixelRatio.toFixed(2)}`,
				unit: "x",
			},
			{
				label: "Viewport (REM)",
				value: `${metrics.viewport.widthRem} × ${metrics.viewport.heightRem}`,
				unit: "rem",
			},
			{
				label: "Screen",
				value: `${metrics.screen.width} × ${metrics.screen.height}`,
				unit: "px",
			},
			{
				label: "Available",
				value: `${metrics.screen.availWidth} × ${metrics.screen.availHeight}`,
				unit: "px",
			},
			{
				label: "Document",
				value: `${metrics.document.width} × ${metrics.document.height}`,
				unit: "px",
			},
			{ label: "Aspect Ratio", value: metrics.viewport.aspectRatio, unit: "" },
			{ label: "Color Depth", value: metrics.screen.colorDepth, unit: "bit" },
			{ label: "Orientation", value: metrics.screen.orientation, unit: "" },
			{
				label: "Root Font",
				value: metrics.typography.rootFontSize,
				unit: "px",
			},
			{
				label: "Body Font",
				value: metrics.typography.bodyFontSize,
				unit: "px",
			},
		];
		const html = cards.map((card) => this.createMetricCard(card)).join("");
		if (this.elements.metricsGrid) this.elements.metricsGrid.innerHTML = html;
	}
	createMetricCard({ label, value, unit }) {
		return `
            <div class="metric-card" role="listitem">
                <span class="metric-label">${label}</span>
                <span class="metric-value">
                    ${value}
                    ${unit ? `<span class="metric-unit">${unit}</span>` : ""}
                </span>
            </div>`;
	}
	renderBreakpoints(metrics) {
		const width = metrics.viewport.width;
		const html = CONFIG.BREAKPOINTS.map((bp) => {
			const isActive =
				width >= bp.min && (width <= bp.max || bp.max === Infinity);
			const range = bp.max === Infinity ? `≥${bp.min}` : `${bp.min}-${bp.max}`;
			return `
                <div class="breakpoint-item ${isActive ? "active" : ""}">
                    <span class="breakpoint-name">${bp.name}</span>
                    <span class="breakpoint-range">${range}</span>
                </div>`;
		}).join("");
		if (this.elements.breakpointsGrid)
			this.elements.breakpointsGrid.innerHTML = html;
	}
	toggleSettings() {
		const panel = this.elements.settingsPanel;
		const isHidden = panel.classList.contains("hidden");
		if (isHidden) {
			panel.classList.remove("hidden");
			panel.setAttribute("aria-hidden", "false");
			this.elements.closeSettingsBtn?.focus?.({ preventScroll: true });
		} else {
			panel.classList.add("hidden");
			panel.setAttribute("aria-hidden", "true");
			this.elements.settingsBtn?.focus?.({ preventScroll: true });
		}
	}
	applyStoredTheme() {
		chrome.storage.sync.get([CONFIG.STORAGE_KEYS.THEME], (result) => {
			const theme =
				result[CONFIG.STORAGE_KEYS.THEME] ||
				(prefersDarkMode() ? "dark" : "light");
			this.setTheme(theme);
		});
	}
	setTheme(theme) {
		document.body.setAttribute("data-theme", theme);
		if (this.elements.themeToggle) {
			this.elements.themeToggle.checked = theme === "dark";
		}
	}
	toggleTheme() {
		const newTheme =
			(document.body.getAttribute("data-theme") || "light") === "light"
				? "dark"
				: "light";
		this.setTheme(newTheme);
		chrome.storage.sync.set({ [CONFIG.STORAGE_KEYS.THEME]: newTheme });
	}
	toggleCompactMode() {
		const isCompact = document.body.classList.toggle("compact-mode");
		chrome.storage.sync.set({ [CONFIG.STORAGE_KEYS.COMPACT_MODE]: isCompact });
	}
	updateElement(elementKey, content) {
		if (this.elements[elementKey]) {
			this.elements[elementKey].textContent = content;
		}
	}
	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
