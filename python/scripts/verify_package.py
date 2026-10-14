"""Build and install Python artifacts, then test with no Node/npm on PATH."""

from pathlib import Path
import os
import shutil
import subprocess
import sys
import tempfile
import venv
import zipfile

root = Path(__file__).resolve().parents[1]


def run(command, **options):
    subprocess.run(command, check=True, **options)


with tempfile.TemporaryDirectory(prefix="cavi-python-package-") as temporary:
    temporary = Path(temporary)
    artifacts = temporary / "artifacts"
    run([sys.executable, "-m", "build", str(root), "--outdir", str(artifacts)])
    wheels = list(artifacts.glob("*.whl"))
    archives = list(artifacts.glob("*.tar.gz"))
    if len(wheels) != 1 or len(archives) != 1:
        raise RuntimeError("Expected one wheel and one source archive")
    with zipfile.ZipFile(wheels[0]) as wheel:
        names = wheel.namelist()
        if "cavi_runtime/py.typed" not in names or any(
            "/tests/" in p or "__pycache__" in p for p in names
        ):
            raise RuntimeError("Invalid Python artifact contents")
    environment = temporary / "venv"
    venv.create(environment, with_pip=True)
    scripts = environment / ("Scripts" if os.name == "nt" else "bin")
    python = scripts / ("python.exe" if os.name == "nt" else "python")
    run([str(python), "-m", "pip", "install", str(wheels[0])])
    run(
        [
            str(python),
            "-c",
            "import importlib.util; from cavi_runtime import create_runtime_client; "
            "assert importlib.util.find_spec('websockets') is None; "
            "client = create_runtime_client('codex-responses', api_key='test'); "
            "import asyncio; asyncio.run(client.close())",
        ],
        cwd=temporary,
    )
    run([str(python), "-m", "pip", "install", str(wheels[0]) + "[openclaw]"])
    tests = temporary / "tests"
    tests.mkdir()
    shutil.copy2(root / "tests/test_native.py", tests / "test_native.py")
    shutil.copy2(root / "tests/lifecycle-cases.json", tests / "lifecycle-cases.json")
    env = {
        **os.environ,
        "PATH": str(scripts),
        "CAVI_ASSERT_NO_NODE": "1",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    env.pop("PYTHONPATH", None)
    run(
        [str(python), "-m", "unittest", "discover", "-s", str(tests), "-v"],
        cwd=temporary,
        env=env,
    )
    print("Installed Python wheel passed without Node or npm")
