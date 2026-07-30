# AI Agents with MCP

`AI Agents with MCP`의 영문·국문 원고를 GitBook 스타일로 제공하는 Jekyll
사이트입니다.

## 문서 구조

- `index.md`: 언어 선택 홈
- `_pages/ai-agents-with-mcp/en/`: 영문 출판 페이지
- `_pages/ai-agents-with-mcp/ko/`: 국문 출판 페이지
- `_data/mcp_book.yml`: 사이드바 순서와 공개 URL
- `_drafts/ai-agents-with-mcp/`: 국문 통합 원고
- `scripts/split_mcp_book.ps1`: 통합 원고를 출판 페이지로 분리하는 스크립트

`_pages`의 문서만 Jekyll `pages` 컬렉션으로 출판됩니다. 통합 원고와 이
README는 빌드 결과에서 제외됩니다.

## 로컬 실행

Ruby 3.2 이상에서 저장소에 포함된 binstub을 사용합니다. 의존성은
`vendor/bundle`에 설치되며 Git에는 포함되지 않습니다.

```shell
bin/bundle install
bin/jekyll serve
```

기본 주소는 `http://localhost:4000/jekyll-gitbook/`입니다.

배포용 결과만 만들려면 다음 명령을 실행합니다.

```shell
bin/jekyll build
```

## 배포

`master` 브랜치에 푸시하면 `.github/workflows/pages.yml`이 사이트를 빌드해
GitHub Pages에 배포합니다.

## 라이선스

저장소의 `LICENSE` 파일을 참고하세요.
