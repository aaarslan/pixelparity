export const PAGE_STYLE = `
:host { color-scheme: dark; }
* { box-sizing: border-box; }
[hidden] { display:none!important; }
.layer { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.grid { position:absolute; top:0; bottom:0; pointer-events:none; }
.columns { display:grid; }
.column { height:100%; border-inline:1px solid currentColor; background:currentColor; }
.ruler { position:absolute; pointer-events:none; }
.ruler-x { top:0; left:0; }
.ruler-y { top:22px; left:0; }
.picker { position:absolute; inset:0; cursor:crosshair; pointer-events:auto; background:transparent; }
.highlight { position:absolute; border:2px solid #818cf8; background:rgb(99 102 241 / 11%); pointer-events:none; }
.guide { position:absolute; pointer-events:none; opacity:.7; }
.guide-x { left:0; right:0; border-top:1px dashed #818cf8; }
.guide-y { top:0; bottom:0; border-left:1px dashed #818cf8; }
.hud { position:absolute; width:256px; max-width:calc(100% - 16px); padding:12px 14px; border:1px solid #4f5877; border-radius:10px; box-shadow:0 8px 30px #0004; background:#111827; color:#e5e7eb; font:12px/1.5 ui-sans-serif,system-ui,sans-serif; pointer-events:none; }
.hud strong { display:block; color:#fff; font-size:13px; margin-bottom:3px; }
.hud .values { color:#c7d2fe; font-variant-numeric:tabular-nums; }
.hud .hint { display:block; color:#c2c9d7; font-size:11px; margin-top:6px; border-top:1px solid #334155; padding-top:6px; }
.hud .spacing { display:block; color:#d1d5db; font-size:11px; margin-top:3px; }
`;
