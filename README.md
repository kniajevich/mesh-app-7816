# mesh-app-7816

## Technical Blueprint

## 📚 Consensus‑Arbiter Report  
**Goal** – Refactor the public repository **`kniajevich/mesh-app-2001`** so that **every Russian‑language identifier, comment, log message and user‑visible string** is replaced with clean, technical English (full i18n).  
All changes must be recorded on a new branch **`copilot-audit`** and pushed to GitHub.  

Below you will find a **complete, production‑ready system architecture** that combines:

1. **Automation pipeline** (detect → translate → rewrite → verify → commit).  
2. **Security‑hardening checklist** (sandboxing, dependency vetting, secret protection).  
3. **CI/CD integration** (GitHub Actions + optional pre‑commit hooks).  
4. **Rollback & auditability** (git‑history, signed commits, PR template).  

The solution is delivered as **ready‑to‑run scripts**, **GitHub‑Action workflow**, and **documentation** that any maintainer can drop into the repo and execute locally or in CI.

---

## 1️⃣ High‑Level Architecture  

```
+-------------------+          +-------------------+          +-------------------+
|   Developer PC   |          |   CI Runner (GH) |          |   Remote Repo     |
| (or CI job)       |          |  (GitHub Actions)|          | (GitHub)          |
+--------+----------+          +--------+----------+          +--------+----------+
         |                               |                               |
         | 1. git clone + checkout       |                               |
         |------------------------------>|                               |
         |                               |                               |
         | 2. run ./detect_cyrillic.py  |                               |
         |    (produces JSON report)    |                               |
         |------------------------------>|                               |
         |                               |                               |
         | 3. run ./translate_and_fix.py |                               |
         |    (AST‑aware rewrites)      |                               |
         |------------------------------>|                               |
         |                               |                               |
         | 4. run ./verify.sh            |                               |
         |    (build + tests + lint)    |                               |
         |------------------------------>|                               |
         |                               |                               |
         | 5. git commit & push          |                               |
         |------------------------------>|  push copilot-audit branch   |
         |                               |------------------------------>|
         |                               |                               |
         | 6. PR created (optional)      |                               |
         |<------------------------------|                               |
```

*All steps are **deterministic**, **idempotent**, and **audit‑logged**.*  

---

## 2️⃣ Security‑First Design  

| Threat | Mitigation (implemented in the pipeline) |
|--------|-------------------------------------------|
| **Code execution of untrusted translation output** | All translation strings are **escaped** before being written back to source files. The `translate_and_fix.py` script never `eval`s any external data. |
| **Leak of repository secrets** | The pipeline runs in a **clean container** (`node:20-alpine` for JS, `python:3.11-slim` for scripts). No environment variables are forwarded except the read‑only `GITHUB_TOKEN` used only for `git push`. |
| **Dependency supply‑chain risk** | All third‑party packages are pinned (`requirements.txt` with hashes). The CI job runs `pip install --require-hashes`. |
| **Accidental removal of functional code** | Identifier renaming is performed **AST‑aware** (via `jscodeshift` for JS/TS, `lib2to3`‑style for Python). A **dry‑run mode** (`--dry`) prints a diff before any write. |
| **Rollback / audit trail** | The branch is created from the latest `main`. All changes are committed in a **single signed commit** (`git commit -S`). The commit message contains a link to the generated `cyrillic_report.json`. |
| **CI abuse** | GitHub Actions workflow is limited to the `copilot-audit` branch (`on: push: branches: [copilot-audit]`). No external triggers. |
| **Denial‑of‑service (large repo)** | The detection step uses `ripgrep` with a **byte‑level regex** (`[\x{0400}-\x{04FF}]`) which is O(N) and fast even on >10 k files. |

---

## 3️⃣ Toolchain & Dependencies  

| Tool | Purpose | Version (pinned) |
|------|---------|------------------|
| `git` | VCS operations | ≥ 2.30 |
| `ripgrep (rg)` | Fast Cyrillic detection | 13.0.0 |
| `python 3.11` | Core scripting | 3.11.9 |
| `googletrans==4.0.0rc1` | Free translation API (fallback) | 4.0.0rc1 |
| `tqdm` | Progress bars | 4.66.2 |
| `unidecode` | Normalise identifiers | 1.3.7 |
| `jscodeshift` | AST‑based JS/TS rewrites | 0.15.0 |
| `eslint` + `prettier` | Lint & format after rewrite | latest |
| `node 20` | Build & test (project uses React) | 20.12.2 |
| `npm` | Package manager | ≥ 9 |
| `bash` | Orchestration script | any POSIX shell |

All Python packages are listed in **`requirements.txt`** with SHA‑256 hashes (see appendix).

---

## 4️⃣ Step‑by‑Step Implementation  

### 4.1 Clone & Branch (local or CI)

```bash
# -------------------------------------------------
# 1️⃣  Clone the repo (shallow is fine for CI)
# -------------------------------------------------
git clone --depth 1 https://github.com/kniajevich/mesh-app-2001.git
cd mesh-app-2001

# -------------------------------------------------
# 2️⃣  Create the audit branch
# -------------------------------------------------
git checkout -b copilot-audit
```

> **CI variant** – the same commands are executed in the GitHub‑Actions runner (see workflow file below).

---

### 4.2 Detect Cyrillic Text  

Save **`detect_cyrillic.py`** at the repo root.

```python
#!/usr/bin/env python3
"""
detect_cyrillic.py
------------------
Scans the repository for any occurrence of Cyrillic characters
in:
  * source code comments
  * string literals
  * identifiers (variable / function / class names)

Outputs a JSON report:
{
  "files": {
    "src/App.jsx": {
      "lines": [12, 45],
      "snippets": ["// Привет мир", "const привет = ..."]
    },
    ...
  }
}
"""

import json, pathlib, re, sys
from collections import defaultdict

CYRILLIC_RE = re.compile(r'[\u0400-\u04FF]')   # Unicode Cyrillic block

def is_text_file(p: pathlib.Path) -> bool:
    # Simple heuristic – ignore binary blobs
    try:
        p.read_text(encoding="utf-8")
        return True
    except UnicodeDecodeError:
        return False

def scan_file(p: pathlib.Path):
    hits = []
    for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), start=1):
        if CYRILLIC_RE.search(line):
            hits.append((i, line.rstrip()))
    return hits

def main():
    root = pathlib.Path(".")
    report = defaultdict(lambda: {"lines": [], "snippets": []})

    for path in root.rglob("*"):
        if path.is_file() and is_text_file(path):
            hits = scan_file(path)
            if hits:
                report[str(path)]["lines"] = [ln for ln, _ in hits]
                report[str(path)]["snippets"] = [txt for _, txt in hits]

    out_path = pathlib.Path("cyrillic_report.json")
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"🔎 Detected Cyrillic in {len(report)} files → {out_path}")

if __name__ == "__main__":
    sys.exit(main())
```

Run:

```bash
python3 -m pip install -r requirements.txt   # installs googletrans, tqdm, unidecode
python3 detect_cyrillic.py
```

*Result*: `cyrillic_report.json` – the single source of truth for the next phase.

---

### 4.3 Translate & Rewrite  

Two complementary scripts are provided:

| Script | Scope | How it works |
|--------|-------|--------------|
| `translate_strings.py` | **String literals** (user‑visible messages, logs) | Uses `googletrans` to translate each Cyrillic literal, then writes back the English version preserving surrounding quotes and escape sequences. |
| `rewrite_identifiers.py` | **Identifiers** (variables, functions, classes) | Parses JavaScript/TypeScript