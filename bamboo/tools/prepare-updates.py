"""Validate the release packages and stage both packages with the update feed."""

import argparse
import hashlib
import json
import plistlib
import re
import shutil
import subprocess
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASES = ROOT / "releases/zov-lesa"
PUBLIC_URL = "https://kopejkingeorgij09-web.github.io/BioVision/releases/zov-lesa/"


def command(tool_dir, name, *args):
    executable = tool_dir / name if tool_dir else name
    return subprocess.check_output([executable, *args], text=True)


def certificates(tool_dir, apk):
    output = command(tool_dir, "apksigner", "verify", "--print-certs", apk)
    found = re.findall(r"^Signer #\d+ certificate SHA-256 digest: (\S+)", output, re.MULTILINE)
    if not found:
        raise ValueError(f"No verified signing certificate in {apk.name}")
    return sorted(found)


def release_info(file, version, build, name):
    return {
        "version": version,
        "build": build,
        "url": PUBLIC_URL + name,
        "sha256": hashlib.sha256(file.read_bytes()).hexdigest(),
        "size": file.stat().st_size,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--android", type=Path, required=True)
    parser.add_argument("--macos", type=Path, required=True)
    parser.add_argument("--android-build-tools", type=Path, help="Directory with aapt2 and apksigner")
    args = parser.parse_args()
    old = json.loads((RELEASES / "manifest.json").read_text())

    gradle = (ROOT / "bamboo/android/app/build.gradle").read_text()
    av = re.search(r"versionName '([^']+)'", gradle)[1]
    ab = int(re.search(r"versionCode (\d+)", gradle)[1])
    badging = command(args.android_build_tools, "aapt2", "dump", "badging", args.android)
    expected = f"package: name='org.biovision.zovlesa' versionCode='{ab}' versionName='{av}'"
    if not badging.startswith(expected + " "):
        raise ValueError("Android application ID or version does not match build.gradle")
    previous = RELEASES / Path(old["android"]["url"]).name
    if certificates(args.android_build_tools, args.android) != certificates(args.android_build_tools, previous):
        raise ValueError("The Android signing certificate differs from the published update")

    with zipfile.ZipFile(args.macos) as archive:
        if archive.testzip() is not None:
            raise ValueError("The macOS archive is damaged")
        # ditto can store names as UTF-8 without setting the ZIP encoding flag.
        plists = [name for name in archive.namelist()
                  if name.endswith(".app/Contents/Info.plist") and not name.startswith("__MACOSX/")]
        if len(plists) != 1:
            raise ValueError("Expected one application bundle in the macOS archive")
        info = plistlib.loads(archive.read(plists[0]))
    if info["CFBundleIdentifier"] != "org.biovision.zovlesa.mac":
        raise ValueError("The macOS bundle identifier differs from the published update")
    mv, mb = info["CFBundleShortVersionString"], int(info["CFBundleVersion"])
    mac_build = (ROOT / "bamboo/macos/build.py").read_text()
    expected_mv = re.search(r"'CFBundleShortVersionString':\s*'([^']+)'", mac_build)[1]
    expected_mb = int(re.search(r"'CFBundleVersion':\s*'(\d+)'", mac_build)[1])
    if (mv, mb) != (expected_mv, expected_mb):
        raise ValueError("The macOS archive version does not match build.py")
    an, mn = f"Zov-Lesa-Android-{av}.apk", f"Zov-Lesa-macOS-{mv}.zip"
    feed = {
        "schema": 1,
        "android": release_info(args.android, av, ab, an),
        "macos": release_info(args.macos, mv, mb, mn),
    }
    for platform in ("android", "macos"):
        if feed[platform] == old[platform]:
            continue
        if feed[platform]["build"] <= old[platform]["build"] or feed[platform]["url"] == old[platform]["url"]:
            raise ValueError(f"{platform} needs a new update URL and a higher build for a changed package")

    for source, name in ((args.android, an), (args.macos, mn)):
        destination = RELEASES / name
        if source.resolve() != destination.resolve():
            shutil.copy2(source, destination)
    text = json.dumps(feed, ensure_ascii=False, indent=2) + "\n"
    (RELEASES / "manifest.json").write_text(text)
    print(text, end="")


if __name__ == "__main__":
    main()
