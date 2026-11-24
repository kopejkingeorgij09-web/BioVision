from pathlib import Path
import subprocess, shutil, plistlib
repo=Path(__file__).resolve().parents[2]
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=Path.home()/'Downloads');args=parser.parse_args()
out=args.output/'Зов леса.app'
exe=out/'Contents/MacOS';resources=out/'Contents/Resources/Web'
exe.mkdir(parents=True,exist_ok=True);resources.mkdir(parents=True,exist_ok=True)
for name in ['bamboo','bioviz/x','shad']:
 dst=resources/name;dst.mkdir(parents=True,exist_ok=True)
 if name=='bamboo':
  for entry in ['style.css','calendar.css','alberts-plan.json','js','icons','manifest.webmanifest']:
   src=repo/name/entry
   if src.is_dir():shutil.copytree(src,dst/entry,dirs_exist_ok=True)
   else:shutil.copy2(src,dst/entry)
  html=(repo/name/'index.html').read_text();html='\n'.join(x for x in html.splitlines() if 'fonts.googleapis.com' not in x and 'fonts.gstatic.com' not in x)
  html=html.replace('</body>','<script src="app-updates.js"></script></body>');(dst/'index.html').write_text(html)
  shutil.copy2(repo/'bamboo/android/web/app-updates.js',dst/'app-updates.js')
 elif name=='shad':shutil.copy2(repo/name/'plan.json',dst/'plan.json')
 else:shutil.copy2(repo/name/'cloud.js',dst/'cloud.js')
info={'CFBundleIdentifier':'org.biovision.zovlesa.mac','CFBundleName':'Зов леса','CFBundleDisplayName':'Зов леса','CFBundleExecutable':'ZovLesa','CFBundlePackageType':'APPL','CFBundleShortVersionString':'1.1.8','CFBundleVersion':'13','LSMinimumSystemVersion':'12.0','NSHighResolutionCapable':True,'NSAppTransportSecurity':{'NSAllowsLocalNetworking':True}}
(out/'Contents/Info.plist').write_bytes(plistlib.dumps(info))
for arch in ['arm64','x86_64']:
 subprocess.run(['xcrun','swiftc',str(repo/'bamboo/macos/main.swift'),'-O','-target',arch+'-apple-macosx12.0','-framework','AppKit','-framework','WebKit','-framework','Network','-framework','CryptoKit','-o','/private/tmp/ZovLesa-'+arch],check=True)
subprocess.run(['lipo','-create','/private/tmp/ZovLesa-arm64','/private/tmp/ZovLesa-x86_64','-output',str(exe/'ZovLesa')],check=True)
subprocess.run(['codesign','--force','--deep','--sign','-',str(out)],check=True)
subprocess.run(['codesign','--verify','--deep','--strict',str(out)],check=True)
subprocess.run(['ditto','-c','-k','--sequesterRsrc','--keepParent',str(out),str(args.output/f"Zov-Lesa-macOS-{info['CFBundleShortVersionString']}.zip")],check=True)
print(out)
