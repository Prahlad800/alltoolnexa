# Excel reference observation

Date: 23 October 2026. User requested REA inspection of Microsoft's public Excel URL and an Excel-style local workspace.

## Observed runtime evidence

- Tool: REA `capture_browser_scenario`, provider `rea-playwright-browser-scenario`.
- Evidence: `ev_8ef64cd5f9ba28e9a703a700ab9e7ae99952e23744d098c619eab5dee2203a42`.
- Owned headless browser: Chromium 155.0.8059.85; temporary process terminated after capture.
- Requested URL: `https://excel.cloud.microsoft/?wdOrigin=SEARCHENGINE.GOOGLE%2CAPPHOME-WEB.UNAUTH%2CAPPHOME-WEB.SHELL.SIGNIN`.
- Observed final path: `/en-us/` with the original query.
- Observed title: `Edit spreadsheets online for free | Microsoft Excel for the Web`.
- Captured DOM was a public marketing/sign-in landing page. The accessibility capture exposed a document and image, not an authenticated workbook grid.

No authenticated workbook editor, proprietary formula engine, internal service protocol, collaboration implementation or full feature inventory was observed. No credentials or authenticated storage were used. Raw marketing HTML is not checked into the repository because anonymous request tokens are irrelevant to this implementation.

## Reconstruction decisions

The AllToolNexa workspace is original application code, using a familiar ribbon, formula bar, cell grid and sheet-tab interaction pattern. These interactions are informed by public documentation, rather than a claim that Microsoft's internal code was recovered. The public landing-page evidence cannot substantiate Excel parity.

Primary references:

- [REA source and documentation](https://github.com/morluto/rea)
- [REA browser scenario contract](https://github.com/morluto/rea/blob/main/docs/browser-scenario-contract.md)
- [Microsoft Excel for the web service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/office-online-service-description/excel-online)
- [Microsoft Excel keyboard shortcuts](https://support.microsoft.com/en-us/accessibility/excel/keyboard-shortcuts-in-excel)
- [Tesseract.js OCR API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)

The implemented scope and limitations are maintained in [DOCUMENT-WORKSPACES.md](DOCUMENT-WORKSPACES.md) and in each workspace's visible help.
