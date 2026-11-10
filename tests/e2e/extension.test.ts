import { createServer, type Server } from "node:http";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer, { type Browser, type Extension, type Page, type Target } from "puppeteer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let browser: Browser;
let fixturePage: Page;
let extension: Extension;
let server: Server;
let fixtureUrl: string;

async function extensionPage(target: Target): Promise<Page> {
  const page = await target.asPage();
  if (!page) throw new Error(`Target is not a page: ${target.type()} ${target.url()}`);
  return page;
}

async function metricValue(page: Page, metricId: string): Promise<string> {
  return page.$eval(
    `[data-metric="${metricId}"] .primary-value`,
    (element) => element.textContent?.replace(/\s+/g, " ").trim() ?? "",
  );
}

async function waitForMetric(
  page: Page,
  metricId: string,
  expected: RegExp,
): Promise<void> {
  await page.waitForFunction(
    (id, source, flags) => {
      const value =
        document.querySelector(`[data-metric="${id}"] .primary-value`)?.textContent ?? "";
      return new RegExp(source, flags).test(value.replace(/\s+/g, " ").trim());
    },
    { timeout: 10_000 },
    metricId,
    expected.source,
    expected.flags,
  );
}

async function clickScopedButton(page: Page, scope: string, name: string): Promise<void> {
  const buttons = await page.$$(`${scope} button`);
  try {
    for (const button of buttons) {
      const matches = await button.evaluate((element, expected) => {
        const label = element.querySelector("strong")?.textContent ?? element.textContent;
        return label?.replace(/\s+/g, " ").trim() === expected;
      }, name);
      if (matches) {
        await button.click();
        return;
      }
    }
    throw new Error(`Could not find ${name} in ${scope}.`);
  } finally {
    await Promise.all(buttons.map((button) => button.dispose()));
  }
}

async function setCaptureOption(page: Page, name: string, checked: boolean): Promise<void> {
  const labels = await page.$$(".capture-options label");
  try {
    for (const label of labels) {
      const matches = await label.evaluate(
        (element, expected) => element.querySelector("strong")?.textContent === expected,
        name,
      );
      if (!matches) continue;
      const input = await label.$("input");
      if (!input) throw new Error(`Missing checkbox for ${name}.`);
      try {
        if (
          await input.evaluate((element, desired) => element.checked !== desired, checked)
        )
          await input.click();
      } finally {
        await input.dispose();
      }
      return;
    }
    throw new Error(`Could not find capture option ${name}.`);
  } finally {
    await Promise.all(labels.map((label) => label.dispose()));
  }
}

async function capturePreview(page: Page, mode: string) {
  const previousSource = await page.evaluate(
    () => document.querySelector<HTMLImageElement>(".capture-preview img")?.src ?? "",
  );
  await clickScopedButton(page, ".capture-modes", mode);
  await page.waitForFunction(
    (previous) => {
      const image = document.querySelector<HTMLImageElement>(".capture-preview img");
      return (
        document.querySelector(".capture-message--error") ||
        (image &&
          image.src !== previous &&
          image.complete &&
          image.naturalWidth > 0 &&
          !document.querySelector(".capture-progress"))
      );
    },
    { timeout: 15_000 },
    previousSource,
  );
  const failure = await page.$(".capture-message--error");
  if (failure)
    throw new Error(
      await failure.evaluate((element) => element.textContent ?? "Capture failed."),
    );
  return page.$eval(".capture-preview img", (element) => {
    const image = element as HTMLImageElement;
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      declaredWidth: Number(image.getAttribute("width")),
      declaredHeight: Number(image.getAttribute("height")),
    };
  });
}

async function screenshotPixel(page: Page, x: number, y: number): Promise<number[]> {
  return page.$eval(
    ".capture-preview img",
    (element, point) => {
      const image = element as HTMLImageElement;
      const canvas = new OffscreenCanvas(1, 1);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("A canvas was not available for PNG verification.");
      context.drawImage(image, Math.floor(point.x), Math.floor(point.y), 1, 1, 0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    },
    { x, y },
  );
}

beforeAll(async () => {
  const fixtures = new Map([
    ["/", await readFile(path.join(root, "tests/fixtures/index.html"))],
    [
      "/responsive-bug.html",
      await readFile(path.join(root, "tests/fixtures/responsive-bug.html")),
    ],
  ]);
  server = createServer((request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const fixture = fixtures.get(pathname) ?? fixtures.get("/");
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture server did not bind.");
  fixtureUrl = `http://127.0.0.1:${address.port}/responsive-bug.html`;

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH || (await puppeteer.executablePath());
  browser = await puppeteer.launch({
    executablePath,
    headless: process.env.PIXELPARITY_HEADLESS === "1",
    enableExtensions: true,
    defaultViewport: { width: 1100, height: 760 },
    args: ["--no-first-run", "--no-default-browser-check", "--disable-component-update"],
  });
  fixturePage = await browser.newPage();
  const extensionId = await browser.installExtension(path.join(root, "dist"));
  const installed = (await browser.extensions()).get(extensionId);
  if (!installed) throw new Error("PixelParity was not installed.");
  extension = installed;
  await fixturePage.setViewport({ width: 1000, height: 700, deviceScaleFactor: 1 });
  await fixturePage.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server?.close((error) => (error ? reject(error) : resolve())),
  );
});

describe("packaged extension", () => {
  it("measures, opens a live tab-scoped panel, updates, compares, and disconnects", async () => {
    const popupTargetPromise = browser.waitForTarget(
      (target) =>
        target.url().startsWith("chrome-extension://") &&
        target.url().includes("popup.html"),
      { timeout: 10_000 },
    );
    await fixturePage.triggerExtensionAction(extension);
    const popup = await extensionPage(await popupTargetPromise);
    const remoteRequests: string[] = [];
    popup.on("request", (request) => {
      if (/^https?:/i.test(request.url())) remoteRequests.push(request.url());
    });
    await popup.waitForSelector('[data-metric="layout-viewport"]');
    const popupGeometry = await popup.evaluate(() => ({
      bodyWidth: document.body.getBoundingClientRect().width,
      bodyHeight: document.body.getBoundingClientRect().height,
      shellWidth:
        document.querySelector<HTMLElement>(".popup-shell")?.getBoundingClientRect()
          .width ?? 0,
      shellHeight:
        document.querySelector<HTMLElement>(".popup-shell")?.getBoundingClientRect()
          .height ?? 0,
    }));
    expect(popupGeometry).toEqual({
      bodyWidth: 380,
      bodyHeight: 480,
      shellWidth: 380,
      shellHeight: 480,
    });

    const expectedViewport = await fixturePage.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    expect(await metricValue(popup, "layout-viewport")).toContain(
      `${expectedViewport.width} × ${expectedViewport.height}`,
    );
    expect(await metricValue(popup, "browser-zoom")).toMatch(/^100\s*%$/);

    const panelTargetPromise = browser.waitForTarget(
      (target) =>
        target.url().startsWith("chrome-extension://") &&
        target.url().includes("sidepanel.html?tabId="),
      { timeout: 10_000 },
    );
    await popup.click(".button--primary");
    const panel = await extensionPage(await panelTargetPromise);
    panel.on("request", (request) => {
      if (/^https?:/i.test(request.url())) remoteRequests.push(request.url());
    });
    await panel.waitForSelector(".connection-pill--live", { timeout: 10_000 });

    await fixturePage.setViewport({ width: 920, height: 650, deviceScaleFactor: 1 });
    await waitForMetric(panel, "layout-viewport", /^920 × 650/);
    await fixturePage.setViewport({ width: 920, height: 650, deviceScaleFactor: 2 });
    await fixturePage.evaluate(() => window.dispatchEvent(new Event("resize")));
    await waitForMetric(panel, "device-pixel-ratio", /^2\s*×$/);
    await fixturePage.setViewport({ width: 920, height: 650, deviceScaleFactor: 1 });
    await fixturePage.evaluate(() => window.dispatchEvent(new Event("resize")));
    await waitForMetric(panel, "device-pixel-ratio", /^1\s*×$/);

    await panel.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (typeof tab?.id !== "number") throw new Error("No active tab");
      await chrome.tabs.setZoom(tab.id, 1.25);
    });
    await waitForMetric(panel, "browser-zoom", /^125\s*%$/);

    await panel.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (typeof tab?.id !== "number") throw new Error("No active tab");
      await chrome.tabs.setZoom(tab.id, 1);
    });
    await waitForMetric(panel, "browser-zoom", /^100\s*%$/);

    const baselineViewport = await fixturePage.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    await waitForMetric(
      panel,
      "layout-viewport",
      new RegExp(`^${baselineViewport.width} × ${baselineViewport.height}`),
    );
    await panel.click(".baseline-card .button");
    await fixturePage.setViewport({ width: 700, height: 650, deviceScaleFactor: 1 });
    const resizedViewport = await fixturePage.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight,
    }));
    await waitForMetric(
      panel,
      "layout-viewport",
      new RegExp(`^${resizedViewport.width} × ${resizedViewport.height}`),
    );
    const widthDelta = resizedViewport.width - baselineViewport.width;
    const expectedDelta = `${widthDelta < 0 ? "−" : "+"}${Math.abs(widthDelta)} px wide`;
    await panel.waitForFunction(
      (delta) =>
        [...document.querySelectorAll(".delta-badge")].some((element) =>
          element.textContent?.includes(delta),
        ),
      {},
      expectedDelta,
    );
    await panel.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (typeof tab?.id !== "number") throw new Error("No active tab");
      await chrome.tabs.setZoom(tab.id, 1.25);
    });
    await waitForMetric(panel, "browser-zoom", /^125\s*%$/);
    expect(
      await fixturePage.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(true);

    const originalPanelValue = await metricValue(panel, "layout-viewport");
    const otherTab = await browser.newPage();
    await otherTab.setViewport({ width: 777, height: 555, deviceScaleFactor: 1 });
    await otherTab.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
    await otherTab.bringToFront();
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(await metricValue(panel, "layout-viewport")).toBe(originalPanelValue);
    await fixturePage.bringToFront();
    await panel.waitForSelector(".connection-pill--live", { timeout: 10_000 });
    await otherTab.close();

    await panel.click('.panel-nav button[data-section="breakpoints"]');
    await panel.waitForSelector(".panel-card");
    await panel.evaluate(() => {
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
        (item) => item.textContent?.includes("New profile"),
      );
      button?.click();
    });
    await panel.waitForSelector("#profile-editor-title");
    await panel.click(".editor-card .button--primary");
    await panel.waitForFunction(() =>
      [...document.querySelectorAll("option")].some(
        (option) => option.textContent === "My breakpoints",
      ),
    );
    const storedPreferences = await panel.evaluate(async () => {
      const result = await chrome.storage.sync.get("pixelparity_preferences_v2");
      const value = result.pixelparity_preferences_v2 as {
        customProfileCount?: number;
        storageLayout?: string;
      };
      return {
        customProfilesLength: value.customProfileCount ?? 0,
        storageLayout: value.storageLayout,
      };
    });
    expect(storedPreferences.customProfilesLength).toBe(1);
    expect(storedPreferences.storageLayout).toBe("profile-slots-v1");

    await panel.click('.panel-nav button[data-section="export"]');
    await panel.waitForSelector(".export-card");
    await panel.waitForSelector(".issue-report-card");
    await panel.click(".issue-report-card .button");
    await panel.waitForFunction(() =>
      [...document.querySelectorAll('[role="status"]')].some((element) =>
        element.textContent?.includes("Issue-ready report copied"),
      ),
    );
    await panel.click(".export-card .button--primary");
    await panel.waitForFunction(() =>
      [...document.querySelectorAll('[role="status"]')].some((element) =>
        element.textContent?.includes("JSON snapshot copied"),
      ),
    );

    const downloadDirectory = await mkdtemp(
      path.join(os.tmpdir(), "pixelparity-download-"),
    );
    const browserSession = await browser.target().createCDPSession();
    await browserSession.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDirectory,
      eventsEnabled: true,
    });
    await panel.click(".export-card .button--secondary");
    await expect
      .poll(
        async () =>
          (await readdir(downloadDirectory)).filter((name) => !name.endsWith(".crdownload"))
            .length,
        { timeout: 5_000 },
      )
      .toBe(1);
    const [downloadName] = (await readdir(downloadDirectory)).filter(
      (name) => !name.endsWith(".crdownload"),
    );
    if (!downloadName) throw new Error("JSON download was not created.");
    const downloadedSnapshot = JSON.parse(
      await readFile(path.join(downloadDirectory, downloadName), "utf8"),
    );
    expect(downloadedSnapshot.schemaVersion).toBe(2);
    expect(JSON.stringify(downloadedSnapshot)).not.toContain("http");
    await browserSession.send("Browser.setDownloadBehavior", { behavior: "deny" });
    await rm(downloadDirectory, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });

    await fixturePage.goto("data:text/html,<title>New origin</title><h1>Navigation</h1>");
    await panel.waitForSelector(".connection-pill--error", { timeout: 10_000 });
    await panel.click('.panel-nav button[data-section="inspect"]');
    await panel.waitForSelector(".state-view--error", { timeout: 10_000 });
    expect(await panel.$('[data-metric="layout-viewport"]')).toBeNull();
    expect(await panel.$(".baseline-card")).toBeNull();
    expect(remoteRequests).toEqual([]);

    const protectedPage = await browser.newPage();
    await protectedPage.goto("chrome://version/", { waitUntil: "domcontentloaded" });
    const protectedPopupTarget = browser.waitForTarget(
      (target) =>
        target.url().startsWith("chrome-extension://") &&
        target.url().includes("popup.html"),
      { timeout: 10_000 },
    );
    await protectedPage.triggerExtensionAction(extension);
    const protectedPopup = await extensionPage(await protectedPopupTarget);
    await protectedPopup.waitForSelector(".state-view--error");
    expect(
      await protectedPopup.$eval(".state-view--error h1", (element) => element.textContent),
    ).toBe("This page is protected");
    await protectedPage.close();
  });

  it("aligns and measures the page, captures local PNGs, and restores cancelled captures", async () => {
    const toolsPage = await browser.newPage();
    await toolsPage.setViewport(null);
    const windowSession = await toolsPage.createCDPSession();
    const { windowId } = await windowSession.send("Browser.getWindowForTarget");
    await windowSession.send("Browser.setWindowBounds", {
      windowId,
      bounds: { width: 1000, height: 850 },
    });
    await windowSession.detach();
    await toolsPage.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
    const popupTarget = browser.waitForTarget(
      (target) =>
        target.url().startsWith("chrome-extension://") &&
        target.url().includes("popup.html"),
      { timeout: 10_000 },
    );
    try {
      await toolsPage.triggerExtensionAction(extension);
      const popup = await extensionPage(await popupTarget);
      await popup.waitForSelector('[data-metric="layout-viewport"]');
      const tabId = await popup.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (typeof tab?.id !== "number") throw new Error("No active fixture tab.");
        return tab.id;
      });
      const panelTarget = browser.waitForTarget(
        (target) => target.url().includes(`sidepanel.html?tabId=${tabId}`),
        { timeout: 10_000 },
      );
      await popup.click(".button--primary");
      const panel = await extensionPage(await panelTarget);
      const remoteRequests: string[] = [];
      panel.on("request", (request) => {
        if (/^https?:/i.test(request.url())) remoteRequests.push(request.url());
      });
      await panel.waitForSelector(".connection-pill--live", { timeout: 10_000 });
      await panel.evaluate(
        async (sourceTabId) => chrome.tabs.setZoom(sourceTabId, 1),
        tabId,
      );
      await waitForMetric(panel, "browser-zoom", /^100\s*%$/);
      const gridSwitch = '.layout-tools [role="switch"][aria-label="Show grid overlay"]';
      const rulerSwitch = '.layout-tools [role="switch"][aria-label="Show page rulers"]';
      const inspectButton = ".layout-picker-card button";
      const overlaySelector = "[data-pixelparity-overlay]";

      const initialGeometry = await toolsPage.$eval(".fixture-card", (element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      await panel.click('.panel-nav button[data-section="layout"]');
      await panel.waitForSelector(`${gridSwitch}:not(:disabled)`, { timeout: 5_000 });
      expect(await toolsPage.$(overlaySelector)).toBeNull();
      await panel.click(gridSwitch);
      await toolsPage.waitForSelector(overlaySelector, { timeout: 5_000 });
      expect(
        await toolsPage.$eval(overlaySelector, (element) => element.shadowRoot),
      ).toBeNull();
      const overlayGeometry = await toolsPage.$eval(".fixture-card", (element) => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      expect(overlayGeometry).toEqual(initialGeometry);
      await panel.click(rulerSwitch);
      await panel.waitForSelector(`${rulerSwitch}[aria-checked="true"]`);

      await panel.click(inspectButton);
      await toolsPage.mouse.move(initialGeometry.x + 16, initialGeometry.y + 16);
      await toolsPage.mouse.click(initialGeometry.x + 16, initialGeometry.y + 16);
      await panel.waitForFunction(
        () =>
          document.querySelector(".layout-measurement .eyebrow")?.textContent ===
          "Locked element",
        { timeout: 5_000 },
      );
      expect(
        await panel.$eval("#layout-measurement-title", (element) => element.textContent),
      ).toBe("<section>");
      const measuredBounds = await panel.$$eval(".layout-bounds strong", (elements) =>
        elements.map((element) => Number(element.textContent)),
      );
      expect(measuredBounds[0]).toBeCloseTo(initialGeometry.width, 0);
      expect(measuredBounds[1]).toBeCloseTo(initialGeometry.height, 0);
      await toolsPage.keyboard.press("Escape");
      await panel.waitForSelector(`${inspectButton}[aria-pressed="false"]`);
      expect(await toolsPage.$(overlaySelector)).not.toBeNull();
      await toolsPage.keyboard.press("Escape");
      await toolsPage.waitForSelector(overlaySelector, { hidden: true, timeout: 5_000 });
      await panel.waitForSelector(`${gridSwitch}[aria-checked="false"]`);
      await panel.waitForSelector(`${rulerSwitch}[aria-checked="false"]`);

      await clickScopedButton(panel, ".layout-presets", "8 px grid");
      await panel.click(rulerSwitch);
      await toolsPage.waitForSelector(overlaySelector);
      const overlay = await toolsPage.$(overlaySelector);
      if (!overlay) throw new Error("Grid overlay did not appear.");
      await panel.click('.panel-nav button[data-section="capture"]');
      expect(await overlay.evaluate((element) => element.isConnected)).toBe(true);
      const captureGeometry = await toolsPage.evaluate(() => {
        const rect = document.querySelector(".fixture-card")?.getBoundingClientRect();
        if (!rect) throw new Error("Missing capture fixture.");
        return {
          width: innerWidth,
          height: innerHeight,
          dpr: devicePixelRatio,
          sampleX: rect.x + 16,
          sampleY: Math.ceil((rect.y + 24) / 8) * 8 + 0.5,
        };
      });
      await setCaptureOption(panel, "Include layout overlays", false);
      const clean = await capturePreview(panel, "Viewport");
      expect(clean.width).toBe(clean.declaredWidth);
      expect(clean.height).toBe(clean.declaredHeight);
      expect(
        Math.abs(clean.width - Math.round(captureGeometry.width * captureGeometry.dpr)),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(clean.height - Math.round(captureGeometry.height * captureGeometry.dpr)),
      ).toBeLessThanOrEqual(1);
      const scale = clean.width / captureGeometry.width;
      const cleanPixel = await screenshotPixel(
        panel,
        captureGeometry.sampleX * scale,
        captureGeometry.sampleY * scale,
      );
      expect(cleanPixel).toEqual([255, 255, 255, 255]);
      expect(
        await overlay.evaluate((element) => getComputedStyle(element).visibility),
      ).toBe("visible");

      await setCaptureOption(panel, "Include layout overlays", true);
      const annotated = await capturePreview(panel, "Viewport");
      expect(annotated).toEqual(clean);
      const gridPixel = await screenshotPixel(
        panel,
        captureGeometry.sampleX * scale,
        captureGeometry.sampleY * scale,
      );
      expect(
        gridPixel.some(
          (value, index) => Math.abs(value - (cleanPixel[index] ?? value)) > 10,
        ),
      ).toBe(true);
      const rulerPixel = await screenshotPixel(panel, 35 * scale, 5 * scale);
      expect(rulerPixel.slice(0, 3).every((value) => value < 100)).toBe(true);

      await clickScopedButton(panel, ".capture-modes", "Select region");
      await toolsPage.waitForSelector('[data-pixelparity-capture="selection"]', {
        timeout: 5_000,
      });
      await toolsPage.keyboard.press("Escape");
      await toolsPage.waitForSelector("[data-pixelparity-capture]", {
        hidden: true,
        timeout: 5_000,
      });
      await panel.waitForFunction(
        () =>
          document
            .querySelector(".capture-message")
            ?.textContent?.includes("Capture cancelled") &&
          !document.querySelector(".capture-progress"),
        { timeout: 5_000 },
      );
      expect(await overlay.evaluate((element) => element.isConnected)).toBe(true);
      expect(await panel.$(".capture-result")).toBeNull();

      await setCaptureOption(panel, "Include layout overlays", false);
      await toolsPage.evaluate(() =>
        window.scrollTo({ left: 32, top: 200, behavior: "instant" }),
      );
      const scrollBaseline = await toolsPage.evaluate(() => ({
        x: scrollX,
        y: scrollY,
        width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
        height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      }));
      expect(scrollBaseline.x).toBeGreaterThan(0);
      expect(scrollBaseline.y).toBe(200);
      const fullPage = await capturePreview(panel, "Full page");
      expect(fullPage.width).toBe(fullPage.declaredWidth);
      expect(fullPage.height).toBe(fullPage.declaredHeight);
      expect(fullPage.width).toBe(Math.round(scrollBaseline.width * scale));
      expect(fullPage.height).toBe(Math.round(scrollBaseline.height * scale));
      expect(await toolsPage.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({
        x: scrollBaseline.x,
        y: scrollBaseline.y,
      });
      expect(
        await overlay.evaluate((element) => getComputedStyle(element).visibility),
      ).toBe("visible");

      await clickScopedButton(panel, ".capture-modes", "Full page");
      await panel.waitForFunction(
        () =>
          (document.querySelector<HTMLProgressElement>(".capture-progress progress")
            ?.value ?? 0) >= 1,
        { timeout: 10_000 },
      );
      await panel.click('.panel-nav button[data-section="layout"]');
      expect(
        await panel.$eval(gridSwitch, (element) => (element as HTMLButtonElement).disabled),
      ).toBe(true);
      expect(await overlay.evaluate((element) => element.isConnected)).toBe(true);
      await panel.click('.panel-nav button[data-section="capture"]');
      await clickScopedButton(panel, ".capture-progress", "Cancel");
      await panel.waitForFunction(
        () =>
          document
            .querySelector(".capture-message")
            ?.textContent?.includes("Capture cancelled") &&
          !document.querySelector(".capture-progress"),
        { timeout: 8_000 },
      );
      expect(await panel.$(".capture-result")).toBeNull();
      expect(await toolsPage.evaluate(() => ({ x: scrollX, y: scrollY }))).toEqual({
        x: scrollBaseline.x,
        y: scrollBaseline.y,
      });
      expect(
        await overlay.evaluate((element) => getComputedStyle(element).visibility),
      ).toBe("visible");
      expect(remoteRequests).toEqual([]);
      await overlay.dispose();
    } finally {
      await toolsPage.close();
    }
  }, 60_000);
});
