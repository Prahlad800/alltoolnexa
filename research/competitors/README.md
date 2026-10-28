# Competitor research artifacts

Start with [REPORT.md](REPORT.md), then [ARCHITECTURE-AND-GAPS.md](ARCHITECTURE-AND-GAPS.md). [status.csv](status.csv) and [status.json](status.json) track all 32 sites. The scope is an initial public-interface audit; pending entries are real unfinished work.

`evidence/` contains the original REA homepage responses. `tool-evidence/` contains 20 additional tool-page attempts, including errors. The capture provider is REA's Playwright browser-scenario provider using locally installed Edge. The official [REA repository](https://github.com/morluto/rea) README was reviewed; the already-connected tools were used without installation or configuration changes. Browser scenarios declared navigation and a short wait. No competitor code or assets were imported into the application.

Several later calls returned `cleanup_incomplete` / 30-second provider timeouts. These are tooling failures, not findings that the websites lack features. The parser recovers a retained `partial_observation` when available and labels it incomplete; it does not invent an Evidence ID. The reported browser-transport/profile resources were reviewed before further work. No user browser was closed, no profile was deleted and no access restriction was bypassed. Further REA captures should first verify provider cleanup/recovery rather than repeat failed launches blindly.

`observations.json` is extracted DOM/control/link/network data. It includes hidden DOM controls; presence does not prove visibility, keyboard usability or successful interaction. Event scope, omissions, service-worker blocking and navigation errors remain attached. A successful REA capture is complete only within its declared capture scope, not a comprehensive website audit.

`web-supplement.json` retains the supplemental web-reader result for six India tool pages; `supplement.json` contains short attributed summaries. Pricing findings in the report link official pages and record the review date. Amounts that did not render were left unknown. The public API findings in the architecture document are documented contracts, not tested account traffic.

To regenerate the derived observations, report and ledgers from the retained files, run Python 3 from the repository root:

```powershell
backend/.venv/Scripts/python.exe research/competitors/build_report.py
```

The scripts use only the Python standard library and perform no network requests. A different Python 3 executable can be substituted. Research evidence and generated artifacts are not imported by frontend/admin/backend runtime code.

The separate local compressor browser check is `frontend/scripts/verify-target-image.mjs`. Start a local frontend preview on port 3100, then run it from frontend; optionally set `AUDIT_ORIGIN` to another local preview. It launches a temporary headless Edge instance, uses a deterministic synthetic image and writes results/screenshots under `frontend/runtime-results/target-image/`. The executable path is Windows-specific and should be adjusted on other systems.
