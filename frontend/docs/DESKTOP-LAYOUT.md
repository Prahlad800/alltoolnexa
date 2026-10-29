# Responsive website layout

Desktop keeps the full website navigation, multi-column cards and tool sidebars. Below 768px the website uses the mobile design reference: a compact header, purple PDF feature card, category shortcuts, stacked tool cards, and a fixed bottom navigation with working Home, Tools, Categories, Translate and Profile destinations.

The viewport uses `device-width`, starts at scale 1, and allows pinch zoom. Safe-area insets keep bottom navigation clear of device controls. Tool inputs/results stack on phones; document and spreadsheet workspaces retain their own internal scrolling. The admin app remains English and is unaffected by public-site language/layout changes.

Run `AUDIT_ORIGIN=http://127.0.0.1:3000 node scripts/verify-desktop-layout.mjs` from `frontend` with the website running. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local Chromium executable when using a system browser. The script checks desktop and phone geometry, navigation, search/category filtering, language switching, translator submission and representative tool pages. Screenshots/results go to ignored `runtime-results/responsive-layout`.
