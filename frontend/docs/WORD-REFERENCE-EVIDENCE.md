# Word reference evidence and PDF editor checklist

Research session: 23–24 October 2026, Asia/Calcutta. Record updated: 24 October 2026.

The user requested REA investigation of Microsoft Word and familiar Word-style editing controls inside AllToolNexa's PDF editor. This record separates runtime evidence, published product documentation, and original implementation decisions.

## Runtime evidence

- Tool: REA `capture_browser_scenario`, controlled replay using an owned temporary browser profile.
- Evidence: `ev_362392f61205e0416446815480dc77112cb5b9b2670aaca0e22b2f11356c6178`.
- Browser: Chromium 155.0.8059.85; the temporary process was terminated after capture.
- Requested URL: `https://word.cloud.microsoft/`.
- Observed final URL: `https://word.cloud.microsoft/en-us/`.
- Observed title: `Create and edit documents for free | Microsoft Word for the Web`.
- Captured DOM: 74,190 bytes; SHA-256 `49aa523b1f3d8c724d475716a908ca55596bfe5370bbcb62e2e71fff8a31ea6a`.
- Accessibility coverage: a document and image, on a public marketing landing page. No authenticated document editor was inspected.

The capture establishes the landing-page response and redirect only. It does not establish signed-in ribbon controls, editing behavior, layout algorithms or shortcut execution. Raw marketing HTML is not committed because anonymous request tokens are irrelevant to the implementation.

## Primary documentation

Microsoft documents browser Word support for reusable styles, lists and indentation, find/replace, tables, images, links, drawing, comments, headers/footers, and page numbers. Documented availability differs from desktop Word; the service description specifically excludes browser mail merge. This feature inventory is documentation evidence, not evidence that these controls were exercised in the REA capture. [Microsoft Word for the web service description](https://learn.microsoft.com/en-us/office365/servicedescriptions/office-online-service-description/word-online).

The shortcut page has separate Windows, macOS and Web sections. The Web section documents Home, Insert, Page Layout, References, Review and View ribbon destinations. Font, paragraph and style commands are suitable reference categories; desktop-only entries must not be presented as observed Word-web behavior. [Microsoft Word keyboard shortcuts](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word).

## Working feature matrix

The following are AllToolNexa design recommendations, not implementation-completion claims. Controls must operate on the selected editable text or the explicitly selected PDF annotation.

| Workspace area | Recommended controls | Meaning in a PDF editor | Verification checklist |
| --- | --- | --- | --- |
| Home / Font | Family, size, bold, italic, underline, foreground/highlight color, clear formatting | Style newly authored text; expose mixed-selection state where applicable | Preview and exported PDF agree for each supported font and decoration |
| Home / Paragraph | Left/center/right/justify, bullets/numbering, indent, line/paragraph spacing | Format the active authored text block | Multiline wrapping, alignment and spacing survive export |
| Home / Styles | Normal, Title, Subtitle, Heading 1–3 | Apply documented AllToolNexa presets to editable text | Preset names, resulting size/weight and current selection state agree |
| Insert | Text box, image, table, link | Create visible additions over the source PDF | Placement, pagination, selection and exported output agree |
| Draw | Pen, highlight, rectangle, line | Maintain existing PDF annotation workflows | Pointer scale and coordinates remain correct at different zoom levels |
| Layout | Text-block width, margins for new text, page orientation where supported | Keep authored text layout distinct from source-page operations | Explain which page or object changes; preserve source page content |
| View | Page navigation, zoom, fit width, shortcuts help | Navigate the PDF and discover available controls | Keyboard focus remains visible; narrow screens remain usable |
| Review | Find/replace in authored text | Search and replace only within editable additions unless original PDF text editing is explicitly implemented | Scope is visible; undo restores replaced text |
| History / File | Undo, redo, download edited PDF | Save the actual edited document | Undo and redo restore authored content and formatting together |

Paragraph spacing can be modeled as space before/after plus a line-height multiplier. Microsoft describes single, 1.5-line, double and custom paragraph spacing, alongside first-line and hanging indents; these are desktop documentation references. Our representation and export layout remain original implementation choices. [Microsoft paragraph spacing reference](https://support.microsoft.com/en-us/word/adjust-indents-and-spacing).

## Shortcut behavior

These mappings come from Microsoft's **Web** shortcut section; they require focused editable document content. They do not prove support in AllToolNexa until verified.

| Action | Word-web reference |
| --- | --- |
| Bold / italic / underline | Ctrl+B / Ctrl+I / Ctrl+U |
| Smaller / larger text | Ctrl+[ / Ctrl+] |
| Left / center / right / justify | Ctrl+L / Ctrl+E / Ctrl+R / Ctrl+J |
| Bullets / numbering | Ctrl+. / Ctrl+/ |
| Undo / redo | Ctrl+Z / Ctrl+Y |
| Cut / copy / paste | Ctrl+X / Ctrl+C / Ctrl+V |
| Move editor/ribbon focus | Ctrl+F6 |

Word-web documentation warns that browser shortcuts differ from desktop shortcuts, including F1 and Ctrl+O. [Microsoft Word keyboard shortcuts, Web section](https://support.microsoft.com/en-us/accessibility/word/keyboard-shortcuts-in-word).

Implementation requirements:

- Scope event handling to the authoring surface. Never globally capture a command because an unrelated text input elsewhere on the page has focus.
- Only cancel the browser default when the corresponding editor action can execute. Provide a visible toolbar alternative for every advertised shortcut.
- Preserve native text selection, caret movement, clipboard and input-method composition. Ignore formatting shortcuts while an IME composition is active.
- Desktop aliases such as Ctrl+Alt+1/2/3 for heading presets may be offered as optional local behavior with an explicit label. They are not part of the documented Web subset above.
- Ctrl+L/E/R/J can collide with browser commands; intercept only during active editor use. Keep browser open/new-tab/close-tab/reload/navigation commands available.
- Provide shortcut help explaining platform and focus requirements. US keyboard punctuation shortcuts can differ on other keyboard layouts.

## Bounded scope and remaining verification

Implementation target communicated by the parent: an original PDF overlay ribbon with Home, Insert, Draw, Layout, Review and View; new/blank pages; annotation selection, movement and clipboard actions; text typography, strike/underline, paragraph presets, alignment, lists and spacing; fixed PDF tables, shapes, headers/footers and page numbers; authored-text find/replace, redo and focused shortcuts. Runtime verification and export verification of that implementation are pending in this research record. The broader matrix above is a checklist, not a claim that every item shipped.

Existing source-PDF text is not automatically a reflowable Word document. Added text, formatting and annotations need explicit preview/export behavior. Do not describe a white rectangle as secure redaction, or imply that covering a word removes its underlying PDF text.

This work does not establish Microsoft's internal implementation, proprietary code recovery, authenticated editor workflows, complete Word compatibility, cloud autosave, collaborative review, tracked changes, macros, or exact DOCX round-trip fidelity.

Before claiming an implemented feature, test the editor interaction and inspect the downloaded PDF. Include multiline text, non-Latin input, a narrow viewport, undo/redo, and at least one browser-shortcut collision. Record actual supported limitations in visible help. REA evidence and official references guide interoperability; application code and visual styling must remain original.

The REA workflow instructions were read from the installed `reverse-engineer-anything` skill, including its runtime-observation guide. [REA project and browser analysis documentation](https://github.com/morluto/rea).
