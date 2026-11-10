export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new DOMException("Capture cancelled.", "AbortError");
  }
}

export function abortableDelay(milliseconds: number, signal: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new DOMException("Capture cancelled.", "AbortError"),
      );
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function settledFrames(): Promise<void> {
  return new Promise((resolve) => {
    let first = 0;
    let second = 0;
    const finish = () => {
      clearTimeout(timeout);
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      resolve();
    };
    const timeout = setTimeout(finish, 150);
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(finish);
    });
  });
}
