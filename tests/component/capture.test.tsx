import { cleanup, render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runCapture } from "../../src/capture/client";
import { CaptureTools } from "../../src/components/CaptureTools";

vi.mock("../../src/capture/client", () => ({
  runCapture: vi.fn(),
  captureFilename: () => "pixelparity-test.png",
}));

afterEach(() => {
  cleanup();
  vi.mocked(runCapture).mockReset();
});

describe("capture controls", () => {
  it("explains local website-content capture before the disabled mode buttons", () => {
    render(<CaptureTools tabId={42} enabled={false} />);
    const disclosure = screen.getByText(
      "Captures website content locally, only when you choose a mode. Nothing is uploaded.",
    );
    const viewport = screen.getByRole("button", { name: /Viewport/ });
    expect(
      disclosure.compareDocumentPosition(viewport) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(viewport).toBeDisabled();
    expect(screen.getByRole("button", { name: /Select region/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Full page/ })).toBeDisabled();
    expect(
      screen.getByText("Reconnect to the inspected tab to enable capture."),
    ).toBeInTheDocument();
    expect(runCapture).not.toHaveBeenCalled();
  });

  it("locks options while capturing and cancels through the session signal", async () => {
    const user = userEvent.setup();
    vi.mocked(runCapture).mockImplementation(
      ({ signal, onProgress }) =>
        new Promise((_resolve, reject) => {
          onProgress({ message: "Capturing frame 1 of 3…", completed: 0, total: 3 });
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Capture cancelled.", "AbortError")),
            { once: true },
          );
        }),
    );
    const onBusyChange = vi.fn();
    render(<CaptureTools tabId={42} enabled onBusyChange={onBusyChange} />);
    await user.click(screen.getByRole("button", { name: /Full page/ }));
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("button", { name: /Viewport/ })).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: /Include layout overlays/ }),
    ).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Frames captured" })).toHaveAttribute(
      "max",
      "3",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await screen.findByText("Capture cancelled. The page has been restored.");
    expect(vi.mocked(runCapture).mock.calls[0]?.[0].signal.aborted).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(screen.getByRole("button", { name: /Full page/ })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /Include layout overlays/ })).toBeEnabled();
  });

  it("shows a capture failure and leaves the controls available for retry", async () => {
    const user = userEvent.setup();
    vi.mocked(runCapture).mockRejectedValue(
      new Error("Keep the inspected tab in the foreground."),
    );
    render(<CaptureTools tabId={42} enabled />);
    await user.click(screen.getByRole("button", { name: /Viewport/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Keep the inspected tab in the foreground.",
    );
    expect(screen.getByRole("button", { name: /Viewport/ })).toBeEnabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("discards the preview and revokes its temporary object URL", async () => {
    const user = userEvent.setup();
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
    const create = vi.fn(() => "blob:pixelparity-capture-test");
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });
    vi.mocked(runCapture).mockResolvedValue({
      blob: new Blob(["png"], { type: "image/png" }),
      width: 1600,
      height: 1200,
      mode: "viewport",
      tiles: 1,
    });
    try {
      render(<CaptureTools tabId={42} enabled />);
      await user.click(screen.getByRole("button", { name: /Viewport/ }));
      expect(
        await screen.findByRole("img", { name: "Captured viewport, 1600 by 1200 pixels" }),
      ).toHaveAttribute("src", "blob:pixelparity-capture-test");
      expect(screen.getByRole("button", { name: "Save PNG" })).toBeEnabled();
      await user.click(screen.getByRole("button", { name: "Discard" }));
      await waitFor(() =>
        expect(revoke).toHaveBeenCalledWith("blob:pixelparity-capture-test"),
      );
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      expect(screen.getByText("Screenshot discarded.")).toBeInTheDocument();
    } finally {
      cleanup();
      if (createDescriptor) Object.defineProperty(URL, "createObjectURL", createDescriptor);
      else Reflect.deleteProperty(URL, "createObjectURL");
      if (revokeDescriptor) Object.defineProperty(URL, "revokeObjectURL", revokeDescriptor);
      else Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  });
});
