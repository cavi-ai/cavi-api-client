"""Run the pin-guard and pin-integrity steps against pull requests in a scratch repository."""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUARD = "scripts/pin_guard.py"
WORKFLOW = "ci.yml"
NEXT_JOB = "\n\n  python:"
DISPATCH = "repos/cavi-ai/mlx-agent/dispatches"
DEPENDENCY = ('"husky": "^9.1.7"', '"husky": "^9.1.8"')
OTHER_JOB = ("- 22", "- 24")
DISPATCH_FILE = f".github/workflows/{WORKFLOW}"
DISPATCH_ERROR = "changes the pin-consumers job"
COPIED = (GUARD, f".github/workflows/{WORKFLOW}", ".github/workflows/pin-integrity.yml",
          DISPATCH_FILE, "pyproject.toml", "uv.lock", "package.json")
COMMIT = "547b4b1" + "0" * 33
CORE = "https://github.com/cavi-ai/mcp-core.git"


def step(workflow, job, after):
    """The run script of a job's last step, as the workflow file holds it."""
    text = (ROOT / ".github/workflows" / workflow).read_text()
    block = text.split(f"  {job}:\n", 1)[1].split("        run: |\n", 1)[1]
    return "\n".join(line[10:] for line in block.split(after, 1)[0].splitlines())


class PinGuardTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / "gitconfig").write_text(
            "[user]\n\tname = Pin Test\n\temail = pin@example.invalid\n")
        self.env = dict(os.environ, GIT_CONFIG_GLOBAL=str(self.root / "gitconfig"),
                        GIT_CONFIG_NOSYSTEM="1")
        self.repo = self.root / "repo"
        for name in COPIED:
            if (ROOT / name).exists():
                (self.repo / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copy(ROOT / name, self.repo / name)
        self.git("init", "-q", "-b", "main")
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.base = self.git("rev-parse", "HEAD")

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.repo, env=self.env, check=True,
                              capture_output=True, text=True).stdout.strip()

    def edit(self, name, old, new):
        path = self.repo / name
        text = path.read_text()
        self.assertIn(old, text)
        path.write_text(text.replace(old, new, 1))

    def pin_core_to_git(self):
        with (self.repo / "pyproject.toml").open("a") as stream:
            stream.write(f'\n[tool.uv.sources]\n'
                         f'cavi-mcp-core = {{ git = "{CORE}", rev = "{COMMIT}" }}\n')
        with (self.repo / "uv.lock").open("a") as stream:
            stream.write(f'\n[[package]]\nname = "cavi-pin-test"\nversion = "0.1.0"\n'
                         f'source = {{ git = "{CORE}?rev={COMMIT}#{COMMIT}" }}\n')

    def add_submodule(self):
        (self.repo / ".gitmodules").write_text(
            f'[submodule "vendor/core"]\n\tpath = vendor/core\n\turl = {CORE}\n')
        self.git("update-index", "--add", "--cacheinfo", f"160000,{COMMIT},vendor/core")

    def commit(self, change):
        self.git("checkout", "-q", "-b", "change", self.base)
        change()
        self.git("add", "-A", "--", ".", ":(exclude)vendor")
        self.git("commit", "-q", "-m", "change")
        return self.git("rev-parse", "HEAD")

    def run_step(self, script, **env):
        runner = self.root / "runner"
        runner.mkdir(exist_ok=True)
        return subprocess.run(["bash", "-e", "-c", script], cwd=self.repo, capture_output=True,
                              text=True, check=False,
                              env={**self.env, "BASE": self.base, "RUNNER_TEMP": str(runner),
                                   **env})

    def guard(self, change):
        head = self.commit(change)
        return self.run_step(step(WORKFLOW, "pin-guard", NEXT_JOB), HEAD=head)

    def integrity(self, change):
        """Run pin-integrity as pull_request_target does: main checked out, the PR fetched."""
        head = self.commit(change)
        origin = self.root / "origin.git"
        subprocess.run(["git", "init", "-q", "--bare", str(origin)], check=True, env=self.env)
        self.git("push", "-q", str(origin), "main", f"{head}:refs/pull/7/head")
        self.git("remote", "add", "origin", str(origin))
        self.git("checkout", "-q", "main")
        return self.run_step(step("pin-integrity.yml", "pin-integrity", "\0"),
                             HEAD=head, NUMBER="7")

    def test_git_dependency_pin_fails(self):
        result = self.guard(self.pin_core_to_git)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("::error file=pyproject.toml::", result.stdout)
        self.assertIn("::error file=uv.lock::", result.stdout)

    def test_submodule_fails(self):
        result = self.guard(self.add_submodule)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("::error file=vendor/core::", result.stdout)

    def test_consumer_dispatch_is_never_changed(self):
        result = self.guard(lambda: self.edit(
            DISPATCH_FILE, DISPATCH, "repos/cavi-ai/other/dispatches"))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(DISPATCH_ERROR, result.stdout)

    def test_main_guard_judges_a_rewritten_guard(self):
        def disable_guard():
            (self.repo / GUARD).write_text("import sys\nsys.exit(0)\n")
            self.pin_core_to_git()
        result = self.guard(disable_guard)
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"::error file={GUARD}::", result.stdout)
        self.assertIn("::error file=uv.lock::", result.stdout)

    def test_integrity_fails_a_gutted_guard_job(self):
        result = self.integrity(lambda: self.edit(
            f".github/workflows/{WORKFLOW}", 'python3 "$RUNNER_TEMP/pin_guard.py"', "true #"))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("changes the pin-guard job", result.stdout)

    def test_integrity_passes_an_unrelated_change(self):
        result = self.integrity(lambda: self.edit(f".github/workflows/{WORKFLOW}", *OTHER_JOB))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_dependency_range_and_other_jobs_pass(self):
        def update():
            self.edit("package.json", *DEPENDENCY)
            self.edit(f".github/workflows/{WORKFLOW}", *OTHER_JOB)
        result = self.guard(update)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
