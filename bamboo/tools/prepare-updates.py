"""Prepare public update files; signing keys remain outside the repository."""
from pathlib import Path
import argparse,hashlib,json,shutil,re,plistlib,zipfile
p=argparse.ArgumentParser();p.add_argument('--android',type=Path,required=True);p.add_argument('--macos',type=Path,required=True);args=p.parse_args()
repo=Path(__file__).resolve().parents[2];out=repo/'releases/zov-lesa';out.mkdir(parents=True,exist_ok=True)
gradle=(repo/'bamboo/android/app/build.gradle').read_text();av=re.search(r"versionName '([^']+)'",gradle)[1];ab=int(re.search(r'versionCode (\d+)',gradle)[1])
with zipfile.ZipFile(args.macos) as z:
 info=plistlib.loads(z.read(next(name for name in z.namelist() if name.endswith('/Contents/Info.plist') and not name.startswith('__MACOSX/'))))
 assert info['CFBundleIdentifier']=='org.biovision.zovlesa.mac'
mv=info['CFBundleShortVersionString'];mb=int(info['CFBundleVersion'])
feed={'schema':1}
for platform,file,version,build,name in [('android',args.android,av,ab,'Zov-Lesa-Android-'+av+'.apk'),('macos',args.macos,mv,mb,'Zov-Lesa-macOS-'+mv+'.zip')]:
 shutil.copy2(file,out/name)
 feed[platform]={'version':version,'build':build,'url':'https://kopejkingeorgij09-web.github.io/BioVision/releases/zov-lesa/'+name,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'size':file.stat().st_size}
(out/'manifest.json').write_text(json.dumps(feed,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(feed,ensure_ascii=False,indent=2))
