export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    useGrouping: false,
  }).format(value);
}

export function formatDimensions(width: number, height: number, unit = "px"): string {
  return `${formatNumber(width)} × ${formatNumber(height)} ${unit}`;
}

export function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

export function formatDelta(value: number, suffix = ""): string {
  if (Math.abs(value) < 0.005) return `0${suffix}`;
  const prefix = value > 0 ? "+" : "−";
  return `${prefix}${formatNumber(Math.abs(value))}${suffix}`;
}
