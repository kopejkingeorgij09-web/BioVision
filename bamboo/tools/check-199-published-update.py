"""Exercise the public feed through an unmodified, previously released APK."""
from pathlib import Path
import re
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
    shell("input", "keyevent", "82")
    shell("wm", "size", "1800x1700")
    shell("wm", "density", "240")
    adb("install", "releases/zov-lesa/Zov-Lesa-Android-1.5.16.apk")
    info = shell("dumpsys", "package", package)
    assert "versionName=1.5.16" in info
    shell("pm", "grant", package, "android.permission.POST_NOTIFICATIONS")
    shell("am", "start", "-W", "-n", package + "/.MainActivity")
    for _ in range(15):
        rows = nodes()
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
        if "Доступна версия 1.5.17" in shown and "Скачать и установить" in shown:
            print("PASS: Android 15, installed 1.5.16, Settings button offers 1.5.17 and installation.")
            return
        time.sleep(1)
    raise AssertionError("Expected the published version: " + shown)


try:
    run()
finally:
    (evidence / "screen.png").write_bytes(adb("exec-out", "screencap", "-p"))
