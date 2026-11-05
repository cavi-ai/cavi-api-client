"""Fail a change that moves a pin outside its pin bot or changes how pins move.

Usage: pin_guard.py [--mechanism] BASE HEAD [BRANCH], in a checkout that holds both commits.
--mechanism checks only the files and jobs that move pins.
"""

import json
import re
import subprocess
import sys
import tomllib

# Settings for this repository. Everything below them is the same in every repository.
GUARD = "scripts/pin_guard.py"
MECHANISM = (GUARD, ".gitmodules", ".github/workflows/pin-integrity.yml")
JOBS = {".github/workflows/ci.yml": ("pin-guard", "pin-consumers")}
PIN_FILES = ()
BOT_BRANCH = None
BOT_FILES = re.compile(r"^$")

BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com"
GIT_URL = re.compile(r"^(git\+|git@|git:|github:|ssh://|https?://)|\.git(#|$)")
GIT_REQUIREMENT = re.compile(r"git\+|\.git[@#]")
REQUIREMENTS = re.compile(r"(^|/)requirements[^/]*\.txt$")
UNITY = re.compile(r"(^|/)Packages/(manifest|packages-lock)\.json$")


def git(*args):
    result = subprocess.run(["git", *args], capture_output=True, text=True, check=False)
    return result.stdout if result.returncode == 0 else None


def show(rev, path):
    return git("show", f"{rev}:{path}")


def job(text, name):
    """The lines of one top-level workflow job, or None when it is absent."""
    lines = (text or "").splitlines()
    if f"  {name}:" not in lines:
        return None
    start = lines.index(f"  {name}:")
    end = next((i for i in range(start + 1, len(lines)) if re.match(r"^ {0,2}\S", lines[i])),
               len(lines))
    return lines[start:end]


def pyproject(rev):
    """How pyproject.toml declares git sources, and the release pins a pin bot moves."""
    text = show(rev, "pyproject.toml")
    data = tomllib.loads(text) if text else {}
    tool, project = data.get("tool", {}), data.get("project", {})
    sources = tool.get("uv", {}).get("sources", {})
    releases = tool.get("cavi", {}).get("servers", {})
    listed = [*project.get("dependencies", []),
              *(r for group in project.get("optional-dependencies", {}).values() for r in group)]
    named = {re.split(r"[\s<>=!~\[;@]", r, maxsplit=1)[0]: r for r in listed}
    return ({"sources": sources, "requirements": {n: named.get(n) for n in sources}},
            {"releases": releases, "requirements": {n: named.get(n) for n in releases}})


def git_dependency(value):
    if isinstance(value, dict):
        return value.get("source") == "git"
    return isinstance(value, str) and bool(GIT_URL.search(value))


def pins(rev):
    """Every pin recorded at one commit, by the file that records it."""
    found = {"pyproject.toml": pyproject(rev)[1]}
    lock = show(rev, "uv.lock")
    found["uv.lock"] = {p["name"]: p["source"]["git"]
                        for p in (tomllib.loads(lock) if lock else {}).get("package", [])
                        if "git" in p.get("source", {})}
    npm = json.loads(show(rev, "package.json") or "{}")
    found["package.json"] = {n: v for group in ("dependencies", "devDependencies")
                             for n, v in npm.get(group, {}).items() if git_dependency(v)}
    for line in (git("ls-tree", "-r", rev) or "").splitlines():
        meta, path = line.split("\t", 1)
        if REQUIREMENTS.search(path):
            found[path] = sorted(r.strip() for r in (show(rev, path) or "").splitlines()
                                 if GIT_REQUIREMENT.search(r))
        elif UNITY.search(path):
            deps = json.loads(show(rev, path) or "{}").get("dependencies", {})
            found[path] = {n: v for n, v in deps.items() if git_dependency(v)}
        elif any(path == p or p.endswith("/") and path.startswith(p) for p in PIN_FILES):
            found[path] = meta.split()[2]
    return found


def bot(base, head, branch, files):
    """Whether the change is the pin bot's: its branch, only its commits and only its files."""
    if not BOT_BRANCH or not (branch or "").startswith(BOT_BRANCH):
        return False
    authors = (git("log", "--no-merges", "--format=%ae%n%ce", f"{base}..{head}") or "").split()
    return bool(authors) and set(authors) == {BOT_EMAIL} and all(map(BOT_FILES.match, files))


def violations(base, head, branch=None, mechanism_only=False):
    found = []
    for path in MECHANISM:
        before = show(base, path)
        if before is not None and before != show(head, path):
            found.append((path, "changes how pins move"))
    for path, names in JOBS.items():
        for name in names:
            before = job(show(base, path), name)
            if before is not None and before != job(show(head, path), name):
                found.append((path, f"changes the {name} job"))
    if pyproject(base)[0] != pyproject(head)[0]:
        found.append(("pyproject.toml", "changes how git dependencies are declared"))
    if mechanism_only:
        return found
    files, moved = [], []
    for line in (git("diff", "--raw", "--no-renames", base, head) or "").splitlines():
        meta, path = line.split("\t", 1)
        files.append(path)
        if "160000" in meta.split()[:2]:
            moved.append(path)
    before, after = pins(base), pins(head)
    moved += [path for path in sorted({*before, *after}) if before.get(path) != after.get(path)]
    if moved and not bot(base, head, branch, files):
        found += [(path, "moves a pin outside the pin bot") for path in dict.fromkeys(moved)]
    return found


def main(argv):
    mechanism_only = argv[:1] == ["--mechanism"]
    args = argv[1:] if mechanism_only else argv
    if len(args) not in (2, 3):
        print(__doc__, file=sys.stderr)
        return 2
    base = (git("merge-base", args[0], args[1]) or "").strip()
    if not base:
        print(f"::error::No merge base for {args[0]} and {args[1]}")
        return 1
    found = violations(base, args[1], args[2] if len(args) == 3 else None, mechanism_only)
    for path, message in found:
        print(f"::error file={path}::{path} {message}")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
