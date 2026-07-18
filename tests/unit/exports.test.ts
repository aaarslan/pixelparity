import { describe, expect, it } from "vitest";
import { DEMO_SNAPSHOT } from "../../store/source/demo-data";
import {
  serializeCss,
  serializeJson,
  serializeMarkdown,
  serializeSnapshot,
  serializeTsv,
} from "../../src/shared/exports";

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
});
