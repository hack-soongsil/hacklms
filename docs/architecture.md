# 코드 구조

Hack LMS는 Manifest V3 기반 Chrome 확장 프로그램입니다. 별도 빌드 과정 없이 JavaScript와 HTML 파일을 직접 로드하며, 이 저장소에는 별도의 백엔드 서버 구현이 없습니다.

이 문서는 현재 구현을 설명합니다. 개발 환경 설정과 기여 절차는 [기여 가이드](../.github/CONTRIBUTING.md)를 참고하세요.

## 구성 요소

| 구성 요소 | 역할 | 코드 |
| --- | --- | --- |
| 팝업 | 사용자 입력을 받고, 현재 탭의 영상 정보를 찾아 결과를 표시합니다. | [popup/index.js](/popup/index.js), [popup/index.html](../popup/index.html) |
| 서비스 워커 | 영상 요청을 감지하고 다운로드와 진도 API 호출을 처리합니다. | [background.js](/background.js) |
| 콘텐츠 스크립트 | 영상 플레이어 프레임 안에서 정보를 읽고 재생 속도를 제어합니다. | [video-iframe-listener.js](/video-iframe-listener.js) |
| 확장 설정 | 각 구성 요소의 실행 위치와 접근 권한을 선언합니다. | [manifest.json](/manifest.json) |

팝업, 백그라운드 서비스 워커, 콘텐츠 스크립트는 서로 메시지를 주고받으며 동작합니다.

### 실행 위치와 통신

팝업은 `chrome.scripting.executeScript`로 스크립트를 주입하여 현재 탭의 토큰과 프레임 정보를 확인합니다.

영상 플레이어는 별도 출처인 `commons.ssu.ac.kr`의 프레임에서 실행됩니다. 브라우저의 동일 출처 정책(SOP)으로 인해 팝업에서 해당 프레임의 DOM에 직접 접근할 수 없으므로, 프레임에 콘텐츠 스크립트(`video-iframe-listener.js`)를 주입하고 메시지를 주고받아 영상 정보를 얻거나 재생을 제어합니다.

콘텐츠 스크립트는 manifest에 설정된 `https://commons.ssu.ac.kr/*` 패턴과 일치하는 모든 프레임에 주입됩니다(`all_frames: true`). 팝업은 이 중 `/em/` 경로의 프레임을 우선 탐색해 통신할 영상 프레임을 선택합니다.

메시지는 `target`과 `type`으로 구분합니다. 각 구성요소의 `chrome.runtime.onMessage` 리스너에서 처리할 수 있는 요청과 응답을 확인할 수 있습니다.

## 외부 연동과 권한

| 대상 | 현재 코드에서의 용도 |
| --- | --- |
| `canvas.ssu.ac.kr` | LMS 탭 확인, `xn_api_token` 쿠키 조회, LearningX 진도 API 호출 |
| `commons.ssu.ac.kr` | 영상 플레이어 프레임에서 정보 추출 및 영상 제어 |
| `*.commonscdn.com` | MP4 네트워크 요청 캡처 및 Referer 헤더 변경 |

현재 도메인과 API 경로는 코드에 직접 지정되어 있습니다.

| manifest 권한 | 용도 |
| --- | --- |
| `scripting` | 현재 탭의 쿠키 조회 및 프레임 위치 확인 |
| `downloads` | MP4 다운로드 실행 |
| `declarativeNetRequest` | CDN 요청의 Referer 헤더 변경 규칙 등록 |
| `webRequest` | CDN 영상 요청 및 Canvas 메인 프레임 로드 감지 |
| `storage` | 캡처한 영상 URL을 `chrome.storage.session`에 보관 |

[manifest.json](/manifest.json)의 `host_permissions`에는 위 세 도메인 패턴이 등록되어 있습니다. 서비스 워커는 설치/업데이트 및 브라우저 시작 시 `setupRefererRule()`을 실행합니다. 이 규칙은 `commonscdn.com`에 대한 지정된 요청 유형의 Referer를 `https://commons.ssu.ac.kr/`로 설정합니다.

## 주요 흐름과 코드 진입점

### 영상 찾기와 팝업 표시

팝업이 열리면 활성 탭에서 토큰을 읽고 영상 프레임을 찾습니다. 선택한 프레임에서 영상 정보를 받아 화면을 구성하고, 필요한 정보가 있는 경우 진도를 조회합니다. 영상 감지와 진도 조회 가능 여부는 별도로 판단합니다.

- [popup/index.js](/popup/index.js): `getToken()`, `findVideoFrame()`
- [video-iframe-listener.js](/video-iframe-listener.js): `getVideoInfo()`

### 영상 URL 확보와 다운로드

영상 URL은 콘텐츠 스크립트가 플레이어와 로드된 리소스에서 찾습니다. 이 방법으로 찾지 못하면 서비스 워커가 CDN 요청에서 캡처한 URL을 사용합니다. 필요할 때는 재생 시작을 시도하고 URL을 다시 확인합니다.

확보한 URL로 팝업이 다운로드를 요청하면 서비스 워커가 실제 다운로드를 실행합니다. 캡처한 URL은 탭별로 관리하며, 서비스 워커가 종료되어도 같은 브라우저 세션에서 다시 사용할 수 있도록 세션 저장소에도 보관합니다.

- [popup/index.js](/popup/index.js): `getVideoUrlFromFrame()`, `getCapturedMp4()`, 다운로드 버튼 처리
- [video-iframe-listener.js](/video-iframe-listener.js): `getVideoUrl()`, `trigger-autoplay` 메시지 처리
- [background.js](/background.js): `webRequest` 리스너, `storeCapturedMp4()`, `clearCapturedMp4()`, `download-video` 메시지 처리

CDN 요청의 Referer 헤더를 설정하는 규칙도 서비스 워커에서 등록합니다. 관련 코드는 `setupRefererRule()`을 참고하세요.

### 배속 제어

팝업의 배속 입력을 콘텐츠 스크립트에 전달하고, 콘텐츠 스크립트가 실제 영상 요소를 제어합니다.

- [popup/index.js](/popup/index.js): 배속 슬라이더 이벤트 처리
- [video-iframe-listener.js](/video-iframe-listener.js): `getVideoElement()`, `get-video-playback-rate` 및 `set-video-playback-rate` 메시지 처리

### 진도 조회와 학습 완료 처리

팝업이 전달한 토큰과 강의 정보를 사용해 서비스 워커가 LearningX API를 호출합니다. 조회 결과는 별도 메시지로 팝업에 전달합니다. 학습 완료 기능은 영상 프레임에서 얻은 URL을 통해 진도 갱신 요청을 수행합니다.

- [background.js](/background.js): `getVideoStatus()`, `completeVideoProgress()`, `sendMessageToPopup()`
- [popup/index.js](/popup/index.js): `set-video-progress` 및 `complete-video-progress-error` 메시지 처리
