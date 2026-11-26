"""Exercise the distributed, signed APKs on the CI emulator when a release is staged."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[2]
releases = root / "releases/zov-lesa"
feed = json.loads((releases / "manifest.json").read_text())["android"]
version = re.search(r"versionName '([^']+)'", (root / "bamboo/android/app/build.gradle").read_text())[1]
if feed["version"] != version:
    print("Signed package for this source version is still being built.")
    raise SystemExit(0)

package = "org.biovision.zovlesa"
target = releases / feed["url"].rsplit("/", 1)[1]
assert target.name == f"Zov-Lesa-Android-{version}.apk"
assert target.stat().st_size == feed["size"]
assert hashlib.sha256(target.read_bytes()).hexdigest() == feed["sha256"]
def numbers(path):
    return tuple(map(int, path.stem.removeprefix("Zov-Lesa-Android-").split(".")))

previous = sorted(
    (p for p in releases.glob("Zov-Lesa-Android-*.apk") if numbers(p) < numbers(target)),
    key=numbers,
)[-2:]
assert previous, "No earlier signed package to upgrade"
def adb(*args):
    return subprocess.check_output(["adb", *map(str, args)], text=True)

for old in previous:
    adb("uninstall", package)  # Disposable emulator only; the upgrade below retains app data.
    assert "Success" in adb("install", old)
    assert "Status: ok" in adb("shell", "am", "start", "-W", "-n", package + "/.MainActivity")
    assert "Success" in adb("install", "-r", target)
    info = adb("shell", "dumpsys", "package", package)
    assert f"versionName={version}" in info and f"versionCode={feed['build']} " in info
    assert "Status: ok" in adb("shell", "am", "start", "-W", "-n", package + "/.MainActivity")
    print(f"Verified in-place upgrade from {old.name} to {target.name}")

# Check release discovery from the previous signed version on this disposable emulator.
adb("uninstall", package)
subprocess.run(["python3", str(root / "bamboo/tools/check-198-published-update.py")], check=True)
