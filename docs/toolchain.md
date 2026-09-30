# 로컬 검증 도구

이 Mac의 기본 셸에는 Node, Java, Android SDK, CocoaPods가 없었다. 기존 시스템 설정을 교체하지 않고 아래 도구로 검증했다.

- Node: Codex 번들 Node 24.19.0. `scripts/dev.sh`에서 자동 탐색.
- Xcode: `/Applications/Xcode.app`, 26.4. DEVELOPER_DIR로 선택. 초기 구성 요소 및 iOS 26.4 시뮬레이터 설치.
- Android: `.tools/android-sdk`에 CLI/SDK36/build-tools36/NDK27.1/ARM 에뮬레이터 설치.
- Java: `.tools/jdk-21.0.12.1+1/Contents/Home`.
- CocoaPods: `.tools/gems`, 1.16.2. 기본 Ruby2.6 호환 의존성 고정 설치.
- Ruby 호환 gem: ffi1.17.0, securerandom0.3.2, minitest5.15.0, zeitwerk2.6.18, drb2.0.6, i18n1.14.8, activesupport6.1.7.10.
- CocoaPods 설치 시 Expo의 Ruby `filter_map` 경고로 일부 모듈은 소스에서 컴파일했다. 최종 iOS Release 빌드는 성공했다. 새 개발 환경에는 현대적인 Ruby 사용을 권장한다.

`.tools/`, 네이티브 생성 디렉터리, 빌드 산출물은 Git 제외 대상이다. 도구·캐시가 수십 GB를 사용할 수 있다. SDK와 캐시를 지우면 다시 준비해야 하므로 작업 중 자동 삭제하지 않는다.

Android Release 빌드는 현재 ARM64만 생성했다. Expo 템플릿의 개발용 서명 키를 사용하는 로컬 검증 APK이며 스토어 배포용 서명은 아직 없다. iOS 산출물은 시뮬레이터용이며 실제 아이폰 설치 파일이 아니다.
