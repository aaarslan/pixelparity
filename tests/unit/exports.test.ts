import { describe, expect, it } from "vitest";
import { DEMO_BASELINE, DEMO_SNAPSHOT } from "../../store/source/demo-data";
import {
  serializeCss,
  serializeJson,
  serializeMarkdown,
  serializeSnapshot,
  serializeTsv,
} from "../../src/shared/exports";
import { serializeIssueReport } from "../../src/shared/issue-report";

describe("snapshot exports", () => {
  it("serializes a versioned JSON snapshot", () => {
    const json = serializeJson(DEMO_SNAPSHOT);
    expect(JSON.parse(json).schemaVersion).toBe(2);
    expect(json).toContain('"tabZoomPercent": 125');
  });

  it("creates CSS, Markdown, and TSV with accurate labels", () => {
    const css = serializeCss(DEMO_SNAPSHOT);
    expect(css).toContain("--pixelparity-browser-zoom: 125%;");
    expect(css).toContain("\n   Captured ");
    expect(css).not.toContain("\n+   Captured ");
    expect(serializeMarkdown(DEMO_SNAPSHOT)).toContain("Screen width (CSS pixels)");
    expect(serializeTsv(DEMO_SNAPSHOT)).toMatch(/^Metric\tValue/m);
  });

  it.each(["json", "css", "markdown", "tsv"] as const)(
    "excludes page metadata from %s",
    (format) => {
      const output = serializeSnapshot(DEMO_SNAPSHOT, format).toLocaleLowerCase("en-US");
      expect(output).not.toContain("https://");
      expect(output).not.toContain("example.com");
      expect(output).not.toContain("page title");
      expect(output).not.toContain("browsing history");
    },
  );

  it("creates a useful baseline-to-reproduction report without page metadata", () => {
    const report = serializeIssueReport(DEMO_BASELINE, DEMO_SNAPSHOT);
    expect(report).toContain("## Responsive mismatch reproduction");
    expect(report).toContain("Capture a baseline in the working state.");
    expect(report).toContain(
      "| Layout viewport | 1024 × 720 px | 1280 × 720 px | +256 px wide; 0 px tall |",
    );
    expect(report).toContain("| Browser zoom | 100% | 125% | +25 percentage points |");
    expect(report).toContain("Add the affected page or build context manually");
    expect(report.toLocaleLowerCase("en-US")).not.toContain("https://");
    expect(report).not.toContain("example.com");
  });
});
