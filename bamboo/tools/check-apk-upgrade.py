"""Exercise the distributed, signed APKs on the CI emulator when a release is staged."""
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
def numbers(path):
    return tuple(map(int, path.stem.removeprefix("Zov-Lesa-Android-").split(".")))

previous = max((p for p in releases.glob("Zov-Lesa-Android-*.apk") if numbers(p) < numbers(target)), key=numbers)
def adb(*args):
    return subprocess.check_output(["adb", *map(str, args)], text=True)

adb("uninstall", package)  # Remove only the instrumentation build on the disposable emulator.
assert "Success" in adb("install", previous)
assert "Success" in adb("install", "-r", target)
info = adb("shell", "dumpsys", "package", package)
assert f"versionName={version}" in info and f"versionCode={feed['build']} " in info
assert "Status: ok" in adb("shell", "am", "start", "-W", "-n", package+"/.MainActivity")
print(f"Verified in-place upgrade from {previous.name} to {target.name}")
