"""Exercise the public feed through an unmodified, previously released APK."""
from pathlib import Path
import hashlib
import json
import re
import urllib.request
import subprocess
import time
import xml.etree.ElementTree as ET

evidence = Path("/tmp/widget-previews/published-update")
evidence.mkdir(parents=True, exist_ok=True)
package = "org.biovision.zovlesa"


def adb(*args):
    return subprocess.check_output(["adb", *args], timeout=30)


def shell(*args):
    return adb("shell", *args).decode()


def nodes():
    for attempt in range(4):
        shell("uiautomator", "dump", "/sdcard/zov-current.xml")
        try:
            xml = adb("exec-out", "cat", "/sdcard/zov-current.xml")
            root = ET.fromstring(xml)
            (evidence / "screen.xml").write_bytes(xml)
            return list(root.iter("node"))
        except ET.ParseError:
            time.sleep(1)
    raise AssertionError("Could not read Android accessibility hierarchy")


def label(node):
    return [node.get(k, "").strip() for k in ("text", "content-desc")]


def center(node):
    x1, y1, x2, y2 = map(int, re.findall(r"-?\d+", node.get("bounds")))
    if x2 <= x1 or y2 <= y1:
        return None
    return str((x1 + x2) // 2), str((y1 + y2) // 2)


def control(rows, name):
    return next((n for n in rows if name in label(n) and center(n)), None)


def click(node, description):
    x, y = center(node)
    print("Tap:", description, x, y, flush=True)
    shell("input", "tap", x, y)
    time.sleep(1)


def contents(rows):
    return " | ".join(v for n in rows for v in label(n) if v)


def run():
    feed = "https://kopejkingeorgij09-web.github.io/BioVision/releases/zov-lesa/manifest.json"
    for attempt in range(75):
        with urllib.request.urlopen(feed + "?test=" + str(time.time_ns()), timeout=25) as response:
            if json.load(response)["android"]["build"] == 27:
                break
        time.sleep(10)
    else:
        raise AssertionError("Android 1.5.19 not available in the public feed")
    shell("input", "keyevent", "82")
    shell("wm", "size", "1800x1700")
    shell("wm", "density", "240")
    assert shell("getprop", "ro.build.version.sdk").strip() == "35"
    adb("uninstall", package)
    adb("install", "releases/zov-lesa/Zov-Lesa-Android-1.5.18.apk")
    info = shell("dumpsys", "package", package)
    assert "versionName=1.5.18" in info and "versionCode=26 " in info
    first_install = re.search(r"firstInstallTime=(.+)", info)[1].strip()
    shell("pm", "grant", package, "android.permission.POST_NOTIFICATIONS")
    shell("am", "start", "-W", "-n", package + "/.MainActivity")
    for _ in range(30):
        rows = nodes()
        if any("Quickstep isn't responding" in text for node in rows for text in label(node)):
            button=control(rows,"Close app")
            if button is not None:
                click(button,"Close stalled emulator launcher")
            shell("am","start","-W","-n",package+"/.MainActivity")
            continue
        settings = control(rows, "Настройки")
        if settings is not None:
            click(settings, "Настройки")
            break
        more = control(rows, "Ещё")
        if more is not None:
            click(more, "Ещё")
        time.sleep(1)
    else:
        raise AssertionError("Settings unavailable: " + contents(rows))

    for _ in range(12):
        rows = nodes()
        check = control(rows, "Проверить обновления")
        if check is not None:
            click(check, "Проверить обновления")
            break
        shell("input", "swipe", "900", "1400", "900", "600", "430")
    else:
        raise AssertionError("Update button unavailable: " + contents(rows))

    for _ in range(15):
        rows = nodes()
        shown = contents(rows)
        if "Доступна версия 1.5.19" in shown and "Скачать и установить" in shown:
            print("PASS: Android 15, installed 1.5.18, Settings button offers 1.5.19 and installation.")
            (evidence / "offer.xml").write_bytes((evidence / "screen.xml").read_bytes())
            (evidence / "offer.png").write_bytes(adb("exec-out", "screencap", "-p"))
            break
        time.sleep(1)
    else:
        raise AssertionError("Expected the published version: " + shown)
    base = "https://kopejkingeorgij09-web.github.io/BioVision/releases/zov-lesa/"
    with urllib.request.urlopen(base + "manifest.json", timeout=60) as res:
        item = json.load(res)["android"]
    assert item["version"] == "1.5.19" and item["build"] == 27, item
    assert item["url"] == base + "Zov-Lesa-Android-1.5.19.apk", item
    with urllib.request.urlopen(item["url"], timeout=90) as res:
        apk = res.read()
    assert len(apk) == item["size"] and hashlib.sha256(apk).hexdigest() == item["sha256"]
    target = Path("/tmp/zov-live-1.5.19.apk")
    target.write_bytes(apk)
    assert b"Success" in adb("install", "-r", str(target))
    current = shell("dumpsys", "package", package)
    assert "versionName=1.5.19" in current and "versionCode=27 " in current
    assert re.search(r"firstInstallTime=(.+)", current)[1].strip() == first_install
    assert "Status: ok" in shell("am", "start", "-W", "-n", package + "/.MainActivity")
    print("PASS: publicly downloaded signed APK upgraded 1.5.18 to 1.5.19 build 27 in place and launched. SHA-256", item["sha256"])


try:
    run()
finally:
    (evidence / "screen.png").write_bytes(adb("exec-out", "screencap", "-p"))
