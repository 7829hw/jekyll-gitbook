---
title: '4장. MCP 클라이언트: 고급 활용과 모범 사례'
author: Kyle Stratis
layout: post
permalink: /AI_Agent_with_MCP/ko/chapter_4.html
lang: ko
book_order: 4
---
<a id="ch04"></a>

# 4장. MCP 클라이언트: 고급 활용과 모범 사례

MCP와 여러 프로토콜 SDK 구현의 기반에는 클라이언트와 서버 사이에서 메시지를 주고받는 시스템이 있다. Python SDK에서 앞서 감싼 모든 세션 메서드는 다시 `send_request()` 메서드를 감싼다. 이 메서드는 클라이언트 및 서버 전용 `Session` 클래스가 모두 상속하는 `mcp.shared.session.BaseSession`에 있다. 따라서 이론상 사용자 정의 요청을 지원하는 서버에 직접 요청을 보낼 수도 있지만, 이를 위해 자체 Request, RequestParams, Result 클래스를 만들어야 한다.

클라이언트 세션 객체에는 활용할 수 있는 다른 메서드도 몇 가지 있다. `send_ping()`은 연결된 서버에 핑 요청을 보낸다. 서버는 데이터는 없지만 정상적인 서버 연결이 존재함을 나타내는 `ServerResult` 안의 `EmptyResult`를 반환한다. MCP `types` 라이브러리의 `LoggingLevel` 객체를 받는 `set_logging_level()`은 서버가 허용할 경우 해당 연결의 서버 로깅 수준을 바꿀 수 있다. 서버가 시작한 로그는 알림을 통해 클라이언트에 전송된다. 구독 알림과 달리 로깅 알림에는 `ClientSession` 생성자에 `logging_callback`이라는 전용 매개변수가 있다. `LoggingFnT` 프로토콜([소스 코드](https://github.com/modelcontextprotocol/python-sdk/blob/f3cd20c9200de001fb58f83a130ab83c6a6ed5fd/src/mcp/client/session.py#L31))을 따르는 자체 로깅 콜백 함수를 구현해 생성자의 `logging_callback` 매개변수로 전달한다.

<a id="handle_logging"></a>

```py
from mcp.types import LoggingMessageNotificationParams

class MCPClient:
    ...
    async def _handle_logs(self, params: LoggingMessageNotificationParams) -> None:
        if params.level in ("debug", "error", "critical", "alert", "emergency"):
            print(f"[{params.level}] - {params.data}")

    async def connect(self) -> None:
        """
        Connect to the server set in the constructor.
        """
        ...  # Removing setup code for brevity
        # Start MCP client session
        self._session = await self._exit_stack.enter_async_context(
            ClientSession(
                read_stream=self.read,
                write_stream=self.write,
                logging_callback=self._handle_logs,
            ),
        )

        # Initialize session
        await self._session.initialize()
        self._connected = True
```

여기서 `handle_logs()`는 서버가 제공한 매개변수의 보고된 로그 수준을 확인하고, 지정한 집합에 포함되면 수준과 데이터를 출력하는 매우 간단한 함수다. 이 수준 목록이 전부는 아니며, MCP는 [RFC 5424](https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1)에 정의된 syslog 심각도 수준을 따른다. `LoggingMessageNotificationsParams`는 `level`과 `data` 외에 선택적 `logger` 이름과 `model_config` 딕셔너리도 제공한다.

`send_progress_notification()`은 `progress_token`과 부동소수점 값 `progress`를 담은 알림을 서버에 보낸다. 선택적으로 부동소수점 `total`과 문자열 `message`도 보낼 수 있다. 이 값이 어떻게 표시될지는 연결된 서버와 서버가 진행률 업데이트에 요구하는 내용에 따라 달라진다.

<a id="id63"></a>

# MCP 클라이언트 기능 제공하기

앞 절에서는 연결된 MCP 서버의 로그 메시지를 처리하는 콜백 구현 예를 보았다. 이 절에서는 같은 패턴을 반복하되 연결된 MCP 서버에 클라이언트 기능을 제공하는 데 사용한다. 클라이언트가 서버에 제공할 수 있는 주요 기능은 세 가지다. **샘플링**은 서버가 클라이언트를 통해 클라이언트에 연결된 LLM에 채팅 완성을 요청하게 한다. **루트**는 호스트 애플리케이션 파일 시스템에서 서버가 접근할 수 있는 영역을 알려 준다. **정보 요청**은 연결된 서버가 사용자에게 정보를 요청할 수 있게 한다.

서버가 이러한 기능을 사용하거나 준수할 의무는 없다. 하지만 클라이언트가 기능을 제공한다면 클라이언트-서버 연결 초기화 단계에서 해당 사실을 알려야 한다. Python SDK를 사용하면 지원할 기능의 콜백 함수를 구현하고 적절한 매개변수로 `ClientSession` 생성자에 전달할 때 자동으로 처리된다. 클라이언트 기능 제공의 일반적인 워크플로는 다음과 같다.

1. 클라이언트 클래스에 서버 요청 시 호출할 콜백 함수를 구현한다.
2. 콜백이 `SamplingFnT` 같은 해당 기능의 정해진 프로토콜을 따르는지 확인한다.
3. 샘플링의 `sampling_callback`처럼 적절한 매개변수로 콜백 함수를 `ClientSession` 생성자에 전달한다.

이것이 전부다. 물론 작업 대부분은 1단계에 있으며 활용 사례와 상호 작용 흐름에 따라 달라진다.

<a id="id64"></a>

## 샘플링 지원하기

샘플링은 MCP 서버가 클라이언트와 호스트 애플리케이션에 연결된 LLM을 사용할 수 있게 하는 클라이언트 기능이다. 서버 안에서 중첩된 도구 선택과 사용을 지원하거나, 서버가 LLM에 질문한 결과로 자신이 제공하는 프롬프트를 선택하거나 정보를 채우는 등 상상할 수 있는 여러 에이전트 워크플로를 가능하게 한다.

프로토콜 수준에서는 서버가 클라이언트에 `sampling/createMessage` 요청을 보내 샘플링을 시작한다. 클라이언트가 요청을 받으면 사용자 승인을 얻는 휴먼 인 더 루프(human-in-the-loop, HITL) 워크플로를 시작해야 한다. 사용자가 승인하면 클라이언트가 메시지를 LLM에 전달해 응답을 받는다. 응답은 클라이언트로 돌아오며 서버에 반환하기 전에 사용자가 다시 승인할 기회를 제공한다. 승인된 응답을 클라이언트가 서버에 반환한다.

클라이언트 제공 기능이므로 서버 제공 기능을 사용할 때보다 작업이 조금 적다. 로깅에서 본 것처럼 `ClientSession` 클래스는 구현할 샘플링 콜백 함수의 시그니처를 정의하는 `SamplingFnT` 프로토콜을 제공한다. 생성자의 `sampling_callback` 매개변수는 연결된 서버가 샘플링 요청을 보낼 때 사용할 콜백을 받는다. 클라이언트가 샘플링 요청을 받으면 `RequestContext` 형식의 `context`와 `CreateMessageRequestParams` 형식의 `params`로 콜백 함수를 호출하고, `CreateMessageResult` 또는 `ErrorData` 객체가 반환되기를 기대한다. `CreateMessageRequestParams` 객체에는 다음 샘플링 요청 매개변수가 들어 있다.

- `messages`: `role`과 `content` 속성이 있는 `SamplingMessage` 객체 목록으로, LLM에 보낼 메시지를 구성하는 데 사용한다.
- `modelPreferences`: 샘플링 요청에 선호하는 모델과 비용·속도·지능 우선순위 힌트를 클라이언트에 제공하는 선택적 매개변수다. 이 선호를 따를지는 클라이언트가 결정한다.
- `systemPrompt`: 서버 제공 시스템 프롬프트를 담는 선택적 매개변수다. 기존 시스템 프롬프트와 함께 사용하거나, 기존 프롬프트를 대체해 단독으로 사용하거나, 사용하지 않을 수 있다.
- `includeContext`: 연결된 서버 또는 모든 서버에서 요청 컨텍스트를 응답에 포함할지 정하는 선택적 문자열 리터럴이다.
- `temperature`: LLM 생성의 temperature를 제어하는 선택적 부동소수점 값이다.
- `maxTokens`: 생성에 사용할 최대 토큰 수를 제어하는 선택적 정수다.
- `stopSequences`: 생성 종료를 나타내는 선택적 문자열 목록이다.

콜백이 반환하는 `CreateMessageResult` 객체는 더 단순하다. 메시지의 `role`, `TextContent`·`ImageContent`·`AudioContent` 중 하나인 `content`, 응답 생성에 사용한 모델을 나타내는 문자열 `model`, 생성 중지 이유를 나타내는 `stopReason`이 들어 있다.

###### 경고

외부 서버에 애플리케이션이 사용하고 비용을 지불하는 LLM 접근 권한을 부여하는 데에는 위험이 따른다. 필자와 Anthropic 모두 서버가 클라이언트와 애플리케이션을 통해 LLM에 요청을 보내기 전에 어떤 형태로든 HITL 승인 절차를 구현할 것을 강력히 권장한다.

이 예제에서는 `SamplingFnT` 인터페이스를 구현하는 간단한 샘플링 콜백을 만들고 `ClientSession` 생성자에 전달하여 위의 일반 워크플로를 따른다. 기본 구현을 보여 주는 것이 목적이고 HITL 워크플로는 호스트 애플리케이션과 사용자 인터페이스에 크게 좌우되므로 구현하지 않는다. 실제로 프로토콜은 샘플링 콜백 개발 시 고려할 몇 가지 권고 사항을 정의한다.

- LLM에 메시지를 보내기 전과 서버에 응답을 반환하기 전에 사용자의 승인을 얻는 HITL 워크플로를 구현하는 것이 *바람직하다*.
- 서버가 제공한 모든 모델 선호 힌트를 따르는 것이 *바람직하다*.
- 속도 제한을 구현하는 것이 *바람직하다*.

프로토콜의 필수 요구 사항은 아니지만 실제 구현에서 이 지침을 따르면 사용자와 LLM을 악용으로부터 보호하는 데 도움이 된다. 따라서 뒤의 프로젝트 기반 장에서는 더 복잡한 샘플링 콜백 구현을 보게 된다.

<a id="sampling_callback"></a>

```py
# client.py
from anthropic import Anthropic
from mcp.shared.context import RequestContext
from mcp.types import (
    CreateMessageRequestParams,
    CreateMessageResult,
    ErrorData,
    SamplingMessage
    TextContent
)

class MCPClient:
    def __init__(self, name: str, server_url: str, llm_client: Anthropic) -> None:
        self.name = name
        self.server_url = server_url
        self._session: ClientSession = None
        self.exit_stack = AsyncExitStack()
        self._connected: bool = False
        self._llm_client = llm_client

    async def _handle_sampling(
        self,
        context: RequestContext[ClientSession, None],
        params: CreateMessageRequestParams
    ) -> CreateMessageResult | ErrorData:
        messages = []
        for message in params.messages:
            if isinstance(message.content, TextContent):
                messages.append(
                    {"role": message.role, "content": message.content.text}
                )
            else:
                # Handle other content types if needed
                messages.append(
                    {"role": message.role, "content": str(message.content)}
                )

        response = self._llm_client.messages.create(
            max_tokens=params.maxTokens,
            messages=messages,
            model="claude-sonnet-4-0",
        )

        # Extract content from the response - content is a list of content blocks
        if response.content and len(response.content) > 0:
            content = response.content[0]
            if hasattr(content, "text"):
                content_data = TextContent(type="text", text=content.text)
            elif hasattr(content, "data"):
                content_data = BlobResourceContents(
                    type="blob",
                    data=content.data,
                    mimeType=content.mimeType,
                )
            else:
                # Fallback to string representation
                content_data = TextContent(type="text", text=str(content))
        else:
            # No content in response
            content_data = ""

        return CreateMessageResult(
            role=response.role, content=content_data, model="claude-sonnet-4-0"
        )

    async def connect(self) -> None:
        """
        Connect to the server set in the constructor.
        """
        ...  # Removing setup code for brevity
        # Start MCP client session
        self._session = await self._exit_stack.enter_async_context(
            ClientSession(
                read_stream=self.read,
                write_stream=self.write,
                logging_callback=self._handle_logs,
                sampling_callback=self._handle_sampling,
            ),
        )

        # Initialize session
        await self._session.initialize()
        self._connected = True
    ...
# agent.py
...
if __name__ == "__main__":
    mcp_client = MCPClient(
        name="calculator_server_connection",
        command="uv",
        server_args=[
            "--directory",
            str(Path(__file__).parent.parent.resolve()),
            "run",
            "calculator_server.py",
        ],
        llm_client=anthropic_client,
    )
    agent = Agent(mcp_client, anthropic_client)
    asyncio.run(agent.run())
...
```

`agent.py`에서는 클라이언트가 LLM과 서버 사이에서 메시지를 라우팅하려면 LLM 클라이언트에 접근해야 하므로 `MCPClient` 생성자에 `llm_client` 매개변수를 추가했다. 핸들러 `_handle_sampling()`은 MCP 서버가 클라이언트로 보낸 각 SamplingMessage의 `content`를 추출해 `messages` 목록에 추가하여 메시지를 구성한다. 이어 `_llm_client`를 통해 `messages` 목록을 LLM에 보내 응답을 받는다. 응답을 추출하여 `TextContent` 또는 `BlobResourceContents`로 변환하고 `CreateMessageResult` 객체에 담아 서버로 돌려보낸다.

###### 경고

이 구현은 단순화된 예제이며 실제 환경에 배포하기에는 안전하지 않다. 핸들러는 서버의 프롬프트를 애플리케이션 모델에 보내기 전에 사용자에게 허가를 요청해야 한다.

`client.py`의 `connect()` 메서드에서는 샘플링 핸들러 메서드를 `sampling_callback`으로 `ClientSession` 생성자에 전달한다. MCP 서버는 `CreateMessageRequestParams` 객체를 통해 여러 매개변수를 클라이언트로 보낼 수 있다. 이 객체에는 생성에 사용할 토큰 상한을 정하는 `maxTokens`, LLM 호출용 시스템 프롬프트를 정의하는 `system_prompt`, 서버 사용에 가장 적합한 모델을 클라이언트에 알려 주는 `model_preferences` 등 샘플링 메시지 생성에 사용할 매개변수가 모두 들어 있다. 클라이언트가 이 선호를 따를 의무는 없다. 서버가 보낼 수 있는 모든 매개변수는 GitHub의 [CreateMessageParams 클래스 정의](https://github.com/modelcontextprotocol/python-sdk/blob/f3cd20c9200de001fb58f83a130ab83c6a6ed5fd/src/mcp/types.py#L919)를 참조한다.

<a id="id65"></a>

## 루트 지원하기

루트는 MCP에 비교적 최근 추가된 기능으로, 연결된 MCP 서버가 접근할 수 있는 파일과 디렉터리를 클라이언트가 지정하는 데 사용한다. 코드 어시스턴트에 작업할 프로젝트 디렉터리를 제공하는 경우처럼 일반적으로 호스트 애플리케이션 사용자가 구성한다. 사용자가 언제든 목록을 바꿀 수 있으므로 클라이언트는 루트 목록이 변경되었음을 알리는 `ListChanged` 알림을 서버에 보낼 수 있어야 한다. Python SDK로 루트를 지원하면 이 작업은 자동으로 처리된다.

###### 경고

루트는 강력한 보안 수단이 아니며 그렇게 사용해서는 안 된다. 서버가 루트로 설정한 경계를 무시할 수 있기 때문이다. 서버나 LLM이 실제로 접근할 수 있는 파일은 호스트 애플리케이션이 최종적으로 결정해야 한다.

루트를 지원하려면 `ListChanged` 알림뿐 아니라 실제 루트 목록도 서버에 보낼 수 있어야 한다. 그래야 서버가 파일 시스템 작업에 필요한 정보를 얻는다. 프로토콜 명세에 따르면 목록은 `uri`와 `name` 속성이 있는 JSON 객체의 목록이다. 이 글을 쓰는 시점에 `uri` 속성은 `file://` 스킴을 사용해야 하고, `name` 속성은 사람이 읽을 수 있는 루트 이름을 제공하는 문자열이면 된다. Python SDK에서는 `uri`와 `name` 외에 `_meta` 속성도 가진 `Root` 클래스로 루트를 표현한다. `_meta`는 루트의 추가 메타데이터를 저장하는 딕셔너리다. 키에는 마침표로 구분되고 `/`로 끝나는 선택적 접두사와 필수 이름이 있으며, 값은 무엇이든 사용할 수 있다.

Python SDK를 사용하여 클라이언트에서 루트를 지원하려면 로깅과 샘플링 때처럼 콜백 함수를 구현하고 `list_roots_callback` 매개변수로 세션 생성자에 전달한다. 콜백 함수는 `RequestContext` 형식, 구체적으로 `ClientSession` 컨텍스트인 `context` 매개변수를 받고 `ListRootsResult` 또는 `ErrorData` 객체를 반환하는 `ListRootsFnT` 프로토콜을 따라야 한다. `ListRootsResult`는 `Result` 클래스의 하위 클래스이며 `Root` 객체 목록인 `roots` 속성을 갖는다. 호스트 애플리케이션이 사용자에게서 루트 목록을 수집해 클라이언트에 전달하는 방법은 직접 결정해야 한다. `ErrorData` 클래스는 JSON-RPC 오류 데이터를 처리하며 JSON-RPC 오류 코드 `code`, 오류 메시지 `message`, 오류 데이터 `data` 속성을 갖는다.

호스트 컴퓨터의 파일 시스템에 명시적인 접근 권한을 제공하면 보안에 영향을 주므로, 프로토콜은 클라이언트에 루트 지원을 구현할 때 반드시 또는 가급적 따라야 할 요구 사항과 권고 사항을 다음과 같이 제시한다.

- 의도한 용도에 적합한 권한을 가진 루트만 노출해야 *한다*.
- [경로 순회 공격](https://owasp.org/www-community/attacks/Path_Traversal)을 방지하도록 루트 URI를 검증해야 *한다*.
- 파일과 디렉터리의 무단 접근을 추가로 방지하는 접근 제어를 구현해야 *한다*.
- 방화벽이나 다른 네트워크 제한 때문에 차단되지 않는지 루트 접근 가능성을 모니터링해야 *한다*.
- 루트를 서버에 제공하기 전에 사용자 동의를 얻는 것이 *바람직하다*.
- 루트를 추가·제거·검사하고 사용 가능 여부를 확인할 수 있는 이해하기 쉬운 사용자 인터페이스를 제공하는 것이 *바람직하다*.

전체 최신 보안 및 구현 지침은 [MCP 명세](https://modelcontextprotocol.io/specification/2025-06-18/client/roots#security-considerations)에서 확인할 수 있다.

아래 예제는 서버가 사용할 `Root` 객체 목록을 반환하는 간단한 `_handle_roots()` 콜백 함수를 보여 준다. 이 방식은 호스트 애플리케이션이 제공한 루트를 저장할 인스턴스 변수를 `MCPClient` 클래스에 두어 콜백에서 접근한다. 호스트 애플리케이션이 언제든 루트 목록을 업데이트할 수도 있다.

<a id="providing_roots"></a>

```py
# client.py
from mcp.types import ListRoolsResult, Root

class MCPClient:
    def __init__(
        self,
        name: str,
        command: str,
        server_args: list[str],
        llm_client: Anthropic,
        env_vars: dict[str, str] = None,
        file_roots: list[str] = None,
    ) -> None:
        self.name = name
        self.command = command
        self.server_args = server_args
        self.env_vars = env_vars
        self.file_roots = file_roots
        self._session: ClientSession = None
        self._exit_stack: AsyncExitStack = AsyncExitStack()
        self._connected: bool = False
        self._llm_client = llm_client
    ...
    async def _handle_roots(
        self,
        context: RequestContext[ClientSession, Any],
    ) -> ListRootsResult | ErrorData:
        """
        Roots handler that returns the file roots, implementing the RootsFnT protocol.
        """
        roots_result = []
        for root in self.file_roots:
            if not root.startswith("file:///"):
                logger.warning(f"Root {root} does not start with file:///, ignoring")
            else:
                roots_result.append(Root(uri=root))
        if roots_result is None:
            return ErrorData(code=-32602, message="No valid file roots provided")
        return ListRootsResult(roots=roots_result)

    async def connect(self) -> None:
        ...
                # Start MCP client session
        self._session = await self._exit_stack.enter_async_context(
            ClientSession(
                read_stream=self.read,
                write_stream=self.write,
                logging_callback=self._handle_logs,
                sampling_callback=self._handle_sampling,
                list_roots_callback=self._handle_roots,
            ),
        )
        ...
# agent.py
...
if __name__ == "__main__":
    mcp_client = MCPClient(
        name="calculator_server_connection",
        command="uv",
        server_args=[
            "--directory",
            str(Path(__file__).parent.parent.resolve()),
            "run",
            "calculator_server.py",
        ],
        llm_client=anthropic_client,
        file_roots=[
            f"file:///{str(Path(__file__).parent.resolve())}",
        ],
    )
    agent = Agent(mcp_client, anthropic_client)
    asyncio.run(agent.run())
```

이 예제에서는 클라이언트에 크고 작은 변경을 적용했다. 주요 변경은 `_handle_roots()` 콜백 함수를 클라이언트 클래스에 추가한 것이다. 서버가 `ListRoots` 요청을 보내면 함수가 호출되어 서버가 사용할 `Root` 객체 목록을 반환한다. 호스트 애플리케이션이나 사용자에게서 루트 목록을 수집하고 처리하는 방법은 전적으로 개발자가 결정한다. 이 코드는 새 인스턴스 변수 `file_roots`를 확인하여 클라이언트 생성자에 전달된 루트가 있는지 살핀다. 호스트 애플리케이션이 언제든 루트 목록을 업데이트할 수 있어 매우 유연하다.

`_handle_roots()` 함수는 각 루트가 `file://` 스킴으로 시작하고 컴퓨터의 정규화된 전체 호스트 이름을 생략했는지 확인하는 등의 간단한 검사를 수행한 뒤 루트 URI 문자열로 `Root` 객체를 만든다. 루트가 없으면 JSON-RPC 오류 코드 `-32602`와 유효한 파일 루트가 제공되지 않았다는 메시지를 담은 `ErrorData` 객체를 반환한다. 루트가 있으면 `ListRootsResult` 객체로 반환한다. `ClientSession` 생성자도 `_handle_roots()` 콜백 함수를 `list_roots_callback` 매개변수에 전달하도록 수정했다.

`agent.py`의 변경은 최소한이다. `file_roots` 목록을 `MCPClient` 생성자에 전달하기만 하면 클라이언트가 `_handle_roots()` 함수에서 사용한다. [GitHub 저장소](https://github.com/kylestratis/ai_agents_mcp_examples)를 따라 실습한다면 디렉터리에 파일이 몇 개 있는지 물어 MCP 기반 에이전트의 이 버전을 시험해 보자. 지정한 루트 경계 안의 디렉터리와 경계 밖의 디렉터리에 대해 “`/full/path/to/directory`에 파일이 몇 개 있나요?”와 같은 질문을 해 보자. 아래에는 클라이언트 제공 루트로 서버가 제한된 상태에서 예제 코드와 로깅 문을 사용한 실제 대화를 보여 준다.

<a id="source"></a>

```
You: How many files are in /full/path/to/ai_agents_mcp_examples/ch3?

Using tool: count_files
Processing request of type CallToolRequest
[error] - Access denied: /full/path/to//ai_agents_mcp_examples/ch3 is not within allowed roots [FileUrl('file:///full/path/to/ai_agents_mcp_examples/ch3/16_using_roots')]

Assistant: It looks like I don't have access to that specific directory path. The system is restricting access to only a subdirectory: `/full/path/to/ai_agents_mcp_examples/ch3/16_using_roots`.

I can only count files within the allowed directory. Would you like me to count the files in `/full/path/to/ai_agents_mcp_examples/ch3/16_using_roots` instead, or do you need to adjust the file permissions to allow access to the broader ch3 directory?
```

다음이자 마지막 클라이언트 제공 기능은 **정보 요청(elicitation)**, 즉 사람의 피드백을 지원하는 기능이다.

<a id="id66"></a>

## 정보 요청 지원하기

정보 요청은 MCP 서버가 클라이언트를 통해 사용자에게 추가 정보를 요청할 수 있게 하는 모델 컨텍스트 프로토콜의 새로운 기능이다. 에이전트 루프에 사람을 포함해 과제 설명을 명확히 하거나 결정에 대한 사용자 승인을 받는 등 사용자 입력이 필요한 과제를 완수하도록 돕는 데 흔히 사용한다. 사용자가 초기 프롬프트에 모든 정보를 미리 제공하도록 강요하지 않고, 필요할 때 정보를 받을 수도 있다.

정보 요청은 서버가 시작하며, 클라이언트는 이를 받으면 수락·거절·취소 세 가지 응답 중 하나를 보낼 수 있다. 애플리케이션 사용자는 요청받은 정보를 서버에 제공할지, 제공하지 않을 경우 대화를 어떻게 진행할지 제어할 수 있다. 수락 응답은 사용자가 정보 요청에 대한 응답을 승인했고 응답에 요청 정보가 들어 있다는 뜻이다. 거절 응답은 사용자가 정보 요청을 거부했음을 뜻하며, `content` 필드가 없거나 빈 응답이 반환된다. 취소 응답은 거절과 비슷하지만 사용자가 요청을 명시적으로 거부하지 않았음을 나타낸다. 요청을 거절하지 않은 채 채팅 대화 상자나 모달을 닫는 등 대화를 취소하는 행동을 했을 때 사용한다.

서버는 JSON의 하위 집합을 사용해 응답 스키마를 클라이언트에 제공할 수도 있다. 문자열, 숫자, 불리언, 열거형이라는 일부 속성 형식만 허용하는 평면 객체를 지원한다. 서버는 애플리케이션 사용자에게 구조화된 피드백을 요청해 자체 목적에 사용할 수 있다. 다행히 Python SDK는 모든 응답 형식과 스키마용 Pydantic 모델을 제공하므로 클라이언트에서 익숙한 API로 사용할 수 있다.

정보 요청은 악성 서버가 사용자의 개인 정보를 수집하는 공격 경로가 될 수 있으므로, 프로토콜은 클라이언트에서 정보 요청 지원을 구현할 때 다음 권고 사항을 제시한다. - 사용자가 정보 요청을 수락·거절·취소할 수 있는 제어 기능을 구현하는 것이 *바람직하다*. - 정보 요청 콘텐츠를 제공된 스키마에 맞게 검증하는 것이 *바람직하다*. - 어떤 서버가 정보를 요청하는지 사용자에게 매우 명확히 알리는 것이 *바람직하다*. - 속도 제한을 구현하는 것이 *바람직하다*. - 어떤 정보를 왜 요청하는지 명확한 형태로 정보 요청을 사용자에게 제시하는 것이 *바람직하다*.

클라이언트에서 정보 요청을 지원할 때도 로깅, 샘플링, 루트와 비슷한 패턴을 따른다. `ClientSession` 요청 컨텍스트를 받는 `context` 매개변수와 `ElicitRequestParams` 객체를 받는 `params` 매개변수를 정의하는 `ElicitationFnT` 프로토콜을 준수하는 콜백 함수를 구현해야 한다. 콜백은 `ElicitResult` 또는 `ErrorData` 객체를 반환해야 한다. 서버에서 오는 `ElicitRequestParams` 객체는 문자열 `message`와 Python 딕셔너리의 형식 별칭인 `ElicitRequestedSchema` 형식의 `requestedSchema` 속성으로 구성된다. 반환 형식 `ElicitResult`는 요청에 대한 사용자의 응답(`"accept"`, `"decline"`, `"cancel"`)을 반영하는 문자열 리터럴 `action`과 서버가 요청한 구조화된 정보를 담는 `content` 딕셔너리로 구성된다. `content`는 `action`이 `"accept"`일 때만 존재한다.

아래 예제에서는 `_handle_elicitations()` 콜백 구현을 볼 수 있다. 사용자가 서버 시작 요청에 응답하고 있으며 클라이언트가 사용자 응답을 서버에 반환한다는 점을 매우 명확히 표시하는 방식에 주목하자. 예제에 나오지 않는 `_collect_form_data()` 도우미 함수는 정보 요청 스키마를 파싱하고 사용자에게 표시해 구조화된 정보를 받는다. 전체 코드는 [이 책의 GitHub 저장소](https://github.com/kylestratis/ai_agents_mcp_examples/tree/fef43e0112a22979fac13bb18ace23061bc61450/ch3/17_returning_elicitations)에서 볼 수 있다.

<a id="returning_elicitations"></a>

```py
# source.py
from mcp.types import ElicitResult, ElicitRequestParams, ElicitRequestedSchema
...
class MCPClient:
    ...
        async def _handle_elicitation(
        self,
        context: RequestContext[ClientSession, Any],
        params: ElicitRequestParams,
    ) -> ElicitResult | ErrorData:
        """
        Elicitation handler that displays the server request to the user, handles
        their accept/decline response, and collects form data when accepted,
        implementing the ElicitFnT protocol.
        """
        # Get the server name from the client instance
        requesting_server = self.name

        # Display the elicitation request to the user
        print(f"\n{'='*60}")
        print(f"ELICITATION REQUEST FROM SERVER: {requesting_server}")
        print(f"{'='*60}")
        print(f"Message: {params.message}")
        print(f"{'='*60}")

        # Get user input for accept/decline
        while True:
            user_response = (
                input("\nDo you want to accept this request? (y/n/c for cancel): ")
                .lower()
                .strip()
            )

            if user_response in ["y", "yes", "accept"]:
                print("Request accepted")
                # Collect form data based on the schema
                form_data = self._collect_form_data(params.requestedSchema)
                if form_data is not None:
                    print("Form data collected successfully")
                    return ElicitResult(action="accept", content=form_data)
                else:
                    print("Form data collection cancelled")
                    return ElicitResult(action="cancel")
            elif user_response in ["n", "no", "decline"]:
                print("Request declined")
                return ElicitResult(action="decline")
            elif user_response in ["c", "cancel"]:
                print("Request cancelled")
                return ElicitResult(action="cancel")
            else:
                print(
                    "Invalid response. Please enter 'y' (accept), 'n' (decline), or 'c' (cancel)."
                )
    ...
    async def connect(self) -> None:
        ...
        self._session = await self._exit_stack.enter_async_context(
            ClientSession(
                read_stream=self.read,
                write_stream=self.write,
                logging_callback=self._handle_logs,
                sampling_callback=self._handle_sampling,
                list_roots_callback=self._handle_roots,
                elicitation_callback=self._handle_elicitation,
            ),
        )
        ...
```

다른 클라이언트 제공 기능과 마찬가지로 `_handle*()` 콜백 함수를 구현하고 `elicitation_callback` 매개변수로 `ClientSession` 생성자에 전달한다. 클라이언트가 연결된 서버에 자신의 기능을 알리는 방식이다. 콜백에서는 별표와 모두 대문자인 텍스트를 사용해 서버가 사용자에게 정보를 요청한다는 사실과 요청한 서버 이름을 매우 명확하게 표시한다. 그런 다음 무한 루프를 시작해 사용자에게 요청을 수락·거절·취소할지 묻는다. 사용자가 수락하면 `params.requestedSchema`의 정보 요청 스키마를 도우미 함수 `_collect_form_data()`에 전달한다. 이 함수는 스키마를 사용자에게 표시하고 각 속성의 입력을 받는다. 결과를 `ElicitResult` 객체로 서버에 돌려보내면 서버가 사용자 정보를 활용한다. 이 코드는 최대한 범용적으로 작성했다. MCP의 주요 특징은 에이전트 애플리케이션을 사용하는 도구 및 리소스와 분리하는 것이므로, 클라이언트가 서버가 요청하는 정보 요청이나 스키마를 미리 알 필요가 없어야 한다.

<a id="id67"></a>

# 여러 모델 지원하기

MCP 사용의 주요 이점 중 하나는 애플리케이션 개발자가 사용자에게 여러 모델 또는 자신이 선택한 모델을 사용할 자유를 제공할 수 있다는 점이다. 이 장의 예제는 Anthropic 모델을 사용하지만 MCP는 특정 모델에 종속되지 않는다. 가장 간단한 지원 방법은 각 프리미티브-모델 계열 조합마다 MCP 객체를 해당 모델 계열이 기대하는 형식으로 바꾸는 변환 함수를 클라이언트에 작성하는 것이다. 각 프리미티브에 대해 MCP 객체로 생성할 수 있고 변환 메서드를 멤버로 갖는 클래스를 만들면 기본 설계를 개선할 수 있다. 이를 클라이언트에 통합하려면 `get_available_tools()`가 호스트 애플리케이션에 `InternalTool` 객체 목록을 반환하도록 수정하고, 호스트 애플리케이션이 각 도구에서 적절한 변환 메서드를 호출한 다음 결과를 해당 LLM으로 보내게 할 수 있다.

다음 예제는 이 워크플로를 보여 준다. `InternalTool` 클래스를 구현하고 멤버로 `translate_to_openai()` 메서드를 추가한 새 파일 `internal_tool.py`에서 시작한다. 이 메서드는 `type`, `name`, `description`, `parameters` 키가 있는 딕셔너리를 반환한다. 클라이언트의 `get_available_tools()` 메서드는 Anthropic API 형식의 딕셔너리 대신 `InternalTool` 객체 목록을 반환하도록 수정한다. 이제 호스트 애플리케이션은 클라이언트 자체를 변경하지 않고 호출할 모델을 바꿀 수 있어 클라이언트와 호스트 애플리케이션이 한층 더 분리된다.

<a id="multiple_models"></a>

```py
#internal_tool.py
from typing import Any

class InternalTool:
    def __init__(
        self, name: str, input_schema: dict[str, Any], description: str | None = None
    ) -> None:
        self.name = name
        self.input_schema = input_schema
        self.description = description

    def translate_to_openai(self) -> dict[str, Any]:
        return {
            "type": "function",
            "name": self.name,
            "description": self.description,
            "parameters": self.input_schema,
        }

    def translate_to_anthropic(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
        }


example_tool = InternalTool(name=mcp_tool.name, input_schema=mcp_tool.inputSchema, description=mcp_tool.description)
openai_tool = example_tool.translate_to_openai()

# client.py
from internal_tool import InternalTool
...
class MCPClient:
    ...
    async def get_available_tools(self) -> list[dict[str, Any]]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")

        tools_result = await self._session.list_tools()
        if not tools_result.tools:
            logger.warning("No tools found on server")
        available_tools = [
            InternalTool(
                name=tool.name,
                description=tool.description,
                input_schema=tool.inputSchema,
            )
            for tool in tools_result.tools
        ]
        return available_tools
    ...
# agent.py
from internal_tool import InternalTool
...
    async def run(self):
        try:
            print(
                "Welcome to your AI Assistant. Type 'goodbye' to quit or 'refresh' to reload and redisplay available resources."
            )
            await self.mcp_client.connect()
            available_tools: list[
                InternalTool
            ] = await self.mcp_client.get_available_tools()
            available_tools: list[dict[str, str]] = [
                tool.translate_to_anthropic() for tool in available_tools
            ]
            await self._refresh()
...
```

이 예제에서는 세 파일을 모두 다룬다. 먼저 `internal_tool.py`가 애플리케이션의 내부 도구 표현을 정의하며, 지원하려는 각 모델 계열의 변환 메서드를 담는다. 이어 클라이언트의 `get_available_tools()` 메서드가 `InternalTool` 객체 목록을 반환하도록 수정하여 어떤 모델을 사용할지 결정하는 책임을 원래 있어야 할 호스트 애플리케이션으로 돌려보낸다.

###### 참고

앞 예제에서는 내부 표현의 Tool 객체를 OpenAI 함수 호출 형식으로 변환하는 함수를 작성했다. OpenAI API는 [원격 MCP 서버 직접 호출](https://platform.openai.com/docs/guides/tools-remote-mcp)도 지원한다.

<a id="id68"></a>

# 여러 서버 사용하기

지금까지의 모든 예제에서는 클라이언트가 단일 서버에 연결했다. [단일 클라이언트는 단일 서버에만 연결할 수 있지만](https://modelcontextprotocol.io/specification/2025-03-26/architecture), Python SDK는 한 클라이언트 안에서 여러 세션을 동시에 관리하는 `ClientSessionGroup` 클래스를 제공한다. `connect_with_session()`으로 기존 `ClientSession`에 연결하거나, `connect_to_server()`로 새 `ClientSession`을 만들어 새 서버에 연결한 다음 연결된 서버가 제공하는 모든 프리미티브/구성 요소(도구, 리소스, 프롬프트)를 객체 속성에 불러온다. 세션과 각 도구를 알맞은 세션에 연결하는 매핑도 `ClientSessionGroup` 객체에 저장된다. 세션은 `sessions` 속성으로, MCP 프리미티브는 `prompts`, `resources`, `tools` 속성으로 접근한다. SessionGroup의 도구도 단일 `ClientSession`처럼 `call_tool()`로 호출할 수 있다. `disconnect_from_server()`로 개별 서버 연결을 해제하면 불러온 서버 구성 요소도 제거된다. 아래 예제에서는 `ClientSessionGroup`을 통해 서버에 연결하는 간단한 클라이언트를 만든다.

<a id="multiple_servers"></a>

```py
# client.py
from mcp.client.session_group import ClientSessionGroup, ServerParameters

class MCPClient:
    def __init__(
        self,
        name: str,
        llm_client: Anthropic,
    ) -> None:
        self.name = name
        self._llm_client = llm_client
        self._session_group = ClientSessionGroup()
    ...
    async def connect(self, server_parameters: ServerParameters) -> None:
        """
        Connect to the server set in the constructor.
        """
        connected_server = await self._session_group.connect_to_server(
            server_params=server_parameters,
        )
        connected_server._logging_callback = self._handle_logs
        connected_server._sampling_callback = self._handle_sampling
        connected_server._list_roots_callback = self._handle_roots
        connected_server._elicitation_callback = self._handle_elicitation

    async def get_available_resources(self) -> list[Resource]:
        if not self._session_group.sessions:
            raise RuntimeError("Client not connected to a server")

        resources_result = list(self._session_group.resources.values())
        if not resources_result:
            logger.warning("No resources found on server")
        return resources_result

    async def get_resource(
        self, uri: str
    ) -> list[BlobResourceContents | TextResourceContents]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")
        # Read resource from session group
        resource_read_result = await self._session_group.read_resource(uri=uri)

        if not resource_read_result.contents:
            logger.warning(f"No content read for resource URI {uri}")
        return resource_read_result.contents
    ...
    async def disconnect(self) -> None:
        """
        Clean up any resources
        """
        for session in self._session_group.sessions:
            await self._session_group.disconnect_from_server(session)

...
# agent.py
async def main():
    """Main async function to run the agent with proper connection management."""
    calculator_server_parameters = StdioServerParameters(
        command="uv",
        args=[
            "--directory",
            str(Path(__file__).parent.parent.resolve()),
            "run",
            "calculator_server.py",
        ],
    )
    mcp_client = MCPClient(
        name="calculator_multi_client",
        llm_client=anthropic_client,
    )
    await mcp_client.connect(calculator_server_parameters)
    agent = Agent(mcp_client, anthropic_client)
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())
```

클라이언트 관점에서는 `ClientSessionGroup`이 이전 예제의 단일 서버 클라이언트가 하던 모든 연결 관리를 처리하므로 더 단순하다. 생성자가 더 이상 단일 서버 매개변수로 정의되지 않아 매개변수 수가 줄었다. 전체 속성도 더 적다. 연결 전까지 `None`인 `_session` 속성 대신 `ClientSessionGroup` 객체를 인스턴스화해 `_session_group`에 저장한다. `call_tool()`처럼 기반 세션 메서드를 호출하는 모든 메서드는 `_session` 대신 `_session_group`을 사용하도록 수정해야 한다. 클라이언트에는 `_connected` 속성도 더 이상 필요하지 않다. 내부에서 `ClientSessionGroup`은 모든 프리미티브가 단일 서버에서 온 것처럼 취급하므로 같은 서버에 여러 번 연결하면 예외가 발생한다. 전체 코드에서는 서버 연결을 확인하던 `_connected` 속성 검사를 제거하고, 연결된 서버가 하나 이상인지 `_session_group.sessions` 목록을 확인하는 검사로 대체했다.

사용 가능한 도구, 리소스, 프롬프트를 가져오려면 `get_available_*()` 메서드를 조금 바꿔야 한다. `get_available_resources()`에서 보인 패턴에 따라 `ClientSessionGroup`의 `resources` 딕셔너리를 순회하고 값을 목록으로 반환해야 한다.

###### 경고

프리미티브는 단일 서버에서 온 것처럼 취급되므로 `ClientSessionGroup` 안에 이름이 같은 프리미티브를 둘 수 없다. 프리미티브 이름은 딕셔너리에 저장되므로 기존 도구와 이름이 같은 도구 같은 프리미티브를 추가하면 예외가 발생한다.

이어 `ServerParameters` 객체 하나만 받는 `connect()` 메서드가 있다. 이는 실제로 `StdioServerParameters`, `SseServerParameters`, `StreamableHttpParameters`의 Python 형식 별칭이다. 이를 사용해 단일 서버에 연결하며 모든 연결 관리는 세션 그룹이 처리한다. 반면 개별 `ClientSession` 객체를 설정할 때 콜백을 포함하는 기능은 아직 지원하지 않는다. 예제에 우회 방법이 나온다. `ClientSessionGroup`의 `connect_to_server()` 함수가 연결된 세션을 반환하므로 세션의 `_logging_callback`과 `_sampling_callback` 속성을 직접 설정할 수 있다. 엄밀히 말해 비공개 속성이므로 가장 깔끔한 방법은 아니지만, `ClientSessionGroup` 클래스가 콜백을 기본 지원하기 전까지 이 제약을 해결하는 가장 간단한 방법이다. `disconnect()` 메서드도 `ClientSessionGroup`의 `sessions` 목록을 순회하며 각 세션에 `disconnect_from_server()`를 호출하도록 수정했다.

호스트 애플리케이션도 수정해야 한다. 위 예제에서는 `if __name__ == "__main__"` 블록의 코드를 대부분 `main()`으로 옮긴다. 계산기 서버 매개변수는 `StdioServerParameters` 객체에 저장하고, `mcp_client`는 이 매개변수 없이 인스턴스화한다. 그 뒤 직접 `connect()`를 호출하면서 만든 서버 매개변수 객체를 전달한다. 이 메서드는 클라이언트와 서버 사이에 세션을 만들고 내부 활성 세션 목록에 추가한다.

`ClientSessionGroup` 생성자는 이름 충돌 방지를 위해 구성 요소 이름을 바꾸는 선택적 훅 `component_name_hook`도 받는다. 문자열인 구성 요소 이름과 [Implementation 객체](https://github.com/modelcontextprotocol/python-sdk/blob/f3cd20c9200de001fb58f83a130ab83c6a6ed5fd/src/mcp/types.py#L200)를 받아 바뀐 구성 요소 이름 문자열을 반환하는 함수면 된다.

<a id="id69"></a>

# 모범 사례

일부 모범 사례는 아직 완전히 확립되지 않았고, 일부는 커뮤니티가 확립했으며, 일부는 일반적인 공학 모범 사례다. 클라이언트에 적용되는 이들을 모두 개괄하면 자체 애플리케이션을 위한 복원력 있고 프로덕션에 바로 사용할 수 있는 MCP 클라이언트를 빠르게 구축하는 데 도움이 된다. 보안, 연결 관리, 사용자 경험을 중심으로 살펴본다.

<a id="id70"></a>

## 보안

LLM은 강력한 도구지만 범용성이 넓은 만큼 공격 표면도 넓다. 서드파티 서버와 상호 작용하면 공격 표면이 더 커진다. 모델 컨텍스트 프로토콜 사용에 따른 보안 위험을 완화하는 방법이 몇 가지 있다. 예를 들어 많은 서버가 인증을 요구한다. stdio 연결에서는 환경에서 자격 증명을 가져오는 방식이 가장 좋다. 스트리밍 HTTP 연결에서는 Python OAuth 2.1 클라이언트 라이브러리로 인증 절차를 처리해야 한다. 클라이언트는 서버에 접근한 뒤 인증 절차를 시작하고 서버에서 액세스 토큰을 받아 보호된 도구와 리소스에 접근해야 한다.

<a id="id71"></a>

## 연결 재개하기

클라이언트와 서버의 연결은 항상 안정적이지 않다. 실패 형태가 많고 보통 구체적인 활용 사례에 따라 달라진다. 다행히 Streamable HTTP 연결은 재개할 수 있어 끊어진 연결을 중단된 지점부터 다시 설정할 수 있다. MCP 서버는 내보내는 각 SSE 이벤트에 선택적으로 `id`를 붙일 수 있다. 클라이언트는 이 `id`를 사용해 마지막으로 받은 이벤트부터 연결을 재개한다. 프로토콜 수준에서는 클라이언트가 연결했던 서버로 보내는 GET 요청에 `Last-Event-ID` 헤더를 포함해 수행한다. Python에서도 비슷하게 처리한다.

클라이언트는 세션 ID와 가장 최근 이벤트 ID를 속성에 보존해야 한다. 다시 연결하기 전에 세션 및 이벤트 ID를 가져와 연결 함수에 전달할 헤더 딕셔너리에 추가한다.

Streamable HTTP 연결 절을 기억한다면 서버 연결이 stdio 서버보다 간단했다는 점도 기억할 것이다. 연결 재개도 마찬가지다. 재개하기 전에 세션 및 이벤트 ID를 헤더 딕셔너리에 추가해 연결 함수의 `headers` 매개변수로 전달한다. 아래 예제에서는 이미 저장된 세션 ID와 이벤트 ID를 가져와 헤더 딕셔너리에 추가한 뒤 Streamable HTTP 연결 생성자에 전달한다.

<a id="resuming_connections"></a>

```py
from mcp.client.streamable_http import streamablehttp_client


class MCPClient:
    """MCP Client class for connecting to and interacting with MCP servers."""

    def __init__(self, name: str, server_url: str) -> None:
        """Initialize the MCPClient with server connection parameters."""
        self.name = name
        self.server_url = server_url
        self._session: ClientSession = None
        self.exit_stack = AsyncExitStack()
        self._connected: bool = False
        self._get_session_id: Callable[[], str] = None
        self._last_event_id: str = None

    async def connect(self, headers: dict | None = None) -> None:
        """Connect to the server set in the constructor."""
        headers["Last-Event-ID"] = self._last_event_id

        # Connect to Streamable HTTP server
        streamable_connection = await self._exit_stack.enter_async_context(
            streamablehttp_client(url=self.server_url, headers=headers)
        )
        ...
```

매우 단순화된 구현이다. `Last-Event-ID` 키로 `_last_event_id`를 `headers` 딕셔너리에 추가한 다음, 전체 딕셔너리를 `headers` 매개변수로 `streamablehttp_client`에 전달한다.

<a id="id72"></a>

## 결과 페이지네이션

서버에서 가져오는 결과가 매우 길면 페이지로 나누는 것이 좋다. 사용자가 어떤 종류의 에이전트를 사용할지 알 수 없으며 한 번에 너무 많은 결과로 에이전트에 부담을 주고 싶지 않으므로 따를 가치가 있다. 일반적으로 서버가 `nextCursor` 속성이 있는 결과를 반환하면서 시작된다.

다음 결과 페이지를 가져오려면 결과를 가져올 때 사용한 같은 메서드를 호출하되 `nextCursor` 속성을 `cursor` 매개변수로 전달한다. 그러면 서버에서 다음 결과 페이지를 받아야 한다. 현재는 목록 함수만 페이지네이션을 지원하며, Python SDK에서는 `list_resources()`, `list_resource_templates()`, `list_prompts()`, `list_tools()` 메서드가 해당한다.
