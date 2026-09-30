# 개발·검증 상태

2026-09-30. 첫 오프라인 기술 검증 진행 중. 기능 코드가 있다는 것과 실기기 검증 완료는 구분한다.

## 구현

- React Native / Expo / MapLibre 공통 앱과 iOS·Android 설정.
- 서울숲 OSM 원본 확보, 1,249개 지형 요소·17개 지명 포함 자체 패키지 595,187 bytes.
- 합성 GPX 1개를 패키지에 포함. 외부 계정/키 없음.
- 다운로드·취소·재시도·삭제, SHA-256·스키마·GPX 검증, 임시 저장 후 이동, 로컬 재실행 복원.
- 도로·건물·공원·수계·한글 지명·GPX 표시, 전경 위치·정확도·오래된 위치·권한 안내.
- 기기 위치 서버 전송 없음. 앱은 공개 Overpass/OSM 타일 서버를 호출하지 않음.

## 검증 기록

| 항목 | 상태 | 근거/한계 |
|---|---|---|
| TypeScript | 통과 | `scripts/dev.sh typecheck` |
| 도메인·저장 테스트 | 18개 통과 | GPX 오류·다중구간·손상 패키지·디스크 실패·동시 작업·새 인스턴스 복원 |
| 실제 파일시스템 복원 | 통과 | 임시 파일은 무시하고 완료된 파일만 새 저장소 인스턴스에서 읽음 |
| HTTP 다운로드 | 통과 | localhost:8787 수신 결과 SHA-256이 카탈로그와 동일 |
| iOS JS 번들 | 통과 | Expo export, 727 modules, Hermes bundle 생성 |
| Android JS 번들 | 통과 | Expo export, 725 modules, Hermes bundle 생성 |
| 네이티브 프로젝트 생성 | 양쪽 통과 | Expo prebuild --no-install |
| Android 네이티브 Release | 통과 | assembleRelease ARM64, BUILD SUCCESSFUL, 가상 기기 설치·실행 성공 |
| Android 가상 기기 | 재검증 보류 | adb로 다운로드·지도 표시 확인. 오프라인 재실행 시 위치 권한 반복 요청 발견 → 코드 수정·Release 재빌드. 수정 후 재실행 검증은 사용자 요청으로 건너뜀 |
| iOS 네이티브 빌드 | 통과 | iOS26.4 시뮬레이터 Release, BUILD SUCCEEDED |
| iOS 시뮬레이터 다운로드·렌더링 | 통과 | iPhone17에서 581KiB 실제 HTTP 다운로드, 지도·한글·GPX 표시 |
| iOS 서버 종료 후 콜드 스타트 | 통과 | 데이터 서버 종료 및 curl 연결 실패 확인. 앱 terminate/launch 후 로컬 지도·경로·주입 좌표 표시 |
| iOS 네트워크 전체 차단 | 미검증 | 서버 종료 시험과 구분. 실제 아이폰 비행기 모드 시험 필요 |
| iPhone 실기기 | 미검증 | 연결된 기기 없음. 계정 서명·신뢰·개발자 모드·실외 GPS는 사용자 기기 필요 |
| Android 실기기 | 미검증 | 출시 전 별도 검증 필요 |

## 해결한 문제/남은 제약

- 빈 저장소에서 시작. 기본 PATH에 Node/Flutter/Java가 없어 내장 Node와 프로젝트 전용 Android 도구 사용.
- Xcode CommandLineTools 선택 상태였으므로 시스템 전역 설정 대신 DEVELOPER_DIR 지정.
- Expo 초기화 도구가 npm 부재로 실패하여 공식 템플릿 아카이브를 사용.
- 테스트의 CommonJS top-level await 오류 수정. 테스트용 Node 타입 명시.
- 기본 Ruby 2.6과 최신 gem 의존성 비호환: 호환 버전 설치 완료. 소스 빌드로 iOS Release 성공.
- 네이티브 빌드, 콜드 스타트, 렌더링, 기기 GPS는 자동 단위 테스트만으로 완료 판정하지 않음.
- 약 581KiB 단일 파일. 바이트 진행률/부분 재개, 임의 영역, 다중 코스, 웹은 후속 단계.
- 다운로드 서버는 로컬 개발용 HTTP. 배포에서는 HTTPS와 새 빌드 설정 필요.

## 실행 화면

- `docs/screenshots/ios-downloaded.png`
- `docs/screenshots/ios-server-off-relaunch.png`

테스트 위치는 서울숲 좌표를 주입한 결과다. 실외 GNSS 측정 결과가 아니다.

## 2026-09-30 후속 작업

- 사용자 요청으로 Android 테스트 중단. `android-offline-relaunch.png`는 실패 시점 캡처이며 성공 증거가 아니다. 최신 코스 화면은 Android에서 빌드/실행하지 않았다.
- 전경 전환 때 위치 권한을 다시 요청하지 않도록 분리했다. 권한 요청은 사용자 버튼에서만 실행하고 중복 요청을 막는다.
- 단일 샘플의 지도 / 코스 목록 / 저장한 코스 탭 추가. 검증된 패키지가 있어야 저장 건수와 오프라인 사용 가능 상태에 반영된다. 새 서버/API나 다중 코스는 추가하지 않았다.
- `./scripts/dev.sh typecheck`: 통과. 도메인 로직은 이번 UI 변경에서 수정하지 않음; 기존 18개 통과 기록 유지.
- `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun devicectl list devices`: 권한 환경 밖에서 재시도했으나 No provider was found / No devices found. 실기기 연결·서명·설치는 미완료.
- `docs/device-testing.md`에 iPhone Release 설치와 LAN 다운로드 절차 추가.

### 이번 변경 검증 결과

- iOS: `xcodebuild -workspace app.xcworkspace -scheme app -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,id=2B45A142-76BD-4FD5-BC30-5C4103872A11' -derivedDataPath .tools/ios-derived CODE_SIGNING_ALLOWED=NO` (실행 시 derivedDataPath는 프로젝트 절대 경로): exit 0, BUILD SUCCEEDED. Release 빌드에 최신 iOS JS 번들 포함. 로그 `.tools/ios-build.log`.
- `xcrun simctl install … app.app` / `launch … dev.gilmap.prototype`: 성공. iPhone17 / iOS26.4에서 코스 목록·저장한 코스 탭 전환, 저장 1개·0.89km·오프라인 사용 가능 표시 확인. 캡처 `docs/screenshots/ios-saved-courses.png`.
- `curl -I --max-time 2 http://localhost:8787/seoul-forest-v1.json`: exit 7, 서버 연결 실패 상태 확인.
- `simctl terminate` → `simctl location … set 37.5444,127.0378` → `simctl launch`: 서버 없이 지도·한글·주황색 GPX·파란 테스트 위치 표시. 실제 GPS 및 통신 전체 차단 결과는 아님.
- 새 목록의 미저장 빈 상태는 코드/타입 검사만 확인, 이번 시뮬레이터 시나리오에서는 저장 데이터를 삭제하지 않아 UI 실측하지 않음.
- 다음 작업: iPhone 연결 및 본인 Team 서명 후 Release 설치, 비행기 모드 콜드 스타트·실외 GPS·위치 권한 거부 검증. 핵심 현장 검증이 끝난 뒤 복수 코스와 웹 미리보기 확장.

## 전국 온라인 지도 확장 (2026-09-30)

- 전국 온라인 / 저장 지역 오프라인 모드 전환 추가. 온라인은 공식 OpenFreeMap Liberty 스타일, 오프라인은 자체 파일 전용. 전국 타일 대량 다운로드 없음.
- 저장 데이터 없는 상태에도 온라인 지도/GPS를 표시하도록 연결. 저장 데이터 복원 중에는 온라인 지도 생성을 대기하고, 저장 데이터가 있으면 로컬 지도 우선 진입.
- 내 위치 버튼은 최신 위치로 이동하고, 위치 수신 대기 상태면 다음 수신 좌표로 이동. 온라인에서는 저장 영역 밖 안내를 표시하지 않음.
- `./scripts/dev.sh typecheck`: 통과. `./scripts/dev.sh test`: 첫 실행 IPC EPERM → 권한 환경에서 재실행, 18개 통과.
- iOS Release `xcodebuild` (앞선 동일 명령): 성공. 최초 simctl 설치는 시뮬레이터 Shutdown으로 실패 → boot/bootstatus 후 install/launch 성공.
- iPhone17/iOS26.4: 저장 지도 초기 진입, 전국 모드 실제 지도/한글 지명 표시 확인. 부산 테스트 좌표 `35.1796,129.0756` 주입 후 내 위치 이동·주변 온라인 상세 지도·파란 점 확인 (`docs/screenshots/ios-online-busan.png`). 실제 GPS 수신은 아님.
- 초기 전국 화면이 잘리는 문제를 발견하여 고정 줌 대신 대한민국 경계 맞춤으로 수정 후 Release 재빌드 성공.
- Android는 사용자 요청으로 번들/빌드/실행 검증하지 않음. iPhone 실기기, 최초 설치의 미저장 상태, 온라인 연결 실패 UI와 통신 전체 차단은 추가 확인 필요.
- 최종 수정 빌드 설치 후 전국 초기 화면에서 서울~제주 범위 표시, 전국 → 저장 지역 전환 및 로컬 지도 복귀 확인.

## 코스 목록·추천 UI (2026-09-30)

- `App.tsx`: 코스 목록을 전체/트레킹/자전거/데이트 필터 + FlatList로 변경. 저장한 코스도 동일한 작은 행으로 표시(기본 글꼴 기준 약 90pt, 큰 글꼴은 자연 확장).
- 온라인 지도 하단 개발 상태 패널을 기본 닫힌 디버그 토글로 이동. 지도 오류 메시지는 토글 밖에 유지. 지도 높이는 남는 공간에 맞춰 확대.
- 추천 TOP5 가로 스냅 슬라이드·페이지 표시·이전/다음 버튼 추가. `src/courseCatalog.ts`는 UI 예시 데이터다. 서울숲 합성 샘플만 다운로드 가능하고 4개 미등록 예시는 안내만 제공한다. 실제 이용 통계나 운영 추천을 조작해 표시하지 않는다.
- `./scripts/dev.sh typecheck`: 통과. 첫 iOS Release xcodebuild 성공 후 설치·실행. 도메인 변경 없음; 도메인 테스트 18개는 앞선 실행 결과이며 이번 UI 작업에서 재실행하지 않음.
- iPhone17/iOS26.4: 전체 5행, 자전거 필터 1행, 저장 코스 1행, 전국 지도 확대, 디버그 펼침 확인.
- CUA scroll/drag는 noWindowsAvailable 오류. 탭/버튼 AX 클릭은 정상. 손가락 스와이프 검증과 실기기/Android 검증은 이번 결과에 포함하지 않는다.
- 최종 iOS Release 재빌드 성공, 재설치 후 추천 다음 버튼: 1→2 페이지·실제 카드 이동 확인, 이전 버튼: 2→1 복귀 및 첫 페이지 이전 버튼 비활성 확인. 캡처 `docs/screenshots/ios-map-recommendations.png`.
- 실제 추천 순위 API/사용량 집계는 미구현. 요청한 UI는 예시 데이터로 확인했고, 운영 코스 등록은 후속 작업이다. Android 테스트는 요청대로 건너뜀.

## 웹 첫 구현 (2026-09-30)

- `apps/web`: Vite 8.3.1 / TypeScript / MapLibre GL JS 6.11.2, 테마 필터·이름/지역 검색·반응형 코스 목록·지도 미리보기·앱 연결 안내창·웹 링크 복사 추가. 모바일의 코스 메타데이터를 함께 사용한다.
- 서울숲 원본 샘플 GPX에서 미리보기 좌표만 `src/preview.json`으로 추출. 웹 dist에 GPX 원문/지역 패키지 미포함, 파일 다운로드 버튼/API 없음. 미리보기 좌표는 공개 클라이언트 데이터다.
- 공식 MapLibre GeoJSON line 및 Expo linking 문서 확인 후 구현. 온라인 배경은 기존 OpenFreeMap 제공 조건을 적용.
- `pnpm --dir apps/web install`, `./scripts/web.sh build`: 통과. 첫 빌드의 MapLibre default import/CSS 타입 오류 수정. 첫 브라우저 실행에서 worker URL 로딩 실패 → Vite `?worker&url`로 워커/의존성 번들 수정, 실제 지도·경로 표시 확인.
- 빌드 경고: 지도 라이브러리 포함 JS 약 1.05MB(gzip 285KB), 별도 worker 약 510KB. 실패는 아니며 로딩 성능 최적화는 후속 항목.
- 브라우저 확인: 자전거 필터 1개, 존재하지 않는 검색어의 빈 결과, 서울 검색, 앱 연결 안내창. 1280/390px 너비에서 가로 넘침 없음. 데스크톱/모바일 스크린샷 저장. 일부 도구 클릭이 적용되지 않아 키보드 Enter로 기능 확인.
- `./scripts/dev.sh typecheck` 및 iOS Release xcodebuild 성공. 앱은 `gilmap://course/seoul-forest-v1`만 처리. simctl이 Shutdown 상태여서 boot 후 재시도, 콜드 링크 실행 및 코스 목록 화면에서 웜 링크로 지도 전환 확인. 실제 iPhone Safari→앱 전환은 미검증.
- 로컬 미리보기 `http://127.0.0.1:4173/` 실행 중. 공개 호스팅/도메인/스토어 링크/Universal Links는 미구현. Android 검증은 계속 보류.
- 다음 작업: 실제 코스 데이터 등록, 웹 공개 배포 대상 결정, 실제 iPhone 브라우저에서 링크·오프라인 동작 검증. 클립보드 복사 권한 실패 분기는 구현했으나 실제 복사 성공은 이번 검증에 포함하지 않음.

## 국내 GPX 수집 가능성 조사 (2026-09-30)

- 공식 공공데이터포털/서울둘레길 자료실/서울시 저작권 정책 확인. 결과 `docs/gpx-sources.md`.
- 두루누비: 무료·이용허락범위 제한 없음·284개 코스 GPX 정보, 인증키 필요. 키 없이 실제 API 수집은 수행하지 않음.
- 서울둘레길 공식 GPX ZIP 존재 확인. 개별 재배포 허락 미확인으로 서비스 편입하지 않음. 다운로드 링크는 웹 도구에서 바이너리 형식 지원 오류, 로컬 파일 수집으로 간주하지 않음.
- 이번 조사에서 실제 코스 목록 추가는 0개. 인증키/이용허락 확인 이후 소량 수집·검증·복수 경로 저장 구조 확장이 필요.

## GitHub 저장소 준비 (2026-09-30)

- 사용자 지정 원격 `https://github.com/hanj0704/maps.git` 확인: 기존 refs 없음.
- main 초기화. 환경파일·인증서·키스토어·네이티브 생성물·도구 캐시 제외. 업로드 후보 61개 약 8.6MB, 비밀키 패턴 검사 발견 0건, diff --check 통과.
- 프로젝트에 포함된 지도 원본은 공개 OSM, GPX는 합성 샘플이다. 실제 사용자 이동 기록은 포함하지 않는다.
- Git 작성자 설정이 없어 저장소 로컬에 GitHub 계정 hanj0704와 GitHub noreply 주소 사용. 전역 Git 설정은 변경하지 않는다.
- 웹 공개 호스팅은 아직 연결하지 않음. GitHub 소스 업로드와 웹 배포는 별개다.
- 첫 커밋 생성 완료. `GIT_TERMINAL_PROMPT=0 git push -u origin main`은 GitHub 인증정보 부재(`could not read Username`)로 실패. 원격 업로드 미완료; 로컬 HTTPS Git 인증 또는 GitHub Desktop 로그인 후 재시도 필요. 토큰을 채팅으로 요청하지 않는다.

## GitHub 인증·배포 연결

- 브라우저 인증 후 hanj0704 계정 확인. `git push -u origin main` 성공.
- GitHub Pages workflow 배포 활성화. 웹 빌드만 업로드하며 원본 GPX/지도 패키지는 Pages 산출물에서 제외.
- `/maps/` 기준 경로와 홈 링크 수정, TypeScript 및 Pages 경로 빌드 통과. 최초 로컬 빌드 명령의 작업 경로 오류 수정 후 재실행.
- 공개 주소: https://hanj0704.github.io/maps/ (배포 결과 확인은 후속 기록).
