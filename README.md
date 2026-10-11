# ESS Ops MCP

2026-10-11에 새로 만든 개인 포트폴리오 데모입니다. 설비 운영 화면 경험을 바탕으로 모의 ESS 데이터의 조회를 MCP 도구로 노출합니다. 실제 회사 코드·고객 정보·설비 데이터는 포함하지 않습니다.

**[GitHub Pages 시연](https://yountaehee.github.io/ess-ops-mcp/)** · **[Oracle 배포 안내](server/DEPLOYMENT.md)**

| 구분 | 실행 위치 | 데이터와 기록 |
| --- | --- | --- |
| GitHub Pages | 브라우저 React 시연 | 모의 데이터, 현재 탭의 메모리 기록. 새로고침 시 초기화 |
| Oracle용 MCP 서버 | Node.js / Docker / Caddy HTTPS | Bearer 인증, SQLite 영구 기록. 계정 생성 및 실제 배포 대기 |
| 초기 Sites 버전 | Cloudflare Workers / D1 | 개인 접근으로 배포 검증. Oracle 배포와 구분 |

GitHub Pages는 원격 MCP 서버를 실행하지 않습니다. Oracle VM 생성·HTTPS 주소·실제 Codex 연결 검증을 마치기 전까지 원격 배포 완료로 표시하지 않습니다.

## 범위

- 2개 가상 사업장 / 4개 가상 ESS, SOC·전력·온도 시계열, 2개 규칙 기반 알람
- `POST /mcp`: stateless Streamable HTTP / JSON-RPC 2.0 / initialize, tools/list, tools/call, ping
- 조회 도구 6개. 도구별 엄격한 입력 검증, 데이터 호출에 사용자 인증 필요
- 모의 공급자: 정상 / timeout / offline / 첫 실패 후 재시도 복구. 시도 2회, 일부 실패 시 성공 데이터 유지, 진행 중 동일 요청 공유
- React 대시보드, 사업장 선택, 장비별 차트, 근거 설명, CSV 다운로드, MCP 요청 실행
- D1 요청 기록: 요청 ID·시각·도구·처리 결과·응답 시간. 최신 30건 조회. 개인 정보·프롬프트·인증 토큰은 기록하지 않음

## AI 사용과 기여

산업용 운영 화면 경험을 바탕으로 새로운 MCP 데모 제작을 요청했습니다. 코드 초안·UI·테스트·배포 준비에는 Codex를 사용했습니다. 이 데모의 Claude 공동 구현은 확인되지 않았습니다. 직접 검토·수정·운영한 범위는 후속 변경 기록으로 구분합니다. 신규 데모와 AI 협업 범위를 공개하며, 전체 코드를 독립적으로 작성하거나 기존 상용 MCP를 운영했다고 주장하지 않습니다.

## 개발

Node 24.12 이상을 권장합니다. Oracle 서버는 Node 내장 SQLite를 사용합니다. Sites starter의 설치·빌드 도구와 라이선스 파일을 유지합니다.

```text
npm run install:ci
npm test
npm run typecheck
npm run pages:dev
npm run pages:build
```

`pages:dev`의 주소는 `http://127.0.0.1:5174/ess-ops-mcp/`입니다. GitHub Actions가 테스트·타입 검사 후 Pages를 배포합니다.

Oracle 서버만 설치하려면 `server/`의 최소 의존성 패키지를 사용합니다. Docker 구성은 [배포 안내](server/DEPLOYMENT.md)에 있습니다. 비공개 토큰을 환경 변수 `MCP_API_TOKEN`으로 전달해야 서버가 시작됩니다. `/healthz`와 MCP discovery는 공개되며, 도구 실행과 `/audit`는 인증을 요구합니다.

초기 Cloudflare/Sites 앱은 `npm run dev`와 `npm run build`로 실행할 수 있습니다. 개인 Site ID는 이 공개 소스에 포함하지 않습니다.

D1 스키마는 `db/schema.ts`, 초기 마이그레이션은 `drizzle/0000_misty_peter_quill.sql`에 있습니다. 로컬 미리보기에는 해당 마이그레이션을 한 번 적용합니다. 배포에서는 Sites가 마이그레이션을 적용합니다. 로컬 모의 로그인과 배포 인증을 혼동하지 않습니다.

## 검증과 운영

자동 테스트 11개: 핵심 도구 7개 + HTTP 서버 4개입니다. lifecycle/discovery, 인증 거절, 정상·부분 실패·복구, 중복 요청 공유, 시계열 순서·입력 범위, 알람 근거, 프로토콜 오류, HTTP 인증·Origin·본문 크기·요청 제한·SQLite 재시작 영속성을 확인합니다. 테스트·TypeScript 검사·Pages 빌드를 배포 전에 실행합니다.

운영 장애 재현: timeout 선택 → 성공 3대/실패 1대 → 실패 값은 `null` → 정상/복구 선택 → 장비 4대 복원 → 요청 기록 확인. 기록 저장 실패는 표시하고 미저장 기록을 실적으로 취급하지 않습니다.

신규 배포 결과만 증명합니다. 장기 운영 기간, 실사용자 수, SLA, 지연 개선률, 실제 설비 장애 해결을 주장하지 않습니다. 알람 설명은 고정 규칙에 근거하며 LLM 진단·RAG·실제 제어가 아닙니다. 재시도와 타임아웃은 모의 공급자의 장애 주입입니다. 실제 산업 프로토콜 연결은 후속 작업입니다.

## 다음에 본인이 해야 할 검증

1. 도구마다 입력·응답·실패 상황을 설명해 보기
2. 직접 도구 하나 수정하고 테스트 추가하기
3. 실제 사용 피드백·수정·배포 날짜와 장애 대응을 기록하기
4. 회사 데이터를 붙이기 전 데이터 권한·환경 분리·접근 통제 검토하기

이 기록이 쌓이면 실제 운영·유지보수 경험으로 서술할 수 있습니다. 배포만으로 운영 경력을 소급하지 않습니다.

브라우저 미리보기는 `/api/mcp-preview`에서 동일한 JSON-RPC 처리기를 호출합니다. Sites의 `/mcp`는 브라우저 세션과 별도로 OAuth 인증이 필요합니다. 브라우저 미리보기 성공은 Codex 플러그인 연결 인증의 성공을 뜻하지 않습니다.
