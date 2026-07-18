import { render, screen, waitFor } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it, vi } from "vitest";
import {
  DEMO_BASELINE,
  DEMO_PREFERENCES,
  DEMO_SNAPSHOT,
} from "../../store/source/demo-data";
import { PopupApp } from "../../src/popup/PopupApp";
import { SidePanelView } from "../../src/sidepanel/SidePanelApp";

describe("extension UI", () => {
  it("renders the essential popup flow and restores focus after Escape", async () => {
    const user = userEvent.setup();
    render(<PopupApp />);
    expect((await screen.findAllByText("Layout viewport")).length).toBeGreaterThan(0);
    const settings = screen.getByRole("button", { name: "Open settings" });
    await user.click(settings);
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open settings" })).toHaveFocus(),
    );
    expect(
      screen.getByRole("button", { name: /open live inspector/i }),
    ).toBeInTheDocument();
  });

  it("announces copy feedback through a live region", async () => {
    const user = userEvent.setup();
    render(<PopupApp />);
    await screen.findAllByText("Layout viewport");
    await user.click(screen.getByRole("button", { name: /copy snapshot/i }));
    expect(await screen.findByText(/snapshot copied/i)).toBeInTheDocument();
  });

  it("announces clipboard failures without losing the snapshot", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(
      new Error("Clipboard denied"),
    );
    render(<PopupApp />);
    await screen.findAllByText("Layout viewport");
    await user.click(screen.getByRole("button", { name: /copy snapshot/i }));
    expect(await screen.findByText(/copy failed/i)).toBeInTheDocument();
    expect(screen.getAllByText("Layout viewport").length).toBeGreaterThan(0);
  });

  it("shows the protected-page state without an ineffective retry control", async () => {
    vi.mocked(chrome.scripting.executeScript).mockRejectedValueOnce(
      new Error("Cannot access contents of url chrome://settings/"),
    );
    render(<PopupApp />);
    expect(
      await screen.findByRole("heading", { name: "This page is protected" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try a website" })).not.toBeInTheDocument();
  });

  it("shows live baseline deltas and navigable inspector sections", async () => {
    const user = userEvent.setup();
    render(
      <SidePanelView
        preferences={DEMO_PREFERENCES}
        snapshot={DEMO_SNAPSHOT}
        baseline={DEMO_BASELINE}
        inspectorState="live"
        errorCode="UNKNOWN"
        status=""
        onReconnect={() => undefined}
        onSetBaseline={() => undefined}
        onClearBaseline={() => undefined}
        onPreferencesChange={() => undefined}
        onStatus={() => undefined}
      />,
    );
    expect(screen.getByText("+256 px wide")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Breakpoints" }));
    expect(screen.getByRole("heading", { name: "Breakpoint profile" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(screen.getByRole("heading", { name: "Copy or download" })).toBeInTheDocument();
  });

  it("offers a reconnect action after temporary tab access ends", async () => {
    const onReconnect = vi.fn();
    const user = userEvent.setup();
    render(
      <SidePanelView
        preferences={DEMO_PREFERENCES}
        snapshot={DEMO_SNAPSHOT}
        baseline={null}
        inspectorState="error"
        errorCode="ACCESS_REVOKED"
        status=""
        onReconnect={onReconnect}
        onSetBaseline={() => undefined}
        onClearBaseline={() => undefined}
        onPreferencesChange={() => undefined}
        onStatus={() => undefined}
      />,
    );
    expect(
      screen.getByText("The page changed, so Chrome ended PixelParity’s temporary access."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it("has no automated axe violations in the populated inspector", async () => {
    const { container } = render(
      <SidePanelView
        preferences={DEMO_PREFERENCES}
        snapshot={DEMO_SNAPSHOT}
        baseline={DEMO_BASELINE}
        inspectorState="live"
        errorCode="UNKNOWN"
        status=""
        onReconnect={() => undefined}
        onSetBaseline={() => undefined}
        onClearBaseline={() => undefined}
        onPreferencesChange={() => undefined}
        onStatus={() => undefined}
      />,
    );
    const result = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
