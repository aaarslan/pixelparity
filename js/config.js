export const CONFIG = {
	STORAGE_KEYS: {
		THEME: "pixelparity_theme",
		COMPACT_MODE: "pixelparity_compact_mode",
		LAST_METRICS: "pixelparity_last_metrics",
	},
	BREAKPOINTS: [
		{ name: "XS", min: 0, max: 575 },
		{ name: "SM", min: 576, max: 767 },
		{ name: "MD", min: 768, max: 991 },
		{ name: "LG", min: 992, max: 1199 },
		{ name: "XL", min: 1200, max: 1399 },
		{ name: "XXL", min: 1400, max: Infinity },
	],
	EXPORT_TEMPLATES: {
		CSS_HEADER: `/* PixelParity - Display Metrics CSS Variables */\n/* Generated: {{timestamp}} */\n\n:root {\n`,
		CSS_FOOTER: `\n}`,
		JSON_REPLACER: null,
		JSON_SPACE: 2,
		TABLE_DELIMITER: "\t",
	},
};
