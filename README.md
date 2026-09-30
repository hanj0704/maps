# 길을 담다 — 오프라인 지도 기술 검증

한국 코스 탐색 서비스의 첫 모바일 프로토타입입니다. React Native + Expo + MapLibre로 iOS/Android를 함께 지원하도록 구성했습니다. 외부 지도 계정이나 API 키 없이 **실제 서울숲 OSM 데이터**를 자체 패키지로 내려받아 사용합니다.

현재 범위: 지도·코스 목록·저장한 코스 화면, 작은 고정 지역, 합성 GPX 1개, 다운로드/취소/재시도/삭제, 무결성 검증, 재시작 시 로컬 복원, 지도·한글 지명·경로·전경 위치 표시. 전국 온라인 지도(OpenFreeMap)와 저장 지역 지도를 전환할 수 있습니다. 추천 코스, 웹, 백그라운드 위치 기록은 아직 구현하지 않았습니다.

- [기술 비교와 선택](docs/architecture.md)
- [제품 범위](SPEC.md)
- [실제 검증 결과](STATUS.md)
- [기기 검증 절차](docs/device-testing.md)
- [지도 데이터 라이선스](data/LICENSE.md)

## 빠른 검증

Node 22.13 이상과 pnpm이 필요합니다. 현재 Mac에서는 `scripts/dev.sh`가 Codex에 포함된 Node를 찾아 사용합니다.

```sh
./scripts/dev.sh typecheck
./scripts/dev.sh test
./scripts/dev.sh export
```

새 환경에서 의존성 설치: `cd apps/mobile && pnpm install --frozen-lockfile`.

## 지도 다운로드 서버

```sh
python3 scripts/serve-data.py --host 0.0.0.0
```

이 개발 서버는 `data/`만 제공합니다. 아이폰을 같은 Wi-Fi에 연결하고 앱의 서버 주소에 `http://MAC의-IP:8787`을 입력합니다. iOS 시뮬레이터는 `http://localhost:8787`, Android 에뮬레이터는 `http://10.0.2.2:8787`을 사용합니다. 폰에서 localhost는 Mac이 아니라 폰 자체입니다.

앱에서 ‘지도와 경로 다운로드’를 눌러야 저장됩니다. 지리 데이터는 앱에 번들하지 않았으며 실제 HTTP 다운로드 흐름을 사용합니다. 다운로드한 하나의 JSON 패키지에는 지도 GeoJSON과 GPX 원문이 모두 들어 있습니다. SHA-256이 앱의 카탈로그와 다르면 저장하지 않습니다.

## 네이티브 앱 빌드

MapLibre는 Expo Go에서 실행되지 않습니다. Xcode / CocoaPods 및 Android SDK / JDK가 필요합니다.

```sh
ALLOW_LOCAL_HTTP=1 ./scripts/dev.sh prebuild
ALLOW_LOCAL_HTTP=1 ./scripts/dev.sh ios --configuration Release --device
ALLOW_LOCAL_HTTP=1 ./scripts/dev.sh android --variant release
```

Release 빌드는 JS 코드를 내장하므로 개발 서버가 없어도 재실행 가능합니다. 개발용 Debug 빌드만으로 오프라인 콜드 스타트 완료를 판정하지 마세요.

`ALLOW_LOCAL_HTTP=1`은 로컬 HTTP 데이터 서버 테스트용 예외입니다. 배포 시 HTTPS 서버를 사용하고 이 값을 제거한 상태에서 prebuild를 다시 실행해야 합니다. 외부 계정이 필요 없다는 뜻이지, 서비스 운영 시 데이터 호스팅 비용까지 없는 것은 아닙니다.

iPhone: Apple 계정으로 Xcode Signing Team을 선택하고 아이폰의 신뢰/개발자 모드를 활성화합니다. 개인 계정의 설치 만료 제한은 Apple 정책을 따릅니다. 비밀번호/서명 자료는 저장소에 넣지 않습니다.

## 데이터 재생성

현재 원본 스냅샷이 `fixtures/`에 있으므로 재생성은 네트워크 없이 가능합니다.

```sh
./scripts/dev.sh prepare-data
```

`apps/mobile/scripts/prepare-data.cjs`가 GeoJSON·샘플 GPX·카탈로그 해시를 생성합니다. 원본 갱신이 필요할 때만 `scripts/seoul-forest.overpass` 쿼리를 Overpass에 요청합니다. 출시 앱의 백엔드로 공개 Overpass 인스턴스를 사용하지 않습니다.

이번 지도는 경계 안에서 교차하는 OSM 요소를 추출한 소규모 데모입니다. 일부 도형은 경계 밖까지 이어질 수 있습니다. POI/지형/등산로의 완전성, 모든 공공데이터 호환성, 실외 길찾기 정확도를 보장하지 않습니다. 확장 시 지역별 벡터 타일과 업데이트 전략을 검증합니다.

## 웹 코스 미리보기

`apps/web`에 Vite + TypeScript + MapLibre GL JS 웹을 추가했습니다. 테마 필터·검색·코스 지도·앱 연결 안내를 제공합니다. GPX 다운로드 버튼이나 파일 제공 API는 없습니다. 서울숲 합성 경로의 미리보기 좌표만 웹에 포함됩니다. 웹 지도에 보이는 좌표 자체는 브라우저가 받는 공개 데이터입니다.

```sh
./scripts/web.sh build
./scripts/web.sh preview
```

로컬 주소: http://127.0.0.1:4173/ (개발 모드는 `./scripts/web.sh dev`). 새 환경은 `cd apps/web && pnpm install --frozen-lockfile` 후 실행합니다. 배포 산출물은 `apps/web/dist`이며 아직 공개 호스팅하지 않았습니다.

웹의 `gilmap://course/seoul-forest-v1` 링크는 설치된 테스트 앱의 서울숲 화면을 엽니다. 미설치 시 안내를 제공하며, 스토어 출시 링크/Universal Links는 도메인과 배포 계정 확정 후 추가합니다. 원본 GPX와 오프라인 지도 패키지는 웹 배포 폴더에 복사하지 않습니다.

## 공개 웹 배포

공개 주소: https://hanj0704.github.io/maps/

`main`의 웹 소스/공통 코스 목록 변경 시 `.github/workflows/web-pages.yml`이 웹을 빌드해 GitHub Pages에 배포합니다. Pages에는 `apps/web/dist`만 올라갑니다. 로컬 실행은 루트 경로, Pages 빌드는 `/maps/` 경로를 사용합니다.
