# Markdown editor, viewer and converter

`/markdown-editor` is a free browser workspace linked from All tools, the homepage document workspace and the footer. It supports live GFM preview, formatting buttons, heading outline, document statistics, local drafts and mobile Editor/Preview tabs. Processing and downloads run locally without an execution service, account or backend change.

## Formats

| Operation | Formats and behavior |
| --- | --- |
| Open/edit | MD, MARKDOWN, MDOWN and UTF-8 TXT |
| Import to Markdown | HTML/HTM and DOCX; basic headings, emphasis, lists, tables and links |
| Save source | UTF-8 Markdown (.md) |
| Word export | Real editable DOCX with headings, emphasis, numbered/bulleted lists, tables, code and links |
| Direct PDF | Formatted A4 image-based pages; visual layout and device-font Unicode rendering; text is not selectable |
| Print / Save PDF | Browser print layout with selectable text; choose Save as PDF in the browser's print dialog |
| HTML export | Standalone styled UTF-8 HTML with a restrictive CSP and no scripts or remote resources |
| TXT export | Readable text with Markdown formatting removed; table cells use tabs |
| RTF export | Word-compatible text, basic emphasis/headings/code, lists, tab-separated tables and escaped UTF-16 Unicode |

Images are shown/exported as descriptions; no external images are downloaded. Raw Markdown HTML is shown as inactive text. The preview uses a restricted Markdown renderer and DOMPurify; HTML imports remove active markup/resources before Turndown/GFM conversion. DOCX import uses Mammoth with external file access disabled and a ZIP expanded-size check. Advanced Word layout, images, comments and tracked changes are not preserved. Legacy `.doc` is not supported.

Source length is limited to 200,000 characters, imports to 5 MiB, and expanded DOCX entries to 20 MiB/2,000 files. Direct PDF is limited to 40 pages and uses html2canvas plus pdf-lib. Cancellation stops after the current render; for long documents use browser Print / Save PDF. Visual appearance depends on the device's fonts. Replacements can be undone until further typing. Local draft saving may be unavailable in private/storage-restricted contexts; download MD as a backup.

## Validation

Run `npm test`, `npm run lint`, `npm run build` and the existing static `npm run build:pages` when publishing on Cloudflare Pages. With a site running, from `frontend`:

```sh
AUDIT_ORIGIN=http://127.0.0.1:3106 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/verify-markdown-editor.mjs
```

Omit the executable variable to use Playwright's installed browser. `AUDIT_WIDTHS=390` limits the run to one phone size for a static-export smoke check. The script exercises 320px, 390px and 1440px by default; validates every downloaded format, editable DOCX structure/Unicode, real PDF image contents and multipage output, reverse HTML/DOCX imports, formatting, preview isolation, invalid-file preservation, print popup and draft restoration. Results/screenshots go to ignored `runtime-results/markdown-editor`.
