# 기술 결정 — 2026-09-29

## 공식 문서 비교

| 기준 | Flutter | React Native + Expo |
|---|---|---|
| 오프라인 지도 | maplibre_gl이 iOS/Android 오프라인 영역 지원 | MapLibre React Native가 iOS/Android 오프라인 팩 및 GeoJSON 지원 |
| 위치 | geolocator 권한 요청·위치 스트림, 필요시 네이티브 채널 | expo-location 권한 요청·watchPositionAsync, 필요시 네이티브 모듈 |
| 유지보수 | Dart·Flutter·플러그인·플랫폼 버전 호환 관리 | TypeScript·Expo·RN·지도 네이티브 버전 호환 관리 |
| 이후 웹 | Dart 앱과 웹 API 계약 공유 | React 웹과 TypeScript 도메인·검증 코드를 직접 공유하기 쉬움 |

**React Native + Expo + MapLibre** 선택. 두 프레임워크 모두 가능하며 속도/배터리 우열은 측정하지 않았다. 선택 이유는 후속 웹과 데이터 코드 공유, 지도 SDK API 및 Expo의 플랫폼 설정 관리다. Expo Go는 MapLibre 네이티브 모듈을 포함하지 않으므로 사용하지 않는다.

## 계정 없는 자체 데이터 방식

사용자 요청에 따라 지도 서비스 계정·키 없이 동작한다. 서울숲 약 1.7 × 1.4km 경계에 대한 OSM 원본을 개발 시 Overpass에 **한 번** 요청하고, 자체 패키지를 생성한다. 앱은 Overpass나 OSM 타일 서버에 요청하지 않는다.

`원본 OSM → 재현 가능한 GeoJSON 변환 → GPX를 포함한 지역 패키지 → 자체 HTTP(S) 서버 → 앱 문서 디렉터리 → MapLibre Native`

소규모 기술 검증에서는 **전체 GeoJSON 파일을 저장**한다. SDK 타일 캐시/OfflineManager를 사용하는 방식과 다르다. 스타일은 앱에 있고, 타일·스프라이트·글리프 URL이 없다. 한글 지명은 시스템 글꼴을 사용하는 네이티브 지도 주석으로 표시한다. 앱 재실행은 서버 없이 저장 파일과 내장 스타일만 사용한다.

- 저장 파일 SHA-256과 스키마·GPX 좌표를 검증한 뒤 임시 파일을 최종 파일로 이동한다.
- 저장 파일은 콘텐츠 해시 이름으로 불변 관리한다. 재실행 시 실제 내용에서 준비 여부를 판단한다.
- 이번 다운로드는 약 581KiB 단일 패키지다. 취소/재시도 가능, 바이트 단위 재개·진행률은 다음 단계다.
- 모든 지도 요소를 메모리에 올리는 방식이므로 전국/광역 서비스에는 그대로 확장하지 않는다. 이후 지역별 벡터 타일·PMTiles/MBTiles 및 네이티브 로컬 타일 접근을 별도 검증한다.
- 합성 GPX는 파이프라인 시험용이다. 실제 보행로 정합성/통행 가능성을 검수한 추천 코스가 아니다.
- 전경 위치만 처리하고 좌표를 서버로 전송하지 않는다.

## 데이터 공급원 검토

| 후보 | 확인한 사실 | 이번 결정 |
|---|---|---|
| OSM 원본 + 자체 배포 | ODbL 조건으로 복사·가공·재배포 가능. 읽기용 추출은 Overpass/지역 덤프 권장 | 선택. 데이터에 출처·라이선스 표시, 원본/변환 코드 제공 |
| 공공데이터포털 도로중심선 WMS/WFS | 국토부/국토지리정보원 원본 API 존재. 메타데이터에 출처표시 및 제3자 권리 포함 명시 | 후속 후보. API 접근 조건·원본 파일 재배포 조건·좌표계·보행로 품질 추가 확인 필요 |
| OSM 표준 타일 서버 | 오프라인 일괄 다운로드 금지 | 사용하지 않음 |
| OpenFreeMap | 공개 지도 표시 무료. 현재 약관의 자동 수집 제한으로 오프라인 일괄 저장 허용을 가정할 수 없음 | 사용하지 않음 |
| Stadia Maps | 모바일 오프라인 저장 문서 존재하나 계정/키 및 구독·용량 조건 있음 | 사용자 요구에 따라 제외 |

공공데이터가 공개되어 있다는 것만으로 오프라인 배포 조건까지 동일하다고 단정하지 않는다. 실제 지도 품질도 서울숲 데이터 수신 여부만 확인했으며 실외 현장 정합성은 미확인이다.

## 공식 출처

- https://docs.flutter.dev/platform-integration
- https://github.com/maplibre/flutter-maplibre-gl
- https://pub.dev/documentation/geolocator/latest/
- https://reactnative.dev/docs/getting-started
- https://maplibre.org/maplibre-react-native/docs/setup/getting-started/
- https://maplibre.org/maplibre-react-native/docs/setup/expo/
- https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/
- https://docs.expo.dev/versions/latest/sdk/location/
- https://www.openstreetmap.org/copyright
- https://operations.osmfoundation.org/policies/api/
- https://operations.osmfoundation.org/policies/tiles/
- https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
- https://www.data.go.kr/data/15056842/openapi.do
- https://openfreemap.org/tos/
- https://docs.stadiamaps.com/tutorials/offline-maps-with-flutter-maplibre-gl/

## 전국 온라인 지도 추가 (2026-09-30)

OpenFreeMap [공식 소개](https://openfreemap.org/)에서 계정·API 키 없는 온라인 지도 제공을 확인했다. [Quick Start](https://openfreemap.org/quick_start/)는 MapLibre Native 모바일에서 `https://tiles.openfreemap.org/styles/liberty` 사용을 명시한다. [이용 조건](https://openfreemap.org/tos/)의 자동 수집 제한을 고려하여 일반 화면 탐색에만 사용하고 공개 타일 일괄 다운로드는 구현하지 않는다. 서비스 가용성 보장은 없다. 온라인 데이터 갱신 주기·한국 지명 완전성은 앱이 보장하지 않는다.

오프라인은 기존 OSM 자체 패키지와 URL 없는 스타일로 분리한다. 저장 데이터 복원 전에는 온라인 Map을 생성하지 않아 콜드 스타트에서 불필요한 온라인 요청을 피한다. 저장 데이터가 있으면 오프라인으로 시작하며 전국 지도는 사용자가 선택한다. GPS 좌표·이동 기록 전송 API는 없지만 온라인 타일 요청은 표시 지역과 IP를 공급원/CDN에 노출한다. 자체 호스팅 전환 시 이 요청도 자체 인프라로 옮길 수 있다.
