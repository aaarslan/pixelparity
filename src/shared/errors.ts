import type { StableErrorCode } from "./types";

export class PixelParityError extends Error {
  readonly code: StableErrorCode;

  constructor(code: StableErrorCode) {
    super(code);
    this.name = "PixelParityError";
    this.code = code;
  }
}

export function toStableError(error: unknown): PixelParityError {
  if (error instanceof PixelParityError) return error;
  const message = error instanceof Error ? error.message.toLocaleLowerCase("en-US") : "";

  if (
    message.includes("cannot access") ||
    message.includes("extensions gallery") ||
    message.includes("chrome://") ||
    message.includes("edge://") ||
    message.includes("about:") ||
    message.includes("not allowed on")
  ) {
    return new PixelParityError("RESTRICTED_PAGE");
  }
  if (
    message.includes("receiving end does not exist") ||
    message.includes("could not establish")
  ) {
    return new PixelParityError("BRIDGE_UNAVAILABLE");
  }
  if (message.includes("no tab") || message.includes("tab was closed")) {
    return new PixelParityError("NO_ACTIVE_TAB");
  }
  return new PixelParityError("INJECTION_FAILED");
}

export const ERROR_CONTENT: Record<
  StableErrorCode,
  { title: string; message: string; action: string }
> = {
  RESTRICTED_PAGE: {
    title: "This page is protected",
    message:
      "Chrome blocks extensions on browser pages, the Web Store, and some built-in viewers.",
    action: "Try a website",
  },
  ACCESS_REVOKED: {
    title: "Reconnect to this tab",
    message: "The page changed, so Chrome ended PixelParity’s temporary access.",
    action: "Reconnect",
  },
  DOCUMENT_NOT_READY: {
    title: "Page is still loading",
    message: "Wait for the document to finish loading, then try again.",
    action: "Try again",
  },
  INJECTION_FAILED: {
    title: "Couldn’t inspect this page",
    message: "PixelParity could not start its temporary measurement bridge.",
    action: "Try again",
  },
  NO_ACTIVE_TAB: {
    title: "No active tab",
    message: "Select a normal website tab and open PixelParity again.",
    action: "Try again",
  },
  BRIDGE_UNAVAILABLE: {
    title: "Inspector disconnected",
    message: "The temporary measurement bridge is no longer available.",
    action: "Reconnect",
  },
  INVALID_MESSAGE: {
    title: "Inspector response rejected",
    message: "PixelParity ignored a response that did not match its expected format.",
    action: "Try again",
  },
  COPY_FAILED: {
    title: "Copy failed",
    message: "Chrome did not allow this snapshot to be copied.",
    action: "Try again",
  },
  DOWNLOAD_FAILED: {
    title: "Download failed",
    message: "Chrome could not create the local JSON file.",
    action: "Try again",
  },
  UNKNOWN: {
    title: "Something went wrong",
    message: "PixelParity could not complete that action.",
    action: "Try again",
  },
};
