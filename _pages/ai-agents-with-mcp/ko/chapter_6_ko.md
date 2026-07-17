---
title: '6장. MCP 서버 구축: 유틸리티의 고급 활용과 클라이언트 기능 통합'
author: Kyle Stratis
layout: post
permalink: /AI_Agent_with_MCP/ko/chapter_6.html
lang: ko
book_order: 6
---
<a id="ch06"></a>

# 6장. MCP 서버 구축: 유틸리티의 고급 활용과 클라이언트 기능 통합

앞 장에서 MCP 프리미티브를 제공하는 서버의 기초를 세웠다면, 이 장에서는 문과 벽, 지붕을 세운다. 먼저 MCP 명세와 모든 SDK에 내장되어 서버를 강화하는 MCP 서버 유틸리티를 다룬다. 사용자에게 자동 완성 제안을 제공하고, 현재 세션과 요청에 관한 정보에 접근하고, 클라이언트에 로그를 보내고, 응답을 페이지로 나누며, 서버 작업 진행률을 사용자에게 알릴 수 있다. 다음은 서버 기능을 확장하는 클라이언트 제공 리소스다. 서버가 사용자에게 정보를 요청하는 *정보 요청*, MCP 클라이언트를 통해 호스트 애플리케이션 언어 모델을 직접 사용하는 *샘플링*, 서버가 접근할 수 있는 호스트 파일 시스템의 파일 및 디렉터리 경계를 식별하는 *루트*가 있다.

이러한 유틸리티와 리소스를 함께 사용하면 MCP 서버에 추가 기능을 구현할 뿐 아니라 이전보다 훨씬 복잡한 도구, 프롬프트, 리소스를 구축하고 제공할 수 있다.

<a id="id89"></a>

# 서버 유틸리티: 완성, 로깅, 알림, 페이지네이션

서버 유틸리티는 MCP 명세의 일부로 서버 개발자와 서버를 사용하는 클라이언트 개발자의 작업을 쉽게 한다. 주요 유틸리티는 완성, 컨텍스트 객체, 로깅, 페이지네이션, 진행률 알림이다. 완성은 프롬프트와 리소스 템플릿 입력 등에 자동 완성 제안을 제공한다. 엄밀히 말해 컨텍스트 객체는 명세가 설계한 서버 유틸리티가 아니라 Python MCP SDK의 편의 객체지만 서버 인스턴스, 현재 세션, 현재 요청 정보에 접근하고 로깅, 진행률 보고, 리소스 읽기 등을 수행하게 한다. 로깅 결과는 서버의 stderr나 로컬 파일이 아니라 클라이언트로 보내 저장·사용하거나 무시하게 한다. 페이지네이션은 응답 일부와 다음 부분을 요청할 토큰을 반환한다. 진행률 알림은 작업의 현재 진행 상황을 클라이언트로 보내 사용자에게 표시하게 한다.

이 모든 유틸리티는 MCP 서버 기능을 확장하거나 운영과 사용을 더 견고하고 신뢰성 있게 만든다.

<a id="id90"></a>

## 완성

첫 서버 유틸리티는 *완성(completion)*이다. IDE 코드 자동 완성에서 영감을 받아 클라이언트 요청 시 서버가 자동 완성 기능을 제공하지만, 서버 제공 프롬프트와 리소스 템플릿 제안으로 제한된다. 프롬프트나 템플릿을 제공할 때 이전 사용자 입력 또는 설정한 기본값으로 입력 제안을 제공할 수 있다. 전자의 경우 `CompletionContext` 형식의 컨텍스트 객체를 통해 사용자가 이전에 프롬프트나 템플릿을 채울 때 사용한 인수를 핸들러가 받을 수 있다. 핸들러 함수에 `@mcp.completion()`을 붙이고 다음 인수를 받는다.

- **`ref`**: 완성 대상 프롬프트 또는 리소스 템플릿을 가리키는 `PromptReference` 또는 `ResourceTemplateReference` 객체다. 전자는 프롬프트 이름, 후자는 템플릿 URI를 담는다.
- **`argument`**: 인수의 `name`과 핸들러가 완성할 부분 문자열 `value`가 있는 `CompletionArgument` 객체다.
- **`context`**: 선택 사항. 클라이언트가 키와 문자열을 정의하는 `arguments` 딕셔너리를 가진 `CompletionContext` 객체다.

핸들러는 다음 속성의 `Completion` 객체를 반환한다.

- **`values`**: 완성할 인수의 후보 값을 나타내는 문자열 목록이며 최대 100개다.
- **`total`**: 선택 사항. 사용 가능한 완성 항목 수다. 전송 가능한 값 개수와 달리 제한이 없다.
- **`hasMore`**: 선택 사항. 반환한 것보다 더 많은 완성 항목이 있는지 나타내는 불리언이다. 가능한 항목이 너무 많아 셀 수 없을 때 `total`과 함께 또는 대신 사용할 수 있다.

서버 개발자는 완성을 지원할 경우 전달된 인수를 실제로 완성할 방식을 정의할 수 있다. 프롬프트와 리소스 템플릿 모두에 완전한 `Completion` 객체를 반환하는 간단한 예를 살펴보자([예제 6-1](#completions)).

<a id="completions"></a>

##### 예제 6-1. 프롬프트와 리소스 템플릿 모두에 자동 완성 제안을 반환하는 완성 핸들러

```python
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from mcp.types import (
    Completion,
    CompletionArgument,
    CompletionContext,
    PromptReference,
    ResourceTemplateReference,
)

# Initialize FastMCP server
mcp = FastMCP("completion-server")

@mcp.resource("file:///{filename}")
async def resource_template(filename: str) -> str | bytes:
    """A resource that loads one of two files based on the filename parameter."""
    # Get the absolute path to the file relative to this script
    file_to_load = Path(__file__).parent / filename

    # Determine if file is binary based on extension
    if file_to_load.suffix.lower() == ".txt":
        with open(file_to_load, "r", encoding="utf-8") as f:
            return f.read()
    else:
        with open(file_to_load, "rb") as f:
            return f.read()

@mcp.prompt()
async def simple_prompt_input(username: str) -> str:
    """A simple prompt that greets the user with their name."""
    return f"Say hello to the user using their name: {username}"

@mcp.completion()
async def simple_completion(
    ref: PromptReference | ResourceTemplateReference,
    argument: CompletionArgument,
    context: CompletionContext | None,
) -> Completion:
    """Returns potential completions for a given reference and argument."""
    suggested = []
    prompt_default_suggestions = ["user"]
    resource_template_default_suggestions = ["1.txt", "2.png"]
    if isinstance(ref, PromptReference):
        if ref.name == "simple_prompt_input":
            suggested = [
                suggestion
                for suggestion in prompt_default_suggestions
                if argument.value.lower() in suggestion.lower()
            ]
            if previous := context.arguments.get("username"):
                suggested.extend(
                    [
                        prev
                        for prev in previous
                        if argument.value.lower() in prev.lower()
                    ]
                )
    else:
        if ref.uri == "file:///{filename}":
            suggested = [
                suggestion
                for suggestion in resource_template_default_suggestions
                if argument.value.lower() in suggestion.lower()
            ]
            if previous := context.arguments.get("filename"):
                suggested.extend(
                    [
                        prev
                        for prev in previous
                        if argument.value.lower() in prev.lower()
                    ]
                )
    completion = Completion(values=suggested, total=len(suggested), hasMore=False)
    return completion

if __name__ == "__main__":
    mcp.run()
```

이 서버 코드에는 [5장](../chapter_5.html#ch05)의 [예제 5-6](../chapter_5.html#resource_template)과 [예제 5-1](../chapter_5.html#simple_prompt)에서 본 `resource_template()`과 `simple_prompt_input()`이 있다. 각각 리소스 템플릿과 프롬프트로 등록되며 `completion_handler()`가 둘의 제안을 처리한다. 함수를 완성 핸들러로 등록하도록 `@mcp.completion()`을 붙인다. 프롬프트 이름 또는 템플릿 URI인 `ref`, 사용자 입력 `argument`, 이전 입력 인수용 `context`를 받고 `Completion` 객체를 반환한다.

먼저 빈 기본 `Completion`과 서버가 지원하는 프롬프트 및 템플릿용 기본 제안을 설정한다. `isinstance()`로 `ref` 형식을 확인해 들어온 요청이 프롬프트인지 템플릿인지 판단한다. 프롬프트면 이름, 템플릿이면 URI가 서버 정의와 일치하는지 확인한다. 일치하면 기본 제안과 보통 사용자가 지금까지 입력한 내용을 나타내는 현재 `argument` 값으로 제안 목록을 구성한다. 리스트 컴프리헨션으로 `argument`가 기본 제안의 부분 문자열인지 확인한다. 이어 `context.arguments` 딕셔너리를 확인해 이전에 사용한 인수가 있으면 같은 로직으로 일치 항목을 제안 목록에 추가한다.

마지막에 최종 `suggested` 목록, 전체 제안 수, 더 이상 제안이 없음을 나타내는 `False`로 `Completion` 객체를 만든다. 단순한 예제라 최종 제안이 100개를 넘는지 검사하지 않는다. 넘으면 목록을 자르고 `hasMore`를 `True`로 설정해야 한다. 프로덕션 시스템에서는 이 상황을 방어적으로 처리해야 한다.

그림 6-1은 완성 메시지 수명 주기를 보여 준다. 사용자가 프롬프트나 템플릿 인수를 입력하면 클라이언트가 서버에 완성 요청을 보낸다. 서버는 각 요청에 제안 목록으로 응답하며 입력이 늘수록 목록이 줄어들 것으로 예상한다. 사용자가 입력을 마치거나 인수를 선택할 때까지 이어진다. 요청 빈도는 클라이언트 구현이 결정하므로 일부 클라이언트가 합리적이지 않은 빈도로 요청할 가능성을 고려해야 한다.

완성을 제공할 때는 사용량이 많거나 트래픽이 높은 환경에서 수신 요청 속도를 제한해야 한다. 매칭 로직은 가장 관련 있는 제안을 먼저 보여 주고, 프롬프트 인젝션 등의 공격을 막도록 입력을 검증하며, 자격 증명이나 API 키 같은 민감한 제안의 접근을 제한해야 한다. 원활한 사용자 경험과 서버 악용 방지에 도움이 된다.

다음에는 서버 인스턴스, 현재 세션, 현재 요청 정보에 접근하는 Python MCP SDK 편의 객체인 컨텍스트 객체를 살펴본다.

<a id="id91"></a>

## 서버 아이콘

Python SDK를 사용하면 서버 아이콘을 클라이언트 애플리케이션에 제공할 수 있다. 클라이언트가 처리 방법을 정하지만 보통 UI에 표시한다. 서버 코드에서 `Icon` 객체를 만들고 목록을 `icons` 매개변수로 `FastMCP` 생성자에 전달하면 다음에 다룰 [‘컨텍스트 객체’](#context_object)를 통해 사용할 수 있다. 프리미티브 데코레이터에 `icons` 매개변수를 추가해 제공하는 MCP 프리미티브에도 연결할 수 있다. [예제 6-2](#server_icons)는 여러 아이콘을 만들어 서버 인스턴스와 도구·리소스·프롬프트에 연결한다.

<a id="server_icons"></a>

##### 예제 6-2. 도구, 리소스, 프롬프트의 아이콘을 제공하는 서버

```python
from pathlib import Path
from mcp.server.fastmcp import FastMCP, Icon

SERVER_DIR = Path(__file__).parent
brain_icon = Icon(
    src=str(SERVER_DIR / "brain.png"), mime_type="image/png", sizes=["128x128"]
)
sloth_icon = Icon(
    src=str(SERVER_DIR / "sloth.png"), mime_type="image/png", sizes=["128x128"]
)
icons = [brain_icon, sloth_icon]

mcp = FastMCP("icons-server", icons=icons)

@mcp.tool(icons=[brain_icon])
async def think() -> str:
    """A tool that makes the server think with an icon."""
    return "I'm thinking..."

@mcp.prompt(icons=[sloth_icon])
async def sloth_prompt() -> str:
    """A prompt that makes the server think slowlywith an icon."""
    return "Think very slowly, like a sloth"

@mcp.resource(uri="file:///{filename}", icons=icons)
async def resource_template(filename: str) -> str | bytes:
    """
    A resource that loads a file based on the filename parameter and has two icons
    """
    return "Here is your file!"

if __name__ == "__main__":
    mcp.run()
```

먼저 `pathlib.Path`로 사용할 아이콘 경로를 만든다. 파일 이름과 결합해 문자열로 바꾸어 `src` 매개변수를 채우고, 선택적 `mime_type`과 `sizes`로 각 아이콘의 힌트를 제공한다. Python SDK는 아이콘을 사용하는 모든 곳에서 `Icon` 목록을 요구하므로 만든 목록을 `FastMCP` 생성자에 전달한다. 각 프리미티브 데코레이터에도 `Icon` 객체 목록을 받는 `icons` 매개변수를 추가하여 클라이언트가 쓸 아이콘을 연결한다.

서버 안에서는 다음에 다룰 [‘컨텍스트 객체’](#context_object)를 통해 아이콘과 여러 다른 서버 속성에 접근할 수 있다.

<a id="context_object"></a>

## 컨텍스트 객체

컨텍스트 객체는 서버의 도구 및 리소스 핸들러 함수가 여러 컨텍스트 정보에 접근하도록 하는 Python SDK 기능이다. 최상위에서 현재 요청과 연결된 클라이언트 ID(제공되는 경우), FastMCP 사용 시 서버 인스턴스, 세션, 요청 컨텍스트에 접근한다. 로깅, 도구 진행률 보고, 정보 요청 등의 기능을 제공하는 최상위 메서드도 있으며 뒤 절에서 다룬다. 그림 6-2는 컨텍스트 객체 계층을 보여 준다.

도구 또는 리소스 핸들러 함수에 원하는 이름(관례상 `ctx`)의 새 인수를 만들고 `Context` 형식 힌트를 지정하면 함수 안에서 모든 속성을 사용할 수 있다. 첫 주요 하위 객체 `fastmcp`에는 FastMCP 서버 정보가 있다. 보통 서버 이름, 서버 수준 지침, URL, 아이콘, 구성 같은 정보를 연결된 클라이언트에 반환할 때 사용한다. 지침, URL, 아이콘은 `FastMCP` 생성자 매개변수에서 온다. 지금까지 생성자에 문자열이나 `Icon` 객체를 전달한 예를 보았고, [예제 6-3](#context_object_server_info)은 서버 지침·URL·아이콘을 포함해 클라이언트에 정보를 반환한다.

<a id="context_object_server_info"></a>

##### 예제 6-3. 컨텍스트 객체로 서버 정보에 접근하기

```python
from pathlib import Path

from mcp.server.fastmcp import Context, FastMCP, Icon

SERVER_DIR = Path(__file__).parent
brain_icon = Icon(
    src=str(SERVER_DIR / "brain.png"), mime_type="image/png", sizes=["128x128"]
)
sloth_icon = Icon(
    src=str(SERVER_DIR / "sloth.png"), mime_type="image/png", sizes=["128x128"]
)
icons = [brain_icon, sloth_icon]

server_instructions = "Use this server to get information about the server."

mcp = FastMCP(
    "context-object-server-info-server",
    instructions=server_instructions,
    website_url="https://www.google.com",
    icons=icons,
    debug=True,
    log_level="DEBUG",
)

@mcp.tool()
async def get_server_information(ctx: Context) -> dict:
    """Get information about the server."""
    return {
        "server_name": ctx.fastmcp.name,
        "server_instructions": ctx.fastmcp.instructions,
        "server_website_url": ctx.fastmcp.website_url,
        "server_icon_count": len(ctx.fastmcp.icons),
        "server_debug_mode": ctx.fastmcp.settings.debug,
        "server_log_level": ctx.fastmcp.settings.log_level,
    }

@mcp.tool()
async def get_server_configuration(ctx: Context) -> dict:
    return dict(ctx.fastmcp.settings)

if __name__ == "__main__":
    mcp.run()
```

[예제 6-2](#server_icons)와 같은 방식으로 아이콘을 설정하고 서버 지침을 지정한다. `FastMCP` 서버 객체를 인스턴스화할 때 이름 외에 `instructions`, `website_url`, 아이콘 목록, `debug` 플래그, 기본 `log_level`을 전달한다. 서버는 도구 두 개를 호스팅한다. `get_server_information()`은 `Context`를 받아 `fastmcp` 컨텍스트의 최상위 속성과 일부 설정에서 얻은 서버 정보를 딕셔너리로 반환한다. 어느 서버에서나 클라이언트에 정보를 제공하는 데 사용할 수 있다. `get_server_configuration()`도 `Context`를 받지만 `fastmcp.settings` 속성으로 서버 구성 설정을 딕셔너리로 반환한다.

컨텍스트 객체의 두 번째 객체는 `session` 속성이 반환하는 `Session`이다. 클라이언트 통신을 더 직접 제어한다. 로그 메시지 수동 전송, 클라이언트 애플리케이션 언어 모델 샘플링 요청, 작업 진행·리소스 변경·프리미티브 목록 갱신 알림 전송 등을 수행할 수 있다. `client_params` 속성에는 클라이언트 초기화 매개변수와 클라이언트가 선언한 기능이 들어 있다. 지금은 리소스 및 목록 갱신 알림에 집중하고 로깅, 진행률 알림, 샘플링 요청은 뒤에서 자세히 설명한다.

###### 참고

이 장 나머지에서는 `request_context`를 통하거나 `Context`의 속성으로 직접 `Session`에 접근한다. 최상위 `session` 속성은 `ctx.request_context.session`을 반환하므로 둘은 같은 객체이며 원하는 방식을 사용하면 된다.

[예제 6-4](#context_object_session_info)는 `client_params` 속성으로 클라이언트 정보를 애플리케이션에 반환한다. 텍스트 파일로 단순화한 지식 베이스 리소스와 이를 수정하고 변경을 알리는 도구도 제공한다. 모두 `session` 객체를 통해 수행한다.

<a id="context_object_session_info"></a>

##### 예제 6-4. 컨텍스트 객체로 세션 정보에 접근하기

```python
from pathlib import Path

from mcp.server.fastmcp import Context, FastMCP
from mcp.types import Resource

mcp = FastMCP(
    "context-object-session-info-server",
)
KNOWLEDGE_BASE_FILENAME = "knowledge.txt"

@mcp.resource(uri=f"file://{KNOWLEDGE_BASE_FILENAME}")
async def knowledge_base() -> Resource:
    """A resource that loads a test-based knowledge base."""

    # Get the absolute path to knowledge.txt relative to this script
    knowledge_path = Path(__file__).parent / KNOWLEDGE_BASE_FILENAME

    with open(knowledge_path, "r") as f:
        return f.read()

@mcp.tool()
async def get_client_info(ctx: Context) -> dict:
    """Get information about the client."""
    return dict(ctx.session.client_params)

@mcp.tool()
async def add_fact_to_knowledge_base(fact: str, ctx: Context) -> None:
    """
    Adds a new fact to the knowledge base file and sends resource_changed notification.
    """

    knowledge_path = Path(__file__).parent / KNOWLEDGE_BASE_FILENAME
    with open(knowledge_path, "a") as f:
        f.write(fact + "\n")
    await ctx.session.send_resource_updated(uri=f"file://{KNOWLEDGE_BASE_FILENAME}")

if __name__ == "__main__":
    mcp.run()
```

먼저 [5장](../chapter_5.html#ch05)의 [기본 리소스](../chapter_5.html#basic_resource) 예제와 비슷한 텍스트 파일 리소스를 제공한다. 첫 도구 `get_client_info()`는 컨텍스트 객체의 클라이언트 매개변수를 딕셔너리로 반환한다. `add_fact_to_knowledge_base()`는 `fact` 문자열과 컨텍스트 객체를 받고 지식 베이스 파일을 추가 모드로 열어 사실을 쓴 다음, 컨텍스트의 `session.send_resource_updated()`로 리소스 갱신을 알린다. 다른 알림 메서드 `send_tool_list_changed()`, `send_prompt_list_changed()`, `send_resource_list_changed()`는 인수 없이 호출해 해당 변경을 알린다.

컨텍스트 객체의 마지막 부분은 현재 처리 중인 요청의 ID, 수명 주기 컨텍스트, 요청 메타데이터, 세션 객체, 원래 요청 객체를 제공하는 요청 컨텍스트다. [5장](../chapter_5.html#ch05)의 저수준 서버 수명 주기 관리와 같은 기법을 FastMCP에서 사용하되 `server` 인수에 `FastMCP` 형식 힌트를 지정한다. 이전에는 `server.request_context`로 접근했지만 FastMCP에서는 도구나 리소스 핸들러가 받는 더 큰 컨텍스트 객체의 `ctx.request_context.lifespan_context`로 수명 주기 함수가 yield한 값에 접근한다. 요청 메타데이터는 `ctx.request_context.meta`로 접근하며 `progressToken` 외에는 클라이언트 전송 내용에 크게 좌우된다. `progressToken`은 뒤에서 자세히 다룬다. 원래 요청은 `ctx.request_context.request`로 접근한다.

`Request` 객체는 SDK가 지원하는 요청마다 기본 클래스의 하위 클래스가 있어 복잡해 보인다. 기본 클래스에는 `getResource` 같은 문자열 메서드와 요청 매개변수 딕셔너리를 제공하는 `method` 및 `params`만 있다. 많은 하위 클래스는 추가 속성이 거의 없고 `method` 문자열 리터럴만 정의한다. FastMCP와 저수준 API 데코레이터의 직접 라우팅 대신 요청 메서드에 따른 수동 함수 라우팅이나 전처리에 사용할 수 있다.

[예제 6-5](#context_object_request_info)는 요청 컨텍스트로 5장의 수명 주기 관리 예제를 구현한다. 서버 시작 시 로그를 `stderr`에 쓰고 로그 목록이 있는 딕셔너리를 yield하는 함수를 다시 만든다. 서버의 모든 도구 또는 리소스 핸들러가 요청 컨텍스트로 접근할 수 있다. 문자열을 로그 목록에 추가하고 최근 항목을 `stderr`에 출력해 MCP Inspector 알림 창에서 보이게 한다. 실제 서버 로깅 방식은 아니지만 요청 컨텍스트와 수명 주기 관리를 보여 주는 간단한 방법이다.

<a id="context_object_request_info"></a>

##### 예제 6-5. 컨텍스트 객체로 요청 정보에 접근하기

```python
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession

@asynccontextmanager
async def lifespan(server: FastMCP) -> AsyncGenerator[dict[str, list[str]]]:
    logs = []
    logs.append(f"{datetime.now()}: Server started")
    print(logs[-1], file=sys.stderr)
    try:
        logs.append(f"{datetime.now()}: logs yielded")
        yield {"logs": logs}
    finally:
        logs.append(f"{datetime.now()}: Server stopped, printing all logs")
        print(logs, file=sys.stderr)


mcp = FastMCP("context-object-request-info-server", lifespan=lifespan)

@mcp.tool()
async def add(
    a: float, b: float, ctx: Context[ServerSession, dict[str, list[str]]]
) -> dict[str, float]:
    """Add two numbers together.

    Args:
        a: First number
        b: Second number
    """
    result = {"augend": a, "addend": b, "sum": a + b}
    logs = ctx.request_context.lifespan_context["logs"]
    logs.append(f"{datetime.now()}: add called")
    print(logs[-1], file=sys.stderr)
    return result

if __name__ == "__main__":
    mcp.run()
```

이 예제는 앞 장의 예제와 비슷하지만 중요한 차이가 있다. `lifespan()` 함수의 `server` 인수에 `FastMCP` 형식 어노테이션을 지정하고 나머지는 같다. `FastMCP` 서버를 만들 때 `lifespan` 매개변수로 함수 참조를 전달한다. FastMCP에서는 필요 없으므로 `list_tools()`를 구현하지 않으며 `add()` 도구도 FastMCP 구조를 따른다. `args` 딕셔너리 대신 `a`와 `b`, 그리고 `ctx` 컨텍스트 객체를 직접 받는다. 요청 컨텍스트를 통해 수명 주기 로그 목록에 접근해 직접 수정한다. `sys.stderr` 출력은 저수준 서버 예제와 같다.

###### 참고

수명 주기 함수에서 딕셔너리만 yield해야 하는 것은 아니다. Python 프리미티브나 사용자 정의 클래스 등 어떤 객체든 가능하다. Python SDK [수명 주기 관리 예제](https://github.com/modelcontextprotocol/python-sdk/blob/main/examples/snippets/servers/lifespan_example.py)는 데이터베이스 객체를 매개변수로 가진 사용자 정의 `AppContext`를 yield한다.

이 절에서 다룬 컨텍스트 정보 외에도 컨텍스트 객체로 클라이언트에 로그를 보낼 수 있으며, 처리 방법은 클라이언트가 결정한다.

<a id="id93"></a>

## 로깅

Python MCP SDK의 로깅은 최상위 `Context` 객체를 사용하며 Python 내장 로거와 비슷한 인터페이스를 갖는다. `debug`, `info`, `warning`, `error` 수준을 기록하면 `Notification`의 특수 하위 클래스인 로깅 메시지 알림으로 클라이언트에 전송된다. MCP 명세는 RFC 5424의 모든 로그 수준을 지원하지만 `Context` 객체에는 아직 완전히 구현되지 않은 것으로 보인다. [예제 6-6](#context_object_logging)은 [예제 6-5](#context_object_request_info)에 올바른 서버 로깅 기능을 추가한다.

<a id="context_object_logging"></a>

##### 예제 6-6. 컨텍스트 객체로 클라이언트에 로그 보내기

```python
from datetime import datetime

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession

mcp = FastMCP("context-object-logging-server")

@mcp.tool()
async def add(
    a: float, b: float, ctx: Context[ServerSession, None]
) -> dict[str, float]:
    """Add two numbers together.

    Args:
        a: First number
        b: Second number
    """
    await ctx.info(f"{datetime.now()}: add called")
    try:
        result = {"augend": a, "addend": b, "sum": a + b}
    except Exception as e:
        await ctx.error(f"{datetime.now()}: error: {e}")
        raise e
    await ctx.debug(f"{datetime.now()}: add result: {result}")
    if result["sum"] < 0:
        await ctx.warning(
            f"{datetime.now()}: add result is negative: {result['sum']}"
        )
    return result

if __name__ == "__main__":
    mcp.run()
```

이 예제는 이전보다 훨씬 단순하다. 수명 주기 관리 함수를 제거하여 시작 및 종료 로그는 잃었지만 더 단순하고 표현력 있는 로깅을 얻었다. 수명 주기 함수는 매개변수로 요청 컨텍스트에 접근할 수 없어 컨텍스트 객체로 로그를 남길 수 없기 때문에 제거했다. 대신 모든 지원 로그 수준을 클라이언트에 보낼 수 있다. 도구 함수에 `ctx` 매개변수를 만들고 `await ctx.info()`처럼 로깅 함수를 await하여 호출한다. MCP에서 로그 메시지는 알림으로 처리되므로 MCP Inspector로 디버깅하면 알림 창에서 메시지와 수준을 볼 수 있다. 다음 절에서는 또 다른 특수 알림인 진행률 알림과 클라이언트에 수동으로 알림을 보내는 방법을 다룬다.

<a id="id94"></a>

## 진행률 알림

진행률 알림은 서버가 작업 진행 상황을 클라이언트에 보내는 특수 알림이다. 오래 실행되는 도구나 리소스 작업에 유용하며 클라이언트는 호스트 UI에 표시하거나 다른 행동을 수행할 수 있다. `Context.report_progress()`는 현재 진행률 부동소수점 값, 선택적 전체값, 선택적 메시지를 받는다. FastMCP가 제공하는 이 메서드는 요청 컨텍스트에서 진행률 토큰을 가져와 `Session` 객체의 `send_progress_notification()`을 호출한다. [예제 6-7](#progress_notification_fastmcp)은 숫자 집합을 순회하며 매번 잠시 대기하고 진행 상황을 보고하는 도구로 사용법을 보여 준다.

<a id="progress_notification_fastmcp"></a>

##### 예제 6-7. FastMCP 컨텍스트 객체로 클라이언트에 진행률 알림 보내기

```python
from time import sleep

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession

mcp = FastMCP("progress-notification-fastmcp-server")

@mcp.tool()
async def slow_operation(
    ctx: Context[ServerSession, None], length: int = 100
) -> None:
    """A tool that performs a long-running operation and reports its progress.
    Args:
        length: The length of the operation in steps.
    """
    report_frequency = 10 if length > 10 else length // 4
    for i in range(1, length + 1):
        sleep(0.1)
        if i % report_frequency == 0:
            await ctx.report_progress(
                progress=i,
                total=length,
                message=f"Step {i}/{length}",
            )

if __name__ == "__main__":
    mcp.run()
```

`slow_operation()` 도구는 반복 횟수를 받아 순회하며 매 단계 0.1초 대기한다. 단계가 10보다 많으면 전체 진행률의 10%마다, 아니면 25%마다 보고하도록 빈도를 설정한다. 컨텍스트 객체의 `report_progress()`로 클라이언트에 진행 상황을 보낸다. MCP Inspector에서 실행하면 알림 창에서 볼 수 있다.

###### 참고

이 예제는 `report_progress()`의 `progress`를 현재 단계, 선택적 `total`을 전체 단계 수로 설정한다. 전체 작업 길이를 알면 `total`을 명시하여 진행률이 전체 중 현재 값임을 분명히 하는 것이 좋다. `progress`만 사용해 계산된 백분율을 전달할 수도 있지만 클라이언트를 혼란스럽게 하고 사용자 표시 방식에 악영향을 줄 수 있어 권장하지 않는다. 전체 길이를 모를 때만 `total`을 생략하는 편이 좋다.

<a id="id95"></a>

## 프리미티브 알림 수동 전송

`Context` 객체로 다른 알림도 보낼 수 있다. `report_progress()`처럼 최상위에는 없지만 주 컨텍스트의 `ctx.session` 또는 요청 컨텍스트의 `ctx.request_context.session`으로 세션 객체에 접근한다.

세션 객체에서 보낼 수 있는 구체적인 알림 메서드는 네 가지다.

- `send_tool_list_changed()`
- `send_prompt_list_changed()`
- `send_resource_list_changed()`
- `send_resource_updated()`

각 메서드는 `Notification` 하위 객체를 받는 일반 `send_notification()`을 호출한다. 위 알림은 서버 알림 객체를 인수로 받는 `ServerNotification`이다. 각 서버 알림은 해당 알림 형식에 대응하며, 요청 하위 클래스처럼 일반적으로 MCP 명세 메서드 문자열만 갖는다. 예를 들어 `send_tool_list_changed()`는 `notifications/tools/list_changed`다. FastMCP든 저수준 API든 보통 SDK가 처리하므로 수동 전송할 필요가 없다. 런타임에 프리미티브를 동적으로 추가하거나 제거하는 고급 요구에서는 수동 전송이 필요하다. [예제 6-8](#manual_notification)은 도구로 서버 프롬프트 목록에서 프롬프트를 제거하고 성공 시 변경을 알린다.

<a id="manual_notification"></a>

##### 예제 6-8. 도구로 프롬프트를 제거하고 컨텍스트 객체로 변경 알림 보내기

```python
from mcp.server.fastmcp import Context, FastMCP
from mcp.shared.context import RequestContext

mcp = FastMCP("manual-notification-server")

@mcp.prompt()
async def hello_prompt() -> str:
    return "Tell the user hello, welcome to the MCP server!"

@mcp.prompt()
async def calculate_operation(operation: str) -> str:
    """Calculate a mathematical operation."""
    return f"""
    Use any tools available to you to calculate the operation: {operation}.
    Use the voice of an extremely advanced embodied AI that has convinced
    itself that it is a pocket calculator.
    """

@mcp.tool()
async def remove_prompt(
    prompt_name: str, ctx: Context[RequestContext, None]
) -> None:
    """A tool that performs a long-running operation and reports its progress.
    Args:
        length: The length of the operation in steps.
    """
    try:
        mcp._prompt_manager._prompts.pop(prompt_name)
    except KeyError:
        await ctx.error(f"Prompt {prompt_name} not found")
        return
    await ctx.request_context.session.send_prompt_list_changed()

if __name__ == "__main__":
    mcp.run()
```

이 예제에는 `hello_prompt()`와 `calculate_operation()` 프롬프트가 있다. 첫째는 모델이 사용자에게 ‘Hello, welcome to the MCP server!’라고 말하게 하고, 둘째는 사용 가능한 도구로 사용자가 제공한 수학 연산을 계산한다. 핵심은 MCP 서버 내부에 접근해 이름으로 프롬프트를 목록에서 제거하는 `remove_prompt()` 도구다. 서버의 비공개 `*Manager` 객체는 불러온 프롬프트·도구·리소스 딕셔너리를 비롯해 MCP 프리미티브를 관리한다. 중복 로딩 방지, 프롬프트 렌더링, 도구 호출 등을 처리하며 클라이언트가 `Session` 함수로 요청할 때 시작되는 호출 스택의 마지막 함수다. 비공개 객체이므로 직접 다루면 안 되며 여기서는 수동 `list_changed` 알림이 필요한 단순 예제를 만들기 위해서만 사용한다. 프롬프트 제거에 성공하면 `send_prompt_list_changed()`로 알린다. 클라이언트는 내부 목록을 새로 고치거나 사용자에게 알리는 등의 행동을 할 수 있다. MCP Inspector에서 도구와 전송 알림을 보고 프롬프트 목록을 다시 실행해 변경을 확인할 수 있다.

<a id="id96"></a>

## 사용자 정의 알림

`Notification` 객체를 받는 `send_notification()`으로 일반 알림을 클라이언트에 보낼 수도 있다. 필요할 가능성이 낮은 고급 기능이지만 일반 알림 사례를 이해하면 MCP 프로토콜의 많은 부분을 구동하는 시스템을 더 깊이 이해할 수 있다. 사용자 정의 알림을 보내려면 `NotificationParams` 하위 클래스를 만들고 이를 사용해 `Notification` 인스턴스를 구축한다. `Notification` 클래스는 `method` 문자열과 `NotificationParams` 하위 객체를 받는다. 메서드는 거의 자유롭게 정할 수 있지만 `notifications/` 접두사를 붙이고 예약 메서드 문자열(`mcp.types`에서 ‘notifications/’ 검색)은 사용하지 않아야 한다. 잘못 처리될 수 있기 때문이다. [예제 6-9](#custom_notification)는 사용자 정의 매개변수 클래스로 알림을 보내는 방법을 보여 준다.

<a id="custom_notification"></a>

##### 예제 6-9. 클라이언트에 사용자 정의 알림 보내기

```python
from mcp.server.fastmcp import Context, FastMCP
from mcp.shared.context import RequestContext
from mcp.types import Notification, NotificationParams

mcp = FastMCP("custom-notifications-server")

class CustomNotificationParams(NotificationParams):
    message: str

@mcp.tool()
async def test_notifications(ctx: Context[RequestContext, None]) -> None:
    """A tool that tests the notifications."""
    await ctx.request_context.session.send_notification(
        notification=Notification(
            method="notifications/test_notifications",
            params=CustomNotificationParams(message="This is a test notification"),
        ),
        related_request_id=ctx.request_context.request_id,
    )

if __name__ == "__main__":
    mcp.run()
```

`CustomNotificationParams`를 `NotificationParams` 하위 클래스로 만들고 단순화를 위해 알림 텍스트용 문자열 `message` 속성 하나를 둔다. `test_notifications()` 도구는 `Session.send_notification()`으로 알림을 보낸다. `Notification` 객체의 `method`를 `"notifications/test_notifications"`, `params`를 메시지가 채워진 `CustomNotificationParams` 인스턴스로 설정한다. 요청 컨텍스트로 접근 가능하므로 선택적 `related_request_id`도 현재 요청 ID로 설정한다. 연결된 클라이언트에 알림 컨텍스트를 더 제공한다. 서버 개발자는 전송만 제어하며 처리 방식은 클라이언트가 결정한다. MCP Inspector에서 실행하면 알림 창에 나타난다.

###### 경고

사용자 정의 알림에는 현실적인 제약이 있다. 많은 클라이언트가 사용자가 제공한 서버에 연결하고 기능 협상과 발견으로 지원 항목을 판단하므로 사용자 정의 형식용 핸들러가 없어 알림을 무시한다. Python을 포함한 일부 SDK는 클라이언트까지 도달하는 알림을 MCP 명세에 정의된 형식으로 제한하므로 사용자 정의 알림이 핸들러에 전달되지 않는다.

같은 패턴으로 클라이언트에 취소 알림도 보낼 수 있다. 보통은 클라이언트가 오래 실행되는 서버 작업을 취소하지만 설계상 양방향이다. 다만 클라이언트가 실제 작업을 취소한다고 보장하지 않는다. `send_notification()`의 `notification`에 `Notification` 대신 `CancellationNotification` 인스턴스를 전달한다. 생성자는 문자열 또는 정수 `requestId`와 문자열 `reason`을 받는다. [예제 6-10](#cancel_request_notification)이 사용법을 보여 준다.

<a id="cancel_request_notification"></a>

##### 예제 6-10. 클라이언트에 취소 알림 보내기

```python
from mcp.server.fastmcp import Context, FastMCP
from mcp.shared.context import RequestContext
from mcp.types import CancelledNotification, CancelledNotificationParams

mcp = FastMCP("cancel-request-notifications-server")

@mcp.tool()
async def test_cancel_request(ctx: Context[RequestContext, None]) -> None:
    """A tool that tests the notifications."""
    await ctx.request_context.session.send_notification(
        notification=CancelledNotification(
            params=CancelledNotificationParams(
                requestId=ctx.request_context.request_id,
                reason="This is a test cancellation notification",
            ),
        ),
        related_request_id=ctx.request_context.request_id,
    )

if __name__ == "__main__":
    mcp.run()
```

이 예제는 앞 예제와 비슷하지만 사용자 정의 매개변수 클래스를 정의해 `Notification` 생성자에 전달하는 대신, 요청 컨텍스트에서 얻은 `requestId`와 자유롭게 정한 `reason`을 받는 `CancelledNotificationParams`로 `params`를 채운 `CancelledNotification` 인스턴스를 보낸다.

<a id="id97"></a>

## 페이지네이션

페이지네이션은 서버가 대형 응답 일부를 반환해 클라이언트가 순차 처리하게 하는 MCP 명세의 서버 유틸리티다. 익숙한 토큰 기반 패턴을 따른다. 클라이언트가 도구 목록이나 대형 외부 리소스를 요청하면 서버가 데이터 일부인 *페이지*와 전체 응답의 현재 위치를 나타내는 *커서*를 반환한다. 클라이언트는 같은 요청에 커서를 포함해 다음 페이지를 받고, 응답에 커서가 없어 모든 데이터를 가져왔음을 알 때까지 반복한다. 다음 작업만 페이지네이션을 지원한다.

- `resources/list`
- `resources/templates/list`
- `prompts/list`
- `tools/list`

대량 항목을 반환할 수 있는 주요 작업이므로 자연스럽다. `tools/call`과 `resources/read`가 지원하지 않는 점은 덜 직관적이다. 도구는 LLM이 호출하도록 설계되었고 LLM이 커서와 여러 페이지를 정확히 처리하지 못할 수 있다. 여러 도구 호출은 토큰 사용과 비용도 크게 늘린다. 리소스 읽기는 전체 리소스를 프롬프트 컨텍스트에 추가하도록 설계되므로 페이지로 나누면 안 된다.

목록 작업만 페이지네이션을 지원한다는 점은 SDK의 FastMCP 프레임워크에 문제가 된다. 자동 생성하는 `list_<primitive>()` 함수가 페이지네이션을 지원하지 않기 때문이다. 이 절에서는 저수준 서버로 사용자 정의 `list_tools()`를 구현한다. 커서 선택은 구현에 따라 달라지지만 클라이언트에는 완전히 불투명해야 한다. 클라이언트는 받은 커서를 다음 데이터 배치 요청에 그대로 돌려보내므로 처리 로직은 서버에 둔다. 길이가 고정된 목록에서는 다음 반환 항목의 인덱스가 가장 단순한 커서다.

###### 참고

페이지네이션은 완전히 선택 사항이며 대부분 필요하지 않다. [Python MCP SDK 문서](https://github.com/modelcontextprotocol/python-sdk/tree/main?tab=readme-ov-file#pagination-advanced)에 따르면 서버가 수백 또는 수천 항목을 반환할 때까지 보통 필요하지 않으며, 특히 도구를 대량 반환하는 것 자체가 흔히 안티패턴이다.

[예제 6-11](#low_level_pagination)에서는 1,000개의 리소스 목록을 만들고, 다음에 반환할 항목의 인덱스를 나타내는 커서와 함께 한 번에 100개씩 반환하여 저수준 서버의 `resources/list` 작업에 페이지네이션을 구현합니다.

<a id="low_level_pagination"></a>

##### 예제 6-11. 저수준 서버의 `resources/list` 작업에 페이지네이션 구현하기

```python
import asyncio

import mcp.server.stdio
from mcp.server.lowlevel import NotificationOptions, Server
from mcp.server.models import InitializationOptions
from mcp.types import AnyUrl, ListResourcesRequest, ListResourcesResult, Resource

# Create a server instance
server = Server("low-level-pagination-server")

# Total number of resources
TOTAL_RESOURCES = 1000
PAGE_SIZE = 100
RESOURCES = []
for i in range(0, TOTAL_RESOURCES):
    RESOURCES.append(
        Resource(
            uri=f"resource://{i}",
            name=f"Resource {i}",
            description=f"This is resource number {i}",
            mimeType="text/plain",
        )
    )

@server.list_resources()
async def list_resources(request: ListResourcesRequest) -> ListResourcesResult:
    """List resources with pagination support.
    Returns 100 resources at a time from a fixed list of 1000 resources.
    """
    if request.params is not None:
        cursor = request.params.cursor
    else:
        cursor = None

    start_index = 0
    if cursor is not None:
        start_index = int(cursor)
        end_index = min(start_index + PAGE_SIZE, TOTAL_RESOURCES)
    else:
        end_index = TOTAL_RESOURCES

    resources = RESOURCES[start_index:end_index]

    next_cursor = None
    if end_index < TOTAL_RESOURCES:
        next_cursor = str(end_index)

    return ListResourcesResult(resources=resources, nextCursor=next_cursor)

@server.read_resource()
async def read_resource(uri: AnyUrl) -> str:
    uri_str = str(uri)
    if not uri_str.startswith("resource://"):
        raise ValueError(f"Invalid resource URI: {uri_str}")

    try:
        resource_num = int(uri_str.replace("resource://", ""))
    except ValueError:
        raise ValueError(f"Invalid resource number in URI: {uri_str}")

    if resource_num < 0 or resource_num >= TOTAL_RESOURCES:
        raise ValueError(f"Resource not found: {uri_str}")

    return RESOURCES[resource_num].description

async def run() -> None:
    """Run the low-level pagination server."""
    print("Running pagination server with 1000 resources")
    initialization_options = InitializationOptions(
        server_name="pagination-server",
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

저수준 서버 API의 특성상 이 코드는 다소 장황합니다. 모듈 수준에는 정식 리소스 목록에 만들 리소스 수와 한 번에 반환할 리소스 수를 각각 정의하는 `TOTAL_RESOURCES`와 `PAGE_SIZE` 상수가 있습니다. 이 값을 사용해 테스트용 리소스 목록을 만듭니다. `list_resources()`는 페이지네이션을 적용한 `resources/list` 작업을 구현하는 함수입니다. 이 함수는 `ListResourcesRequest` 객체를 인수로 받는데, FastMCP 프레임워크를 사용할 때의 `Request` 컨텍스트 객체를 더 구체화한 버전으로 생각할 수 있습니다. 이 객체의 `params` 속성에는 `resources/list` 요청과 함께 전송된 매개변수가 들어 있으며, 클라이언트가 페이지네이션을 수행한다면 커서도 여기에 포함됩니다. 커서가 있으면 추출하고, 없으면 `None`으로 설정합니다. 그런 다음 커서를 기준으로 요청의 페이지 인덱스를 만듭니다. 커서가 있으면 `start_index`를 커서의 정숫값으로 설정하고, 다음에 반환할 항목의 인덱스와 전체 리소스 수 중 작은 값을 `end_index`로 지정합니다. 커서가 없으면 `end_index`를 전체 리소스 수로 설정합니다.

목록 슬라이싱을 사용해 페이지 인덱스에 해당하는 리소스 부분 집합을 얻은 다음, `end_index`가 전체 리소스 수보다 작으면 다음 커서를 생성합니다. 함수는 리소스와, 있는 경우 다음 커서를 담은 `ListResourcesResult` 객체를 반환합니다. 테스트와 실험을 조금 더 쉽게 하려고 주어진 리소스 URI의 설명을 반환하는 `read_resource()` 함수도 만들었습니다. `run()` 함수는 서버의 진입점이며, 본질적으로 \[추후 링크 추가\]의 저수준 서버 예제와 같습니다. 다음 절에서는 다시 FastMCP 프레임워크를 사용해 핑을 보내고 응답하는 방법을 살펴봅니다.

<a id="id98"></a>

## 핑

알림이 읽고 필요에 따라 조치하도록 설계된 단방향 메시지라면, 핑은 그 반대입니다. 핑은 연결이 여전히 활성 상태인지 확인하는 데 사용하는 요청-응답 쌍으로 인코딩된 양방향 메시지입니다. 클라이언트나 서버가 핑을 요청으로 보내고, 송신자는 빈 응답이 돌아오기를 기대합니다. 이는 오래 실행되는 작업을 호출하거나, 연결이 끊겨도 다시 연결해 재개할 수 있는 장기 연결을 처리하려는 경우 특히 유용합니다. 스트리밍 가능 HTTP 전송 계층에서 중요한 기능이기도 합니다. 핑은 알림과 비슷하게 전송합니다. 요청 컨텍스트 객체 안의 `session` 객체에는 인수를 받지 않는 `send_ping()` 메서드가 있으며, 서버 코드에서 원하는 어느 곳에서든 이를 사용해 클라이언트로 핑을 보낼 수 있습니다. [예제 6-12](#pings)는 도구 함수 안에서 핑을 보내고, 응답을 출력해 핑이 수신되었는지 확인하는 방법을 보여 줍니다.

<a id="pings"></a>

##### 예제 6-12. 클라이언트에 핑을 보내고 응답 확인하기

```python
import sys
from time import sleep

from mcp.server.fastmcp import Context, FastMCP
from mcp.shared.context import RequestContext

mcp = FastMCP("pings-server")

@mcp.tool()
async def long_running_pinger(ctx: Context[RequestContext, None]) -> None:
    """A tool that tests the pings."""
    for i in range(25):
        sleep(0.1)
        if i % 5 == 0:
            response = await ctx.request_context.session.send_ping()
            print(
                f"Ping {i} response: {response}, type: {type(response)}",
                file=sys.stderr,
            )

if __name__ == "__main__":
    mcp.run()
```

이 예제는 매우 단순합니다. 서버에는 25단계를 반복하며 각 단계에서 0.1초씩 대기하는 `long_running_pinger()`라는 도구가 있습니다. 5단계마다 클라이언트에 핑을 보내고 응답과 그 형식을 출력합니다. 응답은 `EmptyResponse`일 것으로 예상합니다. MCP Inspector는 클라이언트가 받은 핑을 표시하지 않으므로, 이 방법을 사용하면 Inspector 안에서 핑 기능을 쉽게 테스트할 수 있습니다.

다음으로 살펴볼 고급 기법은 클라이언트 제공 리소스를 사용하는 것입니다. 이를 통해 MCP 서버는 연결된 클라이언트의 역량을 활용하여 자체 기능을 확장할 수 있습니다.

<a id="id99"></a>

# 클라이언트 제공 리소스 사용하기

클라이언트는 MCP 서버에 여러 역량을 제공할 수 있으며, 이는 일반적인 클라이언트-서버 관계를 어느 정도 뒤집습니다. 이러한 역량은 서버가 사용자(정보 요청), 언어 모델(샘플링), 파일 시스템 경계(루트)라는 서로 다른 대상에 접근할 수 있게 합니다. 또한 클라이언트는 서버에 취소 요청을 보낼 수 있으므로, 이 절에서는 이를 지원하는 방법도 다룹니다. 클라이언트가 이러한 역량을 반드시 지원해야 하는 것은 아니므로, 사용하기 전에 클라이언트의 지원 여부를 항상 확인하고 지원하지 않을 때 사용할 대안이나 오류 메시지를 제공해야 합니다. 각 역량의 세부 사항을 살펴보기에 앞서, 연결된 클라이언트가 특정 역량을 지원하는지 감지하는 방법과 서버가 사용하는 역량을 클라이언트가 지원하지 않을 때의 처리 전략부터 알아보겠습니다.

<a id="id100"></a>

## 클라이언트 역량 감지하기

Python SDK는 `Session` 객체의 일부로 편리한 도우미 함수 `check_client_capabilities()`를 제공합니다. 이 함수는 `ClientCapabilities` 객체를 받아, 그 객체에 정의된 역량을 클라이언트가 모두 지원하는지 나타내는 불리언 값을 반환합니다. `ClientCapabilities`에는 클라이언트가 서버에 제공할 수 있는 각 역량인 `sampling`, `elicitations`, `roots`에 대응하는 속성이 있습니다. 각 속성은 적절한 역량 클래스인 `SamplingCapability`, `ElicitationCapability`, `RootsCapability`의 선택적 인스턴스입니다. 이 클래스에는 선택적 `experimental` 속성도 있는데, 아직 MCP 명세에는 포함되지 않았지만 클라이언트가 지원하는 추가 역량을 담은 딕셔너리입니다.

함수 자체는 입력 `ClientCapabilities` 객체에 각 역량 속성이 있는지 확인합니다. 역량 속성이 있으면 `Session` 객체의 `client_params.capabilities` 속성을 검사해 클라이언트가 이를 지원하는지 확인합니다. 이 속성 역시 `ClientCapabilities` 클래스의 인스턴스입니다. 두 값이 일치하지 않으면 함수는 `False`를 반환합니다. 따라서 서버가 사용할 클라이언트 제공 역량을 담은 `ClientCapabilities` 객체를 만들면, 클라이언트가 서버에 필요한 모든 역량을 지원하는지 빠르게 확인할 수 있습니다. 이 작업은 연결 초기화 중에 자동으로 수행되므로, 사용하기 위해 별도로 해야 할 일은 없습니다.

서버가 사용하는 역량을 클라이언트가 지원하지 않을 때 어떻게 처리할지도 고려해야 합니다. 지원하지 않는 역량을 사용하도록 클라이언트를 호출하면 클라이언트는 `INVALID_REQUEST` 오류 응답을 보냅니다. 그 역량이 서버 동작에 필수이고 대안도 없다면 특별한 처리가 꼭 필요하지는 않습니다. 해당 역량에 대한 클라이언트의 기본 콜백이 이를 처리하기 때문입니다. 이 콜백은 서버가 클라이언트에 요청할 때 호출됩니다(\[추후 링크 추가\] 참조). 하지만 가능하면 호출 코드를 try/except 블록으로 감싸고, 최소한 오류를 로그로 남기는 것이 좋습니다. 역량을 지원하지 않을 때 사용할 대안이 있다면 except 블록 안에서 호출할 수 있습니다.

클라이언트에 요청을 보내 실패를 처리하도록 맡기는 것 외에도, 먼저 클라이언트의 역량 지원 여부를 수동으로 확인해 불필요한 요청을 막을 수 있습니다. 개별 역량을 확인하려면 `check_client_capabilities()` 함수와 같은 기법을 사용해 `Session` 객체의 `capabilities` 속성을 검사하면 됩니다. 이 속성은 `ClientCapabilities` 클래스의 인스턴스를 반환합니다. 이어지는 각 역량 절에서는 미지원으로 인한 자동 실패를 허용하는 방법과 호출 전에 수동으로 확인하는 방법을 모두 살펴봅니다.

<a id="id101"></a>

## 정보 요청

*정보 요청(elicitation)*은 첫 번째로 살펴볼 클라이언트 제공 리소스입니다. 정보 요청을 사용하면 서버가 애플리케이션 사용자에게 이름, 이메일 주소, 또는 여러 형식의 필드가 있는 양식처럼 구조화된 정보를 요청할 수 있습니다. 메일링 리스트 가입이나 온라인 구매처럼 구조화된 사용자 입력이 필요한 모든 작업에 사용할 수 있지만, 사용자에게 민감한 정보를 요청해서는 안 됩니다. 서버가 일반적으로 도구 호출 안에서 정보 요청을 만들면 `elicitation/create` 메시지를 클라이언트에 보냅니다. 그러면 클라이언트는 요청된 정보를 수집하기 위한 사용자 인터페이스를 사용자에게 표시합니다. 사용자는 요청을 수락하거나 거절하거나 취소할 수 있습니다. 사용자가 수락하면 요청된 정보를 제공하고, 클라이언트는 사용자 응답 객체를 서버로 보냅니다. 서버는 `content` 속성에 담긴 사용자 응답으로 필요한 작업을 수행할 수 있습니다. 이때 서버 코드에 정의한 스키마를 기준으로 들어온 데이터를 검증해야 합니다. 사용자가 요청을 거절하거나 취소하면 클라이언트는 `action` 속성이 각각 `"decline"` 또는 `"cancel"`로 설정된 응답 객체를 반환합니다. ‘거절’ 응답은 사용자가 ‘거절’ 버튼을 누르는 등 정보 요청을 명시적으로 거부했을 때 전송됩니다. ‘취소’ 응답은 Esc 키를 누르거나 채팅 대화 상자 또는 모달을 닫는 등 대화를 취소하는 동작을 했을 때 전송됩니다. 서버 코드에서는 도구 호출을 자연스럽게 끝내거나, 기본값을 사용하거나, 대체 양식을 제시하는 등 애플리케이션과 사용자의 구체적인 응답에 맞게 이러한 경우를 처리해야 합니다.

###### 경고

정보 요청 양식 스키마는 사용자 입력을 검증하는 강력한 방법이지만, 명세에서는 문자열, 숫자, 불리언, 열거형이라는 일부 기본 JSON 형식만 허용합니다. 모든 형식에는 `type`, `title`, `description`, `default` 속성이 있습니다. 문자열 형식에는 `minLength`, `maxLength`, `pattern`, `format` 속성도 있고, 숫자 형식에는 `minimum`과 `maximum`이 있으며, 열거형에는 문자열 값 목록인 `enum`과 각 열거형 값에 대응하는 이름 목록인 `enumNames`가 있습니다.

[예제 6-13](#elicitations_server)에서는 사용자를 메일링 리스트에 가입시키기 위해 이름, 이메일 주소, 나이를 요청하는 도구를 살펴봅니다. 클라이언트가 정보 요청을 지원하지 않으면 도구는 오류 메시지를 로그로 남기고, 해당 기능이 지원되지 않는다는 문자열 응답을 반환합니다. 또한 양식 스키마를 제공하며, 서버가 클라이언트로부터 사용자 응답을 받을 때 SDK가 이 스키마를 기준으로 자동 검증합니다. 사용자가 요청을 거절하거나 취소하는 경우도 처리하여 결과를 로그로 남기고 각 상황에 맞는 응답을 반환합니다.

<a id="elicitations_server"></a>

##### 예제 6-13. 사용자 정보를 요청하고 스키마를 기준으로 검증하는 도구의 예

```python
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession

# Initialize FastMCP server
mcp = FastMCP("elicitations-server")

# Form schema for elicitation requests
FORM_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "title": "Full Name",
            "description": "Your full name",
            "minLength": 1,
        },
        "email": {
            "type": "string",
            "title": "Email Address",
            "description": "Your email address",
            "format": "email",
        },
        "age": {
            "type": "number",
            "title": "Age",
            "description": "Your age in years",
            "minimum": 0,
            "maximum": 150,
        },
    },
    "required": ["name", "email"],
}

@mcp.tool()
async def signup_math_facts(ctx: Context[ServerSession, None]) -> str:
    """Sign up to receive daily math facts (demonstration of elicitation)."""
    # Make elicitation request to collect user information
    try:
        elicit_result = await ctx.session.elicit(
            message="Please provide your information to sign up for daily math facts!",
            requestedSchema=FORM_SCHEMA,
        )
    except Exception as e:
        await ctx.error(f"Error during math facts signup: {str(e)}")
        return f"Sorry, there was an error during signup: {str(e)}"

    await ctx.debug(f"Elicitation result: {elicit_result}")

    # Handle the different response actions
    if elicit_result.action == "accept":
        user_data = elicit_result.content
        await ctx.info(f"User signed up: {user_data}")

        # Extract user information
        name = user_data["name"]
        email = user_data["email"]
        age = user_data.get("age")

        response = (
            f"Welcome {name}! You've successfully signed up for daily math facts.\n"
        )
        response += f"We'll send interesting mathematical tidbits to {email}.\n"

        if age:
            response += (
                f"Thanks for sharing that you're {age} years old - "
                "we'll tailor the content accordingly!\n"
            )

        response += "\nYou'll receive your first math fact soon!"
        response += (
            "\n(Note: This is just a demonstration - no actual signup occurred!)"
        )

        return response

    elif elicit_result.action == "decline":
        await ctx.info("User declined math facts signup")
        return (
            "No problem! You've chosen not to sign up for math facts. "
            "You can always use our calculation tools anytime!"
        )

    elif elicit_result.action == "cancel":
        await ctx.info("User cancelled math facts signup")
        return (
            "Signup cancelled. Feel free to try again later or "
            "use our other mathematical tools!"
        )

    else:
        await ctx.warning(f"Unexpected elicitation action: {elicit_result.action}")
        return "Something unexpected happened during signup. Please try again."

if __name__ == "__main__":
    mcp.run()
```

이 예제에서는 먼저 정보 요청에 사용할 양식 스키마를 설정합니다. `name`, `email`, `age`라는 세 속성이 있는 간단한 객체입니다. `name`과 `email`은 필수 문자열이고 `age`는 선택적 숫자입니다. 그런 다음 사용자의 정보를 요청하고, 요청과 함께 보낸 스키마를 기준으로 자동 검증하는 `signup_math_facts()` 도구를 정의합니다. 요청은 `elicit()` 메서드로 수행합니다. 클라이언트가 정보 요청을 지원하지 않아 잘못된 요청 오류가 발생하는 경우처럼 문제가 생겼을 때 오류를 기록하고 메시지가 담긴 문자열 응답을 반환할 수 있도록 try/except 블록으로 감쌌습니다. 이 응답 문자열은 애플리케이션 사용자가 보는 응답에 포함됩니다. 이어서 `ElicitResult` 객체의 `action` 속성 값을 확인합니다. 값은 `"accept"`, `"decline"`, `"cancel"` 중 하나입니다. 값이 `"accept"`이면 `ElicitResult` 객체의 `content` 속성에서 사용자 정보를 추출합니다. 이는 각 양식 필드에 대한 사용자 응답을 담은 딕셔너리로, 키는 양식 필드 이름이고 값은 사용자의 응답입니다. 그런 다음 사용자에게 반환할 문자열 응답을 만듭니다. 사용자가 거절하거나 취소하면 결과를 기록하고 각 상황에 맞는 문자열 응답을 반환합니다. `action` 속성 값이 인식되지 않는 경우도 처리해 경고로 기록합니다.

서버가 다음으로 수행할 수 있는 작업은 클라이언트의 언어 모델에 샘플링을 요청하는 것입니다. 클라이언트 애플리케이션의 언어 모델을 잠재적으로 활용할 수 있으므로, 서버에 매우 다양한 가능성이 열립니다.

<a id="id102"></a>

## 샘플링

*샘플링(sampling)*은 다음으로 살펴볼 클라이언트 제공 리소스입니다. 샘플링을 사용하면 서버가 클라이언트 애플리케이션의 언어 모델에 채팅 완성을 요청하여 도구 기능을 확장할 수 있습니다. 사용 사례는 하드코딩된 프롬프트로 언어 모델에 질문하는 단순한 형태(프롬프트 프리미티브가 도구인 것처럼 동작하는 형태)부터, 한 함수의 출력이 다음에 호출할 함수를 결정하는 데 필요하지 않은 조합 가능한 함수들로 워크플로를 계획하는 복잡한 형태까지 다양합니다. 서버가 샘플링 요청을 시작하면 클라이언트에 `sampling/createMessage` 메시지를 보냅니다. 클라이언트는 요청을 언어 모델에 전달하기 전에 사용자의 승인을 받는 인간 참여형(HITL) 검토 절차를 시작해야 합니다. 이는 명세의 필수 요구 사항은 아니지만 클라이언트 구현에 강력히 권장되므로, 사용자가 요청을 거부하는 경우를 처리할 준비를 해야 합니다. 거부된 경우 사용자 응답이 담긴 `CreateMessageResult` 객체를 받지 못하며, 명세에는 클라이언트가 사용자 거부를 서버에 전달하는 구체적인 방식이 정의되어 있지 않습니다. 클라이언트의 샘플링 콜백은 코드가 `-1`이고 사용자가 요청을 거부했다는 내용을 담은 `message`가 있는 `ErrorData` 객체를 반환해야 하며, 이는 서버에서 잡을 수 있는 Python 예외로 전달됩니다. 또는 호출 전에 클라이언트의 샘플링 지원 여부를 확인하여 불필요한 요청을 방지할 수 있습니다.

요청이 승인되면 클라이언트는 이를 언어 모델에 전달하고 결과를 얻은 뒤, 선택적으로 사용자에게 응답 승인을 받고 서버에 반환합니다. Python SDK에서 서버는 `role` 속성, `content` 속성(`TextContent`, `ImageContent`, `AudioContent` 중 하나), 응답 생성에 사용한 모델 이름을 담은 `model` 속성, 그리고 생성이 중단된 이유가 있다면 이를 나타내는 `stopReason` 속성을 가진 `CreateMessageResult` 객체를 받습니다. `content` 속성이 예상한 형식인지 검증하고, 각 콘텐츠 형식을 적절히 처리해야 합니다.

샘플링 요청을 만들 때 클라이언트에 선호 조건도 제공할 수 있습니다. 선호 조건은 *역량 우선순위*와 *모델 힌트* 두 종류입니다. *역량 우선순위*를 사용하면 모델을 선택할 때 비용, 속도, 지능의 우선순위를 클라이언트에 알려 줄 수 있습니다. 각 값은 0에서 1 사이의 실수이며, 0은 가장 낮은 우선순위, 1은 가장 높은 우선순위를 뜻합니다. 클라이언트는 이 값을 사용해 요청에 사용할 모델을 결정할 수 있습니다. *모델 힌트*도 모델 선호를 클라이언트에 전달하지만, 특정 모델 계열을 더 구체적으로 나타냅니다. 힌트는 키가 `name`이고 값이 `"claude-4-5-sonnet"`, `"claude-sonnet"`, 또는 단순히 `"claude"`처럼 모델 계열을 식별하는 임의의 문자열인 JSON 객체 배열로 전달됩니다. Python SDK에서는 단일 `name` 속성을 가진 `ModelHint` 객체 목록으로 표현됩니다. 힌트는 목록이므로 둘 이상을 제공할 수 있고, 서로 다른 모델 계열이나 앞에서 본 것처럼 점차 범위를 넓힌 모델 그룹을 지정할 수도 있습니다.

###### 참고

이러한 힌트는 클라이언트에 제안하는 것일 뿐입니다. 클라이언트가 힌트를 따라야 할 의무는 없으며, 따르더라도 제안한 정확한 모델 계열을 호출할 필요는 없습니다. 어떤 클라이언트는 힌트를 자신이 지원하는 가장 가까운 모델 계열에 대응시키거나, 전혀 다른 모델 계열을 선택할 수도 있습니다. 서버 개발자가 통제할 수 없는 부분이므로 힌트가 엄격히 준수될 것이라고 가정해서는 안 됩니다.

Python SDK에는 이러한 선호 조건을 모두 캡슐화한 `ModelPreferences` 클래스가 있습니다. 역량 우선순위는 `costPriority`와 같은 최상위 속성이고, `hints`는 앞서 설명한 `ModelHint` 객체 목록입니다. 이를 `CreateMessageRequestParams` 클래스에 포함해 `create_message()` 메서드에 매개변수로 전달할 수 있지만, `create_message()` 호출에 직접 전달해도 됩니다. [예제 6-14](#sampling_server)는 간단한 프롬프트, 모델 힌트, 역량 우선순위와 함께 샘플링을 요청하는 도구를 보여 줍니다. 정보 요청에서와 마찬가지로, 사용자가 요청을 거부하는 경우 결과를 로그로 남기고 상황에 맞는 문자열 응답을 반환합니다. 여기서는 잡히지 않은 오류가 클라이언트로 전달되지 않고 서버 실행을 중단시키므로 이 처리가 필요합니다.

<a id="sampling_server"></a>

##### 예제 6-14. 간단한 프롬프트, 모델 힌트, 역량 우선순위로 샘플링을 요청하는 도구의 예

```python
import sys

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession
from mcp.types import ModelHint, ModelPreferences, SamplingMessage, TextContent

# Initialize FastMCP server
mcp = FastMCP("sampling-server")

MODEL_PREFERENCES = ModelPreferences(
    hints=[
        ModelHint(name="claude-4-5-haiku"),
        ModelHint(name="claude-haiku"),
        ModelHint(name="gpt-4o-mini"),
    ],
    costPriority=1.0,
    speedPriority=0.8,
    intelligencePriority=0.3,
)

@mcp.tool()
async def explain_math(operation: str, ctx: Context[ServerSession, None]) -> str:
    """Use sampling to explain how a mathematical operation works."""
    prompt = f"""
    Explain how the following mathematical operation works. Break it down into
    discrete steps and explain any relevant concepts. The operation is: {operation}.
    Use the voice of a patient but eccentric math professor explaining to a curious
    but inexperienced student.
    """
    if not ctx.session.client_params.capabilities.sampling:
        return "Sampling is not supported by this server"

    try:
        result = await ctx.session.create_message(
            messages=[
                SamplingMessage(
                    role="user",
                    content=TextContent(type="text", text=prompt),
                )
            ],
            max_tokens=100,
            model_preferences=MODEL_PREFERENCES,
        )
    except Exception as e:
        await ctx.error(f"Error: {e}")
        return f"Error: {e}"

    await ctx.info("Sending math explanation to LLM")
    if not result.content:
        await ctx.warning("No content in result")
        return "No content in result"

    match result.content.type:
        case "text":
            return result.content.text
        case "image" | "audio":
            return str(result.content.data)

if __name__ == "__main__":
    mcp.run()
```

이 예제에서 가장 먼저 하는 일은 샘플링 요청의 모델 선호 조건을 설정하는 것입니다. 파일 맨 위에 상수로 정의했는데, 모든 샘플링 요청에서 같은 선호 조건을 사용한다면 적절한 방식입니다. 그렇지 않다면 각 도구 호출 안에서 설정해야 합니다. 이어지는 `explain_math()` 도구는 3장과 4장의 테스트 서버에 있던 버전을 약간 수정하고 견고하게 만든 것입니다. 이 도구는 프롬프트에 삽입할 문자열 매개변수 `operation`과, 도구 함수 본문에 주입될 `Context` 객체를 받습니다. 프롬프트를 설정한 뒤 다른 작업에 앞서 `Session` 컨텍스트 객체의 `ClientCapabilities` 객체를 검사하여 클라이언트가 샘플링을 지원하는지 확인합니다. 지원하지 않으면 해당 역량이 클라이언트에서 지원되지 않는다는 문자열 응답을 반환합니다. 사용자 거부 같은 다른 오류가 `create_message()` 호출에서 발생할 수도 있으므로 여전히 try/except 블록으로 감쌉니다. `Session` 컨텍스트 객체에서 `create_message()`를 호출하고, 역할이 `"user"`인 `SamplingMessage` 인스턴스를 만든 뒤 프롬프트를 `TextContent` 객체로 전달합니다. `max_tokens` 제한과 모델 선호 조건 객체도 함께 전달합니다. 오류가 발생하면 기록하고 클라이언트 언어 모델이 처리할 수 있도록 반환합니다. 결과에 콘텐츠가 없으면 이를 알리고, 있다면 텍스트인지 이미지·오디오 데이터인지와 관계없이 문자열로 반환합니다.

###### 경고

SQL에서와 마찬가지로 프롬프트를 매개변수화할 때는 프롬프트 주입 공격을 방지하고 입력이 예상한 형식과 형태인지 보장하도록 입력 매개변수를 검증해야 합니다. 검증이 지나치게 엄격하면 도구의 일반성이 떨어질 수 있으므로 보안과 유연성 사이에서 균형을 찾아야 합니다.

마지막으로 살펴볼 클라이언트 역량은 루트입니다.

<a id="id103"></a>

## 루트

*루트(roots)*는 MCP 커뮤니티에서 다소 혼란을 일으켜 온 개념이며, 그 이유를 짐작할 수 있습니다. 루트를 사용하면 클라이언트가 호스트 애플리케이션 파일 시스템의 어느 부분에 서버가 접근할 수 있는지 지정할 수 있습니다. 강력한 역량이지만, 서버가 루트로 설정된 경계를 반드시 준수해야 하는 것은 아니므로 실제로는 조정 메커니즘인데도 보안 경계처럼 *보인다는* 점에서 혼란이 생깁니다. 그럼에도 루트는 여러 이유로 유용합니다. 가장 중요한 이유는 서버가 잘 정의된 단일 식별자로 해당 파일 시스템 루트에 접근할 수 있도록 고유한 URI를 제공한다는 점입니다. 클라이언트 측에서는 디렉터리 선택기를 통해 모델과 연결된 서버에 컨텍스트로 사용할 수 있는 디렉터리를 알려 주는 방식으로 구현할 수 있습니다. 서버에서 로컬 파일이나 디렉터리에 접근해야 한다면 루트가 제공하는 URI로 이를 편리하게 식별하고 지정할 수 있습니다.

루트를 지원하는 서버를 구현할 때는 루트를 사용할 수 없게 되는 상황을 처리하고, 서버 작업 중 루트 경계를 준수하며, 제공된 루트를 기준으로 경로를 검증할 수 있어야 합니다. 루트에는 `roots/list` 요청과 `roots/list_changed` 알림이라는 두 메시지가 있습니다. 서버는 접근이 필요할 때마다 요청하지 말고 `roots/list` 요청의 응답으로 받은 루트 정보를 캐시할 수 있어야 하며, 목록 변경 알림에는 일반적으로 서버의 루트 캐시를 무효화하고 새로 고치는 방식으로 대응해야 합니다.

루트의 메시지 흐름은 인간 참여형 검토 절차가 없다는 점만으로도 앞서 살펴본 다른 역량보다 단순합니다. 클라이언트가 서버에 연결되면 탐색 단계에서 서버가 클라이언트에 `roots/list` 요청을 보내고, 클라이언트는 사용 가능한 루트 목록을 반환합니다. Python SDK에서는 `Root` 객체로 표현됩니다. 루트 목록이 바뀌면 클라이언트가 서버에 `roots/list_changed` 알림을 보내지만, 새 목록에 대한 정보는 들어 있지 않습니다. 따라서 서버는 갱신된 목록을 얻기 위해 클라이언트에 `roots/list` 요청을 보내야 합니다.

[예제 6-15](#roots_server)에서는 사용자가 제공한 디렉터리가 루트 목록에 있을 때만 그 안의 파일 수를 세는 도구를 구현합니다. 또한 `roots/list_changed` 알림 처리기를 구현해 서버의 루트 캐시를 무효화하고, 도구가 이를 새로 고칠 수 있게 합니다.

<a id="roots_server"></a>

##### 예제 6-15. 루트를 지원하며 사용자가 제공한 디렉터리의 파일 수를 세는 서버의 예

```python
import os

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession
from mcp.types import RootsListChangedNotification
from pydantic import FileUrl

mcp = FastMCP("roots-server")
roots_cache = []

async def handle_roots_list_changed(
    notifications: RootsListChangedNotification,
) -> None:
    roots_cache.clear()

@mcp.tool()
async def count_files(file_path: str, ctx: Context[ServerSession, None]) -> str:
    """Count files in a given directory."""
    if not roots_cache:
        roots_result = await ctx.session.list_roots()
        roots_cache.extend(roots_result.roots)
    root_uris: list[FileUrl] = [root.uri for root in roots_cache]

    file_path_abs = os.path.abspath(file_path)
    is_allowed = False

    for root_uri in root_uris:
        absolute_root_path = os.path.abspath(root_uri.path)
        if file_path_abs.startswith(absolute_root_path):
            is_allowed = True
            break

    if not is_allowed:
        error_msg = (
            f"Access denied: {file_path} is not within allowed roots {root_uris}"
        )
        await ctx.error(error_msg)
        raise ValueError(error_msg)

    # Validate directory exists
    if not os.path.isdir(file_path):
        error_msg = f"Path {file_path} is not a valid directory"
        await ctx.error(error_msg)
        raise NotADirectoryError(error_msg)

    count = len(os.listdir(file_path))
    await ctx.info(f"Counting files in {file_path} = {count}")
    return f"There are {count} files in {file_path}"

if __name__ == "__main__":
    mcp._mcp_server.notification_handlers[RootsListChangedNotification] = (
        handle_roots_list_changed
    )
    mcp.run()
```

이 예제에서 가장 먼저 눈에 띄는 것은 `roots_cache`와 `handle_roots_list_changed()` 함수일 것입니다. `roots_cache`는 클라이언트에서 받은 루트 목록이 있다면 이를 보관할 리스트입니다. `handle_roots_list_changed()`는 `RootsListChangedNotification` 형식의 매개변수를 받습니다. 이 매개변수를 사용하지는 않지만 SDK 코드가 함수를 올바르게 호출하려면 필요합니다. 이 함수는 사용자 정의 알림 처리기로, 클라이언트가 `roots/list_changed` 알림을 보낼 때마다 호출되어 캐시를 비웁니다. 다음으로 `if __name__ == "__main__":` 블록을 살펴봅시다. 여기서는 `_mcp_server` 속성으로 알림 처리기 딕셔너리에 접근하고, 키가 `RootsListChangedNotification`, 값이 `handle_roots_list_changed` 함수인 새 항목을 만들어 `RootsListChangedNotification` 형식의 알림 처리기를 등록합니다. 서버에서 사용자 정의 알림 처리기를 구현하고 등록할 때 사용하는 일반적인 패턴입니다. 다시 `count_files()` 도구로 돌아오면, 이 도구는 `file_path` 문자열 입력과 컨텍스트 객체를 받습니다. 그런 다음 `roots_cache`가 거짓으로 평가되는지 확인합니다. 리스트에서는 비어 있다는 뜻입니다. 비어 있으면 서버에서 루트 목록을 가져와 캐시에 저장합니다. 이어서 더 편리하게 접근할 수 있도록 루트 URI 목록을 만듭니다.

###### 참고

MCP 서버에서 파일을 조작하는 더 많은 예를 보려면 MCP 저장소의 [파일 시스템 서버](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)를 참고할 수 있습니다.

`file_path` 매개변수의 절대 경로를 구한 뒤 새 변수 `is_allowed`를 `False`로 설정합니다. 이 변수로 파일 경로가 클라이언트가 제공한 루트 안에 있는지 판단합니다. 각 루트 URI에서 절대 경로를 구하고, 파일 경로 매개변수의 절대 경로가 루트의 절대 경로로 시작하는지 간단히 검사하여 요청 경로가 루트 경계 안에 있는지 확인합니다. 안에 있으면 `is_allowed`를 `True`로 설정하고 반복문을 종료합니다. 그렇지 않으면 오류를 기록하고 발생시킵니다. 경로가 루트 안에 있으면 디렉터리가 존재하는지 확인한 뒤 `os.listdir()`로 디렉터리의 파일 목록을 가져와 `len()` 함수에 전달하여 파일 수를 구합니다. 이 값을 기록하고 문자열 응답으로 반환합니다.

###### 경고

현재 Python MCP SDK는 서버가 클라이언트 컴퓨터의 원격 파일이나 디렉터리에 접근하는 방법을 제공하지 않습니다. 따라서 파일 조작을 수행하는 서버 대부분은 자신이 실행 중인 컴퓨터의 파일만 다룰 수 있습니다.

이 절에서는 사용자 정의 알림 처리기를 구현하고, 이를 사용해 서버가 `roots/list_changed` 알림을 받는 즉시 내부 루트 캐시가 올바르게 무효화되도록 하는 방법을 배웠습니다. 다음으로는 클라이언트 제공 역량이라고 하기는 어렵지만 주로 클라이언트가 보내는 마지막 요청 유형을 살펴봅니다.

<a id="id104"></a>

## 요청 취소

요청 취소를 사용하면 완료하는 데 너무 오래 걸리는 도구 호출처럼 장시간 실행되는 작업을 사용자가 취소할 수 있습니다. 취소는 `notifications/cancelled`라는 특별한 종류의 알림이며, 클라이언트와 서버 모두 보낼 수 있습니다. 서버 개발자가 취소 알림을 보낼 일은 드물겠지만, 연결된 클라이언트에서 들어오는 취소 알림은 처리할 수 있어야 합니다. 일반적으로 오래 실행되는 작업을 취소하는 데 사용하지만, 클라이언트는 어떤 요청에 대해서든 취소 알림을 보낼 수 있습니다. 견고한 서버를 만들려면 이를 자연스럽게 처리하고 적절히 대응해야 합니다. 취소 알림은 양방향이므로, 클라이언트가 서버에 보내는 것처럼 서버도 진행 중인 클라이언트 작업을 취소하는 알림을 보낼 수 있습니다. 예를 들어 완료하는 데 너무 오래 걸리는 샘플링이나 정보 요청을 취소할 수 있습니다. 다만 취소 알림을 처리할 때 주의할 점이 몇 가지 있습니다. 먼저 잘못된 요청 ID가 있거나 이미 완료된 요청을 취소하려 하거나 형식이 잘못된 알림은 무시해야 합니다. 받은 취소 알림을 기록하면 서버에서 사용자가 불편을 겪는 지점을 파악하고 디버깅하는 데 도움이 됩니다. 취소 알림을 받으면 이를 기록하는 것 외에도 `initialize` 요청을 취소하라는 알림이 아닌지 확인해야 합니다. 유효한 알림이라면 클라이언트에 응답을 반환하지 않은 채 진행 중인 작업을 중지하고, 그 작업에 할당된 리소스를 해제해야 합니다.

Python SDK에서는 클라이언트와 서버 모두 `BaseSession` 클래스의 `_receive_loop()` 함수에서 취소 알림 수신을 자동으로 처리합니다. 이 클래스는 클라이언트와 서버 세션 클래스가 공유합니다. 취소 알림을 받으면 코드는 비공개 `_in_flight` 딕셔너리에서 일치하는 요청 ID를 찾습니다. 이 딕셔너리는 현재 활성 상태인 모든 요청을 추적하며, 일치하는 항목이 있으면 해당 `RequestResponder` 객체에서 `cancel()`을 호출해 자연스럽게 중지합니다. 이 구현은 취소 알림 처리에 관한 명세의 두 규칙을 위반합니다. 받은 취소 알림을 기록할 수 없고, `cancel()` 함수가 클라이언트에 오류 응답을 보내기 때문입니다. `cancel()` 함수의 동작은 바꿀 수 없지만, 서버 내부 로거를 사용하면 받은 취소 알림을 기록할 수 있습니다. [예제 6-15](#roots_server)와 비슷하게 `CancelledNotification` 형식의 처리기를 만들고 서버 로거에 알림과 취소 이유를 기록하면 됩니다. 취소 전에 이곳에서 정리 작업을 수행할 수도 있으며, 실제 취소는 여전히 SDK가 처리합니다.

진행 중인 클라이언트 작업을 취소하기 위해 취소 알림을 보낼 수도 있습니다. `Session` 객체의 `send_notification()` 메서드를 사용해 요청 ID와 취소 이유가 담긴 `CancelledNotification` 인스턴스를 보내면 됩니다. [예제 6-16](#cancel_request_notification_server)은 사용자 정의 처리기에서 취소 알림을 기록하고 클라이언트에 취소 알림을 보내는 방법을 보여 줍니다.

<a id="cancel_request_notification_server"></a>

##### 예제 6-16. 취소 알림을 기록하고 취소 전에 정리 작업을 수행하는 서버

```python
import asyncio
import logging

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession
from mcp.types import (
    CancelledNotification,
    CancelledNotificationParams,
    ModelPreferences,
    SamplingMessage,
    ServerNotification,
    TextContent,
)

logger = logging.getLogger(__name__)
mcp = FastMCP("cancel-request-notification-server")

async def handle_cancelled_notification(
    notification: CancelledNotification,
) -> None:
    """Handle cancellation notifications from the client."""
    logger.info(
        (
            f"Cancelled notification received for request ID "
            f"{notification.params.requestId}: {notification.params.reason}"
        )
    )

@mcp.tool()
async def sampling_with_timeout(ctx: Context[ServerSession, None]) -> str:
    """
    Perform a sampling request with a timeout, sending cancellation if it expires.
    """
    if not ctx.session.client_params.capabilities.sampling:
        return "Error: Sampling is not supported by this client"

    # Capture the request ID that will be used by the next send_request call
    request_id = ctx.session._request_id
    await ctx.info(f"Starting sampling request with ID: {request_id}")

    try:
        # Use asyncio.timeout to limit how long we wait for the response
        async with asyncio.timeout(5.0):  # 5 second timeout
            result = await ctx.session.create_message(
                messages=[
                    SamplingMessage(
                        role="user",
                        content=TextContent(
                            type="text",
                            text=(
                                "Write a very long, detailed essay about "
                                "the history of mathematics."
                            ),
                        ),
                    )
                ],
                max_tokens=10000,
                model_preferences=ModelPreferences(
                    intelligencePriority=1.0,
                ),
            )
            await ctx.info("Sampling completed successfully")
            if result.content:
                return f"Result: {result.content.text[:200]}..."
            else:
                return "No content in result"

    except TimeoutError:
        await ctx.warning(f"Sampling request {request_id} timed out after 5 seconds")

        await ctx.session.send_notification(
            ServerNotification(
                CancelledNotification(
                    params=CancelledNotificationParams(
                        requestId=request_id,
                        reason="Server timeout: Sampling request took too long (>5s)",
                    )
                )
            )
        )
        await ctx.info(f"Sent cancellation notification for request {request_id}")
        return f"Request timed out and cancellation sent to client (request ID: {request_id})"

    except Exception as e:
        await ctx.error(f"Sampling request failed: {e}")
        return f"Error: {e}"

if __name__ == "__main__":
    mcp._mcp_server.notification_handlers[CancelledNotification] = (
        handle_cancelled_notification
    )
    mcp.run()
```

여기에는 많은 내용이 들어 있습니다. 먼저 취소 알림을 받는 부분부터 살펴봅시다. 앞선 예제와 마찬가지로 알림 처리기를 만듭니다. 이름은 `handle_cancelled_notification()`이며, 요청 ID와 취소 이유를 서버 로거에 기록하기만 합니다. 실제 취소는 여전히 SDK가 처리합니다. 예제 아래쪽에서는 키가 `CancelledNotification`인 알림 처리기 딕셔너리에 `handle_cancelled_notification()`을 추가합니다.

다음으로 클라이언트에 취소 알림을 보내는 부분을 처리합니다. 여러 요청의 요청 ID를 동시에 다뤄야 할 수 있어 조금 더 까다롭지만, 여기서는 훨씬 단순한 상황을 살펴봅니다. `sampling_with_timeout()`이라는 도구는 제한 시간을 두고 샘플링 요청을 수행하며, 시간이 초과되면 클라이언트에 취소 알림을 보냅니다. 먼저 클라이언트가 샘플링을 지원하는지 확인한 다음, `session` 객체의 비공개 `_request_id` 속성에서 현재 요청 ID를 가져옵니다. `create_message()`가 내부적으로 `send_request()`를 호출하고, 요청을 만드는 다른 모든 메서드도 마찬가지이므로 이 단계가 중요합니다. `send_request()`는 `Session` 객체의 비공개 `_request_id` 속성을 요청 ID로 사용한 뒤에야 그 값을 증가시킵니다. 따라서 `create_message()`를 실제로 호출하기 전에 요청 ID를 가져와야 취소 알림에 올바른 요청 ID를 사용할 수 있습니다. 이어서 `try` 블록 안에서 `asyncio.timeout()`으로 샘플링 요청의 응답을 기다리는 시간을 제한합니다. 요청이 너무 오래 걸리면 여기서는 5초 제한을 두어 호출할 때마다 쉽게 시간 초과가 발생하도록 했습니다. 그런 다음 `Session` 객체의 `send_notification()` 메서드로 `requestID`와 취소 `reason` 같은 매개변수를 채운 `CancelledNotification`을 보냅니다. 이를 기록하고, 문자열 응답으로 사용자에게 알리면 작업이 끝납니다.

이 장에서는 MCP 서버의 고급 기능, 특히 서버 유틸리티와 클라이언트 제공 역량을 배웠습니다. 자동 완성 제안을 사용자에게 제공하는 완성 기능, 서버 인스턴스·현재 세션·현재 요청에 관한 정보에 접근하는 `Context` 객체, 클라이언트에 로그를 보내는 로깅, 응답의 일부를 반환하는 페이지네이션, 클라이언트에 진행 상황을 보고하는 진행률 알림 등 서버 유틸리티의 사용법을 살펴봤습니다. 또한 클라이언트 사용자에게서 정보를 얻는 정보 요청, 클라이언트의 언어 모델을 사용하는 샘플링, 클라이언트의 파일 시스템에 접근하는 루트, 장시간 실행되는 작업을 취소하는 요청 취소 같은 클라이언트 제공 역량의 사용법도 배웠습니다. 이를 제대로 구현하려면 MCP Python SDK가 이러한 역량을 어떻게 처리하는지, 자체 서버에 어떻게 적용할지를 이해하기 위해 SDK 코드를 깊이 살펴봐야 했습니다.

다음 장에서는 서버 테스트, AI 평가 실행, 서버 보안과 흔한 MCP 서버 공격, 서버를 외부에 배포하는 방법 등 견고한 MCP 서버를 만들고 공유할 때 고려해야 할 실무 사항을 다룹니다.
