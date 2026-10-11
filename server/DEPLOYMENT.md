# Oracle Cloud 배포

현재 상태 (2026-10-11): Oracle 계정 가입·로그인 완료. Singapore 홈 리전 AD-1에서 무료 VM 생성 요청 세 건이 아래와 같이 거절됐습니다. 서버를 아직 생성하거나 배포하지 않았습니다. Node 서버의 Docker 실행·인증·SQLite 기록 유지 검증은 로컬에서 완료했습니다.

| 생성 요청 | 구성 | 실제 결과 |
| --- | --- | --- |
| VM.Standard.A1.Flex | Ubuntu 24.04 Minimal ARM64, 1 OCPU·2 GB, 기본 부트 디스크 | Out of capacity |
| VM.Standard.E2.1.Micro | Ubuntu 24.04 Minimal x86_64, 1 GB, 기본 부트 디스크 | Out of capacity |
| VM.Standard.A1.Flex (축소 재시도) | Ubuntu 24.04 Minimal ARM64, **1 OCPU·1 GB**, 기본 부트 디스크 | Out of capacity |

서버 이름 `ess-ops-mcp-demo`, VCN `ess-ops-mcp-vcn`, 공개 서브넷 `ess-ops-mcp-public` / `10.0.0.0/24`를 준비했습니다. SSH 공개 키는 로컬 보관한 키의 공개 부분만 사용합니다. 개인 키·접속 토큰·작업자 IP는 이 저장소에 넣지 않습니다. 실패 뒤 인스턴스 목록에 생성된 VM이 없는 것을 확인했습니다.

## 용량 확보 후 재개

이 계정의 Singapore 홈 리전에는 AD-1만 표시됐습니다. 별도 fault domain을 지정하지 않은 상태에서 두 무료 shape 모두 용량 부족이었습니다. A1을 [공식 최소 사양인 1 OCPU·1 GB](https://docs.oracle.com/en-us/iaas/Content/Compute/References/computeshapes.htm)로 낮춰도 같은 오류였습니다. 같은 요청을 즉시 반복하지 않고 용량이 확보된 뒤 최소 사양으로 다시 시도합니다. [Oracle 공식 안내](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)는 이 오류를 홈 리전의 무료 shape 일시 부족으로 설명합니다. 다른 리전은 홈 리전 상시 무료 조건을 충족하지 않으므로 무료 대안으로 가정하지 않습니다.

실제 VM 생성에 성공하면 인터넷에 연결하기 전에 SSH 22의 소스를 작업자 공인 IPv4 `/32`로 제한하고 HTTP 80·HTTPS 443만 공개합니다. 승인된 무료 범위를 벗어나는 유료 VM·계정 전환은 별도 예산 결정이 필요합니다. 용량 부족을 해결하려고 자동 유료 전환하지 않습니다.

## 구성

GitHub Pages는 React 시연 화면입니다. 데이터와 JSON-RPC 처리를 브라우저에서 실행하며, 요청 목록은 현재 탭의 메모리에만 존재합니다. 새로고침하면 사라집니다.

Oracle VM에서는 `server/index.mts`가 같은 `lib/ops.ts`를 사용합니다. HTTPS는 Caddy, 요청 기록은 SQLite 영구 볼륨, MCP 도구 호출은 Bearer 인증으로 보호합니다. 공개 `/healthz`는 서비스 상태만 반환합니다. `/audit`는 인증이 필요하며 개인 정보·원문 요청·토큰을 저장하지 않습니다. GitHub에 인증 토큰을 넣지 않습니다.

## 서버 준비

1. Oracle 가입과 본인 확인 완료 후 콘솔에서 현재 **Always Free Eligible** 표시가 있는 Linux VM을 선택합니다. 우선 1 OCPU/2 GB 이하의 작은 인스턴스를 검토합니다. 실제 표시와 총 할당량·부트 볼륨을 확인하며, 유료 업그레이드나 과금 리소스는 별도 사용자 승인 없이 생성하지 않습니다.
2. Ubuntu LTS 또는 Oracle Linux, SSH 키를 사용합니다. SSH는 작업자의 IP로 제한하고, HTTPS 443 및 인증서 발급용 HTTP 80만 공개합니다. Node 3000과 SQLite는 인터넷에 노출하지 않습니다.
3. 본인 도메인의 A 레코드를 VM 공인 IP로 지정합니다. HTTPS 도메인이 필요합니다. 도메인 구매는 이 배포에 포함하지 않습니다.
4. Docker Engine과 Compose를 공식 배포 경로로 설치합니다. 저장소를 clone한 뒤 `server/`에서 환경 파일을 만듭니다.

```sh
git clone https://github.com/YOUNTAEHEE/ess-ops-mcp.git
cd ess-ops-mcp/server
umask 077
# 본인 HTTPS 도메인과 32자 이상의 충분히 무작위인 토큰을 .env에 저장합니다.
# MCP_DOMAIN=mcp.example.com
# MCP_API_TOKEN=<private-random-token>
docker compose up -d --build
docker compose ps
curl --fail https://mcp.example.com/healthz
```

`.env`는 Git에서 제외되어 있습니다. 토큰을 채팅·이력서·GitHub Pages 코드에 넣지 않습니다. Caddy가 인증서를 발급하려면 DNS와 OCI 방화벽, 운영체제 방화벽에서 80/443 연결이 가능해야 합니다.

## 연결과 검증

MCP URL은 `https://<본인 도메인>/mcp`입니다. 클라이언트의 비공개 환경 변수/인증 설정에 Bearer 토큰을 등록합니다. OAuth 서버를 구현한 서비스라고 표기하지 않습니다.

배포 후 확인할 항목:

- `/healthz` 응답 및 컨테이너 healthy
- 토큰 없이 tools/call 요청 시 401, 토큰 사용 시 정상 응답
- 정상 4대, 타임아웃 성공 3대/실패 1대, 재시도 복구 4대
- `/audit` 요청 기록과 컨테이너 재시작 후 SQLite 기록 유지
- 잘못된 Origin 403, 큰 본문 413, 요청 제한 429
- 실제 Codex MCP 호출. 브라우저 로컬 시연으로 원격 연결 검증을 대체하지 않음

## 운영 기록

첫 배포 시각, 실제 요청, 수정 내용, 재시작과 장애 대응 결과를 날짜별로 기록합니다. 신규 데모의 준비·테스트를 이전 상용 운영 경력으로 소급하지 않습니다. 실설비 제어·연결과 AI 진단은 구현 범위에 포함하지 않습니다.

공식 참고: [가입](https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signingup_topic-Sign_Up_for_Free_Oracle_Cloud_Promotion.htm), [상시 무료 리소스](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm), [첫 Linux VM](https://docs.oracle.com/en-us/iaas/Content/Compute/tutorials/first-linux-instance/overview.htm).
