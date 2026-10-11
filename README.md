# ESS Ops MCP

2026-10-11에 새로 만든 개인 포트폴리오 데모입니다. 설비 운영 화면 경험을 바탕으로 모의 ESS 데이터의 조회를 MCP 도구로 노출합니다. 실제 회사 코드·고객 정보·설비 데이터는 포함하지 않습니다.

**[GitHub Pages 시연](https://yountaehee.github.io/ess-ops-mcp/)** · **[Vercel 배포 안내](server/VERCEL.md)** · **[Oracle 배포 안내](server/DEPLOYMENT.md)**

| 구분 | 실행 위치 | 데이터와 기록 |
| --- | --- | --- |
| GitHub Pages | 브라우저 React 시연 | 모의 데이터, 현재 탭의 메모리 기록. 새로고침 시 초기화 |
| Vercel용 MCP 서버 | Node.js 24 Functions / private Blob | Hobby 무료 구성, Bearer 인증, 공개 모의 HTTP 미리보기. 로컬 검증 완료, 원격 배포 준비 |
| Oracle용 MCP 서버 | Node.js / Docker / Caddy HTTPS | Bearer 인증, SQLite 영구 기록을 로컬 검증. 가입 완료, 무료 VM 용량 부족으로 실제 배포 대기 |
| 초기 Sites 버전 | Cloudflare Workers / D1 | 개인 접근으로 배포 검증. Oracle 배포와 구분 |

GitHub Pages는 브라우저에서 모의 데이터를 실행하는 시연 화면입니다. Oracle용 서버의 환경 구성·검증 절차·배포 진행 상태는 [Oracle 배포 안내](server/DEPLOYMENT.md)에 정리했습니다.

## 범위

- 2개 가상 사업장 / 4개 가상 ESS, SOC·전력·온도 시계열, 2개 규칙 기반 알람
- `POST /mcp`: stateless Streamable HTTP / JSON-RPC 2.0 / initialize, tools/list, tools/call, ping
- 조회 도구 6개. 도구별 엄격한 입력 검증, 데이터 호출에 사용자 인증 필요
- 모의 공급자: 정상 / timeout / offline / 첫 실패 후 재시도 복구. 시도 2회, 일부 실패 시 성공 데이터 유지, 진행 중 동일 요청 공유
- React 대시보드, 사업장 선택, 장비별 차트, 근거 설명, CSV 다운로드, MCP 요청 실행
- D1 요청 기록: 요청 ID·시각·도구·처리 결과·응답 시간. 최신 30건 조회. 개인 정보·프롬프트·인증 토큰은 기록하지 않음

## 제작 도구

산업용 운영 화면 경험을 바탕으로 모의 ESS 조회를 프로젝트 범위로 정했습니다. 코드·UI·테스트·배포 구성 제작에 Codex를 활용했습니다.

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

## 검증

자동 테스트 15개: 핵심 도구 7개 + HTTP 서버 4개 + Vercel 함수 4개입니다. lifecycle/discovery, 인증 거절, 정상·부분 실패·복구, 중복 요청 공유, 시계열 순서·입력 범위, 알람 근거, 프로토콜 오류, HTTP 인증·Origin·본문 크기·요청 제한·SQLite 재시작 영속성을 확인합니다. Vercel 함수는 공개 미리보기와 비공개 MCP 기록의 접근 경계, 새 함수 인스턴스의 외부 저장소 조회, 저장 실패 표시를 추가 검증합니다. 테스트·TypeScript 검사·프론트엔드 빌드를 배포 전에 실행합니다.

초기 Cloudflare 서버는 실제 Codex에서 조회 도구 6개 호출을 확인했습니다. Oracle용 서버는 로컬 Docker 환경에서 실행·인증·SQLite 기록 유지를 검증했습니다.

장애 재현: timeout 선택 → 성공 3대/실패 1대 → 실패 값은 `null` → 정상/복구 선택 → 장비 4대 복원 → 요청 기록 확인. 기록 저장 실패는 화면에 표시합니다.

알람 설명은 고정 규칙에 근거하며, 재시도와 타임아웃은 모의 공급자로 재현합니다. 구현 범위는 모의 설비 데이터 조회이며, 실설비 연결·제어와 LLM 진단은 포함하지 않습니다.

브라우저 미리보기는 `/api/mcp-preview`에서 동일한 JSON-RPC 처리기를 호출합니다. Sites의 `/mcp`는 브라우저 세션과 별도로 OAuth 인증을 사용합니다.
