"""Reproducible UI smoke test on the dedicated MapsPrototype emulator only.
Requires the local data server on port 8787. Clears this prototype's test data.
"""
import argparse, pathlib, subprocess, time, xml.etree.ElementTree as ET, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
ADB=str(ROOT/'.tools/android-sdk/platform-tools/adb')
PACKAGE='dev.gilmap.prototype'
def adb(*args):
    return subprocess.check_output([ADB,*args],text=True,stderr=subprocess.STDOUT).strip()
def nodes():
    adb('shell','uiautomator','dump','/sdcard/maps-test.xml')
    return list(ET.fromstring(adb('shell','cat','/sdcard/maps-test.xml')).iter('node'))
def find(text, timeout=20, class_name=None):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        for n in nodes():
            if (n.get('text')==text or n.get('content-desc')==text) and (class_name is None or n.get('class')==class_name):return n
        time.sleep(0.5)
    raise AssertionError(f'UI text not found: {text}')
def tap_node(n):
    x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def tap(text):tap_node(find(text))
def shot(name):
    out=ROOT/'docs/screenshots'/name
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_bytes(subprocess.check_output([ADB,'exec-out','screencap','-p']))
def launch():adb('shell','am','start','-W','-n',PACKAGE+'/.MainActivity')
parser=argparse.ArgumentParser()
parser.add_argument('phase',choices=['download','offline','denied'])
args=parser.parse_args()
assert adb('emu','avd','name').splitlines()[0]=='MapsPrototype', 'Dedicated test emulator required'
if args.phase=='download':
    adb('shell','cmd','connectivity','airplane-mode','disable')
    adb('shell','svc','wifi','enable');adb('shell','svc','data','enable')
    adb('shell','pm','clear',PACKAGE)
    launch()
    tap_node(find('테스트 데이터 서버 주소',class_name='android.widget.EditText'))
    adb('shell','input','keycombination','113','29')
    adb('shell','input','text','http://10.0.2.2:8787')
    adb('shell','input','keyevent','66')
    tap('지도와 경로 다운로드');find('✓ 지도와 경로 저장 완료')
    tap('현재 위치 켜기');tap('While using the app')
    adb('emu','geo','fix','127.0378','37.5444')
    find('위치 수신 중')
    shot('android-downloaded.png')
    print('PASS: real HTTP download, validation, map display, location permission and injected fix')
elif args.phase=='offline':
    adb('shell','cmd','connectivity','airplane-mode','enable')
    adb('shell','svc','wifi','disable');adb('shell','svc','data','disable')
    assert adb('shell','settings','get','global','airplane_mode_on')=='1'
    try:adb('shell','ping','-c','1','-W','1','10.0.2.2')
    except subprocess.CalledProcessError:pass
    else:raise AssertionError('Network unexpectedly available')
    adb('shell','am','force-stop',PACKAGE);launch()
    find('✓ 지도와 경로 저장 완료')
    adb('emu','geo','fix','127.0380','37.5446');find('위치 수신 중')
    shot('android-offline-relaunch.png')
    adb('shell','input','keyevent','3');launch();find('✓ 지도와 경로 저장 완료')
    print('PASS: airplane mode, no host route, cold launch and foreground return with map/route/location')
else:
    adb('shell','pm','revoke',PACKAGE,'android.permission.ACCESS_FINE_LOCATION')
    adb('shell','pm','revoke',PACKAGE,'android.permission.ACCESS_COARSE_LOCATION')
    adb('shell','am','force-stop',PACKAGE);launch();find('✓ 지도와 경로 저장 완료')
    tap('현재 위치 켜기');tap('Don’t allow')
    find('위치 권한이 없습니다. 설정에서 위치 접근을 허용해주세요.')
    shot('android-permission-denied.png')
    print('PASS: permission rejection keeps offline map usable')
