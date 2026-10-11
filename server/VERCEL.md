# Vercel Hobby 배포

React 대시보드와 조회 전용 MCP를 무료 Hobby 프로젝트 하나에서 실행하는 구성입니다. 개인 포트폴리오와 모의 데이터 조회 용도이며, 실제 회사 데이터나 설비 제어를 포함하지 않습니다.

## 구성

- Vite 정적 화면 + Node.js 24 Vercel Function 하나
- `POST /mcp`: JSON-RPC discovery 공개, 도구 실행은 Bearer 인증
- `GET /healthz`: 공개 상태 확인
- `GET /audit`: Bearer 인증 후 MCP 요청 메타데이터 조회
- `/api/demo`, `/api/mcp-preview`: 고정된 모의 데이터용 공개 웹 미리보기. MCP 토큰과 비공개 저장 기록에 접근하지 않음
- 인증된 MCP 도구 호출 기록은 Vercel **private** Blob에 요청별 파일로 저장. 프로세스의 로컬 디스크를 사용하지 않으며 동시 요청이 같은 파일을 덮어쓰지 않음
- 기록에는 UUID·시각·고정 도구 이름·처리 결과·응답 시간만 포함. 인증 토큰·프롬프트·입력 인수·IP는 저장하지 않음
- 웹 화면의 최근 30건은 현재 탭에서 실행한 HTTP 요청 기록. 새로고침 시 초기화되며 비공개 MCP 저장 기록과 구분

## 배포 설정

`vercel.json`에 설치·빌드·함수 라우팅을 정의합니다. 빌드 명령은 `npm run vercel:build`, 출력 폴더는 `pages-dist`입니다. GitHub Pages는 기존 `npm run pages:build`를 사용합니다.

1. Vercel의 개인 Hobby 계정에 GitHub 저장소를 연결합니다.
2. 프로젝트 환경 변수 `MCP_API_TOKEN`에 32자 이상의 무작위 값을 비공개로 등록합니다.
3. private Blob 저장소를 생성하고 이 프로젝트의 Production 환경에 연결합니다. SDK는 연결된 저장소의 OIDC 인증 또는 비공개 환경 변수로 인증합니다.
4. 배포 후 `/healthz`, 인증 없는 도구 실행의 401, 인증된 6개 도구 호출, `/audit` 재조회, 정상·부분 장애·복구 화면을 검증합니다.

토큰은 `VITE_` 접두사 변수·소스·README·공개 페이지에 넣지 않습니다. MCP 클라이언트에는 `/mcp` HTTPS URL과 `Authorization: Bearer <비공개 토큰>`을 설정합니다.

## 무료 사용과 기록 범위

Hobby는 개인 비상업적 프로젝트용입니다. 무료 한도를 초과하면 서비스 접근이 제한되며 유료 플랜으로 자동 전환하지 않습니다. Blob의 무료 한도는 월 1GB 저장, 2,000 Advanced Operations, 10,000 Simple Operations, 10GB 전송입니다. MCP 기록 한 건의 쓰기와 기록 목록 조회는 각각 Advanced Operation을 사용하므로 소규모 시연에 맞춰 사용합니다.

공개 웹 시연은 Blob에 기록을 쓰지 않습니다. 인증된 MCP 호출만 요청별 파일을 저장하며 최신 30건을 조회합니다. 기존 파일은 자동 삭제하지 않습니다. 저장 실패는 `X-Audit-Persisted: false`, 기록 조회 실패는 HTTP 503으로 표시합니다.

버스트 제한은 함수 인스턴스별 120회/분이며 전역 분산 요청 한도를 보장하지 않습니다. Vercel Firewall 및 계정 Usage 화면에서 사용량을 확인할 수 있습니다.

## 실제 배포와 검증 · 2026-10-11

공개 대시보드: [ess-ops-mcp.vercel.app](https://ess-ops-mcp.vercel.app). MCP 주소: `https://ess-ops-mcp.vercel.app/mcp`.

개인 Hobby 프로젝트에 Node.js 24 Function 하나와 싱가포르 `sin1` private Blob을 연결했습니다. 공식 MCP SDK의 Streamable HTTP 클라이언트에서 6개 도구 및 부분 장애·재시도 복구를 포함한 8회 호출을 확인했습니다. 공개 `/healthz`의 설정 상태, 인증 없는 도구 실행·기록 조회의 HTTP 401, private Blob의 8개 기록과 반복 조회 일치를 확인했습니다. 자동 테스트 15개·타입 검사·프론트엔드 빌드도 통과했습니다.

배포 당일의 기능 검증 결과입니다. 장기간 가용성이나 실제 설비 운영 실적을 뜻하지 않습니다. Oracle 무료 VM은 싱가포르 리전의 용량 부족으로 별도 배포 대기 상태입니다.

근거: [Hobby](https://vercel.com/docs/plans/hobby), [MCP 배포](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel), [private Blob](https://vercel.com/docs/vercel-blob/private-storage), [Blob 무료 한도](https://vercel.com/docs/vercel-blob/usage-and-pricing).
