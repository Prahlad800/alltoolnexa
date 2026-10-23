# AllToolNexa — User Experience & Tools Audit

**Date:** 23 October 2026, Asia/Calcutta  
**Project:** `D:\my data\developer\top project\alltoolnexa`  
**Preview:** `http://localhost:3000`  
**Perspective:** Ek first-time visitor jo tool khojna, apna input dena aur usable output download karna chahta hai.

## Result aur scope

Website ka basic navigation aur shared tool interface usable hai. Sabse noticeable problems: clear karne ke baad output rehna, Hindi PDF text support na hona, support contact ka missing hona, mobile navigation ka shrink hona aur results/errors ka generic presentation.

**Current registry mein 502 canonical tools aur 18 categories hain.** README ka 464 count current registry se match nahi karta. Har tool ko broken kehne ka evidence nahi mila.

- Chrome desktop aur 390 × 844 mobile viewport par live website inspect ki.
- Homepage, Word Counter ka run/clear flow, tool directory/search, Contact aur public Login browser mein check kiye.
- **502 tools ki inventory review ki; 417 standard tools ke default engine examples is audit mein execute hue aur pass hue.**
- Existing `npm test`: **456 tests, 455 pass, 1 skip, 0 fail**. Yeh 456 tools ka browser test nahi hai.
- Hindi Text-to-PDF rejection engine se reproduce hui; English sample valid PDF banata hai.
- Remaining **85 browser/file-dependent tools ka complete live upload → process → download flow is audit mein execute nahi hua**. Shared workbench aur relevant image/PDF/conversion code review hua. Unhe browser PASS label nahi diya gaya.
- Per-tool status: [USER-AUDIT-TOOL-COVERAGE.md](./USER-AUDIT-TOOL-COVERAGE.md).

Yeh local user-experience audit hai; all inputs, all devices aur production website ke har possible bug ki guarantee nahi hai. Purane `runtime-audit.log` ke failures current confirmed bugs mein count nahi kiye gaye.

### Evidence labels aur priorities

- **B:** Current browser mein observed.
- **E:** Current engine execution se reproduced.
- **S:** Current source se confirmed behavior; browser reproduction pending.
- **P1:** Jaldi address karein: sensitive output handling ya important target-user task blocked.
- **P2:** Normal priority: task friction, confusing behavior ya incomplete recovery.
- **P3:** Usability improvement / polish. Disclosed product limitation ko crash/defect nahi maana gaya.

## Findings

### UX-01 — Clear inputs ke baad sensitive result aur download active rehte hain

**P1 · B + S · Shared workbench; timer excluded**

**Steps:** Word Counter par text enter karein → Calculate / generate → Clear inputs.

**Actual:** Text field empty hoti hai, lekin previous result, Copy result aur Download rehte hain. Warning batati hai ki inputs changed hain. `reset(empty)` result discard nahi karta.

**User impact:** Shared device par user input clear karke samajh sakta hai ki uska kaam screen se remove ho gaya. Document, password/token aur private text outputs abhi accessible ho sakte hain. Yeh server storage/data leak ka proof nahi hai; current page state ka issue hai.

**Expected/fix:** Explicit **Clear inputs and result** action dein. Agar input-only clear intentional hai, uske paas result retention clear likhein. Reset aur full clear ko alag behavior dein; full clear object URLs bhi revoke kare.

**Source:** `frontend/src/components/Workbench.js` — `reset`, `discard`, result actions.

### UX-02 — Hindi text se PDF banana fail hota hai

**P1 · E + S · Text to PDF, PDF text watermark**

**Steps:** Text-to-PDF engine mein `नमस्ते` input dein. PDF watermark mein unsupported Hindi text bhi same preflight use karta hai.

**Actual:** Error: `This PDF tool supports Latin text only. Hindi, emoji and other unsupported characters need a Unicode PDF editor.` English text sample PDF banata hai.

**User impact:** Hindi/Indian-language users core document task complete nahi kar sakte. Generic PDF tool name se yeh restriction pehle obvious nahi hai.

**Expected/fix:** Unicode font embedding aur Indic shaping support add karein. Tab tak input ke upar supported-language notice aur alternative dein. Is finding ko Word-to-PDF par automatically apply na karein; uska rendering path alag hai.

**Source:** `frontend/src/lib/pdf-tools.mjs` — `preflightText`, Helvetica font.

### UX-03 — Issue report karne ke liye real destination nahi milta

**P2 · B + S · `/contact`**

**Steps:** Footer → Contact.

**Actual:** Page reproduction details maangta hai, lekin `Support contact details will be listed here when available.` dikhata hai. Is local configuration mein email/form/issue link nahi hai.

**Impact:** Wrong calculation ya failed download report karne wala user dead end par pahunchta hai.

**Fix:** Real support email ya issue form configure karein; tool page par tool name prefilled Report issue link dein.

**Source:** `frontend/src/app/[info]/page.js`, `NEXT_PUBLIC_CONTACT_EMAIL`.

### UX-04 — Mobile header se important navigation gayab ho jaati hai

**P2 · B + S · 390 px mobile width**

**Actual:** Header mein All tools aur theme control bachte hain. Categories, Popular tools aur Sign in hide hote hain; alternate menu nahi hai. Homepage ka quick-navigation rail bhi mobile par hidden hai.

**Impact:** Desktop par available routes mobile user ko utni aasani se discover nahi hote. Kuch footer links hain, lekin Sign in ka equivalent mobile navigation nahi hai.

**Fix:** Accessible Menu button/drawer dein, jisme same routes aur current-page indication ho.

**Source:** `frontend/src/app/layout.js`, responsive rules in `globals.css`.

### UX-05 — Mobile categories horizontal strip mein off-screen chhup jaati hain

**P2 · B · `/tools`, 390 px**

**Actual:** Initially All tools, Math aur Student jaise starting filters visible hain; PDF/Image aur later categories ke liye horizontal scroll chahiye.

**Impact:** User ko familiar PDF/Image filter pehle nahi dikhta. Vertical page scroll aur category-strip scroll do alag gestures ban jaate hain.

**Fix:** Searchable category dropdown ya clear Browse categories control dein; active category aur filter reset always visible rakhein.

**Source:** `frontend/src/components/Directory.js`, `.filter-sidebar` responsive styles.

### UX-06 — Mobile tool cards mein descriptions cut hoti hain

**P2 · B + S · Tool directory**

**Actual:** 390 px par two-column cards narrow hain. Description lines truncate hoti hain; long tool names aur formula snippets ko scan karna mushkil hai.

**Impact:** Similar tools ka difference samajhne ke liye user ko detail pages baar-baar kholne padte hain.

**Fix:** Small phones par single-column compact list consider karein. Card par repeated tool name/formula ki jagah one-line task outcome dein.

**Source:** `ToolCard.js`, `.tool-card > p`, `.tool-grid`, `.directory-grid` in `globals.css`.

### UX-07 — Typo search mein recovery suggestions nahi hain

**P3 · B + S · Tool directory**

**Steps:** `pdf merge` search karein, phir `pdf marg`.

**Actual:** First query PDF Merge deta hai; second par 0 results, generic shorter-term hint aur Clear filters aata hai. `image resizer` successfully Image Resize dhoondhta hai, isliye aliases bilkul missing nahi hain.

**Impact:** Spelling mistake wale user ko existing tool missing lag sakta hai.

**Fix:** Limited fuzzy suggestions, common misspellings aur task synonyms add karein; e.g. Did you mean PDF Merge?

**Source:** `frontend/src/lib/search.mjs` — token substring matching.

### UX-08 — Browser Back filter changes ko undo nahi karta

**P2 · S · Directory/search**

**Steps to verify:** Directory mein query/category change karein, phir browser Back use karein.

**Actual from code:** Har filter change `history.replaceState` use karta hai. Previous filter states history entries nahi bante.

**Impact:** User last category par lautne ki expectation mein directory se bahar ja sakta hai.

**Fix:** Deliberate category/search submissions ke liye history entries banayein; typing ko debounce/replace karein. Back/Forward behavior verify karein.

**Source:** `Directory.js` — `filter`.

### UX-09 — Show more ki progress URL mein preserve nahi hoti

**P2 · S · Directory**

**Steps to verify:** Show more se later tools tak jaayein → tool open karein → Back.

**Actual from code:** Visible limit component state mein hai, default 36; remount/popstate par 36 reset hota hai. URL mein loaded-page/limit nahi hai. Exact back-navigation effect browser cache par depend karega.

**Impact:** Remount hone par user ko later tool tak pahunchne ke liye repeated Show more karna pad sakta hai.

**Fix:** Pagination/visible count restore karein aur clicked card tak scroll restore test karein.

**Source:** `Directory.js` — `limit`, `sync`, Show more.

### UX-10 — Generic action label tool ke actual kaam ko clear nahi karta

**P2 · B + S · 417 standard tools ka shared action**

**Actual:** Word Counter ka button bhi `Calculate / generate →` hai. Same wording validators, text transformations aur document templates par use hoti hai.

**Impact:** User ko Count words, Format JSON, Validate ya Create draft jaise clear action cues nahi milte.

**Fix:** Tool metadata mein action label define karein. Generic label fallback rahe.

**Source:** `Workbench.js` — `action`.

### UX-11 — Results ka raw JSON/plain-text presentation nontechnical users ke liye weak hai

**P2 · B + S · Standard result panel**

**Actual:** Word Counter result JSON braces/key-value block mein dikhta hai. Shared renderer object output ko `JSON.stringify` karke `<pre>` mein dikhata hai.

**Impact:** Counts, financial amounts aur multi-metric results ko quickly interpret karna mushkil ho sakta hai. Developer tools mein code output appropriate hai.

**Fix:** Tool type ke hisaab se number cards, labeled units, tables aur currency formatting dein; raw output optional rakhein.

**Source:** `Workbench.js` — `display`, result `<pre>`.

### UX-12 — Validation field-specific guidance nahi deti

**P2 · S · Shared form**

**Actual:** Error form ke start par ek message hai. Fields par `aria-invalid` aur individual error IDs nahi hain. Numeric inputs mein tool-specific min/max/required metadata render nahi hoti; engine validation submit ke baad hoti hai.

**Impact:** Multi-input tool mein galat field identify/correct karna extra effort hai. Error focus aur role=alert already present hain—unhe missing nahi maana gaya.

**Fix:** Per-field constraints, examples, inline errors aur `aria-invalid` add karein; summary se field tak jump dein.

**Source:** `Workbench.js` — field mapping; `shared/core.mjs` validators.

### UX-13 — Kuch numeric errors mein Infinity aur generic Value wording aati hai

**P2 · S · Numeric validation**

**Actual from source:** `number` default upper bound Infinity hai; invalid value par message `must be between ... and Infinity` ban sakta hai. `positive` callers aksar default `Value` label use karte hain.

**Impact:** User ko actual allowed input aur kis field mein issue hai, clear nahi hota.

**Fix:** Finite/unbounded cases ke liye human-readable messages banayein, e.g. Radius must be greater than zero.

**Source:** `shared/core.mjs` — `number`, `positive`; calculator callers.

### UX-14 — File picker ka universal limit message single-file tools par misleading hai

**P2 · S · File-based workbenches**

**Actual:** `Up to 100 files, 50 MB each and 100 MB total` har file tool par dikhaya jaata hai, jabki single-file tools extra file reject karte hain. Image pixel/device-memory budget alag restriction hai jo universal notice mein nahi hai.

**Impact:** User advertised size ke andar image choose karke bhi pixel-budget rejection face kar sakta hai; single vs batch capability unclear hai.

**Fix:** Tool-specific count, file-size, supported type aur pixel/page limits picker ke paas dikhayein.

**Source:** `file-input.mjs` — `FILE_LIMITS`, `validateFiles`, `checkImage`; `Workbench.js` file label.

### UX-15 — Invalid replacement ke baad old selected file retain hoti hai

**P2 · S · File selection**

**Steps to verify:** Valid file select karein → Replace file se unsupported/corrupt file choose karein.

**Actual from code:** `choose` validation fail hone par error set karta hai; existing files state clear nahi hoti. Old file list remains.

**Impact:** User replacement ko selected maan kar retry kare to old file process ho sakti hai. Old selection retain karna useful ho sakta hai, par message explicit nahi hai.

**Fix:** Error ke saath batayein: Replacement rejected; previous file X is still selected. Run button par selected filename reinforce karein.

**Source:** `Workbench.js` — `choose` catch branch.

### UX-16 — File validation ke dauran cancel option nahi hai

**P2 · S · Image/PDF selection**

**Actual:** Validation files ko sequentially inspect/decode karti hai. `Checking files…` ke dauran form/reset/remove disabled hain; processing ka Cancel button selection stage par available nahi hai.

**Impact:** Many/large files par user ko wait ya page leave karna padta hai. Worst-case delay is audit mein benchmark nahi hua.

**Fix:** Cancel selection aur current file/count progress dein; abort/discard pending validation safely handle karein.

**Source:** `Workbench.js` — `choose`, `selecting`, `canCancel`.

### UX-17 — HTML to PDF instructions file choose karne ko kehti hain, input pasted HTML hai

**P2 · S · `/tools/html-to-pdf`**

**Actual:** Tool mein `noFile:true` hai aur HTML textarea hai, lekin How to use instruction `tool.accept` dekhkar Select your local file likhti hai.

**Impact:** First-time user missing upload control dhoondh sakta hai.

**Fix:** Instructions actual `needsFile(tool)` aur tool kind se generate karein; timer-specific instructions bhi dein.

**Source:** `shared/reference-files.mjs`, `frontend/src/app/tools/[slug]/page.js`.

### UX-18 — Local login backend unavailable hone par raw Failed to fetch dikhata hai

**P2 · B + S · `/login`**

**Actual in this run:** Public frontend chal raha tha; Login par `Failed to fetch` dikhaya. Is audit mein authentication backend start nahi kiya gaya, isliye successful sign-in verify nahi hua.

**Impact:** Ordinary visitor ko account credentials, network ya service availability mein difference samajh nahi aata. Yeh production login broken hone ka claim nahi hai.

**Fix:** Friendly service-unavailable message, Retry aur Continue using tools link dein. Public account useful nahi ho to public header se demo sign-in remove/hide karein.

**Source:** `AuthPanel.js`, `shared/api-client.mjs`.

### UX-19 — Timer refresh/navigation se session lose hota hai; finish par alert nahi

**P2 · S · Pomodoro / Countdown · Product limitation**

**Actual:** Timer React state mein hai; reload ya component unmount par session reset hota hai. No sound/notification aur manual next-session behavior UI mein disclosed hai.

**Impact:** User doosra tool visit karke active timer lose kar sakta hai; background mein session complete notice miss ho sakta hai.

**Fix:** Optional local deadline persistence, navigation hint aur opt-in completion sound dein. Notifications ko user choice rakhein.

**Source:** `frontend/src/components/Timer.js`.

### UX-20 — Break duration edit karne par running focus bhi pause hota hai

**P2 · S · Pomodoro**

**Steps to verify:** Focus session Start karein → Break minutes change karein.

**Actual from code:** Break input ka onChange unconditional `setRunning(false)` karta hai, even while focus phase chal raha ho. Pause reason announce nahi hota.

**Impact:** Future break configure karte waqt current focus unexpectedly rukta hai.

**Fix:** Inactive phase ke duration edits current timer ko na rokein; running phase edits ke liye explicit restart/pause behavior dein.

**Source:** `Timer.js` — break input onChange.

### UX-21 — Document conversion names full-fidelity expectations bana sakte hain

**P3 · S · PDF/DOCX/XLSX/PPTX conversions · Disclosed limitations**

**Actual:** Word to PDF text-only hai; PDF to DOCX layout/images preserve nahi karta; PDF to Excel text positions export karta hai; PDF to PPTX image slides banata hai. Descriptions in limitations ko already explain karti hain.

**Impact:** Familiar conversion name dekhkar user editable/layout-preserved output expect kar sakta hai, especially truncated directory cards se aane par.

**Fix:** Picker/action ke paas concise badges dein: Text only, Tables not reconstructed, Image slides. Isse functionality ko broken ya fake label dena justified nahi hai.

**Source:** `shared/reference-files.mjs`, `frontend/src/lib/reference-files.mjs`.

### UX-22 — Input change/refresh par draft recover nahi hota

**P3 · S · Shared workbench · Privacy/product tradeoff**

**Actual:** Inputs/results component memory mein hain; navigation/reload persistence ya unsaved-work warning nahi hai. No saved inputs promise intentional hai.

**Impact:** Long letter, invoice details, formatted text ya multi-file setup galti se leave karne par lost ho sakta hai.

**Fix:** Privacy-preserving unsaved-work warning ya explicit opt-in local draft recovery dein; secret tools ke liye persistence default off rahe.

**Source:** `Workbench.js`, tool page keyed component.

### UX-23 — CGPA conversion ka grading scale validate nahi hota

**P2 · E + S · CGPA to Percentage**

**Steps:** CGPA `100`, institution multiplier `9.5`.

**Actual:** Engine `950` return karta hai. Lower bound hai, upper grading scale field/check nahi hai.

**Impact:** Extra zero/scale mistake par misleading percentage mil sakti hai. Institutions ke rules alag hain, isliye hard-coded universal 10-point assumption bhi sahi fix nahi hai.

**Fix:** Maximum CGPA scale input ya explicit supported range dein; out-of-scale input aur >100% result par policy-aware warning/check lagayein.

**Source:** `shared/catalog.mjs` — CGPA to Percentage registration.

### UX-24 — README aur current tool registry ka count mismatch hai

**P3 · E + S · Documentation**

**Actual:** README 464 implementations batata hai; current registry/browser 502 tools dikhate hain.

**Impact:** Product readiness/coverage assess karne wale maintainer ko outdated scope milta hai. Homepage count current registry ke saath match karta hai.

**Fix:** Counts aur coverage docs registry se generate karein; working/default-tested/browser-tested ko alag define karein.

**Source:** `README.md`, `shared/catalog.mjs`, attached coverage ledger.

## Category coverage

Counts current registry se liye gaye hain. Category inventory review ka matlab uske har tool ka end-to-end browser PASS nahi hai.

| Category | Tools | Main follow-up focus |
|---|---:|---|
| Math & numbers | 44 | Constraints, units, field-specific errors |
| Student | 19 | Institution scales, boundary inputs |
| Office & salary | 25 | Pay period, currency, result presentation |
| Finance & business | 32 | Assumptions, rounding, rates, units |
| Marketing & SaaS | 37 | Metric labels, percentage/ratio interpretation |
| Date & time | 19 | Timezones, timer persistence/phase edits |
| Unit converters | 42 | Source/target unit clarity, precision |
| Text & writing | 37 | Clear behavior, long text, Unicode |
| Developer | 57 | Invalid data, formatting, preview/download |
| Design & CSS | 17 | Visual previews, copied CSS usability |
| Image tools | 23 | Real file upload, crop/resize, device budgets |
| PDF tools | 25 | Unicode, page operations, encrypted files, fidelity |
| QR & barcodes | 13 | Generated output scan verification |
| India utilities | 9 | Format-only scope, invalid/boundary inputs |
| Home & everyday | 22 | Unit assumptions and practical result labels |
| Random & security | 16 | Clear sensitive output, copy/download |
| SEO & social | 24 | Generated markup and external preview compatibility |
| Documents & templates | 41 | Draft loss, required facts, output cleanup |
| **Total** | **502** | See per-tool ledger |

## Fix order aur acceptance criteria

1. **Clear output safety:** Text/file/token result banayein; full clear ke baad input, preview, copy/download aur object URL result access remove hona chahiye.
2. **Hindi PDF:** Hindi, English, mixed text aur emoji fixtures se output visually inspect karein; unsupported characters ko silent replacement na karein.
3. **Support + login recovery:** Contact par usable reporting destination; backend unavailable par friendly recoverable state.
4. **Mobile discovery:** 360/390/768 px par navigation, categories, long names, input/result actions verify karein. Horizontal page overflow na ho.
5. **Shared form UX:** Tool-specific actions, units, readable results aur inline errors implement karein.
6. **File/timer flows:** Cancel during validation, rejected replacement messaging aur timer phase behavior check karein.

## Pending verification — inhe confirmed failures na samjhein

- Remaining 85 browser-dependent tools: synthetic fixtures ke saath upload → process → inspect output → download → reopen.
- Every tool ke invalid, empty, extreme, Unicode aur non-default inputs; default pass mathematical correctness certification nahi hai.
- PDF: scanned documents, mixed page sizes, 40+ rendered pages, protected/corrupt PDFs, signatures/forms and output fidelity.
- Images: EXIF orientation, transparency, large-pixel files, animation rejection, crop presets and JPEG/WebP exports.
- QR/barcode: real scanner se scan aur special-character payload round trip.
- Production build/performance: development cold compile initially slow tha; ise production speed metric nahi maana gaya. Lighthouse/Core Web Vitals measure nahi hue.
- Real Android/iPhone, Safari/Firefox, screen reader, 200% zoom, automated contrast audit aur full keyboard traversal pending.
- Live production URL, deployed backend/authentication aur network/privacy capture verify nahi hua.
- Existing suite ka skipped XML test browser DOM environment mein run karna pending hai.

## Positive observations

- Word Counter current browser mein result generate karta hai; changed-input warning visible hai.
- Search `pdf merge` aur `image resizer` relevant tools deta hai.
- Mobile form inputs readable hain aur workbench single column mein reflow hota hai.
- Skip link, labeled fields, error alert/focus aur live result region implemented hain.
- File limits, many conversion limitations aur local-processing behavior documented hain.
- Current engine mein non-finite numeric outputs reject hote hain; overflow ko successful result bug nahi maana gaya.
- Existing tests ke current run mein failures nahi mile.

**Deliverable scope:** Report aur coverage Markdown files banayi gayi hain. Application fixes is task mein apply nahi kiye gaye.
