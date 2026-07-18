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

beforeAll(async () => {
  const fixture = await readFile(path.join(root, "tests/fixtures/index.html"));
  server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(fixture);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture server did not bind.");
  fixtureUrl = `http://127.0.0.1:${address.port}/`;

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ??
    (process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : await puppeteer.executablePath());
  browser = await puppeteer.launch({
    executablePath,
    headless: process.env.PIXELPARITY_HEADLESS === "1",
    enableExtensions: [path.join(root, "dist")],
    defaultViewport: { width: 1100, height: 760 },
    args: ["--no-first-run", "--no-default-browser-check", "--disable-component-update"],
  });
  fixturePage = await browser.newPage();
  const extensions = await browser.extensions();
  const installed = [...extensions.values()].find((item) => item.version === "2.0.0");
  if (!installed) throw new Error("PixelParity 2.0.0 was not installed.");
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
    await fixturePage.setViewport({ width: 880, height: 650, deviceScaleFactor: 1 });
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

    await panel.click(".panel-nav button:nth-child(2)");
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

    await panel.click(".panel-nav button:nth-child(3)");
    await panel.waitForSelector(".export-card");
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
    await panel.click(".panel-nav button:nth-child(1)");
    await panel.waitForSelector(".reconnect-banner", { timeout: 10_000 });
    expect(
      await panel.$eval(".baseline-card strong", (element) => element.textContent),
    ).toBe("Capture a baseline");
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
});
