import type { ComponentChildren } from "preact";

export function PixelMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      class="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 128 128"
      aria-hidden="true"
    >
      <rect x="16" y="16" width="96" height="96" rx="22" fill="#2563eb" />
      <path fill="#dbeafe" d="M38 36h36v14H52v14h22v14H52v24H38z" />
      <path
        fill="#fff"
        d="M52 36h24c12 0 22 9 22 21s-10 21-22 21h-2V64h2c4 0 8-3 8-7s-4-7-8-7H52z"
      />
      <rect x="84" y="36" width="14" height="14" fill="#67e8f9" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div class="brand-lockup">
      <PixelMark size={compact ? 30 : 34} />
      <div>
        <span class="brand-name">PixelParity</span>
        {!compact && <span class="brand-subtitle">Display inspector</span>}
      </div>
    </div>
  );
}

export function Icon({
  name,
}: {
  name:
    | "refresh"
    | "settings"
    | "back"
    | "copy"
    | "panel"
    | "baseline"
    | "download"
    | "plus"
    | "trash"
    | "edit";
}) {
  const paths: Record<typeof name, ComponentChildren> = {
    refresh: <path d="M18 8a7 7 0 1 0 1 7h-2.1a5 5 0 1 1-.4-4.2L13 14h8V6z" />,
    settings: (
      <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm9 4.6v-1.6l-2.2-.8a7 7 0 0 0-.7-1.7l1-2.1-1.2-1.2-2.1 1a7 7 0 0 0-1.7-.7L13.3 3h-1.6l-.8 2.3a7 7 0 0 0-1.7.7l-2.1-1-1.2 1.2 1 2.1a7 7 0 0 0-.7 1.7l-2.2.8v1.6l2.2.8a7 7 0 0 0 .7 1.7l-1 2.1 1.2 1.2 2.1-1a7 7 0 0 0 1.7.7l.8 2.3h1.6l.8-2.3a7 7 0 0 0 1.7-.7l2.1 1 1.2-1.2-1-2.1a7 7 0 0 0 .7-1.7z" />
    ),
    back: <path d="m14.7 5.3-1.4-1.4L5.2 12l8.1 8.1 1.4-1.4L9 13h10v-2H9z" />,
    copy: <path d="M8 8h11v12H8zM5 4h11v2H7v10H5z" />,
    panel: <path d="M3 4h18v16H3zm2 2v12h9V6zm11 0v12h3V6z" />,
    baseline: (
      <path d="M4 18h16v2H4zm1-3 4-5 3 3 4-7 3 9h-2l-1.5-4.5-3 5-3.3-3.1L7.5 15z" />
    ),
    download: <path d="M11 4h2v9l3-3 1.4 1.4L12 16.8l-5.4-5.4L8 10l3 3zM5 19h14v2H5z" />,
    plus: <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" />,
    trash: <path d="M8 7h8l-.7 13H8.7zM6 4h4l1-1h2l1 1h4v2H6z" />,
    edit: (
      <path d="m5 16.2-.8 3.6 3.6-.8L18.5 8.3l-2.8-2.8zM17.1 4.1l1.4-1.4 2.8 2.8-1.4 1.4z" />
    ),
  };
  return (
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
