# [BACKLOG] AI 플랫폼 프롬프트 추출 안정화 고도화 방안

## 📌 배경 및 목적
현재 Motiverse Prompt Hub 확장 프로그램은 ChatGPT, Claude, Gemini의 웹페이지에 렌더링된 DOM (HTML 태그, 클래스명 등) 구조를 기반으로 사용자 프롬프트 및 AI 응답 결과를 추출(Scraping)하고 있습니다. 
그러나 AI 서비스 제공사들이 UI 업데이트 및 A/B 테스트를 빈번하게 진행하면서 DOM 구조가 수시로 변경되고 있으며, 이로 인해 프롬프트 캡처 기능이 오작동하는 유지보수 이슈가 지속적으로 발생하고 있습니다.

이를 근본적으로 해결하고 장기적인 안정성을 확보하기 위해 아래의 고도화 작업들을 백로그로 관리하고 추후 도입합니다.

---

## 🛠 해결 방안 (Phases)

### Phase 1: 중앙 서버를 통한 선택자(Selector) 동적 주입
* **개요:** 익스텐션 소스코드 내부에 하드코딩된 선택자 값(`.message-item`, `[data-message-author-role]` 등)을 제거하고, Motiverse 백엔드(Supabase/FastAPI)에서 최신 선택자 규칙을 실시간으로 받아오도록 변경합니다.
* **장점:** AI 플랫폼의 DOM 구조가 변경되어 에러가 발생하더라도, 크롬 확장 프로그램을 재심사/업데이트할 필요 없이 서버쪽 DB 수정을 통해 즉시 전파 및 복구가 가능합니다.
* **작업 내용:**
  1. DB 테이블 생성 (`prompt_extract_selectors`)
  2. 익스텐션 초기 로드 시 `chrome.storage`에 API로부터 받은 최신 선택자 JSON 캐싱
  3. `content.js` 파싱 로직을 동적 선택자 기반으로 리팩토링

### Phase 2: 자동 모니터링 봇 기반 CI/CD 결합 구축
* **개요:** 우리가 만든 선택자가 여전히 유효한지 24시간 감시하는 자동화 봇을 서버(GitHub Actions 등)에 구축합니다.
* **장점:** 사용자 클레임(에러 제보)이 오기 전에 개발자가 선제적으로 문제를 인지하고 대응할 수 있습니다.
* **작업 내용:**
  1. `Puppeteer` 또는 `Playwright`를 사용해 매일 주기적으로 ChatGPT, Claude, Gemini에 자동 로그인 후 테스트 프롬프트 발송 스크립트 작성
  2. 기존 추출 로직이 실패할 경우, Slack/Email 웹훅을 통해 개발팀에 즉시 알람 전송

### Phase 3: 네트워크 API 통신(JSON) Intercept (궁극적 해결)
* **개요:** 언제든 바뀔 수 있는 불안정한 프론트엔드 DOM 스크래핑 방식을 완전히 버리고, 브라우저가 AI 서버와 주고받는 '백엔드 API 통신' 그 자체의 응답 데이터(JSON)를 가로챕니다.
* **장점:** DOM 변경과 무관하게 통신 데이터 포맷 자체가 바뀌지 않는 한 영구적인 추출 안정성을 보장합니다.
* **작업 내용:**
  1. `chrome.webRequest` API 또는 XHR/Fetch Monkey Patching 방식을 사용하여 응답 데이터 Intercept
  2. 보안 및 CSP(Content Security Policy) 정책 우회 아키텍처 연구 및 구현 (Manifest V3 규격 내에서)
  3. 추출된 Raw JSON에서 필요한 대화 쌍(Prompt & Result)만 정제하여 캡쳐 버튼과 연동
