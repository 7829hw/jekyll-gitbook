---
title: '5장. MCP 서버 구축: 애플리케이션에 도구, 프롬프트, 리소스 제공하기'
author: Kyle Stratis
layout: post
permalink: /AI_Agent_with_MCP/ko/chapter_5.html
lang: ko
book_order: 5
---
<a id="ch05"></a>

# 5장. MCP 서버 구축: 애플리케이션에 도구, 프롬프트, 리소스 제공하기

MCP에서 클라이언트 반대편에는 서버가 있다. 3장의 모든 클라이언트 예제는 호스트 애플리케이션에 계산 기능을 제공하는 미리 구축된 로컬 서버를 사용했다. 이 장에서는 같은 서버를 처음부터 구축하면서 서버가 클라이언트와 호스트 애플리케이션에 제공할 수 있는 모든 프리미티브와 기능을 살펴본다.

###### 참고

클라이언트 장에서는 클라이언트 관점에서 *호스트 애플리케이션*을 이야기했다. 이제 서버를 구축하므로 클라이언트와 호스트 애플리케이션을 구분할 수 없는 서버의 관점을 취한다. 이 장들에서는 둘을 묶어 *클라이언트 애플리케이션* 또는 간단히 *클라이언트*라고 부른다.

먼저 서버의 역할과 유용성, 클라이언트 연결 방식, Python SDK로 구축하는 두 가지 주요 경로를 높은 수준에서 살펴본다. 이어 다음 세부 사항을 다룬다.

- 서버 프리미티브(도구, 프롬프트, 리소스)와 제공 방법
- 서버 유틸리티(완성, 로깅, 알림, 페이지네이션)와 사용 방법
- 서버 보안
- 샘플링과 정보 요청 같은 클라이언트 제공 리소스 사용

서버 개발자는 서버 테스트에도 익숙해져야 한다. 서버와 도구를 시각화하고 상호 작용하는 MCP Inspector와, 전통적인 AI 시스템용 테스트를 용도에 맞게 활용한 평가를 배운다.

<a id="id73"></a>

# 서버는 어디에 유용한가?

서버는 MCP를 처음 접하는 개발자에게 가장 인기 있는 진입점이다. Claude Desktop, Claude Code, Cursor 같은 인기 도구는 애플리케이션에 서버를 추가하는 기능을 내장하며, MCP SDK 관리자는 서버 개발을 최대한 쉽게 만드는 데 집중해 왔다. 그 결과 보안과 성능이 취약한 서버가 즉시 공개되거나 MCP 서버의 더 깊은 이점이 가려지는 부작용도 생겼다.

서버의 가장 분명한 역할은 애플리케이션에 MCP 프리미티브 접근 권한을 제공하여 이전에 없던 능력을 부여하는 것이다. MCP의 구성 요소인 프리미티브에는 도구, 프롬프트, 리소스가 있다. [3장](../chapter_3.html#ch03)에서 클라이언트가 이들을 간단한 채팅 애플리케이션과 통합했다. 도구는 프로그래밍된 행동, 리소스는 언어 모델의 컨텍스트로 사용할 구조화된 데이터, 프롬프트는 클라이언트 애플리케이션 언어 모델을 위한 대화형 지침을 제공한다. [MCP 명세](https://modelcontextprotocol.io/specification/2025-06-18/server)에서는 각 프리미티브를 서로 다른 주체가 제어하도록 설계한다. 도구는 호출하는 모델, 리소스는 사용 방식을 결정하는 애플리케이션, 프롬프트는 사용을 시작하고 입력을 제공하는 애플리케이션 사용자가 제어한다.

이러한 용도와 제어 주체를 MCP 명세에서 일부 수정해 가져온 다음 표에 요약했다.

<a id="server_primitive_table"></a>

*표 5-1. [MCP 서버 명세](https://modelcontextprotocol.io/specification/2025-06-18/server)의 MCP 서버 프리미티브, 제어 주체, 설명*

| 프리미티브 | 제어 주체 | 설명 |
| --- | --- | --- |
| 도구 | 모델 | 어떤 행동을 수행하도록 LLM에 노출한 함수 |
| 리소스 | 애플리케이션 | 서버를 사용하는 애플리케이션이 관리하는 컨텍스트 데이터 |
| 프롬프트 | 애플리케이션 사용자 | 사용자의 선택으로 호출하는 대화형 템플릿 |

서버의 진정한 힘은 애플리케이션 확장과 관련된 또 다른 곳, 즉 배포 문제 해결에 있다. MCP 이전에는 도구, 데이터 소스, 프롬프트가 사용하는 지능형 애플리케이션과 강하게 결합되어 공유하고 재사용하기 어려웠다. 애플리케이션의 LLM이 AWS 문서에 접근하게 하려면 직접 연결하고 검색 코드를 작성해 LLM이 사용할 수 있게 해야 했다. MCP를 사용하면 도구를 더 잘 아는 AWS 담당자가 MCP 서버를 작성하여 연결할 수 있는 누구에게나 이 기능을 제공할 수 있다. 애플리케이션 개발자는 애플리케이션 로직에 집중하고 나머지는 MCP 서버에 맡긴다. 서버 작성자는 GitHub 같은 코드 공유 플랫폼이나 MCP 클라이언트가 원격으로 연결할 수 있는 실행 중인 서버로 배포한다. MCP 서버를 단일 파일로 작성할 수 있어 공유와 재사용이 훨씬 쉬우며 원격 웹 서버에 배포하면 더욱 그렇다.

<a id="id74"></a>

# 전송 계층으로 서버와 애플리케이션 연결하기

서버가 MCP 클라이언트를 통해 애플리케이션과 통신하는 핵심은 *전송 계층*이다. [3장](../chapter_3.html#ch03)의 클라이언트 예제에서 접했으며 8장에서 세부 사항을 깊이 다룬다. 서버 개발에서는 클라이언트 애플리케이션에 서버를 배포할 수 있는 선택지를 이해해야 한다. 프로토콜은 기반 통신 프로토콜로 [JSON-RPC](https://www.jsonrpc.org/)를 사용하며, 전송 계층은 이 프로토콜로 인코딩한 메시지를 클라이언트와 서버 사이에 전달한다. MCP와 SDK는 로컬 연결용 stdio와 원격 연결용 Streamable HTTP라는 두 가지 주요 전송을 지원한다. 프로토콜은 가능한 한 stdio를 지원하도록 권장한다. 사용자는 서버 스크립트를 애플리케이션에 로컬로 불러오고, 보통 서버 `README`에 안내된 명령으로 MCP 클라이언트가 실행하게 하여 쉽게 연결할 수 있다. MCP 클라이언트는 서버 스크립트를 장기 실행 하위 프로세스로 실행하며 서버는 표준 입력으로 메시지를 읽고 표준 출력으로 쓴다. 그림 5-1은 stdio 연결의 기본 흐름을 보여 준다.

반면 Streamable HTTP는 서버와 클라이언트가 같은 시스템에서 실행될 필요 없는 원격 연결을 지원하도록 설계되었다. 서버는 GET과 POST 요청을 지원하는 단일 HTTP 엔드포인트, MCP 명세에서 말하는 *MCP 엔드포인트*를 제공해야 한다. GET은 클라이언트가 서버 연결을 시작할 때, POST는 요청·알림·이벤트를 서버에 보낼 때 사용한다. 선택적 SSE 스트리밍도 허용하며, 이를 통해 단일 MCP 클라이언트 인스턴스가 서로 다른 스트림으로 여러 서버에 동시에 연결할 수 있다.

###### 참고

Streamable HTTP는 주로 원격 서버용이지만 로컬에서도 사용할 수 있어 디버깅과 테스트에 도움이 된다. 로컬에서는 `0.0.0.0`보다 `localhost`(`127.0.0.1`)를 사용하도록 명세가 권장한다.

그림 5-2는 Streamable HTTP 연결의 기본 흐름을 보여 준다.

공개 인터넷에서 원격 서버를 운영하는 데 따르는 고유한 문제 때문에 MCP 명세는 스트리밍 세션 재개와 OAuth 권한 부여를 지원한다. 세션 재개를 지원하려면 서버가 각 SSE 이벤트에 전역적으로 고유한 이벤트 ID인 `id` 필드를 포함한다. 스트리밍 연결이 끊기면 클라이언트는 마지막으로 받은 이벤트 ID를 `_Last-Event-ID_` 헤더에 넣어 GET 요청을 보낸다. 서버는 같은 스트림에서 해당 ID 뒤에 전송했어야 할 메시지를 다시 보낸다. 서버가 여러 스트림을 동시에 열 수 있으므로 다른 스트림용 메시지를 보내면 안 된다.

> 스트림을 교차하지 마라.
>
> Dr. Egon Spengler, *Ghostbusters (1984)*

스트리밍 세션 재개 구현은 선택 사항이지만 원격 서버의 권한 부여는 필수다. MCP 명세는 OAuth 권한 부여를 규정하며 일반적으로 서버 개발자가 언어 기본 OAuth 라이브러리로 흐름을 처리하도록 요구한다. MCP와 생성형 AI의 고유한 특성은 중간자 공격, 세션 하이재킹, 토큰 패스스루 공격, 도구 오염 등 신구 위협에 서버를 노출한다. 서버 개발자는 자신과 사용자 데이터를 보호하기 위해 방어를 최우선으로 고려해야 한다. 이 장 뒤의 서버 보안 절에서 자세히 다룬다.

보안과 권한 부여를 제외한 연결 관리 세부 사항 대부분은 [3장](../chapter_3.html#ch03)의 클라이언트 예제처럼 MCP SDK가 추상화한다. 다음 절에서는 Python SDK로 MCP 서버를 구축하는 두 방법을 소개하고, 그중 한 방법을 프로젝트에서 사용하는 세부 사항을 알아본다.

<a id="id75"></a>

# Python SDK로 서버 구축하기

MCP와 여러 SDK가 처음 공개되었을 때 MCP 서버 구축 방법은 하나뿐이었다. SDK가 구축 방식에 관해 의견을 갖는 것은 일반적이므로 놀라운 일은 아니다. 그러나 얼마 지나지 않아 Python MCP 서버 구축을 크게 단순화한 FastMCP가 공개되어 큰 인기를 얻었고 공식 MCP Python SDK에 통합되었다. 그 결과 거의 모든 활용 사례를 위한 FastMCP와 더 세밀한 제어가 필요한 경우를 위한 기존 ‘저수준’ API라는 2계층 구조가 생겼다.

###### 경고

FastMCP 1.0을 FastMCP 2.0 또는 FastAPI와 혼동하지 말자. FastMCP 1.0은 MCP 서버 개발 경험 재설계에 집중하고, FastMCP 2.0은 자체 설계로 Python에서 MCP를 구현하며 전체 Python SDK로 범위를 넓힌다.

> <a id="antipattern_rest_apis"></a>
>
> # 안티패턴 경고: REST API로 MCP 서버 만들기
>
> MCP 커뮤니티와 공개 서버에서 기존 REST API로 MCP 서버를 자동 생성하는 사례를 자주 본다. 조직의 API를 에이전트에 노출하려는 제품과 도구가 이를 부추기지만 일반적인 안티패턴이다. REST API는 보통 세분화되고 상태 비저장이며 다형적인 반면, 에이전트는 입력과 출력 형식이 명확하고 하나의 잘 정의된 행동을 수행하는 도구를 가장 잘 사용한다. 단일 활동에 REST API 엔드포인트 여러 개를 호출해야 하면 도구 선택 오류 가능성과 사용자 에이전트 행동 비용이 모두 증가한다. 에이전트에 도구가 너무 많으면 선택 오류율이 높아지고, 한 행동에 여러 도구를 선택하고 호출하면 오류율이 누적된다. 행동별 올바른 도구 선택 성공률이 95%인 에이전트가 도구 5개를 선택해야 하면 성공률은 약 77%로 떨어진다.
>
> 비용도 폭증한다. 단일 행동에 도구 5개를 호출하면 각 턴의 입력 토큰 수에 이전 턴의 입출력 토큰이 포함되어 빠르게 누적된다. 3장의 간단한 예제 서버를 바탕으로 대략 계산하면 전체 토큰 사용량은 약 8배, 비용은 거의 7배 늘 수 있다. 자동 생성 MCP 서버를 그대로 배포하지 말고 [Prefect CEO Jeremiah Lowin의 조언](https://www.jlowin.dev/blog/stop-converting-rest-apis-to-mcp)에 따라 최종 서버의 출발점으로 사용한 뒤, 에이전트에 필요 없는 요소와 불분명한 변수 등을 제거하도록 생성된 도구를 ‘적극적으로 선별’해야 한다. 더 좋은 방법은 전통적인 제품 중심 소프트웨어 개발의 사용자 스토리와 유사한 ‘에이전트 스토리’를 사용해 처음부터 에이전트가 가장 잘 사용할 서버를 만드는 것이다.

<a id="id76"></a>

## FastMCP

FastMCP는 이제 Python SDK로 MCP 서버를 구축하는 기본 방법이며, 원래 SDK 설계의 강력함 대부분을 훨씬 간단한 인터페이스로 제공한다. FastAPI처럼 주로 데코레이터를 통해 서버 코드와 상호 작용하며 서버 인증 같은 기능을 기본 지원한다. 가장 중요한 점은 모든 MCP 프리미티브와 정보 요청·샘플링 같은 클라이언트 측 기능을 지원한다는 것이다. 서버 수명 주기도 관리할 수 있어 FastMCP 서버 인스턴스화 시 데이터베이스에 연결하고 종료 시 닫을 수 있다. 기본적으로 FastMCP 객체를 인스턴스화하고 서버 이름을 전달하기만 하면 된다.

<a id="instantiate_fastmcp"></a>

```python
from mcp.server.fastmcp import Context, FastMCP

mcp = FastMCP(name="server_name")
```

이는 MCP 프리미티브를 서버에 추가하는 데 사용할 FastMCP 객체를 인스턴스화할 뿐이다. 클라이언트에 표시할 지침, 디버그 모드 플래그, 기본 로그 수준, JSON 응답 플래그 등 더 많은 옵션을 `FastMCP` 생성자에 추가할 수 있다. 이들은 서버에서 `Context` 객체로 노출되며 서버 함수의 매개변수로 전달하여 함수 안에서 사용할 수 있다.

그런 다음 `mcp.run()`으로 서버를 시작하면 서버가 중지될 때까지 블로킹한다. `run()` 메서드에 전송 방식을 전달할 수도 있으며, 이 경우 서버를 시작하고 await할 수 있는 코루틴을 반환한다.

<a id="run_fastmcp"></a>

```python
if __name__ == "__main__":
    mcp.run()
```

직접 실행하는 것 외에도 `uv run mcp dev server.py`로 개발 모드에서 [그림 2-5](../chapter_2.html#mcp_inspector)를 사용해 서버를 실행하거나, `uv run mcp install server.py`로 Claude Desktop에서 실행되도록 설치할 수 있다. 이 방법은 저수준 API 서버가 아닌 FastMCP 서버에서만 동작하며 프로젝트에 MCP 개발 도구가 설치되어 있어야 한다. 프로젝트에서 `uv add "mcp[cli]"`를 실행해 설치할 수 있다.

<a id="id77"></a>

## 저수준 서버 API

저수준 API는 FastMCP API의 모든 기능을 포함한 전체 MCP 프로토콜을 제공하면서 클라이언트 요청, 서버 수명, 도구 호출 처리 방식을 완전히 제어하게 한다. FastMCP에서는 Python 함수에 `@mcp.tool()` 같은 데코레이터를 붙이면 클라이언트가 서버에 도구 목록을 요청할 때 FastMCP가 목록을 구축해 반환한다. 정확한 방법은 [‘서버 프리미티브: 도구, 프롬프트, 리소스’](#server_primitives)에서 본다. 저수준 API에서는 `tool/list` 요청의 응답을 직접 구현해 서버 반환 내용을 더 세밀하게 제어할 수 있다. `mcp.server.lowlevel`에서 `Server`를 가져오고 `async` 함수를 만들며 서버 이름·버전·기능 같은 초기화 옵션을 설정한 뒤 비동기 `stdio_server()` 컨텍스트 관리자 안에서 서버를 인스턴스화한다. 컨텍스트 관리자에서 얻은 읽기 및 쓰기 스트림과 초기화 옵션도 전달한다. 마지막으로 `asyncio.run()`으로 함수를 호출해 서버를 비동기로 시작한다.

<a id="start_low_level_server"></a>

```python
import asyncio

import mcp.server.stdio
from mcp.server.lowlevel import NotificationOptions, Server
from mcp.server.models import InitializationOptions

# Create a server instance
server = Server("low-level-server")

async def run():
    print("Running low-level server")
    initialization_options = InitializationOptions(
        server_name="low-level-server",
        server_version="0.1.0",
        capabilities=server.get_capabilities(
            notification_options=NotificationOptions(),
            experimental_capabilities={},
        ),
    )

    async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream=read_stream,
            write_stream=write_stream,
            initialization_options=initialization_options,
        )


if __name__ == "__main__":
    asyncio.run(run())
```

저수준 API의 서버 인스턴스화는 FastMCP보다 장황하지만 드물게 필요한 추가 기능과 유연성을 제공한다. 예제 도입에서 설명하지 않은 `get_capabilities()` 메서드는 서버에 프롬프트·리소스·도구 같은 기능의 핸들러가 등록되었는지 확인한다. 핸들러를 찾으면 해당 기능을 나타내는 클래스 인스턴스(예: `PromptsCapability`)를 만들어 `InitializationOptions` 객체에 포함되는 `ServerCapabilities` 객체로 전달한다. MCP 명세가 요구하는 기능 선언을 저수준 API에서 처리하는 방식이다. `get_capabilities()`에 전달하는 `NotificationOptions` 객체는 어떤 기능이 알림을 지원하는지 결정한다.

도구 사용을 지원하려면 `tools/list`와 `tool/call` 요청 핸들러를 구현해야 하며 프롬프트와 리소스도 마찬가지다. [‘서버 프리미티브: 도구, 프롬프트, 리소스’](#server_primitives)에서 보듯 선언한 도구 함수로 목록을 추론하는 FastMCP보다 복잡하다. 도구 목록 요청을 처리하려면 `Tool` 객체 목록을 반환하는 함수를 작성한다. 각 `Tool`은 `name`, `description`, `inputSchema`와 선택적 `outputSchema`를 갖는다. `inputSchema`는 `type`, `properties`, `required` 키가 있는 JSON 객체여야 한다. `properties`는 도구 함수 인수를 키로, 인수 형식과 설명 딕셔너리를 값으로 갖고, `required`는 필수 인수 목록이다. 다음 예제에서는 `list_tools()`로 구현한다. 도구는 `add()`에 구현하고 `@server.call_tool()` 데코레이터로 선언한다. 저수준 API의 모든 도구 함수는 도구 이름 `name`과 도구 인수 및 값의 딕셔너리 `args`를 받는다.

올바른 도구 호출을 보장하려면 `name` 내용이 예상값인지 확인한다. `inputSchema`에 정의한 인수는 `args`의 키로 접근한다. 결과는 `TextContent` 같은 `Content` 객체나 결과 형식과 결과 자체를 선언한 딕셔너리로 반환할 수 있다. 아래 예제는 후자를 사용해 `text` 형식과 계산식 및 결과를 보여 주는 f-string을 반환한다.

<a id="low_level_list_call_tools"></a>

```python
from typing import Any

import mcp.server.stdio
...
from mcp.types import Tool
...
@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all tools available on the server."""
    return [
        Tool(
            name="add",
            description="Add two numbers together.",
            inputSchema={
                "type": "object",
                "properties": {
                    "a": {
                        "type": "number",
                        "description": "The first number to add"
                    },
                    "b": {
                        "type": "number",
                        "description": "The second number to add"
                    },
                },
                "required": ["a", "b"],
            },
        )
    ]


@server.call_tool()
async def add(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Add two numbers together.

    Args:
        a: First number
        b: Second number
    """
    if name != "add":
        raise ValueError(f"Unknown tool: {name}")
    result = args["a"] + args["b"]
    return {"type": "text", "text": f"{args['a']} + {args['b']} = {result}"}
```

간단한 예제지만 특정 프리미티브(도구 등)를 나열하는 함수와 도구 로직을 구현하는 기본 과정을 보여 준다. 도구에 구조화된 출력 스키마를 제공하면 출력이 일정한 구조로 MCP 클라이언트와 호스트 애플리케이션에 전달된다. 전송 전 출력을 검증하고, 콘텐츠 블록만 보내는 대신 구조화 데이터만 또는 구조화 데이터와 사람이 읽을 수 있는 콘텐츠 블록의 튜플을 반환할 수 있다. FastMCP 구현에서는 이 작업이 자동으로 수행된다.

<a id="low_level_strucutred_output"></a>

```python
@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all tools available on the server."""
    return [
        Tool(
            name="add",
            description="Add two numbers together.",
            inputSchema={
                "type": "object",
                "properties": {
                    "a": {"type": "number", "description": "The first number to add"},
                    "b": {"type": "number", "description": "The second number to add"},
                },
                "required": ["a", "b"],
            },
            outputSchema={
                "type": "object",
                "properties": {
                    "augend": {
                        "type": "number",
                        "description": "The first number to add",
                    },
                    "addend": {
                        "type": "number",
                        "description": "The second number to add",
                    },
                    "sum": {
                        "type": "number",
                        "description": "The result of the addition",
                    },
                },
                "required": ["augend", "addend", "sum"],
            },
        )
    ]

@server.call_tool()
async def add(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Add two numbers together.

    Args:
        a: First number
        b: Second number
    """
    if name != "add":
        raise ValueError(f"Unknown tool: {name}")
    result = {"augend": args["a"], "addend": args["b"], "sum": args["a"] + args["b"]}
    return result
```

저수준 API에서 출력 스키마를 사용하는 과정은 두 단계다. 먼저 `list_tools()` 핸들러의 올바른 도구 정의에 스키마를 선언하고, 도구 자체에서 구조화 데이터를 반환한다. 출력 스키마는 입력 스키마와 같은 구조다. 값이 `"object"`인 `type` 키와 도구 출력에서 예상하는 구성 요소를 담는 `properties` 객체가 있는 JSON 객체 형태의 Python 딕셔너리다. 필수 속성 목록을 담는 선택적 `required` 필드도 있다. 필수 속성을 지정하지 않으면 어떤 출력도 유효하다. 도구에서는 출력 스키마의 `properties`와 같은 키를 가진 딕셔너리를 반환해야 한다. MCP는 출력을 스키마에 맞게 자동 검증하고 필수 필드가 없거나, 이름이 틀리거나, 형식이 잘못된 경우 오류를 발생시킨다.

`add()` 결과의 필드 이름 하나를 바꾼 뒤 MCP Inspector에서 서버와 도구를 실행해 보자. 어떤 일이 일어나는가?

저수준 서버는 이처럼 간단한 예제를 지원하는 데도 작업이 훨씬 많지만 서버 수명 주기 API를 사용할 수 있다는 이점이 있다. 수명 주기 API는 여러 작업을 지원하며, 주로 서버 시작과 종료 시 데이터베이스 연결 같은 필요한 리소스를 설정하고 해제하게 한다. 생성 비용이 크거나 연결에 시간이 걸리거나 서버 중지 시 명시적으로 닫아야 하는 리소스에 유용하다. Python 표준 라이브러리 `contextlib`의 `@asynccontextmanager` 데코레이터를 붙인 `async` 함수를 만든다. 함수는 `Server` 형식의 인수를 받고 `AsyncIterator` 객체를 yield해야 한다. 본문에서 설정을 수행하고, `try` 블록에서 컨텍스트 객체로 제공할 객체를 딕셔너리로 yield하며, `finally` 블록에서 필요한 해제 작업을 수행한다. 이 함수를 `lifespan` 인수로 `Server` 생성자에 전달한다.

서버에서 요청할 수 있는 수명 주기 컨텍스트 객체를 통해 이러한 리소스를 도구, 프롬프트, 리소스에도 제공할 수 있다. 에이전트용 함수에서 컨텍스트 객체에 접근하려면 서버 객체의 `request_context` 속성을 사용한다. 그러면 수명 주기 함수가 yield한 딕셔너리를 받는다. 다음 예제는 앞 예제를 확장해 이를 보여 준다.

<a id="lifespan_management"></a>

```python
import asyncio
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime

...

@asynccontextmanager
async def lifespan(server: Server) -> AsyncGenerator[dict[str, list[str]]]:
    logs = []
    logs.append(f"{datetime.now()}: Server started")
    print(logs[-1], file=sys.stderr)
    try:
        logs.append(f"{datetime.now()}: logs yielded")
        yield {"logs": logs}
    finally:
        logs.append(f"{datetime.now()}: Server stopped, printing all logs")
        print(logs, file=sys.stderr)

# Create a server instance
server = Server("low-level-server", lifespan=lifespan)

@server.list_tools()
async def list_tools() -> list[Tool]:
    """List all tools available on the server."""
    ctx = server.request_context
    logs = ctx.lifespan_context["logs"]
    print(logs[-1], file=sys.stderr)
    logs.append(f"{datetime.now()}: list_tools called")
    print(logs[-1], file=sys.stderr)

    return [
        Tool(
            name="add",
            description="Add two numbers together.",
            inputSchema={
                "type": "object",
                "properties": {
                    "a": {
                        "type": "number",
                        "description": "The first number to add",
                    },
                    "b": {
                        "type": "number",
                        "description": "The second number to add",
                    },
                },
                "required": ["a", "b"],
            },
            outputSchema={
                "type": "object",
                "properties": {
                    "augend": {
                        "type": "number",
                        "description": "The first number to add",
                    },
                    "addend": {
                        "type": "number",
                        "description": "The second number to add",
                    },
                    "sum": {
                        "type": "number",
                        "description": "The result of the addition",
                    },
                },
                "required": ["augend", "addend", "sum"],
            },
        )
    ]

@server.call_tool()
async def add(name: str, args: dict[str, Any]) -> dict[str, Any]:
    """Add two numbers together.

    Args:
        a: First number
        b: Second number
    """
    if name != "add":
        raise ValueError(f"Unknown tool: {name}")
    result = {"augend": args["a"], "addend": args["b"], "sum": args["a"] + args["b"]}
    ctx = server.request_context
    logs = ctx.lifespan_context["logs"]
    logs.append(f"{datetime.now()}: add called")
    print(logs[-1], file=sys.stderr)
    return result

async def run():
    print("Running low-level server", file=sys.stderr)
    ...
```

이 예제에서는 서버에 기초적인 로깅 기능을 추가했다. `lifespan()` 함수를 정의하고 `@asynccontextmanager`로 장식하여 컨텍스트 관리자로 사용할 수 있게 한 뒤 함수 안에 로그를 담을 목록을 만든다. 함수 본문은 서버 시작 시 호출되므로 서버 시작을 알리는 로그 메시지를 추가한다. 이어 `try` 블록에서 로그를 yield한다는 메시지를 추가하고 딕셔너리 안의 로그를 yield한다. `lifespan()`은 서버 시작 시 한 번만 호출되고 `logs` 목록도 한 번만 yield한다. 이후에는 yield된 딕셔너리를 가져오므로 목록 업데이트는 직접 수행해야 한다.

`finally` 블록은 서버 종료 시 사용한다. 서버 초기화 함수에는 정의한 `lifespan()` 함수를 받는 `lifespan` 매개변수를 추가한다. 코드 어디서든, 예제에서는 `list_tools()`와 `add()`에서 `server.request_context`를 호출하면 컨텍스트 객체의 로그 목록에 접근해 직접 업데이트하고 가장 최근 항목을 `stderr`에 출력할 수 있다. MCP Inspector로 서버를 디버깅할 때 알림 창에서 출력 메시지를 볼 수 있도록 `stderr`를 사용한다.

<a id="id78"></a>

## FastMCP를 사용하는 이유

수명 주기 API는 분명 멋지지만 적용 범위가 제한적이어서 FastMCP의 단순성을 포기할 이유가 되기 어렵다. 따라서 이 책에서는 저수준 API보다 FastMCP 서버 구축에 집중한다. 강력함과 단순함을 결합한 FastMCP는 빠르게 Python SDK의 기본 서버 구축 방식이 되었다. 널리 쓰이므로 이 장의 나머지 설명과 예제는 FastMCP API에 집중한다.

<a id="server_primitives"></a>

# 서버 프리미티브: 도구, 프롬프트, 리소스

MCP 서버 개발에서는 지원할 프리미티브 구현에 대부분의 노력을 쓰게 된다. MCP 프리미티브는 서버가 연결된 클라이언트 애플리케이션에 제공하는 주요 구성 요소다. 애플리케이션이 호출할 수 있는 함수인 *도구*, 서버 제공 기능과 애플리케이션의 상호 작용을 더 잘 안내하는 *프롬프트*, 서버가 애플리케이션에 제공하는 데이터인 *리소스*가 있다. 이 절에서는 예제 MCP 서버로 각 프리미티브를 제공하는 방법을 배운다. [3장](../chapter_3.html#ch03)에서는 클라이언트 예제와 함께 서버를 사용했고, 이제 서버 구성 방식을 살펴본다.

먼저 MCP 서버를 실제로 만들고 시작하는 방법부터 알아보자. 다음 예제는 아무 기능도 없지만 실행되고 연결을 받아들이는 서버다.

<a id="minimal_stdio_server"></a>

```python
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("minimal-stdio-server")

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run()
```

FastMCP 절에서 본 것과 같은 예제다. 이름이 `minimal-stdio-server`인 FastMCP 서버 인스턴스를 만들고 스크립트를 직접 실행할 때 `mcp.run()`으로 실행한다. `uv run server.py` 또는 [그림 2-5](../chapter_2.html#mcp_inspector)를 실행하는 `uv run mcp dev server.py`로 실행할 수 있으며, 서버는 시작한 뒤 아무 일도 하지 않는다. 이후 모든 예제를 이 방식으로 실행할 수 있다. 예제 서버와 쉽게 상호 작용하도록 MCP Inspector 사용을 강력히 권장한다.

###### 팁

MCP Inspector에서는 명령줄 플래그로 추가 의존성을 설치하거나 로컬 코드를 마운트하여 Inspector UI에서 변경 사항을 실시간으로 볼 수 있다. 로컬 개발 환경에 설치하지 않고 서버가 Pydantic 라이브러리에 접근하게 하려면 다음 명령을 실행한다.

```bash
uv run mcp dev server.py --with pydantic
```

서버를 재시작하지 않고 코드를 수정하려면 서버 디렉터리에서 다음 명령으로 로컬 코드를 마운트한다.

```bash
uv run mcp dev server.py --with-editable .
```

서버가 Streamable HTTP를 지원하게 하려면 적절한 전송 문자열(`'streamable-http'`)을 `run()` 메서드에 전달한다. 필요하면 여러 방식으로 구성 가능하게 만들 수 있다.

```python
if __name__ == "__main__":
    # Initialize and run the server
    mcp.run("streamable-http")
```

실행되는 MCP 서버를 구축하는 데 필요한 것은 이것이 전부다. 물론 이 예제는 실행만 할 뿐 아무 일도 하지 않는다. 다음 절에서는 MCP 클라이언트가 호출할 수 있는 도구를 구현한다.

<a id="serving_tools"></a>

## 도구 제공하기

도구는 MCP 생태계의 중추다. 코딩할 수 있는 거의 모든 것에 LLM이 접근하게 하여 상상하는 모든 일을 즉시 수행할 능력을 부여하므로 LLM의 행동과 능력을 진정으로 확장한다. Python SDK에서 도구는 `@mcp.tool()` 데코레이터를 붙인 Python 함수다. 클라이언트가 서버에 도구 목록을 요청하면 FastMCP가 도구 이름과 설명을 자동으로 보내며, 클라이언트는 보통 호스트 애플리케이션의 언어 모델에 전달한다. FastMCP는 함수 시그니처와 형식 어노테이션에서 입력 및 출력 스키마를, 함수 독스트링에서 도구 설명을 자동 추론한다.

> MCP는 영화 《매트릭스》와 같다. 서버에 접속하기만 하면 갑자기 쿵후를 알게 된다!
>
> Christopher Bailey, *Real Python Podcast 진행자*

<a id="id81"></a>

### 도구 설계하기

예제로 들어가기 전에 LLM이 효과적으로 사용할 도구의 설계 방식을 이해해야 한다. FastMCP가 도구 이름, 매개변수, 설명을 감지해 데이터 모델의 적절한 위치에 넣게 하는 것이 중요하지만 LLM도 이를 이해해야 한다. 도구에는 수행 행동과 관련된 고유한 이름, 설명력이 있지만 지나치게 장황하지 않은 설명, 잘 정의된 입출력이 필요하다. 도구를 [적절한 네임스페이스](https://www.anthropic.com/engineering/writing-tools-for-agents) 안에 두는 것도 적극 고려해야 한다. MCP 네임스페이스는 보통 도구 이름 앞에 밑줄로 구분한 접두사로 표시한다. 서드파티 API 공급자처럼 핵심 차이 하나만 있는 비슷한 도구 여러 개를 개발할 때 특히 유용하다. 목적별 에이전트는 비슷한 도구를 여러 개 사용할 가능성이 있으므로 네임스페이스가 모델에 추가 구분자를 제공해 도구 선택 정확도를 높인다. Anthropic은 매우 상세한 도구 설명도 권장하며, 신입 직원에게 코드 동작을 설명하는 일에 비유한다. 코드에 관해 암묵적으로 알고 있는 맥락을 깊이 생각해 명시해야 한다. LLM도 마찬가지이므로 토큰 효율성과 최적의 도구 선택을 위한 명확성·맥락 사이에 균형을 맞춰야 한다.

도구 코드를 잘 문서화했다면 도구가 수행하는 일로 초점을 옮긴다. LLM은 REST API에서 흔한 세분화되고 조합 가능한 개별 행동보다 종단 간 행동을 수행하는 도구를 더 잘 사용한다. [‘안티패턴 경고: REST API로 MCP 서버 만들기’](#antipattern_rest_apis)에서 설명했듯 한 행동에 여러 도구를 호출하면 오류율과 토큰 비용이 누적되고 컨텍스트 창이 급격히 커진다. 테스트성과 재사용성을 위해 도구 코드를 비공개 함수로 나눠 서버 코드 안에서 조합할 수 있지만, 그 구성 요소 자체를 도구로 노출하지 않도록 주의한다.

전통적인 소프트웨어 개발의 제품 관리 전략에는 사용자가 원하는 기능이나 행동을 사용자 관점에서 짧게 설명한 ‘사용자 스토리’가 많다. 흔한 형식은 “나는 [사용자 유형]으로서 [목표]를 이루기 위해 [행동]을 하고 싶다”이다. 개발자와 제품 관리자가 사용자 관점에서 실제 요구를 해결하는 기능을 설계하게 한다. MCP 서버는 에이전트가 사용할 도구를 구축하므로 에이전트 관점에서 원하는 행동을 설명하는 ‘에이전트 스토리’를 작성하는 것이 유용하다.

LLM은 선택할 도구가 일정 수를 넘으면 도구 선택 정확도가 낮아지는 느슨한 한계가 있다는 점도 기억해야 한다. MCP 클라이언트 개발자는 도구 과부하를 처리할 선택지가 있지만, 서버 개발자는 노출하는 도구 수를 합리적인 수준으로 유지해야 한다. 사용자는 다른 서버도 사용할 가능성이 높으며 애플리케이션에서 안정적으로 호출할 수 있는 잘 정의된 소수의 도구를 선호한다.

###### 참고

알려진 서버 집합을 사용하는 애플리케이션 및 클라이언트 개발자, 애플리케이션에 범용 MCP 서버 지원을 구축하는 클라이언트 개발자, IDE나 Claude Desktop 같은 애플리케이션에 서버를 직접 추가하지만 수정할 수 없는 최종 사용자 등 모든 잠재 사용자를 고려해야 한다. 클라이언트 개발자는 받은 도구 목록 필터링(유연성 감소 비용이 따른다)이나 전문 하위 에이전트가 있는 [다중 에이전트 시스템](https://www.anthropic.com/engineering/multi-agent-research-system) 개발 등 최종 사용자보다 도구 과다 문제를 다룰 선택지가 많다.

- 알려진 서버 집합을 사용하는 애플리케이션 및 클라이언트 개발자
- 애플리케이션에 범용 MCP 서버 지원을 구축하는 클라이언트 개발자
- 사용하는 애플리케이션에 서버를 추가하지만 애플리케이션은 수정할 수 없는 최종 사용자

앞서 설명했듯 FastMCP API는 도구 함수 시그니처에서 입출력 스키마를 자동 추론한다. 따라서 여러 출력 형식에서 MCP 도구는 기본적으로 검증된 구조화 출력을 반환하여 일관된 형태와 높은 사용 편의성을 보장한다. 해당 출력 형식은 다음과 같다.

- Pydantic 모델
- Python TypedDict
- 데이터 클래스
- 형식 힌트가 있는 클래스
- 문자열 키와 JSON 직렬화 가능 값을 가진 딕셔너리
- `result` 키가 있는 딕셔너리로 감싼 Python 프리미티브 형식
- `result` 키가 있는 딕셔너리로 감싼 Python 제네릭 형식

Python에서 실제로 반환할 수 있는 출력 거의 전부를 포함하며 최신 목록은 [Python SDK README](https://github.com/modelcontextprotocol/python-sdk/tree/main?tab=readme-ov-file#structured-output)에서 볼 수 있다. FastMCP 패키지는 구조화 출력 외에 도구 출력으로 사용할 `Image`와 `Audio` 형식도 제공한다. 개발자나 클라이언트 개발자의 추가 작업 없이 네이티브 `ImageContent`와 `AudioContent` 응답 블록을 자동 구성해 반환한다. 다음 예제는 Pydantic 모델과 이미지를 반환하는 도구를 보여 준다.

<a id="structured_output"></a>

```python
from mcp.server.fastmcp import FastMCP, Image
from PIL import Image as PILImage
from PIL import ImageDraw
from pydantic import BaseModel

# Initialize FastMCP server
mcp = FastMCP("structured-output-server")


class ReportCard(BaseModel):
    name: str
    grades: list[tuple[str, int]]  # class name and grade


@mcp.tool()
async def generate_report_card(name: str, grades: list[tuple[str, int]]) -> ReportCard:
    """
    Generate a report card for a student.

    Args:
        name: The name of the student
        grades: A list of tuples containing the class name and grade
    """
    return ReportCard(name=name, grades=grades)


@mcp.tool()
async def generate_report_card_image(report_card: ReportCard) -> Image:
    """
    Generate a report card image for a student.

    Args:
        report_card: The report card to generate an image for
    """
    image = PILImage.new("RGB", (400, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(image)
    draw.text((100, 100), report_card.name, fill=(0, 0, 0))
    return Image(data=image.tobytes())


if __name__ == "__main__":
    # Initialize and run the server
    mcp.run()
```

이 예제의 `ReportCard` Pydantic 모델은 학생 이름과 과목-성적 튜플 목록을 포함한 성적표를 나타내며 `generate_report_card()` 도구 및 함수의 구조화 출력 형식을 정의한다. `generate_report_card()`는 입력 데이터를 받아 구조화된 ReportCard 모델 형식으로 반환한다. `generate_report_card_image()`는 FastMCP `Image` 클래스 사용법을 보여 준다. FastMCP에서 `Image` 클래스를 가져와 해당 클래스로 만든 이미지 객체를 반환한다. 예제에서는 Pillow로 이미지를 열고 그림을 그린 뒤 학생 이름을 추가했다. `fastMCP.Image` 객체를 반환해야 하므로 `tobytes()`로 이미지를 바이트 객체로 바꿔 `Image` 생성자에 전달한다. 이미지 조작에 Pillow를 써야 하는 것은 아니지만 바이트 객체로 변환할 수 있어야 한다.

도구와 관련해 서버 개발자에게는 중요한 보안 책임이 있다. 도구는 사용자 컴퓨터, 애플리케이션 서버나 내부 네트워크, 또는 개발자가 제어하는 서버에서 실행될 수 있으므로 입력, 출력, 접근 주체를 통제해야 한다. 모든 도구 입력의 형식과 내용을 검증하고, 민감할 수 있는 출력을 정제하며, 서드파티 서비스 인증 접근 같은 필요한 접근 제어와 도구 호출 속도 제한을 구현해야 한다. 이러한 조치는 도구 악용을 막고 도구가 접근할 민감한 데이터를 보호하며, 구체적인 방안은 도구의 실제 동작에 크게 좌우된다. 효과적인 보호 장치를 구축하려면 프로토콜에서 도구를 사용하는 방식과 도구 제공·사용 시 모델-클라이언트-서버 상호 작용 순서를 이해해야 한다.

<a id="id82"></a>

### 도구 사용 방식

일반적으로 모델은 자신이 결정한 시점과 방식으로 도구를 사용한다. Anthropic이 정의하고 [1장](../chapter_1.html#chapter_1_agentic_ai_and_mcp)에서 논한 에이전시의 필수 요소다. 그러나 도구가 이 상호 작용 모델에만 제한되지는 않는다. 애플리케이션 개발자는 더 엄격히 통제된 방식으로 도구를 호출하는 에이전트 워크플로나, 일부 도구는 LLM이 선택하고 다른 워크플로 부분은 애플리케이션이 처리하는 하이브리드 모델 등 알맞은 방식을 자유롭게 구현할 수 있다. 선택과 MCP 명세의 도구 상호 작용 지침 준수는 주로 애플리케이션 개발자의 몫이다. 서버 개발자는 도구 목록과 도구 자체, 배포 전략에 따라 도구 실행 환경을 제공한다.

애플리케이션이 클라이언트를 통해 서버에 연결하면 먼저 도구 목록 요청을 보낸다. Python SDK에서는 FastMCP API가 자동 구현하거나 저수준 API에서 수동 구현한 서버의 `list_tools()` 함수를 호출한다. 반환된 도구 목록은 모델이 에이전트로 동작할 때 이후 모든 요청과 함께 전송된다. 모델이 도구를 선택하면 클라이언트가 서버에 도구 호출 요청을 보낸다. Python SDK에서는 서버의 `call_tool()` 또는 도구 호출을 장식하는 FastMCP API의 `tool()` 함수를 호출하여 알맞은 인수로 도구 함수를 실행한다. 도구 입출력 스키마에 맞춰 인수와 출력을 검증한 다음 결과를 클라이언트에 반환한다.

> <a id="decorators"></a>
>
> # 데코레이터 복습
>
> 데코레이터는 함수 코드 자체를 바꾸지 않고 동작을 수정하는 Python의 문법적 편의 기능이다. Python 함수는 다른 함수의 인수로 전달할 수 있는 일급 객체이므로 가능하다. 함수를 장식하면 장식된 함수가 데코레이터 함수의 인수로 전달되고, 데코레이터는 나머지 로직을 실행하는 동안 이를 호출한다. 데코레이터 본문 안에 로직을 수행하고 전달받은 함수를 호출하는 `wrapper()` 또는 `handler()` 내부 함수를 정의한 뒤, 외부 데코레이터 함수가 이 내부 함수를 반환한다. MCP Python SDK 저수준 API에서는 `call_tool()`이 해당한다. 가장 안쪽 `handler()`가 요청에서 도구 이름과 인수를 파싱하고 서버 내부 캐시에서 정의를 가져오며, 선택적으로 입력 스키마에 맞춰 인수를 검증한 뒤 도구 함수를 호출한다. 결과를 구조화 또는 비구조화 출력으로 파싱하고 출력 스키마에 맞춰 검증한 다음 SDK `ServerResult` 객체를 반환한다. 이를 감싸는 `decorator()`는 함수 인수를 받아 내부 핸들러를 정의하고 서버의 `request_handlers` 딕셔너리에 등록한다. 원래 함수를 반환하고 외부 함수가 데코레이터 함수를 반환한다. 이 흐름은 `call_tools()` 자체의 복잡성 때문에 이해하기 쉽지 않다.
>
> FastMCP API의 `tool()` 데코레이터는 더 단순하다. 내부 함수 `decorator()` 하나만 있으며 함수를 인수로 받아 서버 인스턴스의 `add_tool()`을 호출한다. 이는 별도 `ToolManager` 클래스가 구현한 서버 내부 캐시에 `Tool` 객체로 도구 정의를 추가한다. 도구 호출 시 도구 관리자의 내부 `call_tool()`이 레지스트리에서 도구를 가져와 `Tool` 객체의 `run()`을 호출한다. 저수준 API의 `handler()`처럼 선택적 인수 검증, 출력 검증, 알맞은 출력 형식 변환을 수행한다. 여러 클래스에 분산되지만 이해하기는 더 쉽다. `tool()` 데코레이터에는 함수 이름을 덮어쓰는 `name`, 사람이 읽을 수 있는 이름 `title`, 독스트링을 덮어쓰는 `description`, 도구를 설명하는 힌트 속성의 `ToolAnnotations` 객체를 받는 `annotations`, 구조화 출력 생성 방식을 제어하는 `structured_output` 같은 선택적 매개변수도 전달할 수 있다.
>
> 데코레이터는 이해하기 어려운 경우가 많아 필자도 직접 작성할 때 여러 튜토리얼을 다시 찾아본다. 즐겨 보는 자료로 [Real Python](https://realpython.com/)의 Geir Arne Hjelle가 쓴 [Python 데코레이터 입문](https://realpython.com/primer-on-python-decorators/)이 있다.

결과는 클라이언트에 전달되고 모델로 보내져 에이전트 루프를 계속한다. 서버는 사용 가능한 도구 목록이 바뀔 때마다 클라이언트에 list_changed 알림을 보낼 수도 있다. Python SDK에서는 도구 함수에 매개변수로 전달할 수 있는 MCP 컨텍스트 객체 `ctx`를 사용해 `ctx.session.send_tool_list_changed()`로 수동 전송한다. 클라이언트 구현에 따라 서버에 도구 목록 요청을 다시 보내 목록을 새로 고칠 수 있다. 다음 그림은 도구 사용 시 모델, 클라이언트, 서버의 통신 흐름을 보여 준다.

다음 예제는 이 내용을 종합해 Pydantic 모델로 구조화 출력을 반환하고 사람이 읽기 쉬운 이름을 설정한 네임스페이스 도구를 구현한다. 비구조화 출력을 반환하도록 강제하고 도구 어노테이션에 읽기 전용 힌트를 추가한 더 단순한 도구도 만든다.

<a id="full_tool"></a>

```python
from random import randint

from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
from pydantic import BaseModel

# Initialize FastMCP server
mcp = FastMCP("full-tool-server")


class Class(BaseModel):
    title: str
    grade: int
    instructor: str
    credits: int


class ReportCard(BaseModel):
    name: str
    grades: list[Class]
    weighted_gpa: float | None = None
    unweighted_gpa: float | None = None


def _generate_classes() -> list[Class]:
    return [
        Class(
            title="Math",
            grade=randint(0, 100),
            instructor="Mr. Smith",
            credits=randint(1, 4),
        ),
        Class(
            title="Science",
            grade=randint(0, 100),
            instructor="Mrs. Johnson",
            credits=randint(1, 4),
        ),
        Class(
            title="History",
            grade=randint(0, 100),
            instructor="Mr. Brown",
            credits=randint(1, 4),
        ),
    ]


@mcp.tool(title="Generate Report Card")
def grader_generate_report_card(
    name: str, classes: list[Class] | None = None
) -> ReportCard:
    """
    Generates a full report card for a student and a list of classes.
    Can leave out the list of classes to use a randomly generated list.

    Args:
        name: The name of the student
        classes: An optional list of Class objects to add to the report card
    """
    if not classes:
        classes = _generate_classes()

    weighted_gpa = grader_calculate_gpa(classes)
    unweighted_gpa = grader_calculate_gpa(classes, weighted=False)
    return ReportCard(
        name=name,
        grades=classes,
        weighted_gpa=weighted_gpa,
        unweighted_gpa=unweighted_gpa,
    )


@mcp.tool(
    title="Calculate GPA",
    annotations=ToolAnnotations(readOnlyHint=True),
    structured_output=False,
)
def grader_calculate_gpa(classes: list[Class], weighted: bool = True) -> float:
    """
    Calculate the GPA for a list of classes. Calculates the weighted
    GPA by default, but can optionally calculate the unweighted GPA.

    Args:
        classes: A list of classes
        weighted: Whether to use weighted GPA
    """
    if weighted:
        return sum(_class.grade * _class.credits for _class in classes) / sum(
            _class.credits for _class in classes
        )
    return sum(_class.grade for _class in classes) / len(classes)

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run()
```

이 예제에서는 도구의 선택적 입출력 형식으로 사용할 `Class`와 `ReportCard` Pydantic 모델을 설정하고, 테스트를 돕도록 수업 목록을 무작위 생성하는 `_generate_classes()`를 만든다. 첫 도구 `grader_generate_report_card()`는 사람이 읽을 수 있는 이름 ‘Generate Report Card’와 자세한 설명이 있는 네임스페이스 도구다. 수업이 제공되지 않으면 성적표에 넣을 목록을 생성한다. `grader_calculate_gpa()` 도구를 일반 Python 함수로 사용해 가중 및 비가중 GPA를 계산하고 구조화된 `ReportCard` 객체를 반환한다. 애플리케이션이 여러 도구를 호출해 결과를 조립하게 하지 않고 완전한 행동 하나를 수행하도록 설계했다. 두 번째 `grader_calculate_gpa()`는 사람이 읽을 수 있는 제목과 읽기 전용 어노테이션을 사용하고 구조화 출력을 `False`로 강제한 단순한 도구다. Class 객체 목록과 가중 여부 불리언을 받아 GPA를 계산하고 부동소수점 결과를 반환한다.

다음 프리미티브는 프롬프트다. 서버가 잘 테스트한 프롬프트를 클라이언트 애플리케이션에 배포하면 애플리케이션이 선택해 사용할 수 있으며 도구 선택 성능을 개선할 수 있다.

<a id="id83"></a>

## 프롬프트 제공하기

LLM을 사용해 보았다면 프롬프트에 익숙할 것이다. 프롬프트는 LLM이 응답 생성에 사용하는 지침이며 보통 문자열로 전송된다. 주요 모델에는 대개 *시스템 프롬프트*와 *사용자 프롬프트*가 있다. 시스템 프롬프트는 대화 전체에서 지속적으로 응답을 안내하며 기본 프롬프트에 추가하거나 사용자 정의 프롬프트로 완전히 바꿀 수 있다. 모델의 성격, 도구 사용법, 준수 규칙, 추가 컨텍스트를 지정할 때 사용한다. 사용자 프롬프트는 보통 사용자가 생성하는 직접 질의로, 지속되지 않고 사용자가 질의를 제출할 때만 모델에 전송된다.

###### 팁

시스템 프롬프트는 모든 사용자 프롬프트와 함께 모델에 전송되므로 입력 토큰 비용이 발생한다. 사용자 프롬프트와 마찬가지로 시스템 프롬프트도 토큰 효율성과 비용을 고려해 설계해야 한다.

Python MCP 서버에서 프롬프트는 문자열, `UserMessage`, `AssistantMessage`, 또는 부분 대화를 나타내는 두 메시지 객체의 목록을 반환하고 `@mcp.prompt()` 데코레이터를 붙인 함수로 표현한다. 서버 관점에서는 반환 형식이 제한되고 애플리케이션이 결과를 특별히 처리하는 도구와 본질적으로 비슷하다. 함수 매개변수는 보통 애플리케이션의 사용자 입력을 프롬프트에 주입하지만, 함께 계산할 숫자처럼 프롬프트에 의미 있는 값이면 무엇이든 사용할 수 있다. MCP에서는 사용자나 애플리케이션이 제공된 프롬프트의 사용 방식을 결정하므로, SDK Message 클래스로 사용법을 안내하지 않으면 예상과 다르게 사용될 수 있다.

<a id="id84"></a>

### 프롬프트 설계하기

프롬프트 엔지니어링이 완전히 새로운 직업이 될 것이라는 전망은 성급했지만 LLM 작업에서 여전히 가치 있는 기술이다. MCP 서버로 배포할 프롬프트를 설계하려면 탄탄한 이해가 필요하다. [Prompt Engineering for Generative AI](https://learning.oreilly.com/library/view/prompt-engineering-for/9781098153427/)(O’Reilly, 2024)는 다음 ‘프롬프팅의 다섯 원칙’을 정의한다.

1. 방향 제시
2. 형식 지정
3. 예제 제공
4. 품질 평가
5. 작업 분할

첫 원칙 *방향 제시*는 가장 기본적인 원칙이다. 과제와 응답 형식 모두에 관해 LLM에 명확한 방향을 주어야 한다. MCP 서버 프롬프트는 명확하고 단순하며 간결한 지침과 응답 시 따라야 할 구체적인 지침 또는 규칙을 제공해 효과적으로 무언가를 수행해야 한다. 페르소나나 예제를 제공해 응답의 내용과 어조를 보강할 수도 있다.

다음 원칙은 *형식 지정*이다. 보통 YAML이나 JSON 같은 구조화 출력 또는 일반적인 응답 배치를 뜻한다. 목적에 따라 필요하지 않을 수도 있다. 서버 도구를 정확히 호출하기 위한 프롬프트라면 출력 형식이 덜 중요하지만 올바른 YAML 문서가 필요하면 원하는 형식을 직접 지정하거나 일부 또는 전체 예제를 제공할 수 있다. MCP에서는 YAML 변환 도구를 만들 수도 있으나 이는 [‘도구 제공하기’](#serving_tools)에서 다뤘다.

세 번째 원칙은 *예제 제공*이다. 사람처럼 LLM도 몇 가지 예제가 있을 때 더 잘 동작한다. *퓨샷 학습*은 정확도와 성능을 높이는 강력한 기법이지만, 예제가 많을수록 응답이 제약되고 창의성이 줄어든다는 절충이 있다. 원하는 결과를 고려해 여러 실행과 예제 집합으로 평가해야 한다. 자세한 내용은 [7장](../chapter_7.html#ch07)에서 다루며 [PromptBench](https://github.com/microsoft/promptbench)와 [PromptFoo](https://www.promptfoo.dev/)를 미리 살펴볼 수 있다.

이것이 네 번째 원칙 *품질 평가*다. MCP 덕분에 사용자가 어떤 모델과도 프롬프트를 사용할 수 있으므로 여러 모델에서 품질을 항상 평가해야 한다. 위 도구나 모델 API로 두 프롬프트를 단순 A/B 테스트할 수 있다. 마지막 원칙은 *작업 분할*이다. 프롬프트가 커지고 더 많은 일을 시도하면 별도 프롬프트로 나눌 때다. MCP의 *샘플링*으로 클라이언트를 통해 LLM 응답을 요청하고 컨텍스트가 있는 최종 프롬프트를 제공하거나, 일반적인 사용자 상호 작용 모델을 우회해 모든 프롬프트를 LLM에서 실행할 수도 있다. 그 밖에도 금지 사항 위주 표현을 피하고, ‘상당히 길게’ 대신 ‘3~5문장으로 된 두 단락’처럼 정확히 설명하며, 구분자로 컨텍스트와 지침을 분리하는 것이 좋다.

###### 팁

프롬프트 엔지니어링은 자체 서적과 강좌가 필요할 만큼 복잡하고 미묘한 주제다. 기본을 익힌 뒤 James Phoenix와 Mike Taylor의 [Prompt Engineering for Generative AI](https://learning.oreilly.com/library/view/prompt-engineering-for/9781098153427/)(O’Reilly, 2024), John Berryman과 Albert Ziegler의 [Prompt Engineering for LLMs](https://learning.oreilly.com/library/view/prompt-engineering-for/9781098156145/)(O’Reilly, 2024)도 참고하자.

프롬프트는 보통 시스템 프롬프트와 사용자 프롬프트로 나뉜다. OpenAI와 Anthropic 등의 주요 모델에서는 각각 `system`과 `user` 역할의 메시지로 표현한다. 시스템 메시지는 모델의 응답 방식, 페르소나, 지침과 규칙을 지정한다. 사용자 메시지는 반드시 사람일 필요는 없는 사용자의 입력이나 요청을 나타낸다. 세 번째 역할 `assistant`는 모델 응답을 나타낸다. MCP 서버 프롬프트에는 SDK의 `UserMessage`와 `AssistantMessage` 클래스를 사용해 올바른 사용을 보장하고 다중 턴 프롬프트를 만들 수 있다. `SystemMessage` 클래스는 없으므로 시스템 프롬프트를 제공하려면 일반 문자열을 반환하고 용도를 문서화해야 한다.

모델별 프롬프트 개선 기법은 다른 모델에서도 반드시 성능을 낮추는 것은 아니지만, MCP 서버는 모델 독립적이므로 지나치게 의존하지 말고 충분히 테스트해야 한다. OpenAI의 주요 기법은 [공식 문서](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api)에 설명된 대로 `###` 또는 `"""`로 컨텍스트와 지침을 분리하는 것이다. 다음 프롬프트는 아래에 추가한 사용자 입력에서 핵심 아이디어 세 가지를 만들도록 지시하며 `###`로 구분한다.

```
Create a list of 3 main ideas from the following text:

###
{user_input}
###
```

이 예제에서 지침 블록은 ‘다음 텍스트에서 핵심 아이디어 세 가지의 목록을 만드세요’이며 사용자 입력은 `###` 구분자로 컨텍스트임을 표시한다. Claude 계열 같은 Anthropic 모델은 프롬프트의 특정 부분을 표시할 때 XML 태그를 선호한다. XML 태그를 사용하면 원하는 부분에 설명적인 태그를 붙이고 나중에 그 태그를 다시 참조할 수 있어 더 유연하다. 다음은 같은 프롬프트를 XML 태그로 작성한 간단한 예다.

```
<instruction>
Create a list of 3 main ideas from the following text:
</instruction>

<text>
{user_input}
</text>
```

이 예제에서는 의미가 하나뿐인 구분자 대신 표현력이 더 높은 XML 태그로 프롬프트의 지침과 텍스트 부분을 표시한다. 예제는 단순하지만 제목·서문·본문이 있는 문서 리소스처럼 여러 계층형 XML 태그로 프롬프트 구역에 더 나은 컨텍스트를 제공할 수 있다. 응답에 태그를 포함하도록 요청하고 체인의 다음 프롬프트에서 그 태그를 참조해 프롬프트를 연결할 수도 있다. 이제 실제 프롬프트를 살펴보기 시작했으므로 MCP 서버에서 사용하는 방법을 생각해 보자. 이 절 앞부분에서 MCP 프롬프트가 도구처럼 함수로 제공된다는 사실을 배웠다. 다만 프롬프트 함수는 문자열, `role`과 `message` 키가 있는 딕셔너리, `Message` 객체 또는 그 하위 객체, 앞 형식 중 하나로 이루어진 목록 같은 시퀀스를 반환해야 한다. 프롬프트 함수에 `@mcp.prompt()`를 붙여 등록하며, 이 데코레이터는 `@mcp.tool`처럼 이름·제목·설명을 선택적으로 지정할 수 있다. 다음 예제에는 정적 문자열, 사용자 입력을 포함한 f-string, XML 태그가 있는 `UserMessage` 객체를 각각 반환하는 프롬프트 함수 세 개가 있다.

<a id="simple_prompt"></a>

##### 예제 5-1. 프롬프트를 반환하는 여러 방식을 보여 주는 간단한 프롬프트 함수 세 개

```py
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.prompts.base import UserMessage

# Initialize FastMCP server
mcp = FastMCP("simple-prompt-server")

@mcp.prompt()
async def simple_string_prompt() -> str:
    """A simple, static prompt that greets the user."""
    return "Say hello to the user."

@mcp.prompt()
async def simple_prompt_input(username: str) -> str:
    """A simple prompt that greets the user with their name."""
    return f"Say hello to the user using their name: {username}"

@mcp.prompt()
async def simple_example_prompt(user_text: str) -> UserMessage:
    """A simple prompt that summarizes the input text, using XML tags."""
    return UserMessage(
        content=f"""
<instruction>
Create a list of 3 main ideas from the following text:
</instruction>

<text>
{user_text}
</text>
    """
    )

if __name__ == "__main__":
    mcp.run()
```

첫 프롬프트 함수 `simple_string_prompt`는 모델이 사용자에게 ‘Hello’라고 인사하도록 지시하는 정적 문자열을 반환한다. 두 번째 함수는 `username` 인수를 받아 사용자 입력에 따라 이름으로 인사하도록 지시하는 문자열을 반환한다. 세 번째 함수는 프롬프트를 반환하는 또 다른 방식으로 `UserMessage` 객체를 만들어 반환한다. 사용자 입력이 문자열에 보간되어 있지만 이제 XML 태그로 모델의 이해를 돕고 `UserMessage` 객체 안에 넣는다.

`simple_example_prompt()`가 `UserMessage` 목록을 반환하면 어떻게 될까? 이는 모델과 사용자의 대화를 나타내는 여러 `Message` 객체를 포함한 *다중 턴 프롬프트*가 된다. 각 `Message`는 참가자 한 명이 차지하는 대화의 한 ‘턴’을 나타낸다. `user` 또는 `assistant` 역할로 해당 턴에서 사용자와 모델 중 누가 *말하는지* 표시한다. 대화를 ‘미리 채워’ 모델 응답을 더 강하게 유도할 수 있어 강력하다. 특히 어시스턴트 응답을 일부 채워 두는 *프리필링(prefilling)* 기법으로 응답을 더 세밀하게 제어할 수 있다. 상호 작용 모델에 따라 구조화 출력 형식을 제공하거나 모델이 역할을 유지하게 할 수 있다. 다음 예제의 프롬프트 함수는 어시스턴트 응답을 목록 형식으로 미리 채운 다중 턴 프롬프트를 반환한다.

<a id="multiturn_prompt"></a>

##### 예제 5-2. 어시스턴트 응답을 번호 목록 형식으로 미리 채운 다중 턴 프롬프트

```py
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.prompts.base import AssistantMessage, UserMessage

# Initialize FastMCP server
mcp = FastMCP("multiturn-prompt-server")

@mcp.prompt()
async def multiturn_prompt(
    main_idea_count: int, user_text: str
) -> list[UserMessage | AssistantMessage]:
    user_input = UserMessage(
        content=f"""
<instruction>
Create a list of {main_idea_count} main ideas from the following text:
</instruction>

<text>
{user_text}
</text>
    """
    )

    assistant_prefill_test = f"""
Here are {main_idea_count} main ideas from the text:
1.
"""
    assistant_prefill = AssistantMessage(content=assistant_prefill_test)
    return [user_input, assistant_prefill]

if __name__ == "__main__":
    mcp.run()
```

이 예제의 `multiturn_prompt()` 함수는 [예제 5-1](#simple_prompt)의 `simple_example_prompt()`와 같은 `UserMessage`를 사용하지만 `UserMessage`와 `AssistantMessage` 객체 목록을 반환해 다중 턴 대화를 나타낸다. `UserMessage`는 `main_idea_count` 인수를 받도록 조금 수정했고, `AssistantMessage`에는 도입 응답과 번호 목록의 시작을 미리 채웠다. 모델은 목록을 이어서 요청 정보를 채우게 된다.

프롬프트로 모델 행동을 다른 방식으로 제어할 수도 있다. 사용자 요청에 응답할 때 특정 도구를 우선하도록 유도하려면 사용자 입력에 다른 도구보다 먼저 해당 도구의 적용 가능성을 확인하라는 요청을 추가한다. 더 직접적으로 사용자 요청과 관계없이 도구를 사용하라고 명령할 수도 있다. 다음 예제에서 `request_tool_use`는 사용자 요청에 특정 도구를 사용하고 호출 결과를 사용자 응답 끝에 추가하라는 지침을 덧붙인다. `force_tool_use()`는 도구를 직접 호출하고 그 결과로 어시스턴트 응답을 미리 채워 도구 사용을 강제한다.

<a id="tool_use_prompt"></a>

##### 예제 5-3. 사용자 요청에 추가 지침을 덧붙여 도구 사용을 요청하는 프롬프트 함수

```py
import random

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.prompts.base import AssistantMessage, UserMessage

# Initialize FastMCP server
mcp = FastMCP("tool-use-prompt-server")

@mcp.tool()
async def analyze_sentiment() -> str:
    """A tool that tells the truth."""
    return random.choice(["positive", "negative", "neutral"])

@mcp.prompt()
async def request_tool_use(user_request: str) -> UserMessage:
    """A prompt that forces the model to call a tool."""
    return UserMessage(
        content=f"""
<user_request>
{user_request}
</user_request>
<tool_instruction>
Use the analyze_sentiment tool if available to you to get the sentiment of the
user's request. Respond in such a way to move the user's sentiment to neutral.
</tool_instruction>
    """
    )

@mcp.prompt()
async def force_tool_use(
    user_request: str,
) -> list[UserMessage | AssistantMessage]:
    """Directly calls the tool and adds the result to the response."""
    user_request_message = UserMessage(content=user_request)
    tool_result = await analyze_sentiment()
    assistant_prefill = AssistantMessage(
        content=f"Your request was {tool_result}, let's "
    )
    return [user_request_message, assistant_prefill]

if __name__ == "__main__":
    mcp.run()
```

이 예제의 `analyze_sentiment()` 도구는 무작위 감정 평가를 반환한다. `request_tool_use()`는 사용자 요청에 모델이 이 함수를 사용하고 그 결과를 바탕으로 응답하라는 지침을 추가한다. 반면 `force_tool_use()`는 도구 함수를 직접 호출하고 결과와 사용자 응답의 시작 부분을 어시스턴트 응답에 미리 채운다. 코드는 단순하지만 프롬프트와 도구를 결합해 애플리케이션 행동에 영향을 주는 방식을 알 수 있다. 다음 절에서 다룰 리소스도 MCP 프롬프트 안에서 사용할 수 있다. 리소스는 MCP 서버가 제공하고 서버 개발자가 지정한 URI를 가진 데이터 소스다. 프롬프트에서 URI를 사용하면 모델이 리소스를 분석의 출발점이나 응답의 사실 근거로 사용하게 할 수 있다. 다음 예제는 리소스 URI로 프롬프트에서 리소스를 참조하는 방법을 보여 준다.

<a id="resource_prompt"></a>

##### 예제 5-4. 프롬프트에서 리소스 URI로 리소스를 참조하는 프롬프트 함수

```py
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.prompts.base import UserMessage
from mcp.types import ResourceLink
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("basic-resource-server")

@mcp.resource("file://knowledge.txt")
async def knowledge_base() -> str:
    """A resource that loads a test-based knowledge base."""

    # Get the absolute path to knowledge.txt relative to this script
    knowledge_path = Path(__file__).parent / "knowledge.txt"

    with open(knowledge_path, "r") as f:
        return f.read()

@mcp.prompt()
async def knowledge_base_prompt(user_request: str) -> UserMessage:
    """A prompt that uses the knowledge base resource."""
    user_request_message = UserMessage(content=user_request)
    instruction_message = UserMessage(
        content="""
This prompt includes knowledge base from the resource URI: file://knowledge.txt,
please use this resource to answer the user's request. The resource follows
this message:
"""
    )
    resource_message = UserMessage(
        content=ResourceLink(
            name="knowledge_base", uri="file://knowledge.txt", type="resource_link"
        )
    )
    return [user_request_message, instruction_message, resource_message]

if __name__ == "__main__":
    mcp.run()
```

이 서버에서 `knowledge_base()` 함수는 `@mcp.resource()` 데코레이터로 리소스로 지정되고 인수로 URI를 `file://knowledge.txt`로 설정한다. 함수는 파일을 열어 내용을 문자열로 반환한다. 리소스는 [‘리소스 제공하기’](#serving_resources)에서 자세히 배운다. `knowledge_base_prompt()`는 `@mcp.prompt()`가 붙은 프롬프트 함수다. `user_request` 인수를 받아 원래 사용자 요청, 해당 URI의 리소스를 사용하라는 지침, 리소스 URI를 가리키는 `ResourceLink` `UserMessage`를 포함한 다중 턴 프롬프트를 만든다. 텍스트 리소스를 사용자 요청에 추가하고 모델이 답변에 활용하도록 지시한다.

<a id="id85"></a>

### 프롬프트 사용 방식

이 예제들은 클라이언트 애플리케이션에 프롬프트를 제공하는 방법을 보여 준다. MCP 덕분에 서버 개발자가 사용자(애플리케이션)의 구체적인 사용 방식을 반드시 신경 쓸 필요는 없다. 그러나 도구와 리소스처럼 의도한 사용자 상호 작용 모델, 애플리케이션의 일반적인 사용 방식, 프로토콜이 서버와 애플리케이션 사이에서 프롬프트를 전달하는 방식을 이해하는 것은 중요하다. MCP 명세는 단일 상호 작용 방식을 강제하지 않지만 프롬프트를 *사용자 제어* 방식으로 설계했다. 사용자가 사용할 프롬프트와 사용 시점을 선택할 수 있어야 하며 보통 메뉴 선택이나 채팅 애플리케이션의 슬래시 명령으로 구현한다. 예상 사용 방식을 이해하면 매끄러운 사용자 경험을 제공하도록 설계할 수 있다.

애플리케이션이 프롬프트를 예측하기 어려운 방식으로 사용할 수 있다는 점을 이해하면 더 유연한 경험을 제공할 수 있다. 프롬프트가 사용자·어시스턴트 메시지나 시스템 프롬프트로도 사용될 수 있음을 안다면, 단순 문자열 대신 `UserMessage` 목록을 반환하여 의도한 사용법에 관한 정보를 더 제공할 수 있다. [3장](../chapter_3.html#ch03)처럼 사용자가 프롬프트를 보거나 선택할 수 없고 모델이 동적으로 고르는 애플리케이션에서 서버가 사용될 수도 있다. 프롬프트를 사용자 또는 어시스턴트 메시지가 아니라 시스템 프롬프트에 넣는 애플리케이션도 있다. 구현은 더 복잡하지만 실제로 존재하므로 README나 독스트링에 용도를 문서화하거나 `UserMessage` 및 `AssistantMessage` 객체를 명시적으로 반환하는 것이 좋다.

서버와 클라이언트의 메시지 흐름은 도구 및 리소스와 비슷하다. 초기 발견 단계 뒤에 사용 단계가 이어지고, 연결 수명 동안 서버의 프롬프트 목록이 바뀌면 메시지를 주고받는다. 클라이언트가 연결할 때 `prompts/list` 요청을 보내고 서버가 프롬프트 목록으로 응답하면서 발견 단계가 자동으로 진행된다. 일반적으로 양측이 프롬프트와 다른 프리미티브 지원을 알린 뒤 일어난다. 사용자가 클라이언트 애플리케이션 목록에서 프롬프트를 선택하면 사용 단계가 시작된다. 클라이언트는 `prompts/get` 요청을 보내고 서버는 프롬프트로 응답한다. 연결 중 서버는 사용 가능한 목록이 바뀌었음을 알리는 `prompts/list_changed` 알림을 보낼 수 있다. 클라이언트는 `prompts/list` 요청으로 응답하고 서버는 갱신된 목록을 반환해야 한다.

다음 그림은 요청과 응답 메시지가 클라이언트와 서버 사이를 오가는 흐름을 보여 준다.

마지막 MCP 프리미티브는 *리소스*다. 이 절에서 간단히 살펴보았고 다음 절에서는 리소스의 동작, 구축, 실제 사용자 활용 방식을 자세히 알아본다.

<a id="serving_resources"></a>

## 리소스 제공하기

*리소스*는 세 MCP 프리미티브 중 마지막이다. 클라이언트 애플리케이션 언어 모델의 추가 컨텍스트가 될 데이터 소스에 읽기 전용 접근을 제공한다. 데이터 소스는 거의 무엇이든 될 수 있다.

- 로그 파일
- 데이터베이스 스키마
- 이미지
- PDF
- 구조화 구성(JSON, YAML 등)

물론 이러한 데이터 소스에만 제한되지 않는다. 클라이언트 애플리케이션의 언어 모델에 유용한 모든 데이터를 리소스로 제공할 수 있다. 리소스는 URI, 이름 등을 지정할 수 있는 `mcp.resource()` 데코레이터로 정의한다. URI는 리소스 자체에 접근하는 고유 식별자 또는 키이므로 필수다. 설명도 클라이언트가 애플리케이션 언어 모델에 전달하여 사용할 리소스를 고르는 데 도움을 줄 수 있으므로 적극 권장한다. [3장](../chapter_3.html#ch03)처럼 모델에 항상 리소스 선택을 요청하거나 서버 제공 프롬프트에 URI와 설명을 넣을 수 있다. *리소스 어노테이션*은 클라이언트가 사용 방식을 이해하도록 제공하는 선택적 힌트다. *리소스 템플릿*은 URI 템플릿으로 리소스를 매개변수화하여 서로 관련된 다양한 리소스를 쉽게 제공한다. [‘리소스 노출하기’](#exposing_resources)에서 각 주제를 자세히 다룬다.

리소스는 커뮤니티가 아직 발견하지 못한 방식을 포함해 다양하게 사용할 수 있지만 모두 언어 모델에 추가 컨텍스트를 제공하여 더 나은 판단과 풍부한 응답을 돕는다는 목표를 공유한다. [‘리소스 사용 방식’](#how_resources_are_used)에서는 리소스 템플릿을 이용한 로그 분석, 코딩 질의 응답을 개선하는 문서 제공, 프롬프트 체인의 리소스 캐싱, 사용 가능한 하위 리소스 발견 등 프로덕션 MCP 서버의 활용 사례를 배운다. 앞 절의 [예제 5-4](#resource_prompt)처럼 도구와 함께 사용할 리소스를 제안하는 방법도 본다.

먼저 서버에 연결할 MCP 클라이언트에 리소스를 실제로 노출하는 방법을 살펴보자.

<a id="exposing_resources"></a>

### 리소스 노출하기

리소스가 언어 모델에 컨텍스트를 제공하는 데이터 소스라는 사실을 알았다. 실제 구현은 어떤 모습일까? MCP Python SDK에서는 `@mcp.resource()`를 붙인 Python 함수로 리소스를 노출한다. 데코레이터에 다음 속성을 지정할 수 있다.

- **uri**: 필수. [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986)을 준수하는 리소스 고유 식별자다.
- **name**: 선택 사항. 리소스 이름이며 기본값은 함수 이름이다.
- **title**: 선택 사항. 사람이 읽을 수 있는 리소스 이름이다.
- **description**: 선택 사항. 리소스 설명이며 기본값은 함수 독스트링이다.
- **mime_type**: 선택 사항. 반환할 리소스의 MIME 형식이며 기본값은 `text/plain`이다.
- **icons**: 선택 사항. 클라이언트가 리소스를 표시할 때 사용할 Icon 객체 목록이다.

###### 참고

`icons` 매개변수는 Python SDK 문서에 없지만 리소스에서 사용할 수 있으며 리소스 템플릿에서는 사용할 수 없다. Icon 객체에는 `src` URI 또는 URL, 선택적 `mimeType`, 선택적 `sizes` 문자열이 있다.

URI는 RFC 3986만 준수하면 되지만 MCP 명세는 `https://`, `file://`, `resource://`라는 표준 URI 스킴을 정의한다. `https://`는 서버 도움 없이 클라이언트가 직접 접근할 웹 기반 리소스, `file://`는 파일 시스템을 포함한 로컬 파일 및 파일과 유사한 대상에 사용한다. 프로토콜에는 저장소나 커밋 같은 Git 리소스를 나타내는 `git://`도 정의되어 있다. RFC 3986을 준수하면 사용자 정의 URI 스킴도 만들 수 있다.

리소스 함수 본문은 리소스 콘텐츠에 접근해 읽고 반환해야 한다. 클라이언트가 요청할 때마다 호출되므로 가볍고 효율적이어야 한다. 텍스트 리소스는 문자열, 바이너리 blob은 `bytes`로 반환하고 딕셔너리 같은 그 밖의 값은 SDK가 JSON으로 변환한다. 다음 예제는 파일을 읽어 콘텐츠를 문자열로 반환하는 간단한 리소스 함수다.

<a id="basic_resource"></a>

##### 예제 5-5. 파일을 읽어 콘텐츠를 문자열로 반환하는 간단한 리소스 함수

```py
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("basic-resource-server")

@mcp.resource("file://knowledge.txt")
async def knowledge_base() -> Resource:
    """A resource that loads a test-based knowledge base."""

    # Get the absolute path to knowledge.txt relative to this script
    knowledge_path = Path(__file__).parent / "knowledge.txt"

    with open(knowledge_path, "r") as f:
        return f.read()

if __name__ == "__main__":
    mcp.run()
```

[예제 5-4](#resource_prompt)에서 본 것과 같은 리소스 함수다. URI를 `file://knowledge.txt`로 설정하고 파일의 전체 경로를 문자열로 반환한다. `@mcp.resource()` 데코레이터가 호출하는 MCP 응답 구축 코드는 경로의 파일을 열고 읽어 콘텐츠를 문자열로 반환한다. 가장 단순한 리소스에는 이것으로 충분하다. 그림 5-4는 [7장](../chapter_7.html#ch07)에서 자세히 배울 MCP Inspector에 리소스를 불러온 모습이다. 왼쪽에는 서버가 제공하는 `knowledge_base` 리소스 목록, 오른쪽에는 불러온 콘텐츠가 보인다. `uri`와 `mimeType`이 표시되고 함수가 문자열을 반환하므로 콘텐츠는 `text` 키 아래 나타난다.

![리소스를 불러온 MCP Inspector]({{ site.baseurl }}/assets/ai-agents-with-mcp/chapter_5/mcp_inspector_resource_bpmI.png)

*그림 5-1. 왼쪽에 knowledge_base 리소스를 나열하고 오른쪽에 콘텐츠를 불러온 MCP Inspector.*

리소스 URI를 하드코딩할 필요는 없다. 보유한 다른 정보에 따라 동적 URI를 만들 수 있는 매개변수화된 *리소스 템플릿*을 만들 수 있다. REST API의 매개변수화된 GET 엔드포인트와 비슷하다. 리소스 함수와 같은 방식으로 만들되 URI의 변수를 중괄호로 감싸야 한다. 다음 서버는 클라이언트가 두 파일 중 하나를 선택할 수 있는 리소스 템플릿을 제공한다.

<a id="resource_template"></a>

##### 예제 5-6. 클라이언트가 두 파일 중 하나를 선택하게 하는 리소스 템플릿

```py
from pathlib import Path

from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP("resource-template-server")

@mcp.resource("file:///{filename}")
async def resource_template(filename: str) -> str | bytes:
    """A resource that loads one of two files based on the filename parameter."""
    # Get the absolute path to the file relative to this script
    file_to_load = Path(__file__).parent / filename

    # Determine if file is binary based on extension
    if file_to_load.suffix.lower() == ".txt":
        with open(file_to_load, "r") as f:
            return f.read()
    else:
        with open(file_to_load, "rb") as f:
            return f.read()

if __name__ == "__main__":
    mcp.run()
```

이 예제에서는 리소스 URI의 변수 부분을 중괄호로 감싸 `@mcp.resource()`로 템플릿을 만든다. `file://` URI 스킴 뒤에 `/`가 하나 더 있다는 점에 주목하자. 변수 부분이 URI 시작에 있을 때 필요하며 그렇지 않으면 `file://`만 사용하면 된다. URI의 변수 부분은 리소스 함수 매개변수가 되어 함수 안에서 사용할 수 있다. 대상 파일 전체 경로의 Path 객체를 얻고 확장자를 확인한다. `.txt`면 문자열로, 아니면 바이너리 blob으로 메모리에 읽는다. 어느 쪽이든 결과를 클라이언트에 반환한다. 단순 예제에는 필요 없지만 프로덕션 코드는 더 폭넓고 견고하게 파일 형식을 검사해야 한다. 그림 5-6은 유효한 `filename` 매개변수로 MCP Inspector에 불러온 리소스 템플릿을 보여 준다.

![리소스 템플릿을 불러온 MCP Inspector]({{ site.baseurl }}/assets/ai-agents-with-mcp/chapter_5/mcp_inspector_resource_template_bpmI.png)

*그림 5-2. 가운데에 resource_template 리소스 템플릿을 표시하고 오른쪽에 매개변수 값 `2.png`로 불러온 MCP Inspector.*

이 데코레이터는 리소스 함수를 `FunctionResource` 객체로 바꿔 서버 내부 캐시인 리소스 관리자에 추가한다. 리소스 설명과 함수 자체를 리소스처럼 보이는 객체에 저장하므로 서버가 리소스 목록 요청을 받을 때 모든 데이터를 실제로 불러올 필요가 없다. 함수 실행은 클라이언트가 요청할 때까지 지연되어, 특히 대형 리소스를 제공할 때 성능이 좋아진다. FastMCP API로 리소스를 직접 노출할 수도 있다. `mcp.resource()` 데코레이터 대신 원하는 속성의 `Resource` 객체를 만들고 FastMCP 서버 인스턴스의 `add_resource()`를 호출해 리소스 관리자에 추가한다. FastMCP는 데코레이터 함수 없이 리소스를 직접 만드는 여러 `Resource` 하위 클래스를 제공하여 노출 리소스를 더 유연하게 보강할 수 있다. 다음 예제는 두 방식을 보여 준다. 첫째, 리소스 템플릿 함수에서 나중에 읽을 파일 경로가 있는 `FileResource`를 반환한다. 둘째, 서버 코드 본문에서 `FileResource` 객체를 직접 만들고 `mcp.add_resource()`로 관리자에 수동 추가한다.

<a id="resource_object"></a>

##### 예제 5-7. 리소스 템플릿 클래스와 독립 객체로 Resource 객체 만들기

```py
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.resources import FileResource

# Initialize FastMCP server
mcp = FastMCP("resource-object-server")

@mcp.resource("file:///{filename}")
async def resource_template(filename: str) -> FileResource:
    """A resource that loads one of two files based on the filename parameter."""
    # Get the absolute path to the file relative to this script
    file_to_load = Path(__file__).parent / filename
    if file_to_load.suffix.lower() == ".txt":
        binary_flag = False
    else:
        binary_flag = True
    return FileResource(
        uri=f"file:///{filename}", path=file_to_load, is_binary=binary_flag
    )

filename = "1.txt"
file_resource = FileResource(
    uri=f"file:///{filename}", path=Path(__file__).parent / filename
)
mcp.add_resource(file_resource)

if __name__ == "__main__":
    mcp.run()
```

이 예제는 이전 `resource_template()` 함수가 문자열이나 `bytes` 대신 `FileResource` 객체를 반환하도록 수정한다. 단순 확장자 검사는 유지하지만 `FileResource` 생성자의 `is_binary`에 사용할 불리언 플래그를 정하는 데만 쓴다. URI, 경로, 바이너리 플래그를 전달해 `FileResource` 인스턴스를 반환한다. 서버 본문에서 직접 `FileResource`를 만들고 `add_resource()`로 FastMCP 리소스 관리자 캐시에 추가하는 방식도 보여 준다. 일반적으로 `@mcp.resource()` 데코레이터를 사용하되 더 특수한 기능이 필요하면 `Resource` 하위 클래스가 적합할 수 있다.

###### 팁

FastMCP는 `FileResource`, `HttpResource`, `FunctionResource` 등 여러 리소스 편의 클래스를 제공한다. `mcp.server.fastmcp.resources` 모듈 또는 [Python SDK GitHub 저장소](https://github.com/modelcontextprotocol/python-sdk/blob/71889d7387f070cd872cab7c9aa3d1ff1fa5a5d2/src/mcp/server/fastmcp/resources/types.py)에서 찾을 수 있다.

리소스와 리소스 템플릿에 클라이언트용 추가 정보를 제공하는 어노테이션을 붙일 수도 있다. 프로토콜은 허용 키로 값이 `user`, `assistant` 또는 둘 다인 문자열 JSON 배열 `audience`, 리소스 중요도를 나타내는 0.0~1.0 범위 `priority`, 마지막 수정 시각을 저장하는 `lastModified`를 정의한다. MCP Python SDK에 포함된 FastMCP 버전은 이를 지원하지 않는다. 사용하려면 [FastMCP 2](https://gofastmcp.com/getting-started/welcome) 2.11 이상에서 데코레이터에 `annotations` 매개변수를 추가하거나, 표준 Python SDK 저수준 서버에서 `annotations` 필드가 있는 `Resource` 객체를 반환해야 한다.

앞의 두 예제는 텍스트와 바이너리 blob이라는 두 콘텐츠 형식을 반환했다. 텍스트는 구성 파일, 로그 파일, JSON 데이터 등 모든 텍스트 기반 리소스에 사용한다. 바이너리 blob은 이미지, 오디오, PDF처럼 텍스트로 직접 표현되지 않는 데이터에 사용하며 `bytes` 객체로 반환한다. 리소스 또는 리소스 템플릿 함수가 문자열이나 `bytes`가 아닌 값을 반환하면 JSON 문자열로 변환해 클라이언트에 보낸다.

###### 경고

리소스 개발 시 안티패턴을 경계해야 한다. 리소스는 가벼워야 하며 함수에서 무거운 계산을 피해야 한다. 부작용이 없어야 하고 다른 행동이나 작업을 시작하는 데 사용해서도 안 된다. 리소스 접근을 Python 함수가 중개하므로 기술적으로는 설계 목적 이상으로 악용할 수 있지만 유혹을 피하고 클라이언트에 리소스를 전달하는 일에만 집중하자.

프로토콜은 내부 및 저수준 서버에서 리소스용 작업을 몇 가지 정의한다. `resources/list` 요청은 서버가 제공하는 각 리소스의 URI, 이름, 제목, 설명, mimeType을 담은 목록을 반환한다. 도구와 프롬프트의 유사한 응답처럼 FastMCP가 자동 처리하지만 저수준 API에서는 직접 구현해야 한다. 리소스 템플릿 목록용 `resources/templates/list`도 같은 방식이다. `resources/read` 요청은 URI를 포함하며 서버가 알맞은 리소스를 반환하게 한다. Python SDK에서는 리소스 함수를 호출해 가져온다. 클라이언트는 개별 리소스를 구독하고 변경 알림을 받을 수도 있다.

<a id="how_resources_are_used"></a>

### 리소스 사용 방식

리소스는 여러 방식으로 사용하지만 공통 목표는 클라이언트 애플리케이션 언어 모델에 추가 컨텍스트를 제공하여 더 나은 판단과 운영 환경 이해를 돕는 것이다. 리소스 템플릿으로 로그 일부를 골라 분석 또는 헬프데스크 에이전트에 제공하는 로그 분석, AWS MCP 서버와 [Context7](https://github.com/upstash/context7)처럼 최신 코드 문서를 모델에 제공해 코딩 어시스턴트 응답 품질을 높이는 방식이 있다.

[리소스를 이용한 엔터티 발견](https://aws.amazon.com/blogs/machine-learning/unlocking-the-power-of-model-context-protocol-mcp-on-aws/)처럼 더 이색적인 활용도 있다. 발견하고 사용할 리소스가 많거나 사용자 또는 서버 접근 애플리케이션에 따라 동적으로 달라질 때 유용하다. 리소스가 대상 엔터티의 딕셔너리를 반환한다. 키는 내부 ID, 값은 모델이 사용할 엔터티를 판단하도록 돕는 속성 딕셔너리다. 엔터티와 설명 목록을 `UserMessage` 객체 목록으로 사용자 프롬프트에 추가해 모델이 올바른 엔터티를 고르게 하고, 선택한 엔터티를 실제 데이터 조회 도구의 매개변수로 전달할 수 있다.

리소스 참조 캐시를 만들어 불필요해진 리소스로 프롬프트 컨텍스트가 폭증하는 것을 막는 활용도 흥미롭다. 보통 클라이언트 개발자가 구현하지만 서버가 이 패턴에 어떻게 쓰이는지 알아둘 가치가 있다. 사용자가 RAG와 비슷한 작업을 하며 모델이 서버에서 리소스를 가져오거나 직접 선택한다고 가정한다. RAG 도구는 URI 목록을 반환하고 클라이언트는 URI와 설명을 포함한 풍부한 XML 태그 등으로 프롬프트에 추가하며, 새 항목의 텍스트는 다음 사용자 프롬프트에 넣는다. 새 항목은 사용자가 즉시 컨텍스트로 쓸 가능성이 크므로 전문을 포함한다. 크게 압축한 XML도 모델에 전달한다. 모델이 리소스를 사용하기로 하면 애플리케이션이 응답에서 URI를 파싱해 캐시에서 가져온다. [3장](../chapter_3.html#ch03)의 [tupac 프로젝트](https://github.com/tkellogg/tupac/tree/main)가 프롬프트 컨텍스트의 리소스 캐싱 패턴을 구현한다.

리소스는 *애플리케이션 제어* 방식이며 모델 컨텍스트에 통합하는 방법은 애플리케이션이 결정한다. 메시지 흐름은 단순하고 프롬프트와 크게 다르지 않다. 먼저 클라이언트가 `resources/list` 요청을 보내고 서버가 사용 가능한 목록으로 응답한다. 리소스를 사용할 때는 알맞은 URI가 있는 `resources/read` 요청을 보내고 서버가 콘텐츠로 응답한다. 구독도 2단계다. 클라이언트가 `requests/subscribe` 요청을 보내면 서버가 확인 응답을 반환한다. 서버가 시작하는 유일한 작업은 업데이트 알림이다. 리소스가 갱신되면 서버가 `notifications/resources/updates` 알림을 보내고 클라이언트는 갱신된 리소스에 `resources/read` 요청으로 응답해야 한다. 다음 그림은 각 작업의 메시지 흐름을 보여 준다.

이 장에서는 도구, 프롬프트, 리소스라는 세 MCP 프리미티브의 가장 기본적인 활용을 다뤘다. MCP 생태계에서 서버의 용도, 클라이언트 연결 방식, MCP Python SDK로 자체 서버를 구축하는 FastMCP와 저수준 API를 배웠다. 이어 프리미티브를 다루며 도구와 프롬프트를 설계하고 사용하는 최선의 방법, 리소스 노출법을 살펴봤다. 각 프리미티브의 클라이언트-서버 상호 작용 패턴과 일반적이거나 드물지만 창의적인 활용도 알아봤다. 자체 MCP 서버의 새 활용 사례에 영감을 주거나 에이전트 구축 도구 상자의 필수 도구가 될 수 있다.

다음 장에서는 서버 개발 세부 사항을 더 깊이 다룬다. 완성, 로깅, 알림, 페이지네이션 같은 서버 유틸리티를 사용하고, 사용 가능한 경우 사용자 입력을 받는 정보 요청, 서버가 클라이언트 애플리케이션 언어 모델에 질의하는 샘플링, 호스트 파일 시스템에서 서버가 접근할 위치를 표시하는 루트 같은 클라이언트 제공 리소스를 사용하는 방법을 배운다.
