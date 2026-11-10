import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destination = path.join(root, "store/assets/screenshots");
const fixtureViewport = { width: 900, height: 800, deviceScaleFactor: 1 };
const panelViewport = { width: 380, height: 800, deviceScaleFactor: 1 };
const filenames = [
  "01-inspect.png",
  "02-layout-grid.png",
  "03-element-inspection.png",
  "04-capture.png",
  "05-compare-export.png",
];

async function replaceDirectory(staged, target) {
  const backup = `${staged}-previous`;
  let previousMoved = false;
  try {
    await rename(target, backup);
    previousMoved = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await rename(staged, target);
  } catch (error) {
    if (previousMoved) await rename(backup, target);
    throw error;
  }
  if (previousMoved)
    await rm(backup, { recursive: true, force: true }).catch(() =>
      console.warn(`New screenshots are published; remove the old backup at ${backup}.`),
    );
}

async function metricMatches(page, width, height) {
  await page.waitForFunction(
    (expectedWidth, expectedHeight) => {
      const value = document
        .querySelector('[data-metric="layout-viewport"] .primary-value')
        ?.textContent?.replace(/\s+/g, " ")
        .trim();
      return value?.startsWith(`${expectedWidth} × ${expectedHeight}`);
    },
    { timeout: 10_000 },
    width,
    height,
  );
}

async function chooseSection(panel, section) {
  await panel.click(`.panel-nav button[data-section="${section}"]`);
  await panel.waitForSelector(
    `.panel-nav button[data-section="${section}"][aria-current="page"]`,
  );
  await panel.$eval(".panel-main", (element) =>
    element.scrollTo({ top: 0, behavior: "instant" }),
  );
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
}

async function fitNativeViewport(page, width, height) {
  await page.setViewport(null);
  const session = await page.createCDPSession();
  try {
    const { windowId } = await session.send("Browser.getWindowForTarget");
    await session.send("Browser.setWindowBounds", {
      windowId,
      bounds: { windowState: "normal" },
    });
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const actual = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      }));
      if (actual.dpr !== 1)
        throw new Error(
          `Native Chrome device scale must be 1 for unscaled store images; received ${actual.dpr}.`,
        );
      if (actual.width === width && actual.height === height) return actual;
      const { bounds } = await session.send("Browser.getWindowBounds", { windowId });
      if (typeof bounds.width !== "number" || typeof bounds.height !== "number")
        throw new Error("Chrome did not expose its native window dimensions.");
      await session.send("Browser.setWindowBounds", {
        windowId,
        bounds: {
          width: bounds.width + width - actual.width,
          height: bounds.height + height - actual.height,
        },
      });
      try {
        await page.waitForFunction(
          (expectedWidth, expectedHeight) =>
            innerWidth === expectedWidth && innerHeight === expectedHeight,
          { timeout: 1_500 },
          width,
          height,
        );
      } catch (error) {
        if (error.name !== "TimeoutError") throw error;
      }
    }
    const actual = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    throw new Error(
      `Could not obtain a native ${width}×${height} fixture viewport; Chrome provided ${actual.width}×${actual.height}. No screenshots will be resized.`,
    );
  } finally {
    await session.detach();
  }
}

async function assertViewport(page, expected, label) {
  const actual = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    deviceScaleFactor: devicePixelRatio,
  }));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} viewport is ${JSON.stringify(actual)}; expected ${JSON.stringify(expected)}.`,
    );
  }
}

async function assertInspectedTab(panel, origin) {
  const actual = await panel.evaluate(async () => {
    const tabId = Number(new URLSearchParams(location.search).get("tabId"));
    const tab = await chrome.tabs.get(tabId);
    const windowInfo = await chrome.windows.get(tab.windowId);
    return { active: tab.active, focused: windowInfo.focused, url: tab.url, tabId };
  });
  if (!actual.active || !actual.focused || actual.url !== `${origin}/fixture.html`) {
    throw new Error(
      "The real inspected fixture tab must remain active in its focused Chrome window.",
    );
  }
  return actual.tabId;
}

async function main() {
  const [manifestBytes, fixture] = await Promise.all([
    readFile(path.join(root, "dist/manifest.json")),
    readFile(path.join(root, "store/source/fixture.html")),
  ]);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  if (manifest.manifest_version !== 3 || !manifest.side_panel) {
    throw new Error(
      "Build the current PixelParity extension before generating store screenshots.",
    );
  }
  await mkdir(path.dirname(destination), { recursive: true });
  const staged = await mkdtemp(path.join(path.dirname(destination), ".screenshots-stage-"));
  let browser;
  let server;
  const externalRequests = new Set();
  const evidence = [];
  try {
    server = createServer((request, response) => {
      const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
      if (pathname === "/favicon.ico") {
        response.writeHead(204);
        response.end();
      } else if (pathname === "/fixture.html") {
        response.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        });
        response.end(fixture);
      } else {
        response.writeHead(404);
        response.end("Not found");
      }
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("The fixture server did not bind.");
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      headless: false,
      enableExtensions: true,
      defaultViewport: null,
      args: [
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-component-update",
        "--window-size=1360,960",
        "--force-device-scale-factor=1",
      ],
    });
    const observeRequests = (page) => {
      page.on("request", (request) => {
        if (/^https?:/i.test(request.url()) && new URL(request.url()).origin !== origin) {
          externalRequests.add(request.url());
        }
      });
    };
    const extensionId = await browser.installExtension(path.join(root, "dist"));
    const extension = (await browser.extensions()).get(extensionId);
    if (!extension) throw new Error("The unpacked extension did not install.");
    const fixturePage = await browser.newPage();
    observeRequests(fixturePage);
    await fitNativeViewport(fixturePage, fixtureViewport.width, fixtureViewport.height);
    await fixturePage.goto(`${origin}/fixture.html`, { waitUntil: "networkidle0" });
    await fixturePage.waitForSelector(".feature-card");
    await fixturePage.bringToFront();
    const popupTargetPromise = browser.waitForTarget(
      (target) => target.url().startsWith(`chrome-extension://${extensionId}/popup.html`),
      { timeout: 10_000 },
    );
    await fixturePage.triggerExtensionAction(extension);
    const popup = await (await popupTargetPromise).asPage();
    observeRequests(popup);
    await popup.waitForSelector('[data-metric="layout-viewport"]');
    await metricMatches(popup, fixtureViewport.width, fixtureViewport.height);
    await popup.click('button[aria-label="Open settings"]');
    await popup.select(".settings-form label:nth-child(1) select", "dark");
    await popup.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await popup.select(".settings-form label:nth-child(2) select", "compact");
    await popup.waitForFunction(
      () =>
        document.documentElement.dataset.theme === "dark" &&
        document.documentElement.dataset.density === "compact",
    );
    await popup.click('button[aria-label="Back to metrics"]');
    const panelTargetPromise = browser.waitForTarget(
      (target) =>
        target.url().startsWith(`chrome-extension://${extensionId}/sidepanel.html?tabId=`),
      { timeout: 10_000 },
    );
    await popup.waitForSelector(".action-dock .button--primary:not([disabled])");
    await popup.click(".action-dock .button--primary");
    const panel = await (await panelTargetPromise).asPage();
    observeRequests(panel);
    await panel.setViewport(panelViewport);
    await fitNativeViewport(fixturePage, fixtureViewport.width, fixtureViewport.height);
    await panel.waitForSelector(".connection-pill--live", { timeout: 10_000 });
    await panel.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await fixturePage.bringToFront();
    await metricMatches(panel, fixtureViewport.width, fixtureViewport.height);
    const inspectedTabId = await assertInspectedTab(panel, origin);

    const captureState = async (filename, section, verified) => {
      await panel.waitForSelector(".connection-pill--live");
      await panel.waitForSelector(
        `.panel-nav button[data-section="${section}"][aria-current="page"]`,
      );
      await assertViewport(fixturePage, fixtureViewport, "Fixture");
      await assertViewport(panel, panelViewport, "Side panel");
      await assertInspectedTab(panel, origin);
      await settle(fixturePage);
      await settle(panel);
      if (externalRequests.size)
        throw new Error(
          `Unexpected external requests: ${[...externalRequests].join(", ")}`,
        );
      const fixtureImage = await fixturePage.screenshot({
        type: "png",
        captureBeyondViewport: false,
      });
      const panelImage = await panel.screenshot({
        type: "png",
        captureBeyondViewport: false,
      });
      const [fixtureMetadata, panelMetadata] = await Promise.all([
        sharp(fixtureImage).metadata(),
        sharp(panelImage).metadata(),
      ]);
      if (
        fixtureMetadata.width !== 900 ||
        fixtureMetadata.height !== 800 ||
        panelMetadata.width !== 380 ||
        panelMetadata.height !== 800
      ) {
        throw new Error(
          "Chrome returned unexpected screenshot dimensions; assets were not resized or fabricated.",
        );
      }
      const output = await sharp({
        create: { width: 1280, height: 800, channels: 3, background: "#09111f" },
      })
        .composite([
          { input: fixtureImage, left: 0, top: 0 },
          { input: panelImage, left: 900, top: 0 },
        ])
        .removeAlpha()
        .png({ compressionLevel: 9, effort: 10 })
        .toBuffer();
      await writeFile(path.join(staged, filename), output);
      evidence.push({
        filename,
        section,
        verified,
        sha256: createHash("sha256").update(output).digest("hex"),
      });
      console.log(`Captured real extension state: ${filename}`);
    };

    await chooseSection(panel, "inspect");
    await metricMatches(panel, 900, 800);
    await captureState(filenames[0], "inspect", { viewport: [900, 800], live: true });

    await chooseSection(panel, "layout");
    await panel.waitForSelector(".layout-presets button:not([disabled])");
    await panel.click(".layout-presets button:first-of-type");
    await panel.waitForSelector(
      'button[aria-label="Show grid overlay"][aria-checked="true"]',
    );
    await panel.click('button[role="switch"][aria-label="Show page rulers"]');
    await panel.waitForSelector(
      'button[aria-label="Show grid overlay"][aria-checked="true"]',
    );
    await panel.waitForSelector(
      'button[aria-label="Show page rulers"][aria-checked="true"]',
    );
    await fixturePage.waitForSelector("[data-pixelparity-overlay]", { visible: true });
    await panel.$eval(".panel-main", (element) =>
      element.scrollTo({ top: 0, behavior: "instant" }),
    );
    await captureState(filenames[1], "layout", { grid: "12 columns", rulers: true });

    await panel.click(".layout-picker-card button");
    await panel.waitForSelector('.layout-picker-card button[aria-pressed="true"]');
    const feature = await fixturePage.$eval(".feature-card", (element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        tag: element.tagName.toLowerCase(),
      };
    });
    if (feature.x < 0 || feature.y < 0 || feature.x + 8 > 900 || feature.y + 8 > 800)
      throw new Error("The fixture feature card is outside the capture viewport.");
    await fixturePage.mouse.move(feature.x + 5, feature.y + 5, { steps: 8 });
    await panel.waitForSelector(".layout-measurement");
    await fixturePage.mouse.click(feature.x + 5, feature.y + 5);
    await panel.waitForFunction(
      (expected) => {
        const card = document.querySelector(".layout-measurement");
        const heading = card?.querySelector("h2")?.textContent;
        const locked = card?.querySelector(".eyebrow")?.textContent?.trim();
        const values = [...(card?.querySelectorAll(".layout-bounds strong") ?? [])].map(
          (element) => Number(element.textContent),
        );
        return (
          heading === `<${expected.tag}>` &&
          locked === "Locked element" &&
          Math.abs(values[0] - expected.width) < 0.11 &&
          Math.abs(values[1] - expected.height) < 0.11
        );
      },
      { timeout: 10_000 },
      feature,
    );
    await panel.$eval(".layout-measurement", (element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await captureState(filenames[2], "layout", {
      lockedElement: feature.tag,
      width: feature.width,
      height: feature.height,
    });

    await panel.click(".layout-footer button");
    await panel.waitForSelector(
      'button[aria-label="Show grid overlay"][aria-checked="false"]',
    );
    await fixturePage.waitForFunction(
      () => !document.querySelector("[data-pixelparity-overlay]"),
    );
    await chooseSection(panel, "capture");
    await fixturePage.bringToFront();
    await assertInspectedTab(panel, origin);
    const nativeCaptureGeometry = await fixturePage.evaluate(() => ({
      width: innerWidth,
      height: innerHeight,
      dpr: devicePixelRatio,
    }));
    await panel.click(".capture-mode:first-child");
    await panel.waitForFunction(
      (expected) => {
        const image = document.querySelector(".capture-result img");
        return (
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth === Math.round(expected.width * expected.dpr) &&
          image.naturalHeight === Math.round(expected.height * expected.dpr)
        );
      },
      { timeout: 20_000 },
      nativeCaptureGeometry,
    );
    await panel.waitForSelector(".capture-result .button--primary:not([disabled])");
    await panel.$eval(".capture-result", (element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await captureState(filenames[3], "capture", {
      screenshot: "chrome.tabs.captureVisibleTab via Viewport button",
      nativeCaptureGeometry,
      image: [
        Math.round(nativeCaptureGeometry.width * nativeCaptureGeometry.dpr),
        Math.round(nativeCaptureGeometry.height * nativeCaptureGeometry.dpr),
      ],
      temporaryPreview: true,
    });

    await chooseSection(panel, "inspect");
    await fitNativeViewport(fixturePage, 1024, fixtureViewport.height);
    await metricMatches(panel, 1024, 800);
    await panel.click(".baseline-card .button");
    await panel.waitForFunction(
      () =>
        document.querySelector(".baseline-card strong")?.textContent?.trim() ===
        "Comparing with baseline",
    );
    await fitNativeViewport(fixturePage, fixtureViewport.width, fixtureViewport.height);
    await metricMatches(panel, 900, 800);
    await panel.waitForFunction(() =>
      [...document.querySelectorAll(".delta-badge")].some((element) =>
        element.textContent?.includes("−124 px wide"),
      ),
    );
    await chooseSection(panel, "export");
    await panel.click('.format-grid label:has(input[value="markdown"])');
    await panel.waitForSelector('.format-grid input[value="markdown"]:checked');
    await panel.waitForSelector(".issue-report-card .button:not([disabled])");
    await panel.$eval(".panel-main", (element) =>
      element.scrollTo({ top: 0, behavior: "instant" }),
    );
    await captureState(filenames[4], "export", {
      exportFormat: "Markdown",
      baselineViewport: [1024, 800],
      currentViewport: [900, 800],
      verifiedWidthDelta: -124,
      issueReportEnabled: true,
    });

    if (evidence.length !== filenames.length)
      throw new Error("The full screenshot set did not complete.");
    for (const filename of filenames) {
      const metadata = await sharp(path.join(staged, filename)).metadata();
      if (metadata.width !== 1280 || metadata.height !== 800 || metadata.hasAlpha)
        throw new Error(`Invalid store image: ${filename}`);
    }
    await writeFile(
      path.join(staged, "capture-manifest.json"),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          extensionVersion: manifest.version,
          browser: await browser.version(),
          source:
            "Installed unpacked extension; real popup, side panel, content overlay, and captureVisibleTab result",
          fixture: "store/source/fixture.html",
          fixtureSha256: createHash("sha256").update(fixture).digest("hex"),
          inspectedTabId,
          fixtureViewport,
          fixtureSizing:
            "Native Chrome window bounds; device-metrics emulation disabled; device scale 1",
          panelViewport,
          panelSizing:
            "Real side-panel target rendered at 380×800 via Puppeteer; no synthetic state",
          output: {
            width: 1280,
            height: 800,
            composition: "Unscaled fixture at x=0 and real side panel at x=900",
          },
          screenshots: evidence,
        },
        null,
        2,
      )}\n`,
    );
    await browser.close();
    browser = null;
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    server = null;
    await replaceDirectory(staged, destination);
    console.log(`Published five verified, real-extension screenshots to ${destination}.`);
  } catch (error) {
    console.error(
      "Screenshot generation did not complete. Existing store screenshots were left in place; there is no mock or synthetic fallback.",
    );
    throw error;
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(staged, { recursive: true, force: true });
  }
}

await main();
