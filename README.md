# HistudyCard

한국사를 주제로 학습 콘텐츠를 수집하고, 퀴즈와 학습 세트를 만들어 복습할 수 있는 풀스택 애플리케이션입니다. 콘텐츠와 퀴즈를 직접 작성하거나 불러와 저장하고, 학습 결과에 따라 보상을 관리할 수 있습니다.

## 주요 기능

- **콘텐츠 관리**: 한국사 학습 자료를 제목·본문·태그·하이라이트·연표와 함께 등록하고 삭제할 수 있습니다.
- **퀴즈 생성/관리**: 저장된 콘텐츠에서 다양한 형식(MCQ, 주관식, OX, 빈칸, 순서, 짝맞추기)의 퀴즈를 추가하거나 제거할 수 있습니다.
- **학습 세트**: 퀴즈를 조합해 학습 세트를 만들고, 학습 중 정답률과 카드별 시도/정답 횟수를 기록합니다.
- **보상 시스템**: 보상을 생성하고 학습 세트에 연결하여 사용/미사용 상태를 추적합니다.
- **관리자 도구**: 관리자 계정은 사용자 목록을 조회하고 새로운 관리자/일반 계정을 생성할 수 있습니다.

## 디렉터리 구조

```
.
├── app/                # FastAPI 백엔드 (SQLAlchemy, Pydantic, REST API)
├── frontend/           # React + Vite 프런트엔드 (TypeScript)
├── tests/              # 백엔드 테스트
├── requirements.txt    # 백엔드 Python 의존성
├── package.json        # 프런트엔드 npm/yarn 스크립트 및 의존성
├── venv/               # (옵션) Python 가상환경
└── README.md           # 루트 문서(현재 파일)
```

### app/
- `main.py`: FastAPI 애플리케이션 엔트리포인트. 콘텐츠/퀴즈/학습 세트/보상 관련 REST 엔드포인트 정의.
- `crud.py`: SQLAlchemy ORM을 활용한 데이터베이스 조작 로직.
- `models.py`: 테이블 스키마(`Content`, `Quiz`, `StudySession`, `Reward` 등).
- `schemas.py`: 요청/응답에 사용되는 Pydantic 모델.
- `validators.py`: 콘텐츠 임포트 시 유효성 검사.

### frontend/
- `src/api.ts`: 백엔드 REST API 호출 래퍼.
- `src/routes/`: 주요 페이지 컴포넌트 (콘텐츠 리스트/상세, 퀴즈 리스트, 학습 페이지, 보상 관리, 퀴즈/콘텐츠 생성 등).
- `src/components/`: 재사용 가능한 UI 컴포넌트 (헤더, 카드 프리뷰, 학습 카드 러너 등).

## 시작하기

1. **의존성 설치**
   - 백엔드: 가상환경 생성 (예: `python3 -m venv venv && source venv/bin/activate`) 후 `pip install -r requirements.txt`
   - 프런트엔드: Yarn Workspace를 사용하므로 루트에서 `yarn install`을 실행하면 `frontend` 패키지 의존성도 함께 설치됩니다. (npm을 사용할 경우 `npm install` 동등)

2. **동시 실행 (권장)**
   - 루트에서 `yarn dev` (또는 `npm run dev`)를 실행하면 `uvicorn app.main:app --reload --port 8000`과 `frontend`의 Vite 개발 서버가 동시에 기동됩니다.

3. **수동 실행 (선택)**
   - 백엔드만 실행: `uvicorn app.main:app --reload`
   - 프런트엔드만 실행: `cd frontend && yarn dev`

4. 브라우저에서 프런트엔드(기본 `http://localhost:5173`)에 접속하면 FastAPI 백엔드(`http://localhost:8000`)와 통신하면서 콘텐츠/퀴즈/학습/보상 기능을 사용할 수 있습니다.

## 추가 문서

- 세부 동작 및 실행 방법은 `frontend/README.md`와 코드 주석을 참고하세요.

## Docker 실행

루트 디렉터리에서 아래 명령으로 프론트엔드 정적 빌드와 백엔드를 포함한 단일 이미지를 생성하고 기동할 수 있습니다.

```bash
docker compose up --build
```

컨테이너는 기본적으로 8000 포트를 사용하며, 브라우저에서 `http://localhost:8000`으로 접속하면 정적 프론트엔드와 REST API를 모두 이용할 수 있습니다. 환경변수를 변경하려면 루트의 `.env` 파일을 수정하세요.

기본 제공 변수는 다음과 같습니다.

| 변수 | 설명 | 기본값 |
| --- | --- | --- |
| `HOST` | Uvicorn 서버가 바인딩할 호스트 | `0.0.0.0` |
| `PORT` | API/프런트엔드를 노출할 포트 | `8000` |
| `CORS_ALLOW_ORIGINS` | 허용할 CORS origin (콤마 구분, `*` 허용 가능) | `*` |
| `CORS_ALLOW_ORIGIN_REGEX` | CORS origin 정규식 (선택) | _(빈 문자열)_ |
| `FRONTEND_DIST` | 정적 파일 경로 (컨테이너 내부) | `/app/frontend` |
| `VITE_API_BASE_URL` | SPA 빌드 시 강제 API URL (미지정 시 브라우저 host 사용) | _(빈 문자열)_ |
| `VITE_API_PORT` | SPA 빌드 시 사용할 API 포트 | `8000` |
| `MYSQL_HOST` | MySQL 호스트 (설정 시 SQLite 대신 MySQL 사용) | _(빈 문자열)_ |
| `MYSQL_PORT` | MySQL 포트 | `3306` |
| `MYSQL_USER` | MySQL 사용자 | _(빈 문자열)_ |
| `MYSQL_PASS` | MySQL 비밀번호 | _(빈 문자열)_ |
| `MYSQL_DB` | 사용할 데이터베이스 이름 (존재하지 않으면 자동 생성) | _(빈 문자열)_ |
| `ADMIN_EMAIL` | 기본 관리자 계정 이메일 (선택) | _(빈 문자열)_ |
| `ADMIN_PASSWORD` | 기본 관리자 계정 비밀번호 (선택) | _(빈 문자열)_ |
| `OPENAI_API_KEY` | AI 카드 생성을 위한 OpenAI API 키 | _(빈 문자열)_ |
| `EXTRACT_MODEL` | 사실 추출 단계에 사용할 모델 | `gpt-5-nano` |
| `GENERATE_MODEL` | 카드 생성 단계에 사용할 모델 | `gpt-4o-mini` |
| `FIX_MODEL` | 보정 단계에 사용할 모델 | `gpt-4o-mini` |
| `MAX_OUT_EXTRACT` | 추출 단계 출력 토큰 상한 | `400` |
| `MAX_OUT_GENERATE` | 생성 단계 출력 토큰 상한 | `900` |
| `MAX_OUT_FIX` | 보정 단계 출력 토큰 상한 | `400` |
| `TEMP_EXTRACT` | 추출 단계 temperature | `0.2` |
| `TEMP_GENERATE` | 생성 단계 temperature | `0.4` |
| `TEMP_FIX` | 보정 단계 temperature | `0.2` |
| `GEN_BATCH_SIZE` | 카드 유형 병렬 생성 배치 크기 | `3` |
| `CACHE_TTL` | AI 캐시 TTL(초) | `86400` |
| `REQUEST_TIMEOUT_SEC` | OpenAI 요청 타임아웃(초) | `60` |

`ADMIN_EMAIL`과 `ADMIN_PASSWORD`를 함께 지정하면 서버 기동 시 해당 이메일로 관리자 계정이 존재하는지 확인하고, 없으면 새로 생성합니다. 이미 존재하는 경우에는 관리자 권한을 유지하며 비밀번호를 재설정합니다.

AI 카드 생성을 사용하려면 최소한 `OPENAI_API_KEY`와 단계별 모델(미지정 시 기본값 사용)을 설정하세요. 필요에 따라 출력 토큰 상한, temperature, 병렬 배치 크기를 조절해 비용과 응답 시간을 조정할 수 있습니다.

`PORT` 값을 바꾸면 `docker compose`에서 호스트 포트 매핑도 자동으로 반영됩니다.

## Docker Hub 배포 (GitHub Actions)

GitHub Actions 워크플로(`.github/workflows/docker-publish.yml`)가 리포지토리를 Docker Hub로 자동 배포합니다. 사전에 아래 시크릿을 GitHub 리포지토리에 등록해야 합니다.

- `DOCKERHUB_USERNAME`: Docker Hub 사용자명
- `DOCKERHUB_TOKEN`: `Read & Write` 권한의 Docker Hub Access Token
- `DOCKERHUB_REPOSITORY`: `username/repository` 형태의 전체 리포지토리 경로

`main` 브랜치로의 push 또는 `v*` 태그 push 시 워크플로가 실행되며, 브랜치/태그/커밋 SHA를 기반으로 이미지를 태깅하고 `docker.io/DOCKERHUB_REPOSITORY`에 push 합니다. 필요 시 `workflow_dispatch` 이벤트로 수동 실행도 가능합니다.

### GitHub Actions용 .env 값 주입

워크플로는 빌드 전에 `.env` 파일을 생성하며, 아래 GitHub Secrets를 통해 값을 주입할 수 있습니다(미지정 시 기본값 사용).

- `APP_HOST`, `APP_PORT`
- `CORS_ALLOW_ORIGINS`, `CORS_ALLOW_ORIGIN_REGEX`
- `FRONTEND_DIST`
- `VITE_API_BASE_URL`, `VITE_API_PORT`
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASS`, `MYSQL_DB`

위 항목을 설정하면 Docker 이미지를 배포 환경에 맞는 설정으로 빌드할 수 있습니다.
