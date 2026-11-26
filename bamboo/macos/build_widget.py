import plistlib
import subprocess
from pathlib import Path

def build_widget(app, version, build, scratch):
    bundle = app / 'Contents/PlugIns/Focus.appex/Contents'
    binary = bundle / 'MacOS/FocusWidget'
    binary.parent.mkdir(parents=True, exist_ok=True)
    props = dict(CFBundleIdentifier='org.biovision.zovlesa.mac.focus', CFBundleExecutable='FocusWidget',
                 CFBundleDisplayName='Фокус · Зов леса', CFBundleName='FocusWidget', CFBundlePackageType='XPC!',
                 CFBundleInfoDictionaryVersion='6.0', CFBundleVersion=build, CFBundleShortVersionString=version,
                 CFBundleDevelopmentRegion='ru', LSMinimumSystemVersion='14.0',
                 NSExtension={'NSExtensionPointIdentifier': 'com.apple.widgetkit-extension'})
    (bundle/'Info.plist').write_bytes(plistlib.dumps(props))
    slices = []
    for arch in ['arm64','x86_64']:
        target = scratch/('FocusWidget-'+arch)
        subprocess.run(['xcrun','swiftc','-parse-as-library','-application-extension','-O','-target',
                        arch+'-apple-macosx14.0',str(Path(__file__).with_name('FocusWidget.swift')),'-o',target],check=True)
        slices.append(target)
    subprocess.run(['lipo','-create',*slices,'-output',binary],check=True)
    group = {'com.apple.security.application-groups':['group.org.biovision.zovlesa.focus']}
    entitlements = scratch/'widget.plist'
    entitlements.write_bytes(plistlib.dumps({**group,'com.apple.security.app-sandbox':True}))
    subprocess.run(['codesign','--force','--sign','-','--entitlements',entitlements,bundle.parent],check=True)
    app_entitlements=scratch/'app.plist'
    app_entitlements.write_bytes(plistlib.dumps(group))
    return app_entitlements
