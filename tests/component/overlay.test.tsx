import { act, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OverlayTools } from "../../src/components/OverlayTools";
import { connectOverlay } from "../../src/overlay/client";
import {
  DEFAULT_OVERLAY_SETTINGS,
  type ElementMeasurement,
} from "../../src/shared/overlay";

vi.mock("../../src/overlay/client", () => ({ connectOverlay: vi.fn() }));

const send = vi.fn();
const close = vi.fn();
const measurement: ElementMeasurement = {
  tag: "article",
  x: 24,
  y: 120,
  width: 320,
  height: 180,
  margin: [0, 0, 24, 0],
  padding: [24, 24, 24, 24],
  border: [1, 1, 1, 1],
  rowGap: "10%",
  columnGap: "calc(10% + 4px)",
  fontSize: 16,
  lineHeight: 24,
  display: "grid",
  position: "static",
  boxSizing: "border-box",
  locked: true,
};

beforeEach(() => {
  vi.mocked(connectOverlay).mockImplementation(async (_tabId, onEvent) => {
    onEvent({
      type: "PIXELPARITY/OVERLAY_STATE",
      settings: { ...DEFAULT_OVERLAY_SETTINGS },
    });
    return { send, close };
  });
});

describe("layout tools", () => {
  it("starts with overlays off and applies a user-selected grid preset", async () => {
    const user = userEvent.setup();
    render(<OverlayTools tabId={42} enabled />);
    const toggle = screen.getByRole("switch", { name: "Show grid overlay" });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(send).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "8 px grid" }));
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(send).toHaveBeenLastCalledWith({
      type: "PIXELPARITY/OVERLAY_SET",
      settings: {
        ...DEFAULT_OVERLAY_SETTINGS,
        gridEnabled: true,
        gridType: "square",
        spacing: 8,
      },
    });
    expect(screen.getByRole("spinbutton", { name: "Grid spacing" })).toHaveValue(8);
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(send).toHaveBeenLastCalledWith({ type: "PIXELPARITY/OVERLAY_CLEAR" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("releases its page connection when disabled or unmounted", async () => {
    const { rerender, unmount } = render(<OverlayTools tabId={42} enabled />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pick an element" })).toBeEnabled(),
    );
    rerender(<OverlayTools tabId={42} enabled={false} />);
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(screen.getByRole("switch", { name: "Show grid overlay" })).toBeDisabled();
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("locks controls during capture while retaining the active overlay connection", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OverlayTools tabId={42} enabled />);
    const toggle = screen.getByRole("switch", { name: "Show grid overlay" });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    const onEvent = vi.mocked(connectOverlay).mock.calls.at(-1)?.[1];
    await act(() => onEvent?.({ type: "PIXELPARITY/OVERLAY_MEASUREMENT", measurement }));
    const resume = screen.getByRole("button", { name: "Pick another" });
    rerender(<OverlayTools tabId={42} enabled locked />);
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(resume).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy measurements" })).toBeEnabled();
    await user.click(resume);
    expect(send).not.toHaveBeenCalledWith({ type: "PIXELPARITY/OVERLAY_RESUME" });
    expect(close).not.toHaveBeenCalled();
    rerender(<OverlayTools tabId={42} enabled />);
    expect(toggle).toBeEnabled();
    expect(resume).toBeEnabled();
    await user.click(resume);
    expect(send).toHaveBeenLastCalledWith({ type: "PIXELPARITY/OVERLAY_RESUME" });
    expect(vi.mocked(connectOverlay)).toHaveBeenCalledOnce();
  });

  it("copies only numeric layout facts and has accessible populated controls", async () => {
    const user = userEvent.setup();
    const onStatus = vi.fn();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValueOnce();
    const { container } = render(<OverlayTools tabId={42} enabled onStatus={onStatus} />);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pick an element" })).toBeEnabled(),
    );
    const onEvent = vi.mocked(connectOverlay).mock.calls.at(-1)?.[1];
    expect(onEvent).toBeDefined();
    await act(() => onEvent?.({ type: "PIXELPARITY/OVERLAY_MEASUREMENT", measurement }));
    expect(
      screen.getByRole("table", { name: "Computed box spacing in CSS pixels" }),
    ).toBeInTheDocument();
    expect(screen.getByText("10% / calc(10% + 4px)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy measurements" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Bounds: 320 × 180 CSS px"),
    );
    expect(onStatus).toHaveBeenCalledWith(
      "Element measurements copied. No page text or identifiers included.",
    );
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });

  it("shows an actionable error if page access fails", async () => {
    vi.mocked(connectOverlay).mockRejectedValueOnce(new Error("Access revoked"));
    render(<OverlayTools tabId={42} enabled />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Reopen PixelParity from the toolbar",
    );
    expect(screen.getByRole("button", { name: "Reconnect tools" })).toBeEnabled();
    expect(screen.getByRole("switch", { name: "Show grid overlay" })).toBeDisabled();
  });
});
