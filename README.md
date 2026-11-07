# Hack LMS

[숭실대학교 LMS](https://lms.ssu.ac.kr/)를 더 편리하게 사용할 수 있도록 도와주는 Chrome 확장 프로그램입니다.

## 설치

[Chrome 웹 스토어](https://chromewebstore.google.com/detail/hack-lms/ogjjhamelnijhhnfjjbpmjjjjdeebmoi)

## 브라우저별 빌드

Bash와 `jq`가 필요합니다. `VERSION`을 수정한 뒤 `bash build.sh`를 실행하면
`manifests/chrome.json`과 `manifests/safari.json`에 버전을 주입하고, `src`와 `images`를
통째로 복사하여 `dist/chrome`과 `dist/safari`를 생성합니다.
Chrome에서는 `dist/chrome`을 압축 해제된 확장 프로그램으로 로드합니다.
Safari 산출물은 macOS의 Safari Web Extension 변환·앱 패키징 및 실기기 검증이 추가로 필요합니다.

브라우저 API 차이는 `src/platform.js`에서 처리합니다. 해당 API가 없는 환경의
다운로드, Referer 변경, 네트워크 요청 캡처, 세션 저장은 TODO 상태입니다.
다운로드는 미구현 오류를 반환하고, 나머지 TODO는 작업을 수행하지 않습니다.
세션 저장 API가 없으면 저장된 URL을 복원하지 못하며 기존 메모리 캐시만 사용합니다.
Safari manifest는 현재 `downloads`, `webRequest`, `declarativeNetRequest` 권한을
요청하지 않습니다. 따라서 이 API에 의존하는 기능은 Safari에서 지원 완료 상태가 아닙니다.
실제 Safari에서의 확장 로드와 LMS 연동은 아직 검증하지 않았습니다.

공통 모듈의 모의 검사는 `node --experimental-vm-modules --test tests/platform.test.cjs`로 실행합니다.

## 주요 기능

- **동영상 학습 완료시키기** - 동영상 강의 학습 진도율을 100%로 만듭니다.
- **동영상 다운로드** - 강의 영상을 MP4 파일로 저장합니다.
- **배속 조절** - 영상 재생 속도를 0.5배부터 3배까지 조절합니다.

> 동영상의 구성과 LMS 사이트 구조 변경에 따라 일부 기능이 동작하지 않을 수 있습니다.

> 학습 완료시키기 기능은 학습 진도 기록을 변경하는 기능이므로 사용 전에 학교와 강의의 출석 인정 기준 및 이용 정책을 확인하세요. 사용에 따른 불이익은 사용자 본인의 책임입니다.

## 버그 제보와 기여

동작하지 않는 기능이나 LMS를 사용하면서 불편했던 점이 있다면 이슈로 알려주세요. 버그 수정, 기능 개선, 문서 보완 등의 기여도 환영합니다.

- [기여 가이드](.github/CONTRIBUTING.md): 개발 환경 설정, 디버깅, 검증 및 PR 작성 방법
- [코드 구조](docs/architecture.md): 구성 요소의 역할과 동작 흐름

## 영감을 얻은 프로젝트

- https://github.com/itjustbong/lms-tools-extensions

## 라이선스

[MIT](LICENSE.md)
