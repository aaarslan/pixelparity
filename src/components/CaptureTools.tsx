import { useEffect, useRef, useState } from "preact/hooks";
import { type CaptureProgress, captureFilename, runCapture } from "../capture/client";
import type { CaptureMode, CaptureResult } from "../shared/capture";
import { Icon } from "./Brand";

export interface CaptureToolsProps {
  tabId: number;
  enabled: boolean;
  onStatus?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

function CaptureGlyph({ mode }: { mode: CaptureMode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      {mode === "viewport" && (
        <>
          <rect x="5" y="7" width="22" height="18" rx="3" />
          <path d="M5 12h22M9 9.5h.01M12 9.5h.01" />
        </>
      )}
      {mode === "region" && (
        <>
          <path d="M5 12V5h7m8 0h7v7m0 8v7h-7M12 27H5v-7" />
          <rect x="10" y="10" width="12" height="12" rx="1" stroke-dasharray="3 2" />
        </>
      )}
      {mode === "full" && (
        <>
          <rect x="8" y="3" width="16" height="26" rx="3" />
          <path d="M12 9h8m-8 5h8m-8 5h8m-8 5h5" />
        </>
      )}
    </svg>
  );
}

export function CaptureTools({
  tabId,
  enabled,
  onStatus,
  onBusyChange,
}: CaptureToolsProps) {
  const [includeOverlays, setIncludeOverlays] = useState(false);
  const [hideFixed, setHideFixed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CaptureProgress | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [message, setMessage] = useState("");
  const [hasError, setHasError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const busyCallback = useRef(onBusyChange);
  busyCallback.current = onBusyChange;

  useEffect(
    () => () => {
      mounted.current = false;
      generation.current += 1;
      controller.current?.abort();
      busyCallback.current?.(false);
    },
    [],
  );

  useEffect(() => {
    generation.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    busyCallback.current?.(false);
    setProgress(null);
    setResult(null);
    setMessage("");
    setHasError(false);
  }, [tabId]);

  useEffect(() => {
    if (!enabled) controller.current?.abort();
  }, [enabled]);

  useEffect(() => {
    if (!result) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);

  const announce = (text: string, error = false) => {
    setMessage(text);
    setHasError(error);
    onStatus?.(text);
  };

  const capture = async (mode: CaptureMode) => {
    if (controller.current || !enabled) return;
    const current = new AbortController();
    controller.current = current;
    const requestGeneration = ++generation.current;
    setBusy(true);
    busyCallback.current?.(true);
    setResult(null);
    setMessage("");
    setHasError(false);
    setProgress({ message: "Preparing capture…", completed: 0, total: 1 });
    try {
      const screenshot = await runCapture({
        tabId,
        options: { mode, includeOverlays, hideFixed },
        signal: current.signal,
        onProgress: (value) => {
          if (mounted.current && generation.current === requestGeneration)
            setProgress(value);
        },
      });
      if (mounted.current && generation.current === requestGeneration) {
        setResult(screenshot);
        announce("Screenshot ready. Review it, then save or copy the PNG.");
      }
    } catch (error) {
      if (mounted.current && generation.current === requestGeneration) {
        const cancelled =
          current.signal.aborted || (error instanceof Error && error.name === "AbortError");
        announce(
          cancelled
            ? "Capture cancelled. The page has been restored."
            : error instanceof Error
              ? error.message
              : "Capture failed. Reconnect to the page and try again.",
          !cancelled,
        );
      }
    } finally {
      if (mounted.current && generation.current === requestGeneration) {
        controller.current = null;
        setBusy(false);
        busyCallback.current?.(false);
        setProgress(null);
      }
    }
  };

  const save = () => {
    if (!result || !previewUrl) return;
    const anchor = document.createElement("a");
    anchor.href = previewUrl;
    anchor.download = captureFilename();
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    announce("PNG download started.");
  };

  const copy = async () => {
    if (!result || !navigator.clipboard?.write || typeof ClipboardItem === "undefined")
      return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": result.blob })]);
      announce("PNG copied to the clipboard.");
    } catch {
      announce("Chrome could not copy the image. Save the PNG instead.", true);
    }
  };

  return (
    <div class="capture-tools">
      <section class="panel-card" aria-labelledby="capture-tools-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Local screenshots</p>
            <h2 id="capture-tools-title">Capture the evidence</h2>
          </div>
          <span class="count-badge">PNG</span>
        </div>
        <p class="capture-description">
          Keep a clear record of a layout, a bug, or a finished detail.
        </p>
        <p class="capture-disclosure">
          Captures website content locally, only when you choose a mode. Nothing is
          uploaded.
        </p>
        <div class="capture-modes">
          {(
            [
              { mode: "viewport", title: "Viewport", detail: "What you see now" },
              { mode: "region", title: "Select region", detail: "Draw a precise crop" },
              { mode: "full", title: "Full page", detail: "Scroll and stitch" },
            ] as const
          ).map((item) => (
            <button
              class="capture-mode"
              type="button"
              key={item.mode}
              disabled={!enabled || busy}
              onClick={() => void capture(item.mode)}
            >
              <CaptureGlyph mode={item.mode} />
              <span>
                <strong>{item.title}</strong>
                <span>{item.detail}</span>
              </span>
              <span class="capture-mode-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
          ))}
        </div>
        <fieldset class="capture-options" disabled={busy}>
          <legend class="sr-only">Capture options</legend>
          <label class="capture-option">
            <input
              type="checkbox"
              checked={includeOverlays}
              onChange={(event) => setIncludeOverlays(event.currentTarget.checked)}
            />
            <span>
              <strong>Include layout overlays</strong>
              <span>Keep your grid, rulers, and measurements in the image.</span>
            </span>
          </label>
          <label class="capture-option">
            <input
              type="checkbox"
              checked={hideFixed}
              onChange={(event) => setHideFixed(event.currentTarget.checked)}
            />
            <span>
              <strong>Clean full-page captures</strong>
              <span>
                Hide floating bars and keep sticky elements in their natural position.
              </span>
            </span>
          </label>
        </fieldset>
        {!enabled && (
          <p class="capture-note">Reconnect to the inspected tab to enable capture.</p>
        )}
        <p class="capture-note">
          Full page follows the initial document area, including horizontal overflow. Inner
          scroll panes, virtualized lists, and infinite feeds may need viewport captures.
          Keep the tab in front while capturing.
        </p>
      </section>
      {busy && progress && (
        <section class="panel-card capture-progress" aria-label="Capture progress">
          <div class="section-heading">
            <strong>Capturing locally</strong>
            <button
              class="button button--quiet"
              type="button"
              onClick={() => controller.current?.abort()}
            >
              Cancel
            </button>
          </div>
          <progress
            max={progress.total}
            value={progress.completed}
            aria-label="Frames captured"
          />
          <p role="status">{progress.message}</p>
        </section>
      )}
      {message && (
        <p
          class={`capture-message${hasError ? " capture-message--error" : ""}`}
          role={hasError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      {result && previewUrl && (
        <section class="panel-card capture-result" aria-labelledby="capture-result-title">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Ready to share</p>
              <h2 id="capture-result-title">Your screenshot</h2>
            </div>
            <span class="count-badge">
              {(result.blob.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
          <div class="capture-preview">
            <img
              src={previewUrl}
              width={result.width}
              height={result.height}
              alt={`Captured ${result.mode === "full" ? "full page" : result.mode}, ${result.width} by ${result.height} pixels`}
            />
          </div>
          <p class="capture-metadata">
            {result.width.toLocaleString()} × {result.height.toLocaleString()} px ·{" "}
            {result.tiles} {result.tiles === 1 ? "frame" : "frames"}
          </p>
          {result.notice && <p class="capture-note">{result.notice}</p>}
          <div class="button-row">
            <button class="button button--primary" type="button" onClick={save}>
              <Icon name="download" />
              Save PNG
            </button>
            {typeof ClipboardItem !== "undefined" &&
              typeof navigator.clipboard?.write === "function" && (
                <button
                  class="button button--secondary"
                  type="button"
                  onClick={() => void copy()}
                >
                  <Icon name="copy" />
                  Copy PNG
                </button>
              )}
            <button
              class="button button--quiet"
              type="button"
              onClick={() => {
                setResult(null);
                announce("Screenshot discarded.");
              }}
            >
              Discard
            </button>
          </div>
        </section>
      )}
      <p class="capture-privacy">
        Screenshots stay in this panel’s memory. Saving or copying creates an export.
        Discarding or closing the panel clears the preview. Nothing is uploaded. Up to 48
        MP, 32,760 px per side, and 40 frames.
      </p>
    </div>
  );
}
