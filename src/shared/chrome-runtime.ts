import { findProfile } from "./breakpoints";
import { LIVE_PORT_NAME } from "./constants";
import { PixelParityError, toStableError } from "./errors";
import { createSnapshot } from "./metrics";
import { MESSAGE_TYPES, isBridgeResponse, type LiveControlMessage } from "./protocol";
import type { MetricsSnapshotV2, PageMetrics, PreferencesV2 } from "./types";

export async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (typeof tab?.id !== "number") throw new PixelParityError("NO_ACTIVE_TAB");
  return tab.id;
}

export async function injectBridge(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["bridge.js"],
      world: "ISOLATED",
    });
  } catch (error) {
    throw toStableError(error);
  }
}

export async function requestSnapshot(
  tabId: number,
  preferences: PreferencesV2,
): Promise<MetricsSnapshotV2> {
  try {
    await injectBridge(tabId);
    const [response, zoom] = await Promise.all([
      chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPES.snapshotRequest }),
      chrome.tabs.getZoom(tabId),
    ]);
    if (!isBridgeResponse(response)) throw new PixelParityError("INVALID_MESSAGE");
    if (!response.ok) throw new PixelParityError(response.code);
    const profile = findProfile(preferences.activeProfileId, preferences.customProfiles);
    return createSnapshot(response.metrics, zoom, profile);
  } catch (error) {
    throw toStableError(error);
  }
}

export async function prepareSidePanel(tabId: number): Promise<void> {
  await chrome.sidePanel.setOptions({
    tabId,
    path: `sidepanel.html?tabId=${tabId}`,
    enabled: true,
  });
}

export async function openSidePanel(tabId: number): Promise<void> {
  await chrome.sidePanel.open({ tabId });
}

export function connectLiveBridge(tabId: number): chrome.runtime.Port {
  return chrome.tabs.connect(tabId, { name: LIVE_PORT_NAME });
}

export function sendLiveControl(
  port: chrome.runtime.Port,
  message: LiveControlMessage,
): void {
  port.postMessage(message);
}

export async function mergeLiveMetrics(
  tabId: number,
  pageMetrics: PageMetrics,
  preferences: PreferencesV2,
): Promise<MetricsSnapshotV2> {
  const zoom = await chrome.tabs.getZoom(tabId);
  const profile = findProfile(preferences.activeProfileId, preferences.customProfiles);
  return createSnapshot(pageMetrics, zoom, profile);
}

export async function getAssignedShortcut(): Promise<string | null> {
  const commands = await chrome.commands.getAll();
  const action = commands.find((command) => command.name === "_execute_action");
  return action?.shortcut || null;
}
