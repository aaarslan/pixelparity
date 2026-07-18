import { describe, expect, it } from "vitest";
import { PixelParityError, toStableError } from "../../src/shared/errors";

describe("stable errors", () => {
  it("maps protected Chrome pages without exposing the original URL", () => {
    const error = toStableError(
      new Error("Cannot access contents of url chrome://settings/"),
    );
    expect(error.code).toBe("RESTRICTED_PAGE");
    expect(error.message).toBe("RESTRICTED_PAGE");
  });

  it("preserves an existing stable error", () => {
    const source = new PixelParityError("ACCESS_REVOKED");
    expect(toStableError(source)).toBe(source);
  });
});
