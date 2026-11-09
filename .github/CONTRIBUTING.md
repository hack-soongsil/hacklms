# hacklms 기여 가이드

`hacklms` 프로젝트에 관심을 가져주셔서 감사합니다.

이 프로젝트는 숭실대학교 LMS를 위한 유틸리티를 제공하는 Chrome 및 Safari 확장 프로그램입니다. 버그 수정 및 제보, 기능 개선, 문서 보완, 코드 정리, UX 개선 등 다양한 형태의 기여를 환영합니다.

## 개발 환경 설정

1. 원본 저장소를 포크합니다.
2. 포크한 저장소를 로컬에 클론합니다.
3. 브랜치를 생성합니다.

```bash
git clone https://github.com/<your-username>/hacklms.git
cd hacklms
git checkout -b feature/my-improvement
```

## 빌드

```bash
bash build.sh
```

빌드 스크립트는 `VERSION`의 버전을 브라우저별 매니페스트에 반영하고 소스와 이미지를 복사해 다음 결과물을 생성합니다.

`dist/`는 생성물이므로 직접 수정하지 않습니다. `src/`, `manifests/` 등의 원본을 수정한 뒤 다시 빌드합니다.

## Chrome 브라우저에서 테스트

Chrome 확장 프로그램을 실제 브라우저에서 확인하려면 다음 절차를 따라 주세요.

1. Chrome 브라우저에서 `chrome://extensions`로 이동합니다.
2. 우측 상단의 "개발자 모드"를 활성화합니다.
3. "압축 해제된 확장 프로그램 로드" 버튼을 클릭합니다.
4. 빌드된 `dist/chrome/` 폴더를 선택합니다. (`manifest.json`이 바로 들어 있는 폴더입니다.)
5. 확장 프로그램이 설치되면 브라우저에 아이콘이 표시됩니다.

변경 후에는 `bash build.sh`로 다시 빌드하고, `chrome://extensions`에서 확장 프로그램을 다시 로드합니다. 콘텐츠 스크립트도 갱신되도록 열려 있는 LMS 페이지를 새로고침합니다.

## Safari 브라우저에서 테스트

실제 Safari 테스트에는 Mac이 필요합니다. `Add Temporary Extension…` 메뉴가 있는 Safari에서는 `dist/safari/` 폴더를 직접 불러올 수 있으므로 로컬 테스트를 위한 Xcode 프로젝트 생성이나 앱 패키징은 필요하지 않습니다.

1. 빌드된 `dist/safari/` 폴더 전체를 Mac에 준비합니다. 다른 컴퓨터에서 빌드했다면 폴더를 복사합니다.
2. Safari의 **설정 > 고급**에서 **웹 개발자용 기능 보기(Show features for web developers)**를 켭니다.
3. **설정 > 개발자(Developer) > Add Temporary Extension…**을 선택합니다. 서명되지 않은 확장에 대한 인증 요청이 나오면 승인합니다.
4. `manifest.json`이 바로 들어 있는 `dist/safari/` 폴더를 선택합니다.
5. **설정 > 확장 프로그램**에서 Hack LMS를 활성화하고, LMS(`canvas.ssu.ac.kr`), Commons(`commons.ssu.ac.kr`), 영상 CDN(`*.commonscdn.com`)에 필요한 사이트 접근을 허용합니다. Safari 프로필을 사용한다면 테스트할 프로필에서도 활성화합니다.
6. LMS 강의 페이지를 새로고침하고 확장 프로그램 팝업을 열어 기능을 확인합니다.

변경 후에는 다시 빌드해 Mac의 폴더를 갱신하고, Safari 확장 프로그램 설정에서 **Reload**를 실행한 뒤 LMS 페이지도 새로고침합니다. 임시 확장은 Safari 종료 또는 24시간 경과 시 제거되므로 다시 추가해야 합니다.

해당 메뉴가 없는 Safari에서는 Mac에 Xcode를 설치하고 다음 명령으로 앱 프로젝트를 생성합니다. 경로는 Mac에 복사한 폴더의 절대 경로로 바꿉니다.

```bash
xcrun safari-web-extension-packager "/절대경로/dist/safari"
```

설치된 Xcode에서 위 도구를 찾지 못하면 이전 명칭인 `safari-web-extension-converter`를 사용합니다. 생성된 프로젝트에서 macOS 앱 Scheme과 **My Mac**을 선택하고 **Product > Run**으로 실행합니다. 서명 없이 테스트하려면 Safari의 **설정 > 개발자 > Allow unsigned extensions**를 켜고 확장 프로그램을 활성화합니다. 이 허용 설정은 Safari 종료 시 초기화됩니다. 이후 소스 변경 시에는 프로젝트가 참조하는 확장 파일도 갱신하고 Xcode에서 다시 빌드합니다.

자세한 내용은 Apple의 [Safari 확장 실행 안내](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension)와 [패키징 안내](https://developer.apple.com/documentation/safariservices/packaging-a-web-extension-for-safari)를 참고하세요.

## 디버깅 방법

### Chrome

- 팝업(`src/popup/index.js`): 확장 프로그램 팝업을 연 뒤 팝업 내부를 우클릭하고 **검사**를 선택합니다.
- 백그라운드(`src/background.js`): `chrome://extensions`의 Hack LMS 카드에서 **서비스 워커(service worker)** 링크를 클릭합니다. 로드 오류가 있으면 카드의 **오류(Errors)**도 확인합니다.
- 콘텐츠 스크립트(`src/video-iframe-listener.js`): LMS 강의 페이지에서 DevTools를 열고 **Sources > Content scripts**에서 해당 파일을 찾습니다. Console에서 직접 코드를 실행하려면 실행 컨텍스트를 Commons 영상 프레임의 Hack LMS 콘텐츠 스크립트로 선택합니다.

서비스 워커 검사 창을 열어 두면 워커가 활성 상태를 유지하므로, 검사 창을 닫은 상태에서도 기능을 확인합니다. 자세한 내용은 [Chrome 확장 디버깅 안내](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug)를 참고하세요.

### Safari (macOS)

위 테스트 절차의 **웹 개발자용 기능 보기**를 켠 상태에서 메뉴 막대의 **개발자용(Develop)** 메뉴를 사용합니다. 메뉴 이름은 Safari 버전과 표시 언어에 따라 다를 수 있습니다.

- 팝업(`src/popup/index.js`): 확장 프로그램 팝업을 연 뒤 팝업 내부를 Control-클릭하고 **요소 점검(Inspect Element)**을 선택합니다.
- 백그라운드(`src/background.js`): **Develop > Web Extension Background Content**에서 Hack LMS와 테스트 중인 프로필을 선택합니다. 이전 버전에서는 **Web Extension Background Pages** 메뉴를 사용합니다.
- 콘텐츠 스크립트(`src/video-iframe-listener.js`): LMS 강의 페이지에서 **Develop > Show Web Inspector**를 선택하고, **Sources > Extension Scripts**에서 해당 파일을 찾습니다. 콘솔의 실행 컨텍스트도 Commons 영상 프레임과 확장 프로그램에 맞게 선택합니다.

자세한 내용은 [Apple Safari 확장 디버깅 안내](https://developer.apple.com/documentation/safariservices/troubleshooting-your-safari-web-extension)를 참고하세요.

팝업, 백그라운드, 콘텐츠 스크립트의 로그는 각각의 콘솔에서 확인합니다. `console.log()`와 브레이크포인트로 메시지 송수신을 추적하고, 진도 API나 영상 요청은 요청이 발생하는 컨텍스트의 **Network** 탭에서 확인합니다. 소스 변경 후에는 위 브라우저별 테스트 절차에 따라 재빌드·확장 재로드·LMS 페이지 새로고침을 진행합니다.

## 코딩 스타일

- 불필요한 의존성 추가를 지양합니다.
- 기존 프로젝트 스타일과 일관성을 유지합니다.
- 불필요한 주석은 피하고, 의도가 불분명한 부분만 주석으로 설명합니다.
- 사용하지 않는 변수나 코드는 제거합니다.

## 로컬 테스트 및 검증

변경 사항을 반영한 뒤에는 실제 Chrome 및 Safari 브라우저에서 아래를 확인해 주세요. 한 브라우저에서만 확인했다면 PR에 검증한 브라우저와 버전을 명시합니다.

- 확장 프로그램이 정상적으로 로드되는지
- 기능이 기대대로 동작하는지
- 콘솔에 오류가 없는지
- 기존 기능이 깨지지 않았는지
- LMS 강의에서 영상 정보와 배속 조절이 동작하는지
- Chrome의 다운로드와 Safari의 새 탭 열기 및 영상 저장이 동작하는지

## Pull Request 가이드

- PR을 생성하기 전 현재 브랜치가 메인 브랜치와 충돌하지 않는지 확인합니다.
- PR 제목은 변경 내용을 한 문장으로 간단히 요약합니다.
- 내용에는 변경 이유와 확인한 동작을 함께 적습니다.
- 관련 이슈가 있다면 함께 연결합니다.

PR 제목 예시:
- `강의 세션 파싱 오류 수정`
- `강의 목록 렌더링 성능 개선`
- `기여 가이드 문서 추가`

## 문서화

코드 변경이 있거나 동작 방식이 바뀐 경우, 관련 문서도 함께 업데이트해 주세요.

## 버그 제보

버그를 제보할 때는 다음 정보를 포함해주세요.

- 명확한 제목
- 문제 설명
- 재현 단계
- 기대 동작
- 실제 동작
- 브라우저/환경 정보
- 가능하면 스크린샷 또는 로그

이 정보가 있으면 문제를 빠르게 확인하고 수정할 수 있습니다.

## 기능 제안

기능 제안은 언제나 환영입니다. 제안 시 해결하는 문제와 사용자 입장에서 기대되는 동작을 포함해 주세요.

모든 제안이 수용되는 것은 아니지만, 아이디어와 피드백은 항상 가치 있습니다.

## 질문이 있으신가요?

기여 전에 궁금한 점이 있다면 저장소의 이슈를 통해 문의해 주세요. 적극적이고 건설적인 기여를 환영합니다.

`hacklms` 프로젝트가 더 나은 방향으로 발전할 수 있도록 함께 해주셔서 감사합니다.
