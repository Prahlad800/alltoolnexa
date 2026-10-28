# Desktop layout on every device

The user explicitly requested removing the mobile layout and showing the desktop layout on phones.

- Public frontend viewport is `width=1280, user-scalable=yes`, without a forced initial scale. Phone browsers initially fit the desktop page to the screen; pinch zoom remains available.
- The document has a 1280px minimum width. Narrow desktop windows can scroll horizontally.
- Mobile navigation component was removed. Desktop navigation, sidebar, multi-column cards and editor panels remain in their desktop arrangement.
- 57 maximum-width media-query blocks were removed from 14 frontend stylesheets. Print, theme and reduced-motion rules are retained. The separate admin application was not changed.
- Language selection, file processing and account behavior remain available in the desktop interface.

Verification: `node scripts/verify-desktop-layout.mjs` checks homepage, directory and crop-tool pages at desktop size and in an actual mobile-emulation browser context. It checks desktop navigation, a minimum of three tool-grid columns, sidebar beside the workspace, 1280px viewport, phone initial fit and enabled zoom. Screenshots/results are written to `runtime-results/desktop-layout/`.

Old responsive-width audits and historical screenshots describe the former mobile layout; they are not the acceptance baseline for this intentionally desktop-only interface. Current language and download scripts accept the desktop minimum width when run in a narrow desktop window.
