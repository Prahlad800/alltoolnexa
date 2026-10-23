# Three-service folder structure

All application files are contained by frontend, backend or admin. The root keeps only the repository metadata, README and package.json convenience commands.

| Previous path | Current path |
|---|---|
| shared/ | frontend/shared/ |
| scripts/ (frontend tooling) | frontend/scripts/ |
| scripts/verify-local.py | backend/scripts/verify-local.py |
| docs/ | frontend/docs/ |
| runtime-results/ | frontend/runtime-results/ |
| root *.log | frontend/logs/ |
| shared catalog JSON consumed by Flask | backend/data/ (generated snapshots) |
| shared API/origin imports used by admin | admin/src/lib/ (admin-owned helpers) |
| root node_modules junction | removed; each Node app installs its own dependencies |

Frontend source imports resolve inside frontend. Admin source imports resolve inside admin. Flask reads API catalog files from backend/data and does not read frontend source. The frontend inventory command publishes the API snapshots when the sibling backend is present.

Both Next.js projects use their own app directories as their Turbopack roots. The Python virtual environment and local environment settings remain in backend. Existing Git history is preserved in the root .git metadata directory.

Run commands are documented in the project-root README and each service README. Earlier audit reports describe the historical layout; use the paths above when locating their referenced files.
