---
title: 'Chapter 6. Building MCP Servers: Advanced Use with Utilities and Integrating Client Capabilities'
author: Kyle Stratis
layout: post
permalink: /AI_Agent_with_MCP/chapter_6.html
lang: en
book_order: 6
---
<a id="ch06"></a>

# Chapter 6. Building MCP Servers: Advanced Use with Utilities and Integrating Client Capabilities

If the last chapter set your foundation for building MCP servers that serve up the MCP primitives, this chapter will build the doors, walls, and roof of your servers. The first set of tools are the MCP server utilities. These are tools that are built into the MCP specification and into all of the MCP SDKs that supercharge your MCP servers. They allow you to do things like provide autocompletion suggestions to your users, access a world of information about both the current session and the current request being made, send logs to the client, paginate your responses, and even get progress notifications from your MCP server to your users. The next set are the client-provided resources. These are additional capabilities that your MCP server can use to augment its functionality. These include *elicitations*, which allow your server to request information from the user, *sampling*, which allows your server to directly use the host application’s language model through the MCP client, and *roots*, which helps identify the boundaries of the files and directories on the host application’s filesystem that your server has access to.

Together, these utilities and resources will not only allow you to implement additional functionality in your MCP servers, but also allow you to build and serve far more complex tools, prompts, and resources than you could before.

<a id="id89"></a>

# Server Utilities: Completion, Logging, Notifications, and Pagination

Server utilities are a part of the MCP specification and serve to make your life as an MCP server developer, as well as the lives of the client developers that use your server, easier. The major utilities are completions, the context object, logging, pagination, and progress notifications. Completions provide autocompletion suggestions to users via the client, such as for filling out prompts and resource templates, among other things. Strictly speaking, the context object is not a server utility designed in the specification, but a convenience object provided by the Python MCP SDK, but it allows you to access information about the server instance, the current session, the current request, and do actions like logging, sending progress reports, reading resources, and more. Logging is a server utility, but these logs aren’t sent to a place like stderr or a file local to the server. Instead, they are sent to the client to store, use, or ignore. Then we have pagination, which allows you to return a subset of a response to the client, using a token to allow the client or user to request the next subset. Finally, progress notifications allow you to send the current progress of an operation to the client, which would allow it to display this progress to the user.

All of these utilities can futher extend the functionality of your MCP server or make its operation and use more robust and reliable.

<a id="id90"></a>

## Completions

The first of the server utilities is *completions*. Completions are inspired by code completion in IDEs, and so allow servers to provide autocompletion capabilities when clients request it of them, but are limited to suggestions for prompts and resource templates that are provided by the server. This means that if you provide a prompt or resource template, you can provide suggestions to fill in the prompt or the template, either from previous user inputs or with defaults that you set. In the former case, your completion handler function can receive previous arguments that were used by the user to fill in the prompt or resource template via a context object of type `CompletionContext`. The handler function is decorated with the `@mcp.completion()` decorator and takes the following arguments:

- **`ref`**: A `PromptReference` or `ResourceTemplateReference` object that points to the prompt or resource template that the completion is for. The `PromptReference` holds the prompt’s name, while the `ResourceTemplateReference` holds the resource template’s URI.
- **`argument`**: A `CompletionArgument` object with the `name` of the argument and its `value`, which is a partial string to be completed by the function handler.
- **`context`**: Optional. A `CompletionContext` object with an `arguments` dictionary where the key and string are defined by the client.

Your handler will return a `Completion` object that has the following properties:

- **`values`**: A list of strings representing potential values for the argument to be completed. Can not have more than 100 values.
- **`total`**: Optional. The number of completions available. This number has no limit, even if the number of values able to be sent does.
- **`hasMore`**: Optional. A boolean that indicates whether more completions are available than are being returned. This can be used with or instead of `total` for cases where the universe of possible completions is too large to enumerate.

As a server developer, you have the power to define how you will actually complete the arguments sent to you if you choose to support completions. Let’s take a look at a simple example that returns a full `Completion` object for both prompts and resource templates ([Example 6-1](#completions)).

<a id="completions"></a>

##### Example 6-1. A completion handler that returns autocompletion suggestions for both prompts and resource templates.

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

In this server code, you’ll probably notice two familiar functions: `resource_template()` and `simple_prompt_input()`. These are the same functions that you saw in [Example 5-6](chapter_5.html#resource_template) and [Example 5-1](chapter_5.html#simple_prompt), from [Chapter 5](chapter_5.html#ch05). These functions are registered as resource templates and prompts, respectively, and the next function, `completion_handler()` will handle autocomplete suggestions for both. First, we need to decorate `completion_handler()` with `@mcp.completion()` in order to register it as a completion handler. The function needs to take the arguments that we talked about earlier: `ref` for the prompt name or resource template URI, `argument` for the user’s input, and `context` for any previous arguments that were used to fill in the prompt or resource template, and will return a `Completion` object.

The first thing we’ll do is set up is a default empty `Completion` and some default suggestions for the prompt and resource template that the server supports. Then we will check if the incoming completion request is for a prompt or resource template by checking the type of the `ref` argument with `isinstance()`. Then, if it is a prompt, we will check if the prompt name matches our prompt, and if it is a resource template, we will check if the URI matches our own resource template. If it does, we then construct a list of suggestions based on the the default suggests and the current `argument` value, which typically represents what the user has typed so far. We make use of a list comprehension and just check that the `argument` is a substring of any of the default suggestions. Then we check to see if there are any previous argumements that were used to fill in the prompt or resource template by checking the `context`’s `arguments` dictionary. If there are, we extend the list of suggestions using the same logic to include any matching previously used arguments.

At the end, we create a `Completion` object with the final `suggested` list, total number of suggestions in the final list, and `False` indicating that there are no more suggestions available. Because of how simple this example is, we do not check, for instance, to see whether the final list of suggestions has more than 100, which would necessitate truncating the suggestions list and setting the `hasMore` flag to `True`. In a production-ready system, you should code defensively against this outcome.

In Figure 6-1, you can see the completion message lifecycle. As a user types a prompt or resource template argument, the client sends completion requests to the server. For each sent request, the server responds with a list of suggestions, which is expected to be pared down as the user types more. This continues until the user is finished typing or selects an argument. It is up to the client implementation how rapidly it will send completion requests to the server, so if you are implementing completions for your own server, you should consider that some clients may not send a reasonable frequency of completion requests.

If you choose to provide completions, there are a few best practices you should consider. You should consider rate limiting incoming completion requests if you anticipate heavy usage or deployment in a high-traffic environment. When implementing the matching logic in your completion handler, you should have some way of showing the most relevant suggestions to the user first, validating their input to prevent prompt injection and other attacks, and restricting access to potentially sensitive suggestions, such as credentials or API keys. These will help ensure a smooth user experience and prevent abuse of your server.

Next, we will take a look at the context object, a utility object provided by the Python MCP SDK that allows you to access information about both the server instance, the current session, and the current request.

<a id="id91"></a>

## Server Icons

The Python SDK allows you to provide icons for your server to the client application. If you provide icons, the client will be able to determine what to do with them, but you can expect them to be displayed in some way in the client application’s UI. To provide icons, you can build `Icon` objects in your server code and then pass a list of them to the `FastMCP` constructor via the `icons` parameter, which will make them available via the [“The Context Object”](#context_object), which we will cover next. You can also bind them to any MCP primitive that you serve by adding an `icons` parameter to the primitive’s decorator. In [Example 6-2](#server_icons), you will see an example that creates multiple icons, adds them to the server instance, and binds them to a tool, a resource, and a prompt.

<a id="server_icons"></a>

##### Example 6-2. A server that provides icons for a tool, a resource, and a prompt.

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

In this example, we first use `pathlib.Path` to construct the path to the icons we want to use. This is used with the icon’s filename and stringified to fill the `src` parameter, and we also set the optional `mime_type` and `sizes` parameters to provide hints to the client about each icon. Anywhere you might use icons, the Python SDK requires a list of ``Icon`s, so in the `FastMCP`` constructor, we pass in the list of icons we created. For the MCP primitives, we have very simple examples, but the main thing to notice is that each primitive decorator now has an `icons` parameter, which also takes a list of `Icon` objects. This binds the icons to that primitive for the client to use.

Within your server, you can also access your icons (and many other properties of the server) via [“The Context Object”](#context_object), which we will cover next.

<a id="context_object"></a>

## The Context Object

The context object is a feature of the Python SDK that allows tool and resource handler functions in servers to access all kinds of contextual information. At the top level, you can access the IDs of the current request and the connected client (if available), as well as the FastMCP server instance (if using FastMCP), the session itself, and the request’s context. There are also a number of top-level methods on the context object which we will visit in later sections, these enable features such as logging, tool progress reporting, and elicitations. In Figure 6-2, you will be able to see the hierarchy of the context object mapped out.

To access this object, you make a new argument for your tool or resource handler function named whatever you want (convention is `ctx`) and type hint it as a `Context` object, which will make all of its properties available within your function. The first major sub-object within the context object is the `fastmcp` object, which contains information about your FastMCP server. This is typically used to return information about the server to the connected client, such as the server’s name, server-level instructions, the server’s URL if available, the server’s icons if available, and its configuration. The server instructions, URL, and icons are taken from parameters that you provide in the `FastMCP` constructor. So far, you’ve only seen examples with a `str` value passed to the constructor and one with `Icon` objects passed in, but in [Example 6-3](#context_object_server_info), you will see an example that includes server instructions, its URL, and its icons and then uses them to return information about the server to the client.

<a id="context_object_server_info"></a>

##### Example 6-3. Using the context object to access server information.

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

In this example, we have set up icons just like we did in [Example 6-2](#server_icons), and then set some server instructions. When instantiating the `FastMCP` server object, we pass in the name just like in the other examples, but we also include the server instructions under `instructions`, a `website_url`, the list of icons we set up, a `debug` flag, and the server’s default `log_level`. The example hosts two tools: the first one is `get_server_information()`, which takes a `Context` object as a parameter and returns a dictionary with information about the server, derived from the top-level properties of the `fastmcp` context object and a few from the settings. This is a general example that can be used in any server to provide information back to the client. The second tool, `get_server_configuration()`, takes a `Context` object as well, but simply returns the server’s configuration settings as a dictionary via the `fastmcp.settings` property.

The second object within the context object is the `Session` object, returned by the `session` property of the context object. This object gives you more direct control over communication with the client. With the it, you can do things like manually send a log messaage to the client, request sampling from the client application’s language model, and send notifications to the client informing it of progress on an operation, a resource changing, or a tool, prompt, or resource list being updated. The session object also includes a property `client_params` which holds all the parameters used to initialize the client and the capabilities that the client declared support for. Right now, we will focus on the resource and list update notification abilities, since you will see more detailed explanations of logging in your server, progress notifications, and sampling requests later in this chapter.

###### Note

Throughout the rest of this chapter, you will see the `Session` object accessed via the `request_context` and directly as a property of the `Context` object. These are the same object, as the top-level `session` property simply returns `ctx.request_context.session`, so you can access it whichever way you prefer.

[Example 6-4](#context_object_session_info) shows a use of the `client_params` property as a tool to return client information back to the client application. It also serves a resource that represents a knowledge base (for simplicity’s sake, this is modeled as a simple text file) and a tool that modifies the resource and notifies the client of the change. All of this is done via the `session` object.

<a id="context_object_session_info"></a>

##### Example 6-4. Using the context object to access session information.

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

In this example, our server first provides a textfile resource similar to the one you saw in the [basic resource](chapter_5.html#basic_resource) example in [Chapter 5](chapter_5.html#ch05). After that, we have the first of two tools: `get_client_info()` which returns the client’s parameters from the context object as a dictionary. The second tool, `add_fact_to_knowledge_base()` takes a `fact` string argument and the context object. It opens the knowledge base file in append mode and writes the `fact` to it, then uses the `send_resource_updated()` method on the context’s `session` object to notify the client that the resource has been updated. The other notification methods on the `session` object are `send_tool_list_changed()`, `send_prompt_list_changed()`, and `send_resource_list_changed()`, and just need to be called without any arguments to notify the client of the appropriate changes.

The final part of the context object is the request context object. This gives you information about the current request being processed, such as the request ID, the lifespan context, any request metadata, the session object, and the request object itself. The request ID is probably self-explanatory, but the lifespan context is worth digging into a bit. In [Chapter 5](chapter_5.html#ch05), we talked about lifespan management in the context of the low-level server API. With the FastMCP server API, you can use the same technique to manage the server’s lifespan, except you’ll use the `FastMCP` type hint for the `server` argument in your lifespan function. If you remember the example code from that chapter, you were able to access the lifespan context via `server.request_context`. With FastMCP, though, you can access the lifespan context via the larger context object that you get as an argument to your tool or resource handler functions, with something like `ctx.request_context.lifespan_context`, which will give you access to whatever you yield from your lifespan function. The request metadata can be accesed via `ctx.request_context.meta`, and outside of the `progressToken` is highly dependend on what the client sends. We will cover the `progressToken` in more detail later in this chapter. Last is the original request object itself, which you can access via `ctx.request_context.request`.

The `Request` object at first appears to be a bit more complex, since there are a number of subclasses of the base `Request` class for each type of request the SDK supports. The base class holds just the `method` and `params` properties, which give you the string method (such as `getResource`) and the parameters of the request (if any) as a dictionary. Luckily, many of the subclasses of `Requests` don’t have many, if any, additional properties; instead, they just define the string literal for the `method` property. You can use this for things like manual routing to functions or pre-processing on the basis of a request’s method rather than using the more direct routing that both the FastMCP and low-level server APIs provide via their decorators.

In [Example 6-5](#context_object_request_info), you will see the request context used to implement the lifespan management example from Chapter 5. We will again create a lifespan function that writes server logs to `stderr` at startup and then yields a dictionary containing the logs list, making it available via the request context to any of the server’s tool or resource handler functions. We can “log” by appending a string to the logs list, then printing the most recent entry to `stderr` to make it visible via the MCP Inspector’s notifications pane. While this isn’t how you’ll actually handle logging in your server (more on that in the next section), it’s a simple way to demonstrate lifespan management with the request context.

<a id="context_object_request_info"></a>

##### Example 6-5. Using the context object to access request information.

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

This example is very similar to the one in \[Link to Come\], but with some key differences. First, the `lifespan()` function has the `FastMCP` type annotation for the `server` argument. The rest of the function is the same. Then, when we instantiate the `FastMCP` server object, we pass a reference to the `lifespan()` function to it using the `lifespan` parameter. We don’t implement a `list_tools()` function in this example, since it isn’t necessary when using the FastMCP server API, and our `add()` tool is structured for the FastMCP server API. It takes the `a` and `b` arguments directly, rather than in an `args` dictionary, as well as the context object in the `ctx` parameter. That allows us to access the logs list from the lifespan context via the request context object and modify it directly. Printing to `sys.stderr` remains the same as in the low-level server example.

###### Note

You are not limited to yielding a dictionary from your lifespan function. You can yield any object you’d like, whether it’s a Python primitive or a custom class. In fact, the Python SDK [lifespan management example](https://github.com/modelcontextprotocol/python-sdk/blob/main/examples/snippets/servers/lifespan_example.py) yields a custom `AppContext` object with a database object as a parameter.

In addition to the contextual information we’ve discussed in this section, you can also make use of the context object to send logs to the client, which can then decide how to deal with them.

<a id="id93"></a>

## Logging

In the Python MCP SDK, logging is done via the `Context` object at the top level, and has a similar interface to Python’s built-in logger. You can log `debug`, `info`, `warning`, and `error` levels, and they will be sent to the client as logging message notifications, a special subclass of the `Notification` class. While the MCP specification supports all log levels defined in RFC 5424, it appears that full support is not yet implemented via the `Context` object. [Example 6-6](#context_object_logging) extends [Example 6-5](#context_object_request_info) to add proper logging capabilities to the server.

<a id="context_object_logging"></a>

##### Example 6-6. Using the context object to send logs to the client.

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

This example is much simpler than the previous one. We got rid of the lifespan management function, and while we lost server startup and shutdown logging messages, we have simpler and more expressive logging capabilities. The reason the lifespan management function was removed is that it is unable to access the request context object via its parameters, and so we can’t log from it using the context object. What we can do, though, is write all the available levels of logging to the client. In this example, we again create a `ctx` parameter for the tool function, and call logging functions like `ctx.info()`, ensuring that we `await` them as well. This example uses all the available logging levels so that you can see how they are used. If you are using the MCP Inspector to debug your server, you will be able to see all these messages and their levels in the notifications pane, since log messages are treated as notifications within MCP. In the next section, we will cover another special case of notifications: progress notifications. You will also learn about how to manually send notifications to the client.

<a id="id94"></a>

## Progress Notifications

Progress notifications are a special type of notification that allows your server to send progress updates to the client. This can be useful for long-running tool or resource operations, so that your server can inform the client of its progress. The connected client can then display this progress to the user via the host application’s UI or take some other action in response to the progress update. Progress notifications are sent via the `Context` object’s `report_progress()` method, which takes the current progress as a float, an optional total as a float, and an optional message as a string. This method is provided by the FastMCP framework, and it attempts to get a progress token from the request context object. It then uses that to call `send_progress_notification()`, which is provided by the `Session` object and can be accessed via the context object. [Example 6-7](#progress_notification_fastmcp) will show you how to use the context object to send progress notifications to the client by creating a tool that iterates through a set of numbers, sleeping for a fraction of a second each time, and then reports the progress back to the client.

<a id="progress_notification_fastmcp"></a>

##### Example 6-7. Using the context object to send progress notifications to the client via FastMCP.

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

In this example, we created a `slow_operation()` tool that accepts a number of iterations as an argument and iterates through them, sleeping for 0.1 seconds at each iteration. We also configure a report frequency that is every 10% of the total progress if the number of steps is greater than 10, else every 25% of the total progress. Then the tool reports its progress back to the client using `report_progress()` on the context object. If you run this tool in the MCP Inspector, you will see the progress reported in the notifications pane.

###### Note

In this example, we set the `progress` parameter of the `report_progress()` method to the current step and set the optional `total` parameter to the total number of steps. If you know the total length of the operation, I recommend that you explicitly set the `total` parameter to that value so that the notification is explicit that `progress` is the current progress of the operation out of the reported `total` value. However, there is nothing stopping you from using the `progress` parameter alone, and providing the calculated progress percentage to it. This is not recommended because it could be confusing for the client and negatively affect how it reports the progress to the user. Instead, it’s best to only omit the `total` parameter if you do not know the total length of the operation.

<a id="id95"></a>

## Manual Primitive Notifications

You can also use the `Context` object to send other notifications to the client. These aren’t available at the top level of the context object like `report_progress()` is, but you can access them via the `session` object available in both the main context object (via `ctx.session`, assuming your context object is named `ctx`) and the `request_context` object (via `ctx.request_context.session`).

There are four specific notification methods that you can send from the `session` object:

- `send_tool_list_changed()`
- `send_prompt_list_changed()`
- `send_resource_list_changed()`
- `send_resource_updated()`

Each of these calls the general `send_notification()` method also on the `session` object, which takes as an argument an object that derives from the `Notification` class. For the above notifications, these are `ServerNotification` objects which in turn take a server notification object as an argument. These server notifications correspond to the notification types above, and like the various `Request` subclasses, generally just have a `method` property that corresponds to the notification type as defined in the MCP specification, such as `notifications/tools/list_changed` for `send_tool_list_changed()`. Generally, whether you use FastMCP or the low-level server API, you won’t need to send these notifications manually, as the SDK will handle them for you. If you have more advanced requirements, though, such as dynamically adding or removing primitives at runtime, you will need to send these notifications manually. [Example 6-8](#manual_notification) shows how to do just that by creating a tool that removes a prompt from the server’s prompt list and then notifies the client of the change if successful.

<a id="manual_notification"></a>

##### Example 6-8. Removing prompts via a tool, and using the context object to notify the client of the change.

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

In this example, we have two prompts: `hello_prompt()` and `calculate_operation()`. The first is a simple prompt that tells the model to say “Hello, welcome to the MCP server!” to the user. The second is used to calculate a user-provided mathematical operation, using the tools available to the model. But the interesting part is the `remove_prompt()` tool, which dives into the MCP server object’s internals to remove a prompt from the server’s prompt list by its name. The server object has private `*Manager` objects that are used to manage the various MCP primitives, including maintaining dictionaries of the loaded and available prompts, tools, and resources. This allows FastMCP seamlessly do things like preventing duplicate primitives from being loaded, rendering a prompt, calling a tool, and more. Those are the final functions in the call stack that begins with a client making a request to the server via the `Session` object’s functions. As they’re private, you shouldn’t play with the `*Manager` objects directly—​it is just done here to create a simple example where a manual `list_changed` notification needs to be send to the client. If the prompt is removed successfully, we call `send_prompt_list_changed()` to inform the client that the list has changed. This gives the client the opportunity to refresh the list it holds internally, notify the user, or do some other action in response to the change. You can test this with MCP Inspector by running the tool and viewing the sent notifications. You can also re-run the list prompts tool to see the change reflected in the client.

<a id="id96"></a>

## Custom Notifications

You can also send a generic notification to the client using `send_notification()`, which takes a `Notification` object as an argument. This is a more advanced feature, and it is unlikely that you will need to use it. Even if you never use it though, understanding the general case of notifications will help deepen your understanding of the notification system that powers much of the MCP protocol itself. In order to send a cusotm notification, you need to do two things: create a class that subclasses `NotificationParams`, and build a `Notification` instance using it. The `Notification` class takes a `method` string and your `NotificationParams`-descended object as arguments. The `method` string can be almost anything you want, but it should be prefixed with `notifications/` and it should *not* be a reserved method string (you can find them by searching “notifications/” in `mcp.types`), as that may cause the notification to not be processed correctly. [Example 6-9](#custom_notification) shows how to send a custom notification with a custom `NotificationParams` class.

<a id="custom_notification"></a>

##### Example 6-9. Sending a custom notification to the client.

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

In this example, we created `CustomNotificationParams` as a subclass of `NotificationParams`. To keep things simple, we gave it a single string `message` property, which you can use for the text of the notification. Then we created a tool called `test_notifications()` that uses the `Session` object’s `send_notification()` method to send a custom notification to the client. We instantiate a `Notification` object and set its `method` parameter to `"notifications/test_notifications"` and its `params` parameter to an instance of `CustomNotificationParams` with the `message` parameter filled in. Because we have access to it via the request context object, we also set the `related_request_id` parameter to that of the current request. This is an optional parameter, but it can be helpful to any connected clients to have more context for the notification. As a server developer, all you can control is that a notification is sent, it is up to the client to decide how to handle it. If you run this tool in the MCP inspector, you will see your custom notification in the notifications pane.

###### Warning

If you do decide to create custom notifications, you should be aware of their very real limitations. Because many clients connect to servers provided by their users and rely on capability negotiation and discovery to determine what both client and server support, most clients will not have handlers for your notification type. This means that your notification will go ignored. Additionally, some SDKs, including the Python one, restrict which kinds of notifications actually reach the client. These are restricted to notification types defined in the MCP specification, meaning that custom notifications will not make it to the client’s notification handlers.

You can also use this same pattern to send a cancellation notification to the client. While the more common scenario has the client sending a cancellation notification to a server to cancel a long-running operation, cancellation notifications are bidirectional by design, however it does not guarantee that the client will actually cancel running operations. To send a cancellation notification, instead of passing a `Notification` instance to the `notification` parameter of the `send_notification()` function, you will pass a `CancellationNotification` instance. The constructor for `CancellationNotification` takes a `requestId` string or integer and a `reason` string as arguments. [Example 6-10](#cancel_request_notification) shows what this looks like.

<a id="cancel_request_notification"></a>

##### Example 6-10. Sending a cancellation notification to the client.

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

This example looks very similar to the previous one, but instead of defining a custom notification parameters class and sending it as an argument to the `Notification` constructor, we send a `CancelledNotification` instance with `params` filled by an instance of `CancelledNotificationParams`, which takes a `requestId` which you can again get from the request context object and `reason` that you can define as any string.

<a id="id97"></a>

## Pagination

Pagination is a server utility that is defined in the MCP specification, allowing servers to return a subset of a large response for clients to process sequentially. This follows a familiar token-based pagination pattern, where the client requests something from the server, such as a list of tools or a large external resource, and the server responds with a subset (or *page*) of the data along with a token (or *cursor*) that represents the current position in the overall response data. The client can then make the same request again and include that cursor to get the next page of data, continuing this in a loop until all the data has been retrieved, which is communicated by the lack of a cursor in the response. As you decide to implement pagination, remember that only the following operations support pagination:

- `resources/list`
- `resources/templates/list`
- `prompts/list`
- `tools/list`

This might be intuitive: these are the main operations that could potentially return a large number of items, and so are the ones you’d most want to paginate. One thing that may not be as intuitive is the lack of support for paginating `tools/call` and `resources/read` operations. For tool-calling, this is likely due to the user interaction model: tools are designed to be called by LLMs, which may not be able to accurately process or handle cursors and multiple pages. Beyond that, multiple calls to a tool to page through results would blow up your client’s token usage, resulting in a significant cost increase for those consuming your tool. For resource reading, you don’t want to paginate because the entire resource is designed to be added to the prompt context, and pagination would prevent that.

Related to this: only list operations support pagination. This presents a problem for the FastMCP framework within the SDK: it automatically generates the `list_<primitive>()` functions for you, and these don’t support pagination. For this section, we will implement a custom `list_tools()` function that supports pagination using the low-level server. As you implement pagination, you will have to consider cursor selection, which will depend on your specific implementation, but it should be completely opaque to the client. The client should get their cursor and send it back to the server for the next batch of data, so the logic to process the cursor should reside in your server. For a fixed-length list of items, the simplest cursor is just the index of the next item to return.

###### Note

Pagination is purely optional to implement and in most cases is not necessary. According to the [Python MCP SDK documentation](https://github.com/modelcontextprotocol/python-sdk/tree/main?tab=readme-ov-file#pagination-advanced), it is typically not necessary until your server is returning hundreds or thousands of items, which is often an antipatten to begin with, especially if you are returning a large number of tools.

In [Example 6-11](#low_level_pagination), we will implement pagination for a `resources/list` operation in a low-level server, by creating a list of 1000 resources and returning 100 of them at a time with a cursor indicating the index of the next item to return.

<a id="low_level_pagination"></a>

##### Example 6-11. Implementing pagination for a `resources/list` operation in a low-level server.

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

This is a bit verbose, as is to be expected with the low-level server API. At the module level, we have constants `TOTAL_RESOURCES` and `PAGE_SIZE` to define the number of resources to build into the canonical list of resources and the number of resources to return at a time, respectively. We then use that to build a list of resources for testing purposes. `list_resources()` is the function that implements the `resources/list` operation with pagination. It takes a `ListResourcesRequest` object as an argument, which can be thought of as a more specific version of the `Request` context object you have when using the FastMCP framework. It has a `params` property that holds any parameters that are sent with the `resources/list` request, which would include a cursor if the client is paginating. We extract the cursor if it is present, if not we set it to `None`. Then we create the page indices for the request based on the cursor: if there’s a cursor, we set the `start_index` to its integer value, then create an `end_index` which is either the index of the next item to return, or the total number of resources, whichever is smaller. If a cursor isn’t present, then we set `end_index` to the total number of resources.

We use list slicing to get the subset of resources to return based on the page indices, then generate the next cursor if the `end_index` is less than the total number of resources. The function then returns a `ListResourcesResult` object with the resources and next cursor, if any. We also built a `read_resource()` function that returns the resource description for a given resource URI, just to make testing and experimentation a bit easier. The `run()` function is the entry point for the server, and is essentially the same as in the low-level server examples in \[Link to Come\]. For the next section, we will return to using the FastMCP framework, this time to demonstrate how to send and respond to pings.

<a id="id98"></a>

## Pings

If notifications are one-way messages designed to be read and optionally acted upon, pings are the opposite: they are two-way messages encoded as a request-response pair that are used to verify if the connection is still active. A ping is sent by the client or the server as a request, and the sender expects an empty response in return. This is especially useful if you’re calling a long-running operation or expecting to handle long-lived connections that you can reconnect to and resume if it is dropped, an important feature of the streamable HTTP transport. Pings are sent similarly to notifications: the `session` object within the request context object has a `send_ping()` method that takes no arguments, which you can send to the client anywhere in your server code that you’d like. [Example 6-12](#pings) shows how to do this within a tool function, printing the response to verify that the ping was received.

<a id="pings"></a>

##### Example 6-12. Sending a ping to the client and verifying the response.

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

This example is about as simple as it gets: the server has a tool called `long_running_pinger()` that iterates through 25 steps, sleeping for 0.1 seconds at each step. Every 5 steps, it sends a ping to the client and prints the response and its type, which is expected to be an `EmptyResponse`. This enables easy testing of the ping functionality within the MCP Inspector, as it won’t display pings received by the client.

The next advanced technique we will cover is using client-provided resources, which allow your MCP server to harness the capabilities of the client its connected to in order to augment its own functionality.

<a id="id99"></a>

# Using Client-Provided Resources

Clients may provide any of several capabilities to MCP servers, providing a quasi-reversal of the typical client-server relationship. These capabilities provide the server with access to different entities: the user (via elicitations), the language model (via sampling), and filesystem boundaries (via roots). Additionally, clients may send your server a cancellation request, and we will tackle how to support those in this section as well. Because clients aren’t required to support these capabilities, you should always check if the client supports them before using them and provide a fallback or error message if they don’t. Before diving into the specifics of each capability, we will first cover how to detect if the connected client supports a given capability and some strategies for handling a client not supporting a capability that your server uses.

<a id="id100"></a>

## Detecting Client Capabilities

The Python SDK provides a convenient helper function as part of the `Session` object called `check_client_capabilities()` that takes a `ClientCapabilities` object and returns a boolean for whether the client supports all of the capabilities defined in the object, which has a property for each capability the client can provide to servers: `sampling`, `elicitations`, and `roots`. Each of these is an optional instance of the appropriate capability class: `SamplingCapability`, `ElicitationCapability`, and `RootsCapability`, respectively. The class also has an `experimental` property that is also optional and is a dictionary of any additional capabilities that the client supports but are not yet part of the MCP specification.

The function itself checks for the existence of each capability property in the input `ClientCapabilities` object. If a capability property is present, the function will then check that the client supports it by inspecting the `Session` object’s `client_params.capabilities` property, itself an instance of the `ClientCapabilities` class. If there is a mismatch between the two, then the function will return `False`. So by building a `ClientCapabilities` object with the client-provided capabilities that your server can use, you can quickly check if it supports all of the capabilities your server needs. This is done automatically during connection initialization, so you don’t need to do anything special to use it.

You should also consider how you will handle a client not supporting a capability that your server uses. When you make a call to the client to use a capability it doesn’t support, the client will respond with an `INVALID_REQUEST` error response. If the capability is essential to the functioning of your server and you have no fallback, you don’t need to do anything special, the client’s default callback for the capability (this is what gets called when a server makes a request of the client, see \[Link to Come\]). Ideally, though, you should wrap the calling code in a try/except block and at the very least log the error. If you can provide a fallback if the capability is not supported, you can call it from within the except block.

In addition to making the request of the client and letting it handle the failure mode, you can prevent an unnecessary request from being made by manually checking if the client supports the capability first. To do this for an individual capability, you can use the same technique as the `check_client_capabilities()` function, and check the `capabilities` property in the `Session` object, which returns an instance of the `ClientCapabilities` class. In the following sections for each capability, you will see how to do both allow automatic failure due to non-support and manual checking before making the call.

<a id="id101"></a>

## Elicitations

*Elicitations* are the first client-provided resource that we will cover. Elicitations allow your server to request structured information from the application user, like name, email address or a form with several fields of varying types. This can be used for anything that requires structured user input, like mailing list signups or online purchases, however you must not request sensitive information from users. When your server requests an elicitation (typically from within a tool call), it sends an `elicitation/create` message to the client, which will then trigger the presentation of some sort of user interface to the user in order to collect the requested information. The user can accept, decline, or cancel the request. If the user accepts, then they will provide the requested information and the client will send the user response object to your server which can then do whatever it needs to do with the information, which will include the user’s response in the `content` property. Your server’s actions should include validating the incoming data against a schema defined in your server code. If the user declines or cancels the request, the client will return a response object with the `action` property set to `"decline"` or `"cancel"`, respectively. A “decline” response is sent when the user explicitly rejects the elicitation request, such as by clicking a “decline” or “reject” button, while a “cancel” response is sent when the user does something that cancels the conversation, like pressing the Escape key, closing a chat dialog window or modal, etc. You should handle these cases appropriately in your server code, whether that means ending the tool call gracefully, using default values, offering the user alternative forms to fill out, or whatever else makes sense for your application and the user’s particular response.

###### Warning

Elicitations form schemas are a powerful way to validate user input, however the specification only allows for a subset of primitive JSON types: strings, numbers, booleans, and enums. All types have `type`, `title`, `description`, and `` default` `` properties, while string types also have `minLength`, `maxLength`, `pattern`, and `format` properties, number types include `minimum` and `maximum`, and enum types have `enum` with a list of string values and `enumNames` with a list of corresponding names for the enum values.

In [Example 6-13](#elicitations_server), you will see a tool that requests a user’s name, email address, and age in order to sign them up for a mailing list. If the client doesn’t support elicitations, the tool will log an error message and return a string response indicating that the feature is not supported. It will also provide a form schema that the SDK will automatically validate when the server receives the user’s response from the client. This will also handle cases where the user decliens or cancels the request by logging the result and returning a response tailored to each situation.

<a id="elicitations_server"></a>

##### Example 6-13. An example of a tool that requests user information and validates it against a schema.

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

In this example, the first thing we do is set up the form schema for the elicitation request. This is a simple object with three properties: `name`, `email`, and `age`. The `name` and `email` properties are both required strings, while `age` is an optional number. We then define the tool `signup_math_facts()` which requests the user’s information, automatically validating it against the schema that is sent with the request. The request is made with the `elicit()` method call, which we wrapped in a try/except block so that if an error occurs, like an invalid request because the client doesn’t support elicitations, we can log the error and return a string response with the error message. This response string will be incorporated into the response the application user sees. Then we check for the value of the `action` property of the `ElicitResult` object, which will be either `"accept"`, `"decline"`, or `"cancel"`. If the value is `"accept"`, then we extract the user’s information from the `content` property of the `ElicitResult` object, which is a dictionary with the user’s response to each of the form fields. In this dictionary, the keys are the names of the form fields, while the values are the user’s responses. We then construct a string response to be returned to the user. If the user declines or cancels, we log the result and return a string response tailored to each situation. We also handle the situation where we don’t recognize the value of the `action` property, and log it as a warning.

The next action your server can take is to request sampling from the client’s language model. This opens up a whole lot of possibilities for your server, since you will potentially have the client application’s language model at your disposal.

<a id="id102"></a>

## Sampling

*Sampling* is the next client-provided resource that we will cover. Sampling allows your server to request chat completions from the client application’s language model, lending your server the ability to use the client application’s language model to augment the functionality of your tools. Use cases here can be as simple as querying the language model with a hardcoded prompt to answer a question (much like a prompt primitive masquerading as a tool), or as complex as using the language model to plan a workflow out of composable functions where the output of one function isn’t needed to determine the next one to call. When your server intiates a sampling request, it sends a `sampling/createMessage` message to the client, which should then trigger a human-in-the-loop (HITL) review process to get the user’s approval before forwarding the request to the language model. This isn’t required by the specification, but is strongly suggested for clients to implement, so you should expect to handle cases where the user rejects the request. In the case of a rejection, you won’t receive a `CreateMessageResult` object with the user’s response and the specification doesn’t define a specific way for clients to communicate a user rejection to the server. The client’s sampling callback should return an `ErrorData` object with a `code` of `-1` and a `message` that indicates that the user rejected the request, which reaches your server a catchable Python exception. Alternatively, you can check that the client supports sampling before attempting the call to prevent an unnecessary request from being made.

If the request is approved, the client will forward the request to the language model, get a result, optionally present the response to the user for approval, and then return the response to the server. In the Python SDK, your server will receive a `CreateMessageResult` object with a `role` property, `content` property (which can be `TextContent`, `ImageContent`, or `AudioContent`), a `model` property that holds the name of the model that was used to generate the response, and a `stopReason` property that indicates why the generation stopped, if any. You should validate the `content` property to ensure that it is of the expected type, and handle the different content types appropriately.

When you create a sampling request, you can also provide preferences to the client. These come in two flavors: *capability priorities* and *model hints*. *Capability priorities* allow your server to tell the client how to prioritize cost, speed, and intelligence when selecting a model. Each of these takes a float value between 0 and 1, where 0 is the lowest priority and 1 is the highest. The client can use these values to determine which model to use for the request. *Model hints* also communicate model preferences to the client, but are more specific to model families. Hints are communicated as an array of JSON objects where the key is `name` and the value is any string that identifies the model family, such as `"claude-4-5-sonnet"`, or `"claude-sonnet"`, or simply `"claude"`. In the Python SDK, these are represented by a list of `ModelHint` objects which have the single property `name`. Because hints are a list, you can provide more than one hint, and they can be different model families, or increasingly broad model groupings, like we just saw.

###### Note

Remember that these hints are just a suggestion to the client. The client is not required to respect them, and if it does, it is not required to call the exact model family that you suggest. In some cases, the client may attempt to map your hints to the closest model family that it supports, or even to a different model family altogether. This is out of your control as a server developer, so you should not rely on the hints being strictly followed.

In the Python SDK, there is a `ModelPreferences` class that encapsulates all of these preferences: the capability priorities are top-level properties (such as `costPriority`), while `hints` is a list of the previously described `ModelHint` objects. These are included in a `CreateMessageRequestParams` class that you can use to pass parameters to the `create_message()` method, but you can also just pass them directly to the `create_message()` method call. [Example 6-14](#sampling_server) shows a tool that requests sampling with a simple prompt, a model hint, and capability priorities. It also handles cases where the user rejects the request by logging the result and returning a string response tailored to the situation, as we did with elicitations. This is necessary here because an uncaught error will not be forwarded to the client, and instead will halt the server’s execution.

<a id="sampling_server"></a>

##### Example 6-14. An example of a tool that requests sampling with a simple prompt, a model hint, and capability priorities.

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

The first thing done in this example is setting the model preferences for the sampling request. This is set up as a constant at the top of the file, which would make sense if all of your sampling requests use the same preferenes. If not, of course, you’ll want to set these up in your tool calls. Then we have our tool, `explain_math()`, which is slightly modified from (and more robust than) the version in the test server for Chapters 3 and 4. The tool takes a string parameter `operation` that will be interpolated into the prompt, as well at a `Context` object that will be injected into the tool’s function body. We set up the prompt, then before doing anything else, check that the client supports sampling by inspe3cting the `ClientCapabilities` object in the `Session` context object. If not, we return a string response indicating that the capability is not supported by the client. We still open up a try/except block to handle the `create_message()` call in case of any other error, like a rejection from the user. `create_message()` is called on the `Session` context object, and we create a `SamplingMessage` instance with the role `"user"` and we pass the prompt as a `TextContent` object. We also set a `max_tokens` limit and pass the model preferences object here. If there is an error, we log it and return it for the client language model to handle. Then, we report if there is no content in the result, and if there is, we return it as a string, whether it’s text or image/audio data.

###### Warning

When you parametrize prompts, just like you might do with SQL, you will want to validate the input parameters to protect against prompt injection attacks and ensure that the input is of the expected type and form. Too strict validation can negatively affect the generalizability of your tool, so you should seek to strike a balance between security and flexibility.

The last client capability we will cover is roots.

<a id="id103"></a>

## Roots

*Roots* have been the source of some confusion in the MCP community, and it might be clear why. Roots allow clients to indicate which parts, if any, of the host application’s filesystem the server may access. This is a powerful capability, but the confusion arises because the capability is *shaped* like a security boundary, when it is really a coordination mechanism, as servers aren’t required to respect the boundaries set by roots. Roots are useful for a number of reasons, though. Chief among these reasons is that they provide a unique URI so that servers can access those file system roots with a single well-defined identifier. A client-side implementation of this may be a directory picker that tells the model and any connected servers which directories are available to use as context. If your server needs access to local files or directories, the URIs provided by roots can be a convenient way to identify and address them.

When you are implementing a server that supports roots, your server should be able to handle situations where roots become unavailable, respect roots during server operations, and validate paths against provided roots. Roots have two messages: a ``roots/list request and a `roots/list_changed`` notification. Your server should be able to cache root information when it receives a response to the `roots/list` request instead of making a request every time access is needed, and respond to notifications arising from changes to that list — typically by invalidating and refreshing the server’s root cache.

The message flow for roots is simpler than for the other capabilities we’ve covered, if only because it doesn’t involve a human-in-the-loop review process. When a client connects to your server, during the discovery phase the server will send a `roots/list` request to the client, which will return a list of availbale roots (represented by `Root` objects in the Python SDK). If a change to the root list occurs, the client will send a `roots/list_changed` notification to your server, but it won’t have any information about the new list, so you will need to send a `roots/list` request to the client to get the updated list.

In [Example 6-15](#roots_server), we will implement a tool that counts the number of files in a user-provided directory, but only if it’s present in the roots list. We will also implement a handler for the `roots/list_changed` notification to invalidate the server’s root cache, allowing our tool to refresh it.

<a id="roots_server"></a>

##### Example 6-15. An example of a server that supports roots and counts the number of files in a user-provided directory.

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

The first thing you might notice about this example is the `roots_cache` and `handle_roots_list_changed()` functions. The `roots_cache` is a list that will hold the roots list received from the client, if there are any. It receives a parameter of type `RootsListChangedNotification` which we don’t use but is required to be called properly by the SDK code. This is a custom notification handler, and it will be called whenever the client sends a `roots/list_changed` notification, and it will simply clear the cache. Next, let’s look at the `if __name__ == "__main__":` block. Here we use the `_mcp_server` attribute to access the notification handlers dictionary and register the notification handler for the `RootsListChangedNotification` type by creating a new entry with the key `RootsListChangedNotification` and the value being the `handle_roots_list_changed` function. This is the general pattern you will use to implement and register custom notification handlers on servers. Back to our tool, `count_files()` takes a file\_path string input and context object. It then checks if roots\_cache is falsy, which for lists means that the list is empty, and if so we get the list of roots from the server and store them in the cache. We then build a list of root URIs for more convenient access.

###### Note

To see more examples of file manipulation in an MCP server, the MCP repo has an example [file system server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) that you can use as a reference.

We get the absolute path of the `file_path` parameter, and then set a new variable `is_allowed` to `False`. This is what we will use to determine if our file path is within the roots provided by the client. Then, for each root uri, we get their absolute path, do a very simple check to see if the file path parameter’s absolute path starts with the root’s absolute path, indicating that the requested path is within the root’s boundaries. We set `is_allowed` to `True` and break out of the loop. If not, we log and raise an error. If the path is within a root, then we ensure the directory exists, then use `os.listdir()` to get the list of files in the directory and use it as a parameter to the `len()` function to get the number of files in the directory. We log this and return it as a string response.

###### Warning

The Python MCP SDK doesn’t currently provide a way for servers to access remote files or directories on a client machine, so most servers that do file manipulation can only do on the machines they are being run from.

In this section, you learned how to impement your own notification handler and used that to ensure that your server’s internal root cache was properly invalidated as soon as the server received a `roots/list_changed` notification. Next, we will learn about the final kind of request, one that isn’t quite a client-provided capability, but is still sent mostly by clients.

<a id="id104"></a>

## Request Cancellation

Request cancellation allows your user to cancel long-running operations, like tool calls that are taking too long to complete. Cancellation is a special kind of notification: `notifications/ cancelled`, and can either be sent by the client or the server. As a server developer, you will be unlikely to send cancellation notifications, but you should expect to at least handle incoming cancellation notifications from connected clients. While these are typically used for cancelling long-running operations, a client can send a cancellation notification for any request, and to develop a robust server, you should handle them gracefully and respond appropriately. Cancellation notifications are bidirectional: you can send a cancellation notification to a client to cancel some ongoing operation just like the client can send you one. You may want to do this for a sampling or elicitation request that is taking too long to complete, for example. There are a few things you need to watch out for when handling cancellation notifications, however. First, you should ignore any invalid notifications, such as those that have an invalid request ID, are trying to cancel completed requests, or are otherwise malformed. You should also log cancellation notifications that you receive to get a better idea of user pain points in your server and assist in debugging. When you receive a cancellation notification, besides logging it, you should ensure that the notification is not requesting your server to cancel the `initialize` request, and if it isn’t an invalid notification, you should ensure that you stop the ongoing operation without returning a response to the client and free up any allocated resources for that operation.

In the Python SDK, receiving a cancellation notification is handled automatically for both client and server, in the `_receive_loop()` function of the `BaseSession` class, which is shared with the client and server session classes. When a cancellation notification is received, the code will check a private `_in_flight` dictionary for a matching request ID. This dictionary keeps track of all currently active requests, and if it finds a match, it will using `cancel()` on the corresponding `RequestResponder` object to stop it gracefully. This implementation violates two rules in the specification for handlign cancellation notifications: you won’t be able to log cancellation notifications that you receive, and the `cancel()` function sends an error response to the client. While you can’t change the behavior of the `cancel()` function, you can log the cancellation notification that you receive by using a logger internal to the server. You can do this by creating a handler for the `CancelledNotification` type, similar to what you did in [Example 6-15](#roots_server) and just log the notification and reason the server’s logger. You can also perform any cleanup here before cancellation, and the SDK will still handle the actual cancellation.

You can also send cancellation notifications to the client to cancel any ongoing operations as well. To do this, you can use the `Session` object’s `send_notification()` method to send a `CancelledNotification` instance with the request ID and reason you want to cancel the operation. [Example 6-16](#cancel_request_notification_server) shows you how to log cancellation notifications in a custom handler and how to send a cancellation notification to the client.

<a id="cancel_request_notification_server"></a>

##### Example 6-16. A server that logs cancellation notifications and performs cleanup before cancellation.

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

There is quite a bit going on here. Let’s start with receiving cancellation notifications. First, we create a notification handler just like we did in the last example, this one is called `handle_cancelled_notification()` and simply logs to the server’s logger the request ID and reason for the cancellation. The actual cancellation will still be handled by the SDK. And then, near the bottom of the example, we add `handle_cancelled_notification()` to the notification handlers dictionary with the key `CancelledNotification`.

Next, we will handle sending a cancellation notification to the client. This can be a little more tricky, because it can require handling request IDs of multiple requests at once, however we will look at a much simpler situation. We have a tool called `sampling_with_timeout()` that performs a sampling request with a timeout, and sends a cancellation notification to the client after timing out. First, we check if the client supports sampling, then we get the current request ID from the `session` object’s private `_request_id` property. This is important because we using `create_message()`, which calls `send_request()` internally, as do all the other methods that generate requests. `send_request()` uses the `Session` object’s `_request_id` private property as its request ID, and only after it does that does it increment the request ID. So, we need to get the request ID before actually calling `create_message()`, ensuring that we have the correct request ID for the cancellation notification. Next, within a `try` block, we use `asyncio.timeout()` to limit how long we wait for the response to the sampling request. If the request takes too long to complete (we set a limit of 5 secnds, it should easily timeout every call), then we use the `Session` object’s `send_notification()` method to send a ``CancelledNotification which some parameters filled out, like the `requestID`` and `reason` for the cancellation. We log it, notify the user by returning a strong response, and then are all done.

In this chapter, you learned about some of the advanced capabilities of MCP servers, specifically server utilities and client-provided capabilities. You learned how to use server utilities like completions to provide autocompletion suggestions to your users, how to use the `Context` object to access information about the server instance, the current session, and the current request, how to use logging to send logs to the client, how to use pagination to return a subset of a response to the client, and how to use progress notifications to send progress reports to the client. You also learned how to user client-provided capabilities like elicitations for getting information from the client’s user, sampling for using the client’s language model, roots for accessing the client’s filesystem, and request cancellation for canceling long-running operations. Doing this successfully required us to really dig into the MCP Python SDK’s code in order to understand how the SDK handles these capabilities and how to implement them in our own server.

In the next chapter, we will discuss practical considerations for creating and sharing a robust MCP server, such as running tests on your server, running AI evaluations on it, securing your server and common MCP server attacks, and how to deploy your server out into the wild.
