---
title: '3장. MCP 클라이언트로 지능형 애플리케이션을 에이전트화하기'
author: Kyle Stratis
layout: post
permalink: /AI_Agent_with_MCP/ko/chapter_3.html
lang: ko
book_order: 3
---
<a id="ch03"></a>

# 3장. MCP 클라이언트로 지능형 애플리케이션을 에이전트화하기

모델 컨텍스트 프로토콜을 사용할 때는 일반적으로 클라이언트나 서버를 다루거나 직접 구축하게 된다. 프로젝트에 따라 둘 다 구축할 수도 있다. 프로토콜을 제대로 이해하고 프로젝트에서 잠재력을 온전히 활용하려면 MCP 아키텍처의 모든 구성 요소를 익숙하게 다룰 수 있어야 한다. 이 장에서는 이 아키텍처의 소비자 측인 호스트 애플리케이션과 클라이언트를 배운다.

먼저 호스트 애플리케이션을 자세히 살펴본다. 호스트 애플리케이션이 무엇이고 어떤 일을 하며, 어떤 애플리케이션이 MCP 통합의 이점을 얻을 수 있는지 알아본다. 그런 다음 클라이언트 자체를 살펴본다. 호스트 애플리케이션은 클라이언트를 호스팅하고, 클라이언트는 호스트 애플리케이션과 MCP 서버의 통신을 가능하게 한다. 바로 이것이 호스트 애플리케이션을 ‘호스트’로 만드는 요소다.

단, 한 가지 제약이 있다. 단일 클라이언트는 단일 서버와만 통신할 수 있다. 여러 서버에 접근하려면 여러 클라이언트 인스턴스를 실행하거나, 여러 서버에 짧은 임시 연결만 만드는 단일 클라이언트를 사용해야 한다. 각 접근 방식의 장단점과 어떤 활용 사례에 가장 적합한지 살펴본다.

이어서 매우 단순한 호스트 애플리케이션과 그 안에서 호스팅되는 클라이언트를 살펴본다. 코드를 한 줄씩 분석하여 클라이언트 구조와 호스트 애플리케이션에 기능을 제공하는 방식을 이해한다. 마지막으로 호스트 애플리케이션에 클라이언트를 구축할 때의 모범 사례를 배워 애플리케이션의 보안성, 신뢰성, 응답성을 유지한다.

<a id="id52"></a>

# 호스트 애플리케이션

호스트 애플리케이션은 MCP 서버 연결을 관리하는 클라이언트를 호스팅하는 모든 애플리케이션이 될 수 있다. 사용자 입력을 받아 LLM에 보내고 응답을 받는 간단한 챗봇 스크립트부터 [Cursor](https://www.cursor.com/)나 [Windsurf](https://windsurf.com) 같은 완전한 기능을 갖춘 IDE까지 모두 해당한다.

MCP는 모듈식이므로 MCP를 지원하기 위해 호스트 애플리케이션이 수행해야 할 작업에는 제약이 거의 없다. LLM과 통신하고 하나 이상의 MCP 클라이언트를 호스팅하기만 하면 된다. 도구를 사용할 계획이라면 호스트 애플리케이션이 사용하는 LLM도 도구 호출을 지원해야 한다.

아래 예제는 최소한의 호스트 애플리케이션을 보여 준다. 현재는 무한 루프에서 사용자 입력을 받아 LLM에 전달하는 기능만 수행한다. 이 스크립트와 이 장의 다른 모든 코드는 [책의 GitHub 저장소](https://github.com/kylestratis/ai_agents_mcp_examples)의 `ch3`에서 찾을 수 있다.

<a id="id53"></a>

## 예제: 간단한 호스트 애플리케이션

<a id="host_no_client"></a>

```python
import os

from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()

LLM_API_KEY = os.environ["LLM_API_KEY"]
anthropic_client = Anthropic(api_key=LLM_API_KEY)

print("Welcome to your AI Assistant. Type 'goodbye' to quit.")

def main():
    while True:
        prompt = input("You: ")
        if prompt.lower() == "goodbye":
            print("AI Assistant: Goodbye!")
            break
        message = anthropic_client.messages.create(
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="claude-sonnet-4-0",
        )
        for response in message.content:
            print(f"Assistant: {response.text}")

if __name__ == "__main__":
    main()
```

여기에는 MCP 호스트의 출발점이 있다. 사용자 입력을 받아 LLM(이 예제에서는 Anthropic Claude 3.5)에 보내고 응답을 출력하는 매우 간단한 스크립트다. 코드를 한 줄씩 살펴보자.

1~4행에서는 몇 가지 패키지를 가져온다. `os`는 환경 변수를 불러오고, `anthropic`은 `Anthropic` 클라이언트 클래스를 제공하며, `dotenv`는 파일의 키-값 쌍을 환경 변수로 임시로 불러온다. 이를 사용하면 API 키 같은 민감한 정보를 코드 외부의 파일에 `KEY=VALUE` 형식으로 저장할 수 있다. 관례적으로 이 파일을 `.env`라고 부른다.

###### 경고

`.env` 파일을 버전 관리 시스템에 커밋하지 말아야 한다. API 키가 공개되어 무단 사용이나 사용량 기반 API의 막대한 비용 같은 문제가 발생할 수 있다. 실수로 커밋했다면 즉시 키 공급자에 로그인하여 노출된 키를 비활성화해야 한다.

6~9행에서 애플리케이션은 `load_dotenv()`를 호출해 키를 환경 변수에 불러온 다음 `os.environ` 딕셔너리에서 불러온 키를 가져온다. 이어 이 키로 Anthropic 클라이언트를 인스턴스화한다.

11행에서 사용자에게 환영 메시지를 표시한 뒤 코드는 무한 루프에 들어간다. 14행은 사용자에게 프롬프트를 요청하고, 15~17행은 프롬프트에 종료 문구가 있는지 확인한다. 발견하면 애플리케이션은 작별 메시지를 출력하고 종료한다.

18~28행은 모델과의 통신을 처리한다. 코드에서 LLM을 호출할 때 반복해서 접하게 될 패턴이다. Anthropic 클라이언트에서 `.messages.create()` 함수에 접근하고 여러 매개변수를 제공한다. `max_tokens`는 사용자 질의에 대한 응답으로 생성할 토큰의 상한을 제어한다. `system`은 시스템 프롬프트를 설정해 모델이 사용자에게 응답하는 방식을 형성한다. `messages`는 역할이 지정된 프롬프트 딕셔너리의 목록이다. 여기서는 `role`을 `"user"`로, `content`를 사용자의 프롬프트로 설정했다. 마지막으로 `model`은 사용할 모델을 지정한다.

더 큰 Anthropic API 안의 `messages` 인터페이스는 매우 강력하며, `create()` 함수에는 모델 응답의 특성을 조정하며 실험할 수 있는 매개변수가 여럿 있다. 자세한 내용은 [Anthropic 공식 문서](https://docs.anthropic.com/en/api/messages)를 참조한다.

마지막 29~30행에서는 모델이 생성한 응답을 순회하며 Anthropic 클라이언트가 받은 메시지 중 텍스트 콘텐츠를 출력한다.

이제 Anthropic 모델 클라이언트에서 애플리케이션이 호스팅할 MCP 클라이언트로 초점을 옮겨 보자.

<a id="id54"></a>

# 클라이언트

애플리케이션에 MCP 지원을 구축할 때 클라이언트는 직접 구축하고 다루게 될 가장 중요한 구성 요소 중 하나다. 클라이언트는 MCP 서버와 애플리케이션 사이의 통신을 지원하며, 서버·애플리케이션·사용 중인 대규모 언어 모델 사이의 인터페이스를 제공한다.

클라이언트는 애플리케이션과 MCP 서버 사이의 인터페이스 역할을 하므로 어떤 서버 기능을 지원할지는 클라이언트가 결정한다. 이 글을 쓰는 시점에 MCP 서버는 호스트 애플리케이션에 다음을 제공할 수 있다.

- 텍스트 파일, 로그 파일 등의 데이터를 나타내는 리소스
- 프롬프트
- 에이전트나 모델이 실행할 수 있는 코드인 도구
- 서버가 호스트 애플리케이션의 모델에 채팅 완성을 요청하는 샘플링
- 이미지
- 도구에 MCP 기본 기능을 제공하는 컨텍스트

각 항목은 4장 ‘서버’에서 자세히 알아본다.

클라이언트는 연결된 서버가 동작해야 할 경계, 예를 들어 특정 파일 시스템 위치를 정의하는 **루트(roots)**도 지원할 수 있다. 루트는 엄격하게 강제되지 않으므로 서버가 이를 준수해야 하며, 클라이언트 사용자는 서버를 사용하기 전에 잠재적 위험을 검토해야 한다.

이 글을 쓰는 시점에 MCP가 지원하는 주요 전송 메커니즘은 표준 입력/출력(stdio)과 Streamable HTTP 두 가지다. 이 장에서는 각 공식 메커니즘을 지원하는 방법을 다룬다. 5장에서는 전송 계층 자체, 공식 전송 구현의 동작 방식, 자체 전송 계층 구현 방법을 자세히 배운다.

###### 참고

Anthropic은 최근 원격 MCP 서버에 Anthropic SDK의 Messages API를 통해 직접 접근하게 해 주는 [MCP 커넥터](https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector) 베타 버전을 공개했다. 사용자 정의 클라이언트의 필요성을 줄일 수 있어 보이지만, 이 글을 쓰는 시점에는 도구와 원격 MCP 서버만 지원한다. MCP 서버를 다루는 장에서 보겠지만 이는 보안 위험이 될 수 있다. 또한 사용자를 Claude 같은 Anthropic 모델에 묶어 두므로 특정 활용 사례에는 맞지 않을 수 있다.

<a id="id55"></a>

## 기본 클라이언트 설계

MCP에서 클라이언트는 서버와의 모든 통신과 연결을 처리한다. 클라이언트-서버 연결은 일대일이므로 일반적으로 클라이언트 클래스를 만드는 것이 가장 좋다. 클라이언트는 최소한 다음 작업을 수행해야 한다.

- 서버에 연결한다.
- 서버의 리소스를 발견한다.
- 해당 리소스를 LLM이 사용할 수 있게 한다.

이러한 기본 작업 외에도 다음 기능을 구현하면 유용한 경우가 많다.

- 인증
- 리소스 필터링
- 모델 독립성

이 장의 나머지 부분에서는 각 기능을 구축하는 방법과 애플리케이션에 제공하는 이점을 배운다. 먼저 클라이언트 클래스의 인터페이스를 대략 설계해 보자. [GitHub 저장소](https://github.com/kylestratis/ai_agents_mcp_examples)를 따라 실습한다면 이 절의 코드는 `client.py`에, 호스트 애플리케이션 코드는 모두 `agent.py`에 있다. 장의 나머지 부분에서도 이 구조를 유지한다.

<a id="host_w_client_interface"></a>

```python
...
class MCPClient:
    def __init__(self) -> None:
        pass

    async def connect(self) -> None:
        """
        Connect to the server set in the constructor.
        """
        pass

    async def get_available_tools(self) -> list[Any]:
        """
        Retrieve tools that the server has made available.
        """
        pass

    async def use_tool(self, tool_name: str, tool_args: list | None = None):
        """
        Given a tool name and optionally a list of argumnents, execute the
        tool
        """
        pass

    async def disconnect(self) -> None:
        """
        Clean up any resources
        """
        pass
```

이 클래스에서는 생성자를 제외한 세 메서드의 시그니처를 만들었다.

- `connect()`: 서버 연결을 초기화한다. 구현 형태는 선택한 전송 계층에 따라 달라진다.
- `get_available_tools()`: 클라이언트의 서버 연결을 사용하여 서버가 제공하는 도구를 가져온다.
- `use_tool()`: 도구 이름과 호출자가 제공한 인수를 받아 도구를 호출한다.

호스트 애플리케이션 관점에서 인스턴스화된 객체가 MCP 서버를 나타내므로 [공식 Python 예제](https://github.com/modelcontextprotocol/python-sdk/tree/05b7156ea8a34d8476a7cfbef5f754e22ab6c697/examples/clients/simple-chatbot)처럼 클라이언트 이름을 `MCPServer`로 지정하는 것도 좋다. 다만 혼동을 일으킬 수 있어 이 예제에서는 `MCPClient`라고 했다. 자신의 프로젝트에서는 개발자와 사용자에게 가장 이해하기 쉬운 이름을 선택하자.

이 골격은 도구 지원부터 시작한다. 도구는 MCP의 주요 프리미티브 중 하나이자 가장 인기 있는 MCP 활용 사례라 할 수 있다. 도구는 에이전트에 행동 능력을 부여하고 LLM의 지식을 확장하는 등 많은 일을 할 수 있다. 따라서 먼저 도구 지원을 구현한 뒤 MCP 서버가 제공할 수 있는 여러 리소스를 모두 지원하는 방법으로 넘어간다.

###### 참고

MCP의 세 가지 프리미티브는 **도구**, **프롬프트**, **리소스**다.

<a id="id56"></a>

## 클라이언트 초기화 및 서버 연결

코드를 작성하기 전에 서버에 *어떻게* 연결할지 생각해 보자. 어떤 전송 계층을 사용할지 결정해야 한다. MCP에서 **전송(transport)**은 프로토콜의 전송 계층을 구현하며 클라이언트와 서버 사이에서 메시지를 보내는 방식을 관리한다.

이 글을 쓰는 시점에 MCP에는 stdio와 Streamable HTTP라는 두 가지 주요 기본 전송 구현이 있다. stdio 전송은 표준 입력과 출력 스트림으로 클라이언트와 서버 사이의 통신을 전달하므로, 서버를 호스트 애플리케이션과 함께 실행할 것으로 예상하는 활용 사례에 적합하다. 구현이 간단하고, MCP 클라이언트를 호스팅하는 시판 애플리케이션 대부분이 사용자가 서버를 직접 설치하고 실행한다고 가정하므로 가장 일반적인 전송 방식이다.

###### 참고

Python MCP SDK에는 WebSocket 전송과 HTTP 서버 전송 이벤트(SSE) 전송도 포함되지만, SSE는 Streamable HTTP로 대체되고 있다. 따라서 여기서는 Streamable HTTP 연결만 다룬다. 이 절에서 정립하는 패턴과 [Anthropic의 하위 호환성 가이드](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#backwards-compatibility)를 참고하면 클라이언트 개발자가 두 원격 전송을 모두 지원하는 데 충분할 것이다. 모든 전송 방식은 5장에서 더 자세히 살펴본다.

반면 기본 제공 Streamable HTTP 전송은 사용하는 MCP 서버를 호스트 애플리케이션과 함께 실행한다고 가정할 수 없는 애플리케이션에 가장 적합하다. 플랫폼 개발과 호스팅 도구에서 특히 분명하게 드러난다.

하위 제품을 구축하고 배포하는 플랫폼이나 프레임워크를 개발할 때는 MCP 서버가 애플리케이션과 같은 컴퓨터에 배포된다고 보장할 수 없다. 그렇지 않다면 stdio 클라이언트는 서버와 통신할 수 없다. 일부 조직은 자체 네트워크에서 MCP 서버를 호스팅하고 공개하는 방식을 실험 중이다. 이를 사용하려면 클라이언트에 Streamable HTTP 지원을 구축해야 한다.

###### 경고

Streamable HTTP를 포함한 모든 원격 전송은 보안 문제를 막기 위해 올바르게 보호해야 한다. 연결 인증과 Origin 헤더 검증이 포함된다.

먼저 가장 간단한 사례인 stdio 연결을 살펴보자. 이 절에서는 `MCPClient` 클래스의 생성자와 `connect()` 메서드를 구현한다. 그런 다음 같은 방식으로 원격 MCP 서버 연결을 지원하는 Streamable HTTP 클라이언트를 구축한다.

그 후 세 가지 메서드를 모두 지원하는 클라이언트 예제와 적절한 메서드를 선택하는 방법을 살펴본다.

<a id="id57"></a>

### stdio로 연결하기

stdio로 MCP 서버에 연결하면 클라이언트가 서버를 하위 프로세스로 실행한 뒤 서버의 표준 입력에서 메시지를 읽고 표준 출력으로 메시지를 보낸다. 다행히 MCP [Python SDK](https://github.com/modelcontextprotocol/python-sdk/tree/main)에는 클라이언트를 구성하고 stdio로 연결하는 데 필요한 구조가 모두 포함되어 있다.

먼저 클라이언트 생성자를 설정하자.

<a id="stdio_client_constructor"></a>

```python
# client.py
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession

class MCPClient:
    def __init__(self, name: str, command: str, server_args: list[str], env_vars: dict[str, str]=None) -> None:
        self.name = name
        self.command = command
        self.server_args = server_args
        self.env_vars = env_vars
        self._session: ClientSession = None
        self._exit_stack: AsyncExitStack = AsyncExitStack()
        self._connected: bool = False
    ...
```

이 생성자에서는 MCP 서버에 연결하고 상호 작용할 수 있게 하는 몇 가지 중요한 속성을 설정한다. 첫 번째 `name`은 인스턴스화한 클라이언트에 사람이 읽을 수 있는 이름을 부여한다. 특히 여러 서버 연결을 유지할 때 로그가 나온 구체적인 출처를 쉽게 식별할 수 있어 로깅에 유용하다. 다만 MCP 클라이언트의 필수 요소는 아니다.

다음 세 매개변수는 서버 설정에 사용한다. `command`는 서버를 시작하기 위해 실행할 프로그램을 지정한다. 서버는 보통 `python`, `node`, 또는 로컬 설치 방식에 따라 `npx`로 실행한다. 매우 일반적인 값이므로 대부분의 활용 사례에서 클라이언트가 열거형을 정의하여 지원되는 명령만 사용하도록 할 수 있다. `server_args`는 `command` 실행 파일에 전달할 모든 명령줄 인수의 목록이며, 최소한 서버 파일 경로를 포함한다. 파일이 `--port 8000 --verbose` 같은 명령줄 인수를 받는다면 `server_args` 목록은 `["server.py", "--port", "8080"]`처럼 구성한다. 다음 `env_vars`는 환경 변수 딕셔너리다. 일반적인 환경 변수처럼 동작하며 `{**os.env}`로 시스템 환경 변수를 이 딕셔너리에 펼칠 수도 있다. 그러나 민감한 정보가 서버에 노출될 수 있으므로 권장하지 않는다.

클라이언트 세션을 저장할 `_session`, 비동기 연결 컨텍스트를 관리할 `_exit_stack`(뒤에서 자세히 설명한다), 이미 연결된 상태에서 서버에 다시 연결하는 것을 막을 `_connected` 같은 ‘비공개’ 연결 관리 속성도 포함한다.

다음 단계는 `connect()`와 `disconnect()` 메서드를 구현하는 것이다. Python MCP SDK의 기본 연결 관리 객체를 사용해 서버 연결을 만들고 유지한다.

<a id="connect_disconnect_stdio"></a>

```python
# client.py
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

class MCPClient:
    ...
    async def connect(self) -> None:
        """
        Connect to the server set in the constructor.
        """
        if self._connected:
            raise RuntimeError("Client is already connected")

        server_parameters = StdioServerParameters(
            command=self.command,
            args=self.server_args,
            env=self.env_vars if self.env_vars else None
        )

        # Connect to stdio server, starting subprocess
        stdio_connection = await self._exit_stack.enter_async_context(stdio_client(server_parameters))
        self.read, self.write = stdio_connection

        # Start MCP client session
        self._session = await self._exit_stack.enter_async_context(ClientSession(read_stream=self.read, write_stream=self.write))

        # Initialize session
        await self._session.initialize()
        self._connected = True

    async def disconnect(self) -> None:
        """
        Clean up any resources
        """
        if self._exit_stack:
            await self._exit_stack.aclose()
            self._connected = False
            self._session = None
```

특히 비동기 Python을 작성한 경험이 없다면 복잡해 보일 수 있다. `connect()` 메서드부터 작업을 나누어 이해해 보자. 메서드가 가장 먼저 하는 일은 `_connected` 속성을 확인하는 것이다. 사용자가 이미 열린 연결을 다시 열지 못하게 한다. 그런 다음 생성자에서 설정한 속성을 전달하여 `StdioServerParameters` 객체를 인스턴스화한다. 나머지 코드는 MCP 서버를 실행하고 사용하는 데 필요한 프로세스와 연결을 생성한다. `AsyncExitStack` 인스턴스를 담고 있는 `_exit_stack`을 통해 이 작업을 수행한다.

###### 참고

`AsyncExitStack`을 사용하면 더 일반적인 `async with` 컨텍스트 관리자 구문을 쓰지 않고도 비동기 컨텍스트 관리자를 수동으로 중첩할 수 있다. 스택에 비동기 컨텍스트 관리자를 동적으로 추가할 수 있고 호출 한 번으로 스택의 모든 리소스를 순서대로 안전하게 해제할 수 있어 이 상황에 이상적이다. 특히 각 컨텍스트 관리자의 범위를 코드가 벗어날 때까지 기다리지 않고 스택을 해제할 시점을 직접 결정할 수 있다는 점이 매우 유용하다. `enter_async_context()` 함수를 호출해 이를 수행한다.

먼저 MCP 세션이 실행될 하위 프로세스를 시작하는 stdio 서버 연결을 연다. 바로 앞에서 만든 `server_params`로 인스턴스화한 `stdio_client`를 전달한다. 호출 결과를 각각 세션의 읽기 및 쓰기 스트림을 나타내는 `self.read`와 `self.write`로 풀어낸다. 다음에는 `enter_async_context()`를 다시 호출하되, 이번에는 읽기 및 쓰기 스트림을 `self.read`와 `self.write`로 설정한 `ClientSession` 인스턴스를 전달해 MCP 클라이언트 세션을 시작한다. 이를 `self._session`에 저장한 다음 `initialize()`로 초기화한다. 이 메서드는 서버 연결 시작, 서버에 클라이언트 기능 알림, 서버 지원 프로토콜 버전 확인, 클라이언트가 성공적으로 초기화되었음을 서버에 알리는 작업을 처리한다. 마지막으로 `self._connected`를 `True`로 설정한다.

요약하면 stdio 서버 연결 코드를 작성할 때는 다음 순서를 따른다.

1. `StdioServerParams` 인스턴스를 만든다.
2. 비동기 컨텍스트에서 stdio 서버 하위 프로세스를 시작한다.
3. 중첩된 다른 비동기 컨텍스트에서 MCP 클라이언트 세션을 시작하고 `self._session`에 저장한다.
4. 세션 자체를 초기화한다.

이 예제에서는 `disconnect()` 메서드도 만들었다. `self._exit_stack.aclose()`를 호출해 모든 서버 연결을 순서대로 닫고, `self._connected`를 `False`로, `self._session`을 `None`으로 설정한다. 이제 stdio 전송을 사용하여 필요할 때 MCP 서버에 깔끔하게 연결하고 연결을 해제할 수 있다. 아직 서버로 어떤 작업도 할 수는 없지만 가장 복잡한 부분을 끝냈다. 스스로를 격려해도 좋다. 이제 Streamable HTTP 전송을 지원하도록 같은 작업을 수행해 보자.

<a id="id58"></a>

### Streamable HTTP로 연결하기

[서드파티 예제](https://github.com/S1LV3RJ1NX/mcp-server-client-demo/blob/main/client/universal_client.py) Streamable HTTP는 원격 MCP 서버에 사용하도록 설계된 주요 전송 방식이다. 원래는 HTTP 서버 전송 이벤트(SSE)가 원격 서버 연결 표준이었지만, 여러 프로덕션 문제 때문에 계속 지원하기 어려워졌다. 이러한 문제와 두 전송 방식의 아키텍처는 5장에서 다룬다.

Streamable HTTP로 원격 서버에 연결하면 서버가 정의한 단일 엔드포인트를 사용한다. 응답은 서버에 POST를 보내 발생하며 상시 연결이 필요 없는 즉각적인 표준 HTTP 응답일 수도 있고, 서버에 빈 GET을 보내 발생하는 스트리밍 SSE 응답일 수도 있다. 후자는 선택 사항이며 서버 구현에 따라 달라진다.

###### 참고

“잠깐, Streamable HTTP가 HTTP+SSE를 대체한다고 하지 않았나? 무엇이 다른가?”라는 의문이 들 수 있다. 개선 사항은 5장에서 자세히 설명하지만 가장 큰 차이는 SSE 응답이 선택 사항이라는 점이다. 클라이언트는 스트리밍 응답을 요청해야 하고, 서버도 지원 여부를 선택할 수 있다.

Streamable HTTP를 지원하기 위해 다시 `MCPClient`의 생성자, `connect()`, `disconnect()` 메서드를 구축한다. 생성자부터 시작하자.

<a id="streamable_http_client_constructor"></a>

```python
# client.py
from contextlib import AsyncExitStack
from typing import Callable

from mcp import ClientSession

class MCPClient:
    def __init__(self, name: str, server_url: str) -> None:
        self.name = name
        self.server_url = server_url
        self._session: ClientSession = None
        self.exit_stack = AsyncExitStack()
        self._connected: bool = False
        self._get_session_id: Callable[[], str] = None
```

stdio 클라이언트 생성자와 놀랄 만큼 비슷하다. 로컬에서 프로세스를 시작하지 않으므로 `command`나 `server_args`는 필요 없지만, `server_url`이 제공하는 서버 위치는 필요하다. 나머지 속성은 stdio 클라이언트와 같다.

서버 연결 및 연결 해제 방식도 stdio 클라이언트와 매우 비슷하다.

<a id="streamable_http_connect_disconnect"></a>

```python
# client.py
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

class MCPClient:
    ...
    async def connect(self, headers: dict | None = None) -> None:
        if self._connected:
            raise RuntimeError("Client is already connected")

        # Connect to Streamable HTTP server
        streamable_connection = await self._exit_stack.enter_async_context(streamablehttp_client(url=self.server_url, headers=headers))
        self.read, self.write, self._get_session_id = streamable_connection

        # Start MCP client session
        self._session = await self._exit_stack.enter_async_context(ClientSession(read_stream=self.read, write_stream=self.write))

        # Initialize session
        await self._session.initialize()
        self._connected = True

    async def disconnect(self) -> None:
        """
        Clean up any resources
        """
        if self._exit_stack:
            await self._exit_stack.aclose()
            self._connected = False
            self._session = None
```

이 코드는 stdio 클라이언트의 `connect()` 및 `disconnect()` 코드와 거의 같으므로 익숙해 보일 것이다. 다른 점은 선택적 `headers` 매개변수를 받아 `server_url` 속성과 함께 `streamablehttp_client()`에 전달한다는 것이다. 이 함수는 `read_stream`과 `write_stream` 외에도 서버가 세션 ID를 제공할 경우 이를 가져오는 콜백을 반환한다. 서버가 지원하면 끊어진 세션을 재개하는 데 사용할 수 있다. 또한 `streamablehttp_client` 함수는 별도의 매개변수 객체 대신 URL과 헤더를 직접 매개변수로 받으므로 `StdioServerParams` 객체를 인스턴스화하지 않는다. 클라이언트 개발자가 관심을 둘 만한 다른 매개변수는 다음과 같다.

- `timeout`: HTTP 작업이 시간 초과될 때까지의 초 단위 시간으로, 형식은 `datetime.timedelta`다. 기본값은 30초다.
- `sse_read_timeout`: 추가 이벤트를 기다리다가 시간 초과될 때까지의 초 단위 시간으로, 형식은 `datetime.timedelta`다. 기본값은 5분이다.
- `auth`: 인증을 처리하며 형식은 `httpx.auth`다. 인증을 지원하는 서버와 세션을 인증하는 방법은 뒤 절에서 배운다.

클라이언트 클래스를 구축하는 동안 이를 호스트 챗봇 애플리케이션에 통합하는 한 가지 전략을 살펴보자. 이 장 도입부의 간소화된 챗봇을 사용하여 MCP 클라이언트가 더 큰 LLM 기반 애플리케이션에 어떻게 들어맞는지 보여 준다. 여기서는 stdio MCP 클라이언트를 인스턴스화하고 `add_two_numbers`, `subtract_two_numbers`, `multiply_two_numbers`, `divide_two_numbers` 같은 계산기 도구를 제공한다고 가정한 MCP 서버에 연결하는 기능만 추가한다.

<a id="instantiate_stdio_client"></a>

```python
import asyncio
from pathlib import Path
...
mcp_client = MCPClient(
    name="calculator_server_connection",
    command="uv",
    server_args=[
        "--directory",
        str(Path(__file__).parent.resolve()),
        "run",
        "calculator_server.py",
    ],
)

print("Welcome to your AI Assistant. Type 'goodbye' to quit.")

def main():
    await mcp_client.connect()
    while True:
        prompt = input("You: ")
        if prompt.lower() == "goodbye":
            print("AI Assistant: Goodbye!")
            break
        message = anthropic_client.messages.create(
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model="claude-sonnet-4-0",
        )
        for response in message.content:
            print(f"Assistant: {response.text}")
    await mcp_client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())
```

여기서는 클라이언트를 인스턴스화한 다음 `connect()`를 호출해 서버 연결을 열었을 뿐이다. 채팅 루프가 끝나면 `disconnect()`를 호출해 연결을 닫는다. Streamable HTTP 서버용으로 바꾸려면 어떻게 해야 할까?

###### 참고

클라이언트를 인스턴스화할 때 명령으로 `python` 대신 `uv`를 사용한다. `uv`는 어느 위치에서나 실행할 수 있고 가상 환경과 의존성을 간단히 관리하므로 여기서 유용하다. 명령을 `python`이나 `python3`로 바꿀 수도 있지만, [uv도 살펴보기](https://github.com/astral-sh/uv) 바란다.

이제 MCP 서버가 클라이언트에 제공할 수 있는 모든 것을 사용하는 방법을 살펴보자.

<a id="id59"></a>

## MCP 서버 기능과 상호 작용하기

MCP 서버는 MCP 프리미티브인 *도구*, *리소스*, *프롬프트*를 비롯해 매우 다양한 기능을 제공할 수 있다. 클라이언트 개발자는 인스턴스화한 `ClientSession` 객체를 통해 이들과 상호 작용하며, 일반적으로 각 기능에 대해 발견과 사용이라는 같은 2단계 워크플로를 적용한다. 각 기능은 `<primitive>/list` 요청으로 발견하며, Python SDK에서는 `list_<primitive>s()` 메서드가 이 요청을 감싼다. 서버가 해당 기능을 제공하면 호출 결과로 사용 가능한 도구, 리소스, 프롬프트 목록이 반환된다. 결과 기능을 사용하려면 `<primitive>/<verb>` 호출이 필요하며 동사는 호출하는 프리미티브에 따라 달라진다. Python SDK에서는 `tool/call`을 위한 `call_tool()`처럼 `<verb>_<primitive>()` 형식의 메서드가 이러한 호출을 감싼다.

###### 참고

프로토콜은 서버와 클라이언트가 알림 메시지를 보낼 수 있게 하며, 수신 측은 원하는 방식으로 알림을 처리한다. Streamable HTTP 연결에서 알림은 전송 계층 정의에 따라 다른 메시지와 같은 방식으로 보내지만, `JSONRPCMessage` 클래스의 구현인 `JSONRPCNotification` 형태로 전송한다.

MCP SDK는 여러 요청 호출을 클라이언트가 직접 호출할 수 있는 메서드로 감싸지만, 자체 객체 메서드로 한 번 더 감싸는 것이 유용한 경우가 많다. 그러면 로깅, 재시도, 메서드 매개변수 등 서버 호출을 사용자 정의할 수 있다. 페이지네이션을 위해 `list_<primitive>()` 메서드에 선택적 `cursor` 매개변수를 전달하는 것도 한 예다.

<a id="id60"></a>

### 도구

도구는 MCP 서버가 제공하는 가장 일반적인 리소스이며 그럴 만한 이유가 있다. 에이전트 워크플로는 기반 LLM의 능력을 확장하기 위해 도구가 필요한 경우가 많다. 도구는 필요할 때 LLM이 호출하기로 결정할 수 있는 결정론적 함수다. 숫자 계산부터 특정 위치의 날씨 조회까지 코드로 할 수 있는 모든 일을 수행할 수 있다. MCP 서버는 클라이언트가 이러한 도구를 발견하고 사용하게 한다.

Python SDK로 도구를 발견하려면 클라이언트 안에서 `self.session.list_tools()`를 호출하면 된다. 이 함수는 `tools` 속성이 있는 `response` 객체를 반환한다. `tools`에는 클라이언트에 연결된 서버가 제공한 모든 도구의 목록이 들어 있으며, 각 도구에는 `name`, `description`, `inputSchema`, `annotations`, `model_config` 속성이 있다. 현재 Tool 클래스 구조는 [MCP Python SDK의 types 모듈](https://github.com/modelcontextprotocol/python-sdk/blob/2cbc435c6cabf75b3b6a6095faad5498e8a133f3/src/mcp/types.py#L781)에서 확인할 수 있다.

기본 활용 사례에서는 `list_tools()`를 직접 호출해도 괜찮다. 그러나 기능이 서로 다른 여러 서버 및 애플리케이션에서 사용할 클라이언트를 구축한다면 보호 장치, 로깅, 사용자에게 감추고 싶은 기능을 포함한 자체 함수를 작성하는 편이 유리하다. 예를 들어 다음 함수를 구현할 수 있다.

<a id="wrap_list_tools"></a>

```python
# client.py
import logging
...
logger = logging.getLogger(__name__)

class MCPClient:
    ...
    async def get_available_tools(self) -> list[dict[str, Any]]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")

        tools_result = await self._session.list_tools()
        if not tools_result.tools:
            logger.warning("No tools found on server")
        available_tools = [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema,
            }
            for tool in tools_result.tools
        ]
        return available_tools
...
# agent.py
async def main():
    await mcp_client.connect()
    available_tools = await mcp_client.get_available_tools()
    print(f"Available tools: {", ".join([tool['name'] for tool in available_tools])}")
    while True:
        ...
```

이 메서드는 `tools/list` 요청을 감싸는 `Session` 객체의 `list_tools()` 메서드를 다시 감싼 매우 간단한 래퍼다. 단순하지만 서버 연결 상태 확인 같은 기본 보호 장치와 빈 도구 결과 확인 같은 상세 로깅을 구현하는 방법을 보여 준다. 또한 MCP 고유 도구 객체 목록을 `"name"`, `"description"`, `"input_schema"` 키가 있는 딕셔너리 목록으로 변환하여 Anthropic Messages API와 호환되게 한다. 이 패턴을 확장해 재시도를 추가하거나 MCP 도구 형식을 다른 LLM과 호환되는 형식으로 변환할 수 있다. 이 장 뒤에서 볼 또 다른 유용한 패턴은 MCP `Tool` 객체를 자체 객체로 변환하여 구조를 사용자 정의하고 다른 LLM을 지원하는 변환 함수를 구현하는 것이다. `main()` 함수에는 사용 가능한 도구 이름 목록을 만드는 리스트 컴프리헨션을 추가하고 코드가 동작하는지 확인하기 위해 출력했다.

클라이언트가 도구를 갖추었으니 무엇을 해야 할까? 당연히 사용해야 한다. `get_available_tools()` 예제처럼 `Session` 객체의 `call_tool()` 함수를 감싸고 약간의 로깅을 추가한 뒤 여러 응답 형식을 처리한다. `call_tool()`은 SDK의 콘텐츠 형식으로 이루어진 목록인 `CallToolResult`를 반환한다.

- `TextContent`: 도구 결과가 사용자에게 반환할 텍스트라면 `text` 속성에 저장된다.
- `ImageContent`: 도구 결과가 이미지라면 `ImageContent` 객체로 반환되며 이미지 데이터 자체는 `data` 속성에 Base64 인코딩 문자열로 저장된다.
- `AudioContent`: 일부 도구는 오디오 콘텐츠를 반환한다. `ImageContent`처럼 데이터는 Base64로 인코딩되어 `data` 속성에 들어 있다.
- `EmbeddedResource`: 도구는 일반적으로 추가 컨텍스트나 데이터 캐싱을 위해 응답 일부로 임베디드 리소스를 반환할 수 있다. 리소스 데이터는 `resource` 속성에 있으며, 구성 파일 리소스 등의 텍스트 콘텐츠를 나타내는 `TextResourceContents` 또는 Base64 인코딩 문자열로 된 바이너리 데이터를 나타내는 `BlobResourceContents`일 수 있다.

도구 사용 요청은 콘텐츠 목록을 반환한다는 점을 기억해야 한다. 추가 컨텍스트로 사용하는 `EmbeddedResource` 응답 같은 경우에는 이를 예상하고 알맞게 처리해야 한다. 아래 예제에서는 `call_tool()`을 감싸고 유효한 각 도구 콘텐츠 응답 형식의 문자열 표현을 반환한다.

###### 경고

활용 사례에 따라 응답 형식을 클라이언트 자체에서 처리하는 것이 바람직하지 않을 수 있다. 클라이언트를 구축할 때 사용자가 여러 콘텐츠 형식의 처리 방식을 직접 제어하기를 원하거나 그럴 필요가 있는지 고려해야 한다.

<a id="implement_use_tool"></a>

```python
# client.py
from typing import Any
from mcp.types import TextResourceContents

class MCPClient:
    ...
    async def use_tool(self, tool_name: str, arguments: dict[str, Any] | None=None) -> list[str]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")

        tool_call_result = await self._session.call_tool(name=tool_name, arguments=arguments)
        logger.debug(f"Calling tool {tool_name} with arguments {arguments}")

        results = []
        if tool_call_result.content:
            for content in tool_call_result.content:
                match content.type:
                    case "text":
                        results.append(content.text)
                    case "image" | "audio":
                        results.append(content.data)
                    case "resource":
                        if isinstance(content.resource, TextResourceContents):
                            results.append(content.resource.text)
                        else:
                            results.append(content.resource.blob)
        else:
            logger.warning(f"No content in tool call result for tool {tool_name}")
        return results
```

여기서는 `list_tools()` 메서드와 마찬가지로 먼저 클라이언트가 서버 세션에 연결되어 있는지 확인하고, 연결되지 않았으면 예외를 발생시키는 `use_tool()` 메서드를 만들었다. 이어 도구 이름과 인수를 전달해 `call_tool()`을 호출한다. 다음 행에는 어떤 도구를 호출하는지 알 수 있도록 디버그 문을 추가했다. 사용자가 여러 콘텐츠 형식의 처리 방법을 결정하게 하려면 여기서 즉시 결과를 반환할 수 있다. 이 예제에서는 `content` 목록이 비어 있지 않은지 확인한 다음 각 항목을 순회한다. 항목의 형식을 확인하여 알맞은 문자열 표현을 결과 목록에 추가한다. `content`가 비어 있으면 사용자에게 경고를 표시하고 마지막에 결과 목록을 반환한다. `list_tools()`와 마찬가지로 `call_tool()`을 감싸면 도구 호출 중 일어나는 일을 훨씬 세밀하게 제어할 수 있다.

###### 경고

MCP를 지원하는 에이전트를 구축할 때 도구를 추가하면서 도구 호출과 전체 성능을 면밀히 관찰해야 한다. 도구가 늘수록 프롬프트에 맞는 올바른 도구를 선택하기 어려워져 성능이 크게 떨어지는 경향이 있다. 도구 설명이 모호하거나 서로 겹치거나, 설명과 인터페이스를 합친 정보량이 LLM이 정확히 처리하기에 지나치게 많을 때 이런 문제가 생길 수 있다.

이 장 도입부의 간소화된 채팅 애플리케이션처럼 특정 애플리케이션용 클라이언트를 구축한다면 이러한 호출도 사용해야 한다. 도구 호출을 지원하는 여러 LLM API에는 선택적 `tools` 매개변수가 있어 사용 가능한 도구를 모델에 간단히 보낼 수 있다. 다른 모델에서는 도구 이름, 설명, 스키마 목록을 시스템 프롬프트에 포함해야 한다. 이 예제에서는 `tools` 매개변수를 받는 Anthropic Claude API에 집중한다. 이 목록은 모델로 보내는 모든 사용자 메시지에 추가되고, 호스트 애플리케이션은 결과 응답에 도구 사용이 있는지 분석한다. 도구 사용을 발견하면 애플리케이션이 `tool_result` 메시지를 구성하여 메시지 목록에 추가하고, 이 목록을 모델에 다시 보내 사용자를 위한 최종 결과를 생성한다.

<a id="make_tool_calls"></a>

```python
# agent.py
...
mcp_client = MCPClient(
    name="calculator_server_connection",
    command="uv",
    server_args=[
        "--directory",
        str(Path(__file__).parent.resolve()),
        "run",
        "calculator_server.py",
    ],
)

print("Welcome to your AI Assistant. Type 'goodbye' to quit.")

async def main():
    """Main async function to run the assistant."""
    try:
        await mcp_client.connect()
        available_tools = await mcp_client.get_available_tools()
        print(
            f"Available tools: {", ".join([tool['name'] for tool in available_tools])}"
        )

        while True:
            prompt = input("You: ")
            if prompt.lower() == "goodbye":
                print("AI Assistant: Goodbye!")
                break

            # Build conversation starting with user message
            conversation_messages = [{"role": "user", "content": prompt}]

            # Tool use loop - continue until we get a final text response
            while True:
                # Get LLM response
                current_response = anthropic_client.messages.create(
                    max_tokens=4096,
                    messages=conversation_messages,
                    model="claude-sonnet-4-0",
                    tools=available_tools,
                    tool_choice={"type": "auto"},
                )

                # Add assistant message to conversation
                conversation_messages.append(
                    {"role": "assistant", "content": current_response.content}
                )

                # Check if we need to use tools
                if current_response.stop_reason == "tool_use":
                    # Extract tool use blocks
                    tool_use_blocks = [
                        block
                        for block in current_response.content
                        if block.type == "tool_use"
                    ]

                    # Execute all tools and collect results
                    tool_results = []
                    for tool_use in tool_use_blocks:
                        print(f"Using tool: {tool_use.name}")
                        tool_result = await mcp_client.use_tool(
                            tool_name=tool_use.name, arguments=tool_use.input
                        )
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": tool_use.id,
                                "content": "\n".join(tool_result),
                            }
                        )

                    # Add tool results to conversation
                    conversation_messages.append(
                        {"role": "user", "content": tool_results}
                    )

                    continue

                else:
                    # No tools needed, extract final text response
                    text_blocks = [
                        content.text
                        for content in current_response.content
                        if hasattr(content, "text") and content.text.strip()
                    ]

                    if text_blocks:
                        print(f"Assistant: {text_blocks[0]}")
                    else:
                        print("Assistant: [No text response available]")

                    break
    finally:
        await mcp_client.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
```

이 코드에는 필요한 도구를 가져와 사용하는 여러 변경 사항이 있다. 먼저 초기화 단계에서 `get_available_tools()`를 사용해 연결된 서버의 모든 도구를 가져온다. 그런 다음 `Tool` 객체 목록을 일반 딕셔너리 목록으로 변환하여 모델에 올바르게 전달한다. 도구 목록을 한 번만 가져오도록 모듈 최상단에서 처리한다. 연결 중인 서버가 제공 도구를 변경할 수 있다고 예상한다면 모델에 사용자 입력을 보낼 때마다 새 도구 목록을 가져오거나, 클라이언트가 서버의 `list_changed` 알림을 수신해 처리하도록 해야 한다.

다음으로 모델용 사용자 메시지를 만드는 코드를 수정하여 도구 목록을 `tools` 매개변수에 전달하고, `tool_choice`를 `"type"` 키가 `"auto"`로 설정된 딕셔너리로 지정했다. `auto`는 기본 설정이며 사용자의 질의에 답할 도구를 모델이 직접 결정하게 하므로 명시하지 않아도 된다. `"any"`로 설정하면 사용 가능한 도구 중 하나 이상을 사용한다. 도구 이름과 `"tool"` 형식을 지정하면 특정 도구 사용을 강제하고, `"none"`으로 설정하면 사용 가능한 도구를 사용하지 못하게 할 수 있다.

그런 다음 결과를 검사하고 모델에 돌려보낼 수 있는 도구 사용 메시지를 초기화한다. 메시지 응답의 `stop_reason`이 `tool_use`라면 모델이 요청한 도구의 결과가 담긴 응답을 기다리고 있다는 뜻이다. 응답 콘텐츠에서 도구 사용 메시지 블록을 만들고 루프에서 각 도구를 실행한다. 결과로 `type` 키는 `"tool_use"`, `tool_use_id`는 모델의 도구 사용 메시지 응답 ID, `content`는 도구 호출 결과로 설정한 딕셔너리를 만든다. 이들을 모두 `conversation_messages` 목록에 추가한다. 모든 도구를 호출한 뒤 결과와 원래 사용자 질문을 LLM에 보내 평가한다. 사용자에게 응답하기 전에 여러 도구를 호출할 수도 있으므로, 예를 들어 모델에 5 × 3 + 7을 묻는 경우처럼, 이 전체 과정을 while 루프로 감싼다.

도구 사용 메시지에 도구 호출 응답이 없다면 도구가 필요하지 않았거나 도구 사용 단계가 끝난 것이다. 어느 경우든 최신 응답에서 텍스트 블록을 추출해 사용할 수 있으면 출력한다. 마지막으로 사용자가 애플리케이션을 종료할 때 올바른 범위에서 연결이 해제되도록 전체를 try/finally 블록으로 감싼다.

이 절에서는 MCP 서버 제공 도구, 서버에서 도구를 발견하고 사용하는 방법, 채팅 애플리케이션 맥락에서 도구를 사용하는 방법을 배웠다. 다음 절에서는 리소스와 방금 도구에 적용한 방식으로 리소스를 애플리케이션에서 사용하는 방법을 배운다.

<a id="id61"></a>

### 리소스

2장에서 배웠듯 MCP 리소스는 프롬프트 크기를 최적화하는 캐시처럼 커뮤니티도 아직 충분히 탐구하지 않은 역할을 포함해 다양한 역할을 할 수 있다. 기본적으로 리소스는 호스트 애플리케이션과 그 애플리케이션이 상호 작용하는 LLM에 MCP 서버가 제공하는 데이터 접근 권한을 준다. 데이터베이스 레코드, 이미지, 텍스트 파일 등이 될 수 있다. 리소스에는 다음과 같은 작업을 수행할 수 있다.

- **`resources/list` 또는 `list_resources()`**: 서버에 사용 가능한 리소스 목록을 요청한다.
- **`resources/templates/list` 또는 `list_resource_templates()`**: 서버에 리소스 URI 템플릿 목록을 요청한다. 보유한 다른 정보를 바탕으로 리소스 URI를 동적으로 구성할 수 있다. Python SDK에서 이 문자열은 f-string처럼 보이며 변수 부분이 중괄호로 둘러싸여 있다.
- **`resources/read` 또는 `read_resource()`**: 서버가 제공하는 파일에 접근하여 텍스트 또는 blob 형식의 데이터를 LLM에 보낸다.
- **`resources/subscribe` 또는 `subscribe_resource()`**: 호출에서 지정한 리소스 URI의 업데이트를 클라이언트가 구독한다.
- **`resources/unsubscribe` 또는 `unsubscribe_resource()`**: 매개변수의 리소스 URI로 지정한 리소스 업데이트 구독을 해제한다.

###### 참고

MCP 리소스를 효율적인 프롬프팅용 캐시로 사용하는 최소 클라이언트 구현은 Tim Kellogg의 [tupac](https://github.com/tkellogg/tupac/) 프로젝트를 참조한다.

먼저 두 목록 메서드의 래퍼를 구현한다. 앞 절에서 `get_available_tools()`에 정립한 패턴을 이어 간다. 몇 가지 기본 보호 장치와 로깅을 갖춘 가벼운 래퍼로, 더 복잡한 워크플로의 기반으로 사용할 수 있다.

<a id="wrap_list_resources"></a>

```py
# client.py
from mcp.types import Resource, ResourceTemplate

class MCPClient:
    ...
    async def get_available_resources(self) -> list[Resource]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")

        resources_result = await self._session.list_resources()
        if not resources_result.resources:
            logger.warning("No resources found on server")
        return resources_result.resources

    async def get_available_resource_templates(self) -> list[ResourceTemplate]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")

        resource_templates_result = await self._session.list_resource_templates()
        if not resource_templates_result.resources:
            logger.warning("No resource templates found on server")
        return resource_templates_result.resources
```

두 메서드는 서로 거의 같고 `get_available_tools()` 메서드와도 거의 같다. 각 함수는 서버에 요청하기 전에 연결을 확인하고, 알맞은 목록 메서드를 호출한 다음 결과를 확인해 반환하며, 결과가 비어 있으면 경고한다. `list_tools()` 메서드와 마찬가지로 두 목록 메서드 모두 페이지네이션을 위한 선택적 커서 매개변수를 받는다. 다음 프롬프트 절에서도 이 패턴을 다시 보게 된다. 목록 메서드 래퍼의 기능을 확장하면서 코드를 더 간결하게 만드는 방법을 생각해 보자.

###### 참고

리소스와 리소스 템플릿은 `uri`, `name`, `description`, `mimeType`, `size`, `annotations`, `model_config`라는 거의 동일한 속성 집합을 갖는다. 리소스 템플릿에는 `uri` 대신 `uriTemplate` 속성이 있다.

다음에는 `read_resource()` 세션 메서드의 래퍼를 구현하고 이전 예제의 패턴에 따라 `use_resource()`라고 부른다. 이 코드는 리소스 URI 또는 리소스 템플릿에서 값을 채운 URI를 받아 리소스를 읽은 뒤 텍스트 문자열이나 Base64 인코딩 데이터 문자열로 호출자에게 반환한다.

<a id="get_resource"></a>

```py
# client.py
from mcp.types import BlobResourceContents, TextResourceContents

class MCPClient:
    ...
    async def get_resource(self, uri: str) -> list[BlobResourceContents | TextResourceContents]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")
        resource_read_result = await self._session.read_resource(uri=uri)

        if not resource_read_result.contents:
            logger.warning(f"No content read for resource URI {uri}")
        return resource_read_result.contents
```

이 메서드에는 이제 표준이 된 연결 보호 장치와 빈 결과 경고만 추가하면 된다. `get_available_tools()`와 비슷하게 MCP의 `BlobResourceContents`와 `TextResourceContents` 클래스를 변환하지 않고 그대로 사용자에게 반환한다. 반환되는 문자열 형식에 관한 유용한 정보를 제공하며, 예제 모음의 최소 처리 원칙에도 부합하기 때문이다.

MCP 프로토콜은 클라이언트가 리소스 변경 알림을 구독하는 것도 허용한다. 그러나 이 글을 쓰는 시점에는 Python SDK에 알림 처리가 일부만 구현되어 있으며 알림을 처리 함수로 라우팅하거나 핸들러를 등록하는 방법이 제공되지 않는다. TypeScript SDK에서는 가능한 것으로 보인다. ClientSession 클래스에 메시지 핸들러 콜백이 있지만 요청, 응답, 알림을 포함한 모든 수신 메시지를 처리한다.

지금까지 사용 가능한 리소스 및 리소스 템플릿 목록을 가져오고, 리소스 URI가 있을 때 해당 리소스를 읽는 방법을 배웠다. 그렇다면 호스트 애플리케이션에서는 어떻게 사용할까? 리소스는 주로 사용자 질의에 추가 컨텍스트를 제공하기 위해 존재한다. 예를 들어 사용자의 스크립트 관련 질의에 Bash 스크립트를 추가할 수 있다. 이를 직접 확인하기 위해 장 도입부의 최소 호스트 챗봇 애플리케이션을 다시 사용한다. 이번에는 사용자 프롬프트에서 `context:` 키를 찾아 모델 요청의 컨텍스트로 사용한다. 애플리케이션이 시작될 때와 사용자가 `refresh` 명령을 입력할 때마다 서버의 현재 리소스 목록을 가져와 표시한다. 사용자 프롬프트에서 `context:`를 발견하면 그 뒤의 내용을 사용해 특정 리소스를 선택하고 원래 사용자 질문의 컨텍스트로 추가한다.

[GitHub 저장소](https://github.com/kylestratis/ai_agents_mcp_examples)의 코드를 따라 실습한다면 다음 예제 코드가 `client.py`와 `agent.py` 두 파일로 나뉜 것을 볼 수 있다. 코드 복잡도를 낮추고 가독성을 높이기 위해서다. 다음 코드 예제는 이제 `Agent` 클래스를 포함하는 `agent.py`로 시작한다. 이 클래스는 이전 `main()` 함수를 `run()`으로 포함하고 리소스 처리용 유틸리티 함수도 몇 개 포함한다. `extract_resource_name()`은 사용자 프롬프트에서 리소스 이름을 추출하고, `display_resources()`는 사용 가능한 리소스 이름과 설명을 사용자에게 출력하며, `refresh_resources()`는 사용 가능한 리소스를 새로 고쳐 딕셔너리로 반환한다.

<a id="use_resource"></a>

```python
# agent.py
...
class Agent:
    def __init__(self, mcp_client: MCPClient, anthropic_client: Anthropic):
        self.mcp_client = mcp_client
        self.anthropic_client = anthropic_client
        self.available_resources = {}

    async def _select_resources(self, prompt: str) -> list[str]:
        """Use LLM to intelligently select relevant resources."""
        if not self.available_resources:
            return []

        resource_descriptions = {
            name: resource.description or f"Resource: {name}"
            for name, resource in self.available_resources.items()
        }

        selection_prompt = f"""
Given this user question: "{prompt}"

And these available resources:
{json.dumps(resource_descriptions, indent=2)}

Which resources (if any) would be helpful to answer the user's question?
Return a JSON array of resource names, or an empty array if no resources are needed.
Only include resources that are directly relevant.

Example: ["math-constants"] or []
"""

        try:
            response = self.anthropic_client.messages.create(
                max_tokens=200,
                messages=[{"role": "user", "content": selection_prompt}],
                model="claude-sonnet-4-0",
            )

            response_text = response.content[0].text.strip()
            # Extract JSON from response (handle case where LLM adds explanation)
            if "[" in response_text and "]" in response_text:
                start = response_text.find("[")
                end = response_text.rfind("]") + 1
                json_part = response_text[start:end]
                selected_resources = json.loads(json_part)
                return [r for r in selected_resources if r in self.available_resources]

        except Exception as e:
            logger.warning(f"Failed to select resources with LLM: {e}")

        return []

    async def _load_selected_resources(
        self, resource_names: list[str]
    ) -> list[dict[str, Any]]:
        """Load the specified resources."""
        context_messages = []

        for resource_name in resource_names:
            if resource_name in self.available_resources:
                print(f"LLM selected resource: {resource_name}")
                try:
                    resource = self.available_resources[resource_name]
                    resource_contents = await self.mcp_client.get_resource(
                        uri=resource.uri
                    )
                    for content in resource_contents:
                        if isinstance(content, TextResourceContents):
                            context_messages.append(
                                {
                                    "type": "text",
                                    "text": f"[Resource: {resource_name}]\n{content.text}",
                                }
                            )
                        elif content.mimeType in [
                            "image/jpeg",
                            "image/png",
                            "image/gif",
                            "image/webp",
                        ]:  # b64-encoded image
                            context_messages.append(
                                {
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": content.mimeType,
                                        "data": content.blob,
                                    },
                                }
                            )
                        else:
                            print(
                                f"WARNING: Unable to process mimeType {resource_contents.mimeType} for resource {resource_name}"
                            )
                except Exception as e:
                    print(f"Error loading resource {resource_name}: {e}")

        return context_messages

    async def _refresh_resources(self) -> None:
        available_resources = await self.mcp_client.get_available_resources()
        self.available_resources = {
            resource.name: resource for resource in available_resources
        }

    async def run(self):
        try:
            print(
                "Welcome to your AI Assistant. Type 'goodbye' to quit or 'refresh' to reload and redisplay available resources."
            )
            await self.mcp_client.connect()
            available_tools = await self.mcp_client.get_available_tools()
            await self._refresh_resources()

            while True:
                prompt = input("You: ")

                if prompt.lower() == "goodbye":
                    print("AI Assistant: Goodbye!")
                    break

                if prompt.lower() == "refresh":
                    await self._refresh_resources()
                    continue

                selected_resource_names = await self._select_resources(prompt)
                context_messages = await self._load_selected_resources(
                    selected_resource_names
                )

                # Build conversation with initial user message and any context
                user_content = [{"type": "text", "text": prompt}]
                if context_messages:
                    user_content.extend(context_messages)

                conversation_messages = [{"role": "user", "content": user_content}]

                # Tool use loop - continue until we get a final text response
                while True:
                    # Get LLM response
                    current_response = anthropic_client.messages.create(
                        max_tokens=4096,
                        messages=conversation_messages,
                        model="claude-sonnet-4-0",
                        tools=available_tools,
                        tool_choice={"type": "auto"},
                    )

                    # Add assistant message to conversation
                    conversation_messages.append(
                        {"role": "assistant", "content": current_response.content}
                    )

                    # Check if we need to use tools
                    if current_response.stop_reason == "tool_use":
                        # Extract tool use blocks
                        tool_use_blocks = [
                            block
                            for block in current_response.content
                            if block.type == "tool_use"
                        ]

                        print(f"Executing {len(tool_use_blocks)} tool(s)...")

                        # Execute all tools and collect results
                        tool_results = []
                        for tool_use in tool_use_blocks:
                            print(f"Using tool: {tool_use.name}")
                            tool_result = await self.mcp_client.use_tool(
                                tool_name=tool_use.name, arguments=tool_use.input
                            )
                            tool_results.append(
                                {
                                    "type": "tool_result",
                                    "tool_use_id": tool_use.id,
                                    "content": "\n".join(tool_result),
                                }
                            )

                        # Add tool results to conversation
                        conversation_messages.append(
                            {"role": "user", "content": tool_results}
                        )

                        # Continue loop to get next LLM response
                        continue

                    else:
                        # No tools needed, extract final text response
                        text_blocks = [
                            content.text
                            for content in current_response.content
                            if hasattr(content, "text") and content.text.strip()
                        ]

                        if text_blocks:
                            print(f"Assistant: {text_blocks[0]}")
                        else:
                            print("Assistant: [No text response available]")

                        # Exit the tool use loop
                        break
        finally:
            await self.mcp_client.disconnect()


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
    )
    agent = Agent(mcp_client, anthropic_client)
    asyncio.run(agent.run())
```

이 통합은 도구 절에서 수행한 통합과 같은 방식으로 시작한다. 클라이언트를 통해 MCP 서버에 연결하고, 이 경우 리소스인 사용 가능한 프리미티브를 발견한 다음, 해당 프리미티브를 메모리에 불러온다. 에이전트에 다음 세 유틸리티 함수를 추가했다.

- `_select_resources()`: 사용 가능한 리소스의 이름-설명 딕셔너리를 만든 다음, 사용자 프롬프트를 바탕으로 관련 리소스를 LLM이 선택하게 한다.
- `_load_selected_resources()`: `_select_resources()`가 반환한 리소스 이름 목록을 받아 유효한 이름에 대해 클라이언트로 리소스 콘텐츠를 가져온다. 콘텐츠가 텍스트면 텍스트 콘텐츠 블록을 만든다. blob이면 `mimeType`이 Anthropic 모델 API가 지원하는 이미지 형식과 일치하는지 확인하고, 일치하면 해당 데이터로 콘텐츠 블록을 구성하여 호출자에게 돌려보낼 최종 메시지 목록에 추가한다.
- `_refresh_resources()`: 사용 가능한 리소스를 새로 고치고 Agent 객체의 `available_resources` 딕셔너리에 저장한다.

`run()` 함수에서는 `refresh`라는 단어만 담은 메시지를 입력하면 리소스 목록을 새로 고친다는 내용을 환영 메시지에 추가했다. 이어 `refresh()` 메서드 결과로 리소스 목록을 채운다. 사용자가 프롬프트를 입력하면 `_select_resources()`를 사용해 LLM이 사용자 프롬프트와 관련된 리소스를 선택하게 한다. 그런 다음 `_load_selected_resources()`를 호출해 이름이 지정된 리소스를 `context_messages` 목록에 추가한다. 컨텍스트 메시지는 LLM에 추가 컨텍스트를 제공하며 사용자 프롬프트와 한 목록으로 묶는다. 이 사용자 프롬프트와 선택한 리소스 목록을 LLM에 보내면 모델은 필요할 때 리소스 콘텐츠를 사용해 사용자의 프롬프트에 답할 수 있다.

###### 참고

사용자 프롬프트에 컨텍스트를 추가할 때는 사용자 프롬프트처럼 별도의 사용자 메시지를 만들면 안 된다. 대신 사용자 메시지를 `type` 키와 `content` 키를 가진 중첩 딕셔너리인 완전한 형식으로 변환해야 한다. `content` 키에는 딕셔너리 목록이 들어 있으며 이 목록에 컨텍스트 메시지를 추가한다.

이 예제에는 여러 개선점을 적용할 수 있다. 지식을 확장하는 연습으로 일반 리소스와 함께 리소스 템플릿을 나열하고 사용하는 기능을 구현해 보자. 그런 다음 일반 텍스트 파싱이나 추가 LLM 호출을 사용해 하나가 아닌 여러 컨텍스트 파일을 지원해 보자. 정리할 부분도 있다. 현재 애플리케이션은 사용자 질의에 가장 적합한 리소스를 선택하기 위해 각 사용자 입력마다 비용이 많이 들 수 있는 LLM 호출을 한 번 더 수행한다. 어떻게 하면 더 효율적으로 만들 수 있을까?

###### 참고

눈치챘겠지만 이러한 개선점 중 다수는 생성형 AI에만 국한되지 않은 일반적인 소프트웨어 공학 모범 사례다. AI 공학이 독자적인 분야로 발전하고 있지만 핵심은 여전히 소프트웨어 공학이다. 따라서 소프트웨어 엔지니어로서 보유한 실무 방식과 도구는 AI를 위한 개발에도 큰 도움이 된다.

<a id="id62"></a>

### 프롬프트

프롬프트는 MCP 서버가 제공하는 세 가지 주요 프리미티브 중 마지막이다. 프롬프트는 애플리케이션 사용자가 제어하도록 설계되며, 앞 절의 호스트 애플리케이션 예제와 비슷하게 사용자가 원하는 프롬프트를 선택할 수 있어야 한다. 각 프롬프트 정의에는 고유 식별자인 `name`, 선택적이며 사람이 읽을 수 있는 `description`, 선택적 `arguments`가 있다. `arguments`는 `name`, 선택적이며 사람이 읽을 수 있는 `description`, 인수가 필수인지 나타내는 선택적 불리언 `required`를 포함한 딕셔너리 목록이다. 각 인수에 값을 주입하는 일은 프롬프트를 사용하는 클라이언트 구현이나 호스트 애플리케이션이 담당한다. 이를 **동적 프롬프트(dynamic prompts)**라고 한다.

Python SDK는 프롬프트 처리를 단순화한다. `Session` 클래스의 `list_prompts()` 메서드는 앞 단락에 나열한 프롬프트 정의 속성을 가진 `Prompt` 객체 목록을 반환한다. `get_prompt()`로 특정 프롬프트를 가져올 때 이름과 인수를 제공하면 일반 딕셔너리로 변환해 LLM에 직접 보낼 수 있는 즉시 사용 가능한 `PromptMessage` 객체 목록을 받는다. 앞 절의 호스트 통합 예제에서 LLM으로 보내는 메시지 구조를 자세히 살펴보자. 메시지는 `role`과 `content` 키가 있는 딕셔너리이며, 이 두 가지가 `PromptMessage` 객체의 필수 속성이다. 콘텐츠 자체는 `TextContent`, `ImageContent`, `AudioContent`, `EmbeddedResource`가 될 수 있다. 임베디드 리소스는 이름 그대로 메시지 콘텐츠 블록에 삽입된 리소스이며, 앞 절에서 구축한 호스트 애플리케이션 예제와 같다.

앞 두 절의 패턴을 이어 두 메서드를 자체 클라이언트로 감싸 보자.

<a id="get_available_prompts"></a>

```py
# client.py
from mcp.types import Prompt

class MCPClient:
    ...
    async def get_available_prompts(self) -> list[Prompt]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")

        prompt_result = await self._session.list_prompts()
        if not prompt_result.prompts:
            logger.warning("No prompts found on server")
        return prompt_result.prompts
```

이 패턴은 앞에서 이미 본 내용이므로 설명할 것이 많지 않다. 연결 확인을 설정하고 프롬프트 목록을 가져온 뒤 결과 목록이 비어 있지 않은지 확인하고 사용자에게 반환한다. `get_prompt()` 래퍼도 매우 익숙할 것이다. 사용자에게서 프롬프트 이름과 인수를 받고, 제공된 인수로 서버에서 프롬프트를 불러온 다음 MCP `PromptMessage` 객체를 애플리케이션에 반환한다.

<a id="load_prompt"></a>

```py
# client.py
from mcp.types import PromptMessage

class MCPClient:
    ...
    async def load_prompt(self, name: str, arguments: dict[str, str]) -> list[PromptMessage]:
        if not self._connected:
            raise RuntimeError("Client not connected to a server")
        prompt_load_result = await self._session.get_prompt(name=name, arguments=arguments)

        if not prompt_load_result.messages:
            logger.warning(f"No prompt found for prompt {name}")
        else:
            logger.warning(f"Loaded prompt {name} with description {prompt_load_result.description}")
        return prompt_load_result.messages
```

앞 절에서 리소스를 가져온 방식과 다시 한번 비슷하다. 표준 보호 장치를 두고 `name`과 `arguments`를 변경하지 않은 채 세션의 `get_prompt()` 메서드에 전달하며 로깅을 추가한다.

###### 참고

리소스와 도구처럼 사용 가능한 프롬프트 목록이 변경되었을 때 알림을 보내는 기능도 프로토콜이 지원한다. 안타깝게도 클라이언트가 구독할 수는 있어도 서버의 알림을 처리하고 수신 대기하는 사용자용 API는 없다. 사용하려면 콜백 라우팅을 직접 처리해야 한다. SDK 소스 코드에는 `Session._received_request()`에서 샘플링 콜백을 라우팅하는 방식 등 참고할 예제가 있다([소스 코드](https://github.com/modelcontextprotocol/python-sdk/blob/29c69e6a47d0104d0afcea6ac35e7ab02fde809a/src/mcp/client/session.py#L373)). 모든 메시지를 처리하는 새 함수를 만들어 클라이언트 생성자의 `message_handler` 매개변수에 전달할 수도 있다. 모든 메시지를 처리해야 하지만 알림 처리 로직도 구축할 수 있다.

다른 프리미티브와 마찬가지로 프롬프트를 애플리케이션에 통합하는 방법은 상상하는 것 이상으로 다양하다. 애플리케이션에서 사용 가능한 프롬프트 기능을 활용하는 방법을 보여 주기 위해 앞의 두 예제와 같은 기반 애플리케이션을 사용한다. 서버 및 프롬프트 프리미티브의 사용법이 과도한 애플리케이션 로직에 가려지지 않고 명확하게 드러난다. 리소스 절과 비슷한 사용자 상호 작용 패턴도 사용한다. 애플리케이션이 사용 가능한 프리미티브, 여기서는 프롬프트 목록을 가져와 사용자에게 표시하고, 사용자가 입력에서 사용할 프롬프트를 선택하게 한다. 선택한 프롬프트만 그대로 LLM에 보내고 애플리케이션이 응답을 처리해 표시한다.

<a id="use_prompt"></a>

```py
# agent.py
class Agent:
    def __init__(self, mcp_client: MCPClient, anthropic_client: Anthropic):
        self.mcp_client = mcp_client
        self.anthropic_client = anthropic_client
        self.available_resources = {}
        self.available_prompts = {}

    async def _select_resources(self, user_query: str) -> list[str]:
        """Use LLM to intelligently select relevant resources."""
        ...

    async def _select_prompts(self, user_query: str) -> list[dict[str, Any]]:
        """Use LLM to intelligently select relevant prompts."""
        if not self.available_prompts:
            return []

        prompts = [
            prompt.model_dump_json() for prompt in self.available_prompts.values()
        ]

        selection_prompt = f"""
Given this user question: "{user_query}"

And these available prompt templates:
{json.dumps(prompts, indent=2)}

Which prompts (if any) would provide helpful instructions or guidance for answering this question?
Return a JSON array of prompt objects which have a name (string) and arguments (objects where the
keys are the named parameter name and value is the argument value), or an empty array if no prompts
are needed. Only include prompts that are directly relevant.

Example: [{{"name": "calculation-helper", "arguments": {{"operation": "addition"}}]}},
 {{"name": "step-by-step-math", "arguments": {{}}}}] or []
"""

        try:
            response = self.anthropic_client.messages.create(
                max_tokens=200,
                messages=[{"role": "user", "content": selection_prompt}],
                model="claude-sonnet-4-0",
            )

            response_text = response.content[0].text.strip()
            if "[" in response_text and "]" in response_text:
                start = response_text.find("[")
                end = response_text.rfind("]") + 1
                json_part = response_text[start:end]
                selected_prompts = json.loads(json_part)
                return [
                    p for p in selected_prompts if p["name"] in self.available_prompts
                ]

        except Exception as e:
            logger.warning(f"Failed to select prompts with LLM: {e}")

        return []

    async def _load_selected_resources(
        self, resource_names: list[str]
    ) -> list[dict[str, Any]]:
        ...

    async def _load_selected_prompts(self, prompts: list[dict[str, Any]]) -> str:
        """Load the specified prompts as system instructions."""
        system_instructions = []

        for prompt in prompts:
            if prompt["name"] in self.available_prompts:
                print(f"Using prompt: {prompt['name']}")
                try:
                    prompt_content = await self.mcp_client.load_prompt(
                        name=prompt["name"], arguments=prompt["arguments"]
                    )

                    # Extract the prompt text
                    prompt_text = ""
                    for message in prompt_content:
                        if hasattr(message.content, "text"):
                            prompt_text += message.content.text + "\n"
                        elif isinstance(message.content, str):
                            prompt_text += message.content + "\n"

                    if prompt_text.strip():
                        system_instructions.append(
                            f"[Prompt: {prompt['name']}]\n{prompt_text.strip()}"
                        )

                except Exception as e:
                    print(f"Error loading prompt {prompt['name']}: {e}")

        return "\n\n".join(system_instructions)

    async def _refresh(self) -> None:
        available_resources = await self.mcp_client.get_available_resources()
        self.available_resources = {
            resource.name: resource for resource in available_resources
        }
        available_prompts = await self.mcp_client.get_available_prompts()
        self.available_prompts = {prompt.name: prompt for prompt in available_prompts}

    async def run(self):
        try:
            print(
                "Welcome to your AI Assistant. Type 'goodbye' to quit or 'refresh' to reload and redisplay available resources."
            )
            await self.mcp_client.connect()
            available_tools = await self.mcp_client.get_available_tools()
            await self._refresh()

            print(
                f"Loaded {len(self.available_resources)} resources and {len(self.available_prompts)} prompts"
            )

            while True:
                prompt = input("You: ")

                if prompt.lower() == "goodbye":
                    print("AI Assistant: Goodbye!")
                    break

                if prompt.lower() == "refresh":
                    await self._refresh()
                    continue

                # Select relevant resources and prompts
                selected_resource_names = await self._select_resources(prompt)
                selected_prompt_names = await self._select_prompts(prompt)

                # Load relevant resources and prompts
                context_messages = await self._load_selected_resources(
                    selected_resource_names
                )
                system_instructions = await self._load_selected_prompts(
                    selected_prompt_names
                )

                # Build conversation with initial user message and any context
                user_content = [{"type": "text", "text": prompt}]
                if context_messages:
                    user_content.extend(context_messages)

                conversation_messages = [{"role": "user", "content": user_content}]

                # Tool use loop - continue until we get a final text response
                while True:
                    create_message_args = {
                        "max_tokens": 4096,
                        "messages": conversation_messages,
                        "model": "claude-sonnet-4-0",
                        "tools": available_tools,
                        "tool_choice": {"type": "auto"},
                    }

                    if system_instructions:
                        create_message_args["system"] = system_instructions

                    current_response = self.anthropic_client.messages.create(
                        **create_message_args
                    )

                    # Add assistant message to conversation
                    conversation_messages.append(
                        {"role": "assistant", "content": current_response.content}
                    )

                    # Check if we need to use tools
                    if current_response.stop_reason == "tool_use":
                        # Extract tool use blocks
                        tool_use_blocks = [
                            block
                            for block in current_response.content
                            if block.type == "tool_use"
                        ]

                        # Execute all tools and collect results
                        tool_results = []
                        for tool_use in tool_use_blocks:
                            print(f"Using tool: {tool_use.name}")
                            tool_result = await self.mcp_client.use_tool(
                                tool_name=tool_use.name, arguments=tool_use.input
                            )
                            tool_results.append(
                                {
                                    "type": "tool_result",
                                    "tool_use_id": tool_use.id,
                                    "content": "\n".join(tool_result),
                                }
                            )

                        # Add tool results to conversation
                        conversation_messages.append(
                            {"role": "user", "content": tool_results}
                        )

                        # Continue loop to get next LLM response
                        continue

                    else:
                        # No tools needed, extract final text response
                        text_blocks = [
                            content.text
                            for content in current_response.content
                            if hasattr(content, "text") and content.text.strip()
                        ]

                        if text_blocks:
                            print(f"Assistant: {text_blocks[0]}")
                        else:
                            print("Assistant: [No text response available]")

                        # Exit the tool use loop
                        break
        finally:
            await self.mcp_client.disconnect()
...
```

이 코드 버전은 예제 도입부에서 설정한 모든 작업을 수행한다. 주 루프부터 보면 먼저 클라이언트에 구축한 `get_available_prompts()` 메서드를 호출하는 `_refresh_()` 함수를 호출한다. 리소스 예제와 비슷한 딕셔너리로 `available_prompts` 속성을 채우며, 키는 프롬프트 이름이고 값은 프롬프트 객체다. 에이전트 루프에서는 리소스 절과 마찬가지로 `_select_prompts()`를 호출해 LLM이 사용자 질의에 가장 관련 있는 프롬프트를 선택하게 하되 몇 가지 차이가 있다. 먼저 `model_dump_json()`으로 `Prompt` 객체를 JSON 문자열로 덤프한다. 선택 프롬프트가 설명과 인수를 포함한 전체 프롬프트 객체를 이용해 가장 적합한 프롬프트를 판단할 수 있다. 이어 `_load_selected_prompts()`를 호출해 환각으로 만들어 낸 프롬프트를 걸러내고, 남은 프롬프트를 클라이언트를 통해 가져와 시스템 프롬프트 형식으로 변환한다.

이 예제에서는 LLM을 호출하기 전에 메시지 인수 딕셔너리를 만든 다음, 불러온 프롬프트가 있으면 `system` 인수 키로 인수에 추가한다. 이어 Anthropic의 `create()` 호출에서 이 인수들을 펼쳐 전달한다. 에이전트의 나머지 부분은 동일하다.
