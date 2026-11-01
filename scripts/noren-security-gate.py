#!/usr/bin/env python3
"""Noren security gate.

Fast, deterministic, offline. Meant to run on every commit (pre-commit hook) and
in CI. It does NOT replace the full `security-audit` skill, which is a deep,
model-driven review you run on demand; this gate catches the mistakes that
repeat: committed secrets and dangerous patterns on the public surface.

Usage:
  scripts/noren-security-gate.py            # scan files staged for commit
  scripts/noren-security-gate.py --all      # scan every tracked file
  scripts/noren-security-gate.py --self-test
Exit 1 when a blocking finding exists.
"""
from __future__ import annotations

import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip() or ".")

# (name, regex). Specific provider formats only, so false positives stay rare.
SECRET_PATTERNS = [
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,}\b")),
    ("GitHub fine-grained token", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{50,}\b")),
    ("npm token", re.compile(r"\bnpm_[A-Za-z0-9]{36}\b")),
    ("OpenAI/DeepSeek-style secret key", re.compile(r"\bsk-[A-Za-z0-9]{32,}\b")),
    ("Anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b")),
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b")),
    ("Slack token", re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b")),
    ("Private key block", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----")),
    ("Cloudflare API token (labelled)", re.compile(r"(?i)cloudflare[_-]?(?:api[_-]?)?(?:token|key)\s*[:=]\s*['\"]?[A-Za-z0-9_-]{37,}")),
    ("EVM private key (labelled)", re.compile(r"(?i)(?:private[_-]?key|PRIVATE_KEY)\s*[:=]\s*['\"]?(?:0x)?[0-9a-fA-F]{64}\b")),
]

# Risky code. Only flagged inside the public-facing server paths below.
RISK_PATTERNS = [
    ("eval() on a dynamic value", re.compile(r"(?<![\w.])eval\s*\(")),
    ("new Function(...)", re.compile(r"\bnew\s+Function\s*\(")),
    ("dangerouslySetInnerHTML with an unreviewed value", re.compile(r"dangerouslySetInnerHTML(?!=\{\{\s*__html:\s*JSON\.stringify\()")),
    ("iframe sandbox with allow-same-origin", re.compile(r"sandbox=[\"'][^\"']*allow-same-origin")),
    ("shell=True subprocess", re.compile(r"shell\s*=\s*True")),
    ("TLS verification disabled", re.compile(r"(?i)rejectUnauthorized\s*:\s*false|verify\s*=\s*False|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0")),
    ("docker --privileged / host socket", re.compile(r"--privileged|/var/run/docker\.sock")),
    ("docker run without --network none on a workspace path", re.compile(r"$^")),  # placeholder, see runner check
]
RISK_PATHS = ("agent-os/noren-web/app", "agent-os/noren-web/lib", "agent-os/crates/norend/src", "landing/app", "landing/lib")

# Reviewed placeholders that merely look like secrets. Measured, not assumed: the
# "private key" bodies are 30 and 4 base64 characters (a real RSA key is hundreds).
REVIEWED_SECRET_FILES = {
    "services/noren-updater/.env.example",
}

# Files where a hit is intentional: tests that exercise the gate, fixtures, docs about attacks.
SKIP_SUFFIX = (".lock", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".pdf", ".mp4", ".tar", ".gz", ".zip")
SKIP_PARTS = ("node_modules/", "/target/", ".next/", "/lib/forge-std/", "pnpm-lock.yaml", "Cargo.lock", "scripts/noren-security-gate.py")
ALLOW_MARK = "noren-gate: allow"  # put this on the same line to allow a reviewed exception

# Reviewed, constant-or-escaped sources of dangerouslySetInnerHTML. Matching is on
# the file AND the line text, so the same call added anywhere else is still flagged.
REVIEWED = {
    "agent-os/noren-web/app/components/BuildOutput.tsx": "dangerouslySetInnerHTML={{ __html: activeHtml }}",   # highlight.js output, 12 hostile cases escaped
    "agent-os/noren-web/lib/highlight.ts": "dangerouslySetInnerHTML",                                           # a comment describing the contract
    "landing/app/onepager/page.tsx": "dangerouslySetInnerHTML={{ __html: CSS }}",                                  # static stylesheet constant
}


@dataclass
class Finding:
    kind: str
    path: str
    line: int
    what: str

    def __str__(self) -> str:
        return f"[{self.kind}] {self.path}:{self.line}  {self.what}"


def tracked(all_files: bool) -> list[str]:
    cmd = ["git", "ls-files"] if all_files else ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"]
    out = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT).stdout.split("\n")
    return [p for p in out if p]


def scan_text(path: str, text: str) -> list[Finding]:
    found: list[Finding] = []
    in_risk_scope = any(path.startswith(p) for p in RISK_PATHS)
    is_test = "/tests/" in path or path.endswith((".test.ts", ".test.tsx", ".test.cjs", "_test.rs")) or "test" in Path(path).name
    for n, line in enumerate(text.splitlines(), 1):
        if ALLOW_MARK in line:
            continue
        if path in REVIEWED and REVIEWED[path] in line:
            continue
        for name, rx in SECRET_PATTERNS:
            if rx.search(line):
                if path in REVIEWED_SECRET_FILES and name == "Private key block":
                    continue
                found.append(Finding("SECRET", path, n, name))
        if "ld+json" in line or "JSON.stringify" in line:
            pass
        if in_risk_scope and not is_test:
            for name, rx in RISK_PATTERNS:
                if rx.pattern != "$^" and rx.search(line):
                    found.append(Finding("RISK", path, n, name))
    return found


def scan_file(rel: str) -> list[Finding]:
    if rel.endswith(SKIP_SUFFIX) or any(part in rel for part in SKIP_PARTS):
        return []
    p = ROOT / rel
    try:
        if not p.is_file() or p.stat().st_size > 2_000_000:
            return []
        return scan_text(rel, p.read_text(errors="ignore"))
    except OSError:
        return []


def self_test() -> int:
    fake_gh = "ghp_" + "A1b2C3d4E5" * 4          # built at runtime so this file holds no token
    fake_sk = "sk-" + "0123456789abcdef" * 2
    fake_npm = "npm_" + "Z9y8X7w6V5" * 3 + "abcdef"
    cases = [
        ("secret gh", "x/a.ts", f"const t = '{fake_gh}'", "SECRET"),
        ("secret sk", "x/a.ts", f"KEY={fake_sk}", "SECRET"),
        ("secret npm", "x/a.ts", f"//registry/:_authToken={fake_npm}", "SECRET"),
        ("private key", "x/a.pem", "-----BEGIN OPENSSH PRIVATE KEY-----", "SECRET"),
        ("eval in public path", "agent-os/noren-web/app/x.ts", "const v = eval(input)", "RISK"),
        ("allow-same-origin", "agent-os/noren-web/app/x.tsx", '<iframe sandbox="allow-scripts allow-same-origin" />', "RISK"),
        ("eval outside risk scope", "scripts/tool.js", "eval(x)", None),
        ("eval in a test file", "agent-os/noren-web/app/x.test.ts", "eval(x)", None),
        ("reviewed exception", "agent-os/noren-web/app/x.ts", "eval(x) // noren-gate: allow", None),
        ("clean code", "agent-os/noren-web/app/x.ts", "const a = 1 + 2", None),
        ("reviewed placeholder key passes", "services/noren-updater/.env.example", "-----BEGIN PRIVATE KEY-----", None),
        ("same header in a NEW file is flagged", "services/other/.env", "-----BEGIN PRIVATE KEY-----", "SECRET"),
        ("json-ld stringify is the reviewed safe shape", "landing/app/docs/x/page.tsx", "dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}", None),
        ("raw html from a variable IS flagged", "landing/app/docs/x/page.tsx", "dangerouslySetInnerHTML={{ __html: userHtml }}", "RISK"),
        ("reviewed BuildOutput line passes", "agent-os/noren-web/app/components/BuildOutput.tsx", "dangerouslySetInnerHTML={{ __html: activeHtml }}", None),
        ("same call in a NEW file is flagged", "agent-os/noren-web/app/components/Other.tsx", "dangerouslySetInnerHTML={{ __html: activeHtml }}", "RISK"),
        ("word 'evaluate' is not eval()", "agent-os/noren-web/app/x.ts", "evaluate(x); retrieval(y)", None),
    ]
    bad = 0
    for name, path, text, want in cases:
        got = {f.kind for f in scan_text(path, text)}
        ok = (want in got) if want else not got
        print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  (got {sorted(got)}, want {want})"))
        bad += 0 if ok else 1
    return 1 if bad else 0


def main() -> int:
    if "--self-test" in sys.argv:
        return self_test()
    files = tracked("--all" in sys.argv)
    findings = [f for rel in files for f in scan_file(rel)]
    if not findings:
        print(f"noren-security-gate: clean ({len(files)} files)")
        return 0
    print(f"noren-security-gate: {len(findings)} blocking finding(s)\n")
    for f in findings:
        print("  " + str(f))
    print("\nFix them, or add '# noren-gate: allow' on the line after a reviewed exception.")
    print("A leaked secret must also be rotated: removing it from a commit does not un-leak it.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
