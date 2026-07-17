---
title: 'Chapter 7. Testing, Securing, and Sharing your MCP Server'
author: Kyle Stratis
layout: post
permalink: /AI_Agent_with_MCP/chapter_7.html
lang: en
book_order: 7
---
<a id="ch07"></a>

# Chapter 7. Testing, Securing, and Sharing your MCP Server

You’ve built your server. It provides tool, prompts, and resources to client applications. It supports a bevy of client-provided capabilities like sampling, elicitations, and roots, along with utilities to make your life and your users’ lives easier, like logging, notifications, and pagination. What’s next? Your work is not yet done. Like any other software project, you still need to test your server code, evaluate its performance, secure it, and finally share it with the world. *Testing* should be familiar to the software engineer, servers are code and thus testing them takes the same form as testing any other code: unit testing, integration testing, and end-to-end testing still take the spotlight here. But on top of that, you have additional tools, such as MCP Inspector (which we’ve been using throughout the server chapters) which allows you to directly test the functionality of your server, view logs and notifications, and otherwise simulate its use by a fully-featured MCP client. *Evaluations* are endemic to the world of machine learning, and while outside of generative AI evaluations happen in the context of model training, within generative AI this involves anticipating user prompts and evaluating the results of those prompts against expected outcomes, including tool choice, tool execution and results, prompt results, guardrail performance, and more. Some of these evaluations are not relevant to MCP servers, but enough are that they are worth covering here.

###### Note

LLM evaluation is a complex discipline unto itself. This book will only touch on parts that are relevant to tool development and how they relate to MCP servers. Hamel Husain and Shreya Shankar both teach a popular cohort-based course on LLM evaluation on the Maven platform and have written a book on the subject, [Evals for AI Engineers](https://learning.oreilly.com/library/view/evals-for-ai/9798341660717/) (O’Reilly, 2026).

*Security* is a hot-button issue in the world of MCP. The natural language interface that LLMs provide makes the attack surface of agentic applications almost infinitely broad. How can we allow LLMs to run code locally or remotely in a safe and secure manner while safeguarding user data and privacy? This is a complex issue that is not yet fully solved, but we can drastically improve our security posture by understanding common attacks, techniques for defending against them, and the most current best security practices for MCP. We will then cover what may be the most important topic of all: *sharing* your server with the world. MCP servers can be shared in a very of ways, from simply sharing the code with integration instructions on GitHub to deploying your server to a remote server and making it safely accessible to potentially millions of users. This chapter will cover all of these topics in detail in order to equip you with the knowledge to build production-ready MCP servers that are secure, performant, and easy to use.

<a id="id105"></a>

# Testing Your Server

When writing your server, you will want to test it thoroughly. Well, if you’re like me, you won’t literally *want to*, but unfortunately it is necessary and will save you a lot of headache in the long run. This section will focus on testing the correctness of the actual code you have written for your server, while the following section will cover evaluating performance when interacting with actual models. Here, the standard testing tools and techniques apply: unit testing for individual functions and methods, integration testing for testing interactions with external data, systems, and services, and end-to-end testing for testing the entire system as a whole. While the latter item sounds a lot like evaluations, the focus here is on having a stand-in fully-featured MCP client that makes it easy for you to trigger behavior and inspect both the results and the message passing that happens between client and server.

> <a id="id134"></a>
>
> # What Do I Actually Need to Test?
>
> A near-constant question in software development is “Do I even need to test this?” The answer depends heavily on your situation. Are you building a server for a fun side project? Then you probably don’t need (or want) 100% unittest coverage or a full suite of automated-end-to-end tests. If you’re building a server to be used by large enterprises with strict compliance standards or are handling sensitive data or critical operations, on the other hand, then you probably want to err on the side of over-testing. There is a big gap in between these two extremes, and within that spectrum you may choose to test only the most critical or complex paths, ignoring simple prompt functions, or maybe you decide not to test every failure case in a tool and focus on the happy path. What you decide to test depends heavily on your situation and your risk tolerance, so be sure to think hard about how your server might be used, who might use it, and what kind of data it will be handling when deciding how far to take your testing.

<a id="id106"></a>

## Debugging During Development with MCP Inspector

When you are developing a server, MCP Inspector might be the tool you use the most. We used it extensively in the previous server chapters to interact with the server and inspect tool calls, resources, prompts, notifications, logging, and much more. MCP Inspector is a powerful testing tool: it is a nearly fully-featured MCP client that allows you to manually trigger your server’s functions and inspect the results. Since we discussed the practical aspects of MCP Inspector in [Chapter 5](chapter_5.html#ch05), we won’t cover it in detail here. Instead, we will focus on using it to test your server’s behavior and ensure that it is working as expected.

<a id="mcp_inspector_main_menu"></a>

![MCP Inspector's main menu]({{ site.baseurl }}/assets/ai-agents-with-mcp/chapter_7/mcp_inspector_menu_AvxK.png)

*Figure 7-1. The main menu of MCP Inspector. The left panel shows the connection setup, with options for transports, authentication, and connection configuration. The top menubar allows you to navigate to different specific Inspector sections that allow you to visualize primitive functionality (such as list and execute functions) as well as more advanced functionality like server pings, sampling monitoring, elicitation interaction, root configuration, and authentication inspection.*

[Figure 7-1](#mcp_inspector_main_menu) shows the Inspector’s main menu and describes the navigation panels and their functionality. In the main view, you will see panels for interacting with the server features you will be testing. In this screenshot we are inspecting resources, so that means we can see trigger `resources/list`, `resources/templates/list`, and `resources/read`. The bottom panels show you message history between the Inspector client and the server on the left, and the right shows any notifications, including logs and output to `stderr`, making this panel very handy for print debugging. MCP Inspector is a powerful tool and excellent choice for first-line server testing and debugging. It is also very easy to incorporate new changes to your server: just hit the “Restart” button in the connection panel and the latest version of your server will be loaded and ready to test. In addition to working with the primitives, the Inspector allows you to view and accept or deny sampling requests during a tool call, displaying both the request object and the resulting model call.

<a id="mcp_inspector_sampling"></a>

![MCP Inspector showing a sampling request in progress]({{ site.baseurl }}/assets/ai-agents-with-mcp/chapter_7/mcp_inspector_sampling_AvxK.png)

*Figure 7-2. MCP Inspector showing a sampling request in progress, with the sampling request on the left and the model call object on the right.*

In [Figure 7-2](#mcp_inspector_sampling) you can see a sampling request in progress, triggered by a tool call initiated within the Inspector. You can see the exact request object on the left and what the model call object will look like on the right. The Inspector allows you to accept or deny the sampling request so that you can test and debug both outcomes of the approval/denial process, something clients are strongly encouraged to implement. When testing your server, you should review the MCP documentation for the suggested user interaction models and recommended best practices. Doing this will help you anticipate the common usage and client integration patterns (such as getting user approval for sampling requests) so that you can manually test your server’s behavior with more confidence that you’re closely reflecting real-world conditions that your server will encounter.

While you are probably familiar with at least some techniques for manually testing the code you write, every subdiscipline has its own tools and techniques that can take some time to master. This is also true for developing MCP servers. To get familiar with the development and debugging workflow for MCP servers with MCP Inspector, we will build off of the debugging workflow suggested in the [MCP Inspector documentation](https://modelcontextprotocol.io/docs/tools/inspector#development-workflow) and create a step-by-step workflow for debugging and testing your server while you develop it. If we think about how we’ve developed our small example servers thus far, we can break down the development and testing workflow roughly into the following steps:

1. Build your server code skeleton and connection logic, then connect Inspector locally. Test connectivity and primitive listing functions to ensure your functions are listed correctly.
2. Start writing your functions. Once you finish one, refresh the connection in Inspector, test listing it and running it (happy path) and repeat. Use logging or print to stderr to help debug/trace logic.
3. Once done with this to cover your happy paths, start testing potential interactions (e.g. tool call with elicitation), edge cases, failure cases, notifications, logs, everything.
4. If your goal is a remote server, deploy (see if you can local test with a remote transport), test connectivity, latency, etc.

First things first: write the basic skeleton of your server. Like we did in [Chapter 5](chapter_5.html#ch05), we can create a server that does nothing but run and allow connections to be made to it, then add function signatures for the primitives and other features you want to support. You can have them either raise a `NotImplementedError` or `pass` to indicate that they’re not implemented yet. Next, start up MCP Inspector and connect to your server, just as in [Chapter 5](chapter_5.html#ch05). Make sure you can connect to the server, then go back to your server code and start implementing your first function. Once the first draft is complete, navigate to the appropriate menu item or items in MCP Inspector to test the function:

- **Resources**: If you provide a resource or resource template, in the Resources view you should be able to view the resource(s) or resource template(s) by clicking “List Resources” or “List Templates.” You should then be able to load and view a specific resource or resource template in the “Select a resource or template” pane. These should open and display their contents correctly, take parameters if you’re testing a resource template, and handle unexpected parameter values gracefully.
- **Prompts**: If you are testing a provided prompt, you should be able to view all prompts your server provides by clicking “List Prompts” in the Prompts view. When you select one, you can click “Get Prompt” in the right panel to load the prompt and see the JSON object representing it. For parametrized prompts, you will see dropdowns with space for you to fill in the prompt parameters, which you should see in the resulting prompt object.
- **Tools**: If you’re developing an MCP server, the chances are good that you’re building tools. Like with prompts and resources, the first pane tests the list call and will list any tools you have in your server. You can click on a tool in the list to run it in the right pane. If the tool takes arguments, you will be given space to fill them in. If the tool takes complex objects as arguments, you will have to provide a JSON representation of that object. The right pane also displays the expected output schema for the tool, so you can verify without even running the tool that it will the correct output type and shape. Running the tool will result in the JSON object representing the message returned by your server with the tool function’s results. You will also see a success or error result alonbg with any accompanying messages.
- **Ping**: This one is pretty simple: you click “Ping Server” in the Pings view, the Inspector will send a ping request to the server. You can see the ping request and expected empty response in the History pane as well as a log message in the Server Notifications pane that shows that a ping request was sent.
- **Sampling**: This view is used in conjunction with the Tools view. If you are testing a tool that makes a model call, you will call the tool in the Tools view, then you will see a notification badge over the Sampling menu item. Move to this view, and you will see on the left the sampling request object that would be sent to the client. You can approve or reject the sampling request, which won’t actually call an LLM, but will show you any notifications that result from that action, allowing you to test the approval/rejection process itself as well as gain insight (via logging) into the code paths taken by each choice. When complete, you can see the final results back in the Tools view.
- **Elicitations**: This view works just like the Sampling view, but for elicitation requests. Since elicitations are initiated by the server within tools, you’ll have to call a tool that requests an elicitation from the client in the Tools view, then move to the Elicitations view. You should see the request that gets delivered to the user as well as the request schema in the left pane, and then a generated form in the right pane. Here, you can test that the form has the correct fields, inspect the JSON object representing the form and any entered values, test unexpected or disallowed form values, and test the submit/decline/cancel flows with the buttons provided under the form. Like with sampling, you can see the final results back in the Tools view. This will be more useful since elicitations don’t rely on a stubbed-out model call, so you can see the entire flow of the tool call and elicitation request/response.
- **Roots**: Roots can be a bit more complex to test depending on what you do with them. Generally, they’re used to restrict server access to a specific location in the filesystem, but can be used for any URI. These are generally applied to tool or resource functions, so if your server supports roots, your testing workflow will consist of adding roots to the MCP Inspector client in the Roots view, then running your tool or resource function with the roots applied. When you load the resource or call the tool, you should be able to tell from the results or from your own logging whether or not the roots were respected and if the correct code paths were taken.
- **Auth**: We will discuss authentication in more detail in the \[Link to Come\] section, but to test your authentication workflows, you can run through a guided OAuth flow or the standard automatic OAuth flow with the “Quick OAuth Flow” button in the Auth pane. Below the top panel, there is an OAuth Flow Progress panel that shows you the results of each step of the flow, giving you visibility into the results of each step of the flow, along with any errors that occur.

Use the appropriate view for the server functionality you’re building, and inspect the input and output objects to ensure they are correct and match your expectations. Be sure to also make use of the History and Server Notifications panes, which allow you to see all MCP function calls made with their request and response objects and all notifications sent by the server, respectively. Focus on ensuring the happy path works as expected. Once you have that complete, you can move on to testing edge cases, expected failure points, notifications, logs, and anything else that is appropriate for the type of server you’re building (see \[Link to Come\]). Then, for the next feature or behavior, repeat this full process. Once you’ve built and tested each feature, you can move on to testing your deployment process and the deployed server itself.

###### Warning

In MCP Inspector, it’s not always obvious that the displayed JSON object is truncated in some way, especially when it comes to long strings. The MCP Inspector uses ellipses (…​) to indicate that a field value is truncated, but for truncated string values, the ellipsis will appear within the double quotes of the string, appearing as part of the string itself. If you see this, you can click in the general area of the ellipsis to display the full field value.

Using the development and testing workflow described above, you can more rapidly iterate on your server code, seeing the results of your server almost immediately after making changes. This workflow ensures development is done hand-in-hand with testing, allowing individual behaviors to be fully tested and validated on their own before moving on to the next one. This whole workflow is enabled by the near-instant feedback MCP Inspector provides, allowing you to see the results of your server’s behavior almost immediately after making changes. There is still more to cover, however. While there are specialized debugging and testing tools for MCP servers like MCP Inspector, these are manual and time-consuming. We can automate some of this testing process by writing unit tests, which will focus on the logic in each function only, and automated integration tests, which will test the interactions between your server, its clients, and its external dependencies.

> <a id="id135"></a>
>
> # Integration Testing with Claude Desktop
>
> You can also do integration testing with Claude Desktop which, given its popularity, is a likely candidate for the client your users will use to interact with your server. This makes it a good tool for integration testing your server with a real-world MCP client and working model calls. Beyond its popularity, Claude Desktop works well as an integration testing tool because it’s a general-purpose chat application with minimal alterations to the system prompt, allowing you to test your server’s behavior with an actual application but little else between you and your server. It also writes detailed metadata logs of its chat sessions, including server connections, message passing, runtime errors, and more. On Macs, these can be found in the `~/Library/Logs/Claude/` directory. You can also use Chrome DevTools after enabling it by adding `{"allowDevTools": true}` to Claude Desktop’s `developer_settings.json` file and then opening DevTools with `Ctrl + Shift + I` on Windows and Linux or `Cmd + Shift + I` on Macs.

<a id="id107"></a>

## Testing Your MCP Server, Automated

Automated testing usually involves writing tests in code that can be run automatically to verify the correctness of the server’s behavior. While there are many different types of automated testing, the most common ones are unit and integration tests. Unit testing MCP servers isn’t much different from unit testing any other code. You’ll use the same tools (like Pytest) and techniques (like mocking outside dependencies and creating test fixtures), use the same metrics (like test coverage), and cover both the code’s happy path and any potential failure cases. Mocking is important here, because servers often rely on many external dependencies, especially if they are sending requests to connected clients alongside the more common dependencies like databases and APIs.

Because of the nature of servers, integration testing is also very important: servers don’t do much without interacting with clients, and so you will also need to perform tests that cover interactions not only between your server and clients, but also between your server and any external dependencies it may have. Many of these you can automate: testing connecting to and disconnecting from clients, testing any functions that call external APIs with real API calls, using test tables to test functions that make database queries, loading test files for resource and prompt functions, all using expected inputs and outputs. You can also write more widely-scoped automated tests with a simple MCP client that makes requests to the server and verifies the results, putting the full server functionality under test. In most cases, though, you will be best served by first implementing the workflow discussed in \[Link to Come\], only writing automated test suites after you have at least verified the basic functionality of your server when interacting with actual clients using the protocol.

Arguably, the most important test is a kind of end-to-end test that is front-and-center in the world of machine learning and especially generative AI: *evaluations*. Evaluations are a way to assess the behavior of models, and for the MCP server developer they provide insights into how your server is utilized by different models, the quality of your documentation and naming scheme for your primitives (especially your tools), and more.

<a id="id108"></a>

# Evaluations

If you come from a machine learning background, you might be familiar with evaluations as a way to assess the performance of a trained model. If you don’t, when traditional machine learning models are trained, a portion of the total data is held back from the training process and then used after training to assess the model’s performance using metrics like accuracy, precision, recall, F1 score, and more. Often, these results are compared against other versions of the model or against a baseline model to decide if the model should be deployed or not. This process allows you to iteratively improve the model’s performance over time. In generative AI, however, we aren’t typically training several versions of a large language model to compare against each other, but evaluations still have an important role to play.

Instead of allowing us to iterate on the model itself to improve its performance, evaluations in generative AI allow us to iterate on our prompts (including tool names and descriptions) by allowing us to test them against a variety of models for accuracy, correctness, output formats, tool choice accuracy, cost, and more. You can even use an LLM to evaluate the output of your prompts against a rubric you develop or against predefined metrics like answer relevance or factuality. Whether you write your own evaluations or use a tool to create evaluation prompts and view the results, it is important to properly scope your evaluations.

<a id="id109"></a>

## Evaluations in the Context of Model Context Protocol Servers

Evaluations are typically used by developers of intelligent and agentic applications to assess their overall performance. As an MCP server developer, you have very little control over how agent applications will use your server, so the utility of evaluations is somewhat limited and very dependent on what your server provides to its users. Across all of the features an MCP server can provide to client applications, there are a few key areas that are worth running evaluations on to some degree: prompts, tool use, and sampling.

When evaluating prompts, there are a few dimensions that you could evaluate across: response accuracy, accuracy across several different models, and cost are some of the most important. To evaluate accuracy, there are a few techniques you can use. First, you could simply check that the response contains a specific string. This is the simplest check, but runs the risk of false positives and false negatives: false positives if the response contains the string but in the wrong voice or with the wrong response, and false negatives if the response doesn’t contain the string but is correct.

You can improve on this by creating a rubric for the response and using another LLM to grade the response against the rubric (*LLM as a judge*). This is more complex and potentially more costly, but when done correctly, it can be a very powerful tool. For both of these techniques, many evaluation tools allow you to run your tests against several different models to see how they perform and at what cost. Typically, this would be used to hone in on a single model that performs best or most efficiently. For the server developer though, it’s more important that your prompts are performant across a variety of models and at a reasonable cost, since you don’t have the luxury of selecting the model your users will use. Additionally, if your prompt includes tool calls, you can evaluate the accuracy of the model’s choice of tool, the output of the tool call, and the structure of the tool call request itself.

You can also use evaluations to test your tools in a more end-to-end fashion. While you can’t usually predict which models and prompts your users will use, you can develop a set of queries that you’d expect your users to use and then test your tools against them. Your tests should at least include testing that the expected value is included in the response and that the tool call returns the expected structures, such as a valid tool call response object.

Some evaluation tools, like [Promptfoo](https://promptfoo.dev), include built-in tests to ensure that valid tool calls are being made. As with prompts, you should also run your tests against several different models to get a better idea of the cost-performance curve for your tools. These tests won’t be as precise as those on your prompts, but they can give you a good intuition for how your tools could perform in the real world while forcing you to think deeply about how users might use what your server provides. If your tools utilize sampling requests, you can also evaluate the sampling prompts directly, just as you would an MCP server prompt.

<a id="id110"></a>

## Evaluations in Practice

What would running evaluations on a server look like in practice? This will depend largely on two things: 1) what you’re evaluating and 2) how much return on investment you’ll actually get from evaluations. If you’re building a small server for a side project, or one that is only available local to the client that uses it, you may decide that evaluations are not worth the time and effort, and you wouldn’t be wrong, strictly speaking. Now, if you’re building a remotely accessed server that handles sensitive data or critical operations, investing time in building evaluations becomes a no-brainer. But still, as a server developer, evaluations are quite limited.

The simplest thing to evaluate are your prompts, whether these are prompts that your server exposes or prompts that you use with sampling. To evaluate them, you can just load your prompts into your preferred evlauation tool and run them directly against however many models you want to test against and see how they perform. You can start by looking directly at the responses and costs across different models, look for any patterns, and tweak your prompts to move towards your desired outcome. If you provide many prompts, however, this quickly becomes impractical. It also has limited utility for getting a more general sense of how any prompt performs per model: you will get slightly different responses from the same model with the same prompt, and a good evaluation tool will allow you to easily run your prompts against each model as many times as you’d like and provide summary statistics on the results. To do so, you’ll need an automated way to evaluate the correctness of the response. This can range from something as simple as ensuring that the response contains a defined substring, to something as complex as using an LLM as a judge to grade the response on a rubric or writing your own code to evaluate the response.

To summarize, the process of evaluating prompts that your server provides or uses with sampling can be constructed as follows:

1. Load your prompt or prompts into your evaluation tool.
2. Run each prompt againsst a common model a few times to get a sense of the response and cost.
3. If there are any glaring issues with the response, tweak the prompt and re-run.
4. Once comfortable with the response, write simple automated tests, such as checking that the response contains a certain string or maintains a certain structure.
5. Use these simple tests to run your prompts against a variety of models that aligns with what you expect your users to use using multiple calls to each model.
6. Refine your prompts based on the results of the evaluations.
7. If desired, define rubrics or custom metrics for your prompts and use an LLM as a judge to grade the responses on the rubric.
8. Refine your prompts based on the results of the evaluations.

###### Note

The act of exploring where your prompts fail and refining them to reduce failures is referred to as **error analysis**. Hamel Husain’s [Field Guide to Rapidly Improving AI Products](https://hamel.dev/blog/posts/field-guide/index.html) is an in-depth guide on using error analysis for end-to-end AI products, but its principles can be applied to evaluating MCP server prompts as well.

Evaluating tools can be a bit more difficult. Typically as a server developer, you don’t have access to usage telemetry or logging (often referred to as **traces**) to get problematic prompts from your users. Instead, you have to come up with your own queries that align with how you think your users will use your tools. While users will almost always surprise you, you can still come up with a reasonable set of queries or tasks to test your tools against.

Naturally, you will also need expected results to judge against. Once you have your queries, you can run them with your tools against a model of your choice. A simple way to do this is to write a script that calls the LLM API directly within agentic loops, allowing each model call the opportunity to call your tools and see how they perform. For each result, you can check the final response object to ensure it contains the expected output, that the appropriate tool was called, and that the tool call request object matches the expected structure.

If your API provides cost or token consumption metrics, you can also report on those. The potentially significant downside to this approach is that you will also have to write (and debug) these test conditions, rather than having them built-in to your evaluation tool. This approach is recommended in Anthropic’s [Writing Tools for Agents blog post](https://www.anthropic.com/engineering/writing-tools-for-agents). In [Example 7-1](#simple_evaluation), you’ll see a simple test script that loops through prompt-tool pairs, calls the model with each one, and detects if the model calls the correct tool. It then calculates a tool call accuracy score based on the number of correct tool calls divided by the total number of prompts.

This is a very simple but powerful test script. With it, you can quickly run a number of prompts that you expect your users to use and ensure that your tools are performing as expected. This can allow you to identify and fix issues with their signatures or descriptions should they come up. Several tools do this kind of testing for you, such as [Promptfoo](https://promptfoo.dev).

<a id="simple_evaluation"></a>

##### Example 7-1. Simple evaluation script for tool calls

```python
client = Anthropic(api_key=api_key)

tool_choice_score = 0
for prompt, expected_tool_choice in TEST_PROMPT_TOOL_CHOICE_PAIRS:
    conversation_messages = [
        {"role": "user", "content": prompt},
    ]
    # Call Claude API with available tools
    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4096,
        messages=conversation_messages,
        tools=TOOLS,
        tool_choice={"type": "auto"},  # Let Claude decide when to use tools
    )

    # Check if Claude wants to use tools
    if response.stop_reason == "tool_use":
        # Extract all tool use blocks from the response
        tool_use_blocks = [
            block for block in response.content if block.type == "tool_use"
        ]

        if (
            len(tool_use_blocks) == 1
            and tool_use_blocks[0].name == expected_tool_choice
        ):
            tool_choice_score += 1

print(f"Tool choice score: {tool_choice_score}")
print(
    f"Tool choice accuracy: {tool_choice_score / len(TEST_PROMPT_TOOL_CHOICE_PAIRS) * 100}%"
)
```

###### Note

This script is a partial example, for the full code, see the [code repository](https://github.com/kylestratis/ai_agents_mcp_examples/tree/main/ch7_code) that accompanies this book.

In [Example 7-1](#simple_evaluation), first an Anthropic client is set up. Then we iterate through a list of tuples that contain a prompt and the expected tool choice. For each pair, we call the model with the prompt and check for a `tool_use` stop reason. If we find one, we parse it, and update the tool choice score if the tool choice is correct. After the test loop, we print the raw score and percentage accuracy. Of course, this doesn’t tell you much about how the server will work in practice, since it doesn’t (and can’t) replicate a user’s actual environment or interactions with the server.

If you want your test to be more end-to-end, you could also write a simple client to connect to your server and use that with your evaluation loops. This is more complex and may make failure analysis more difficult by introducing additional failure points beyond those of the tool calls themselves. Some evaluation tools, like [Promptfoo](https://promptfoo.dev), include built-in MCP integrations, allowing you or the users of your server to connect directly to your server to test it.

This can allow you to focus on writing evaluation tasks rather than building agentic loops directly and use your tool’s built-in tests and metrics to assess the quality of your tool calls. There are also MCP-focused evaluation frameworks, such as [mcp-eval](https://github.com/lastmile-ai/mcp-eval) (Python) and [mcp-evals](https://www.mcpevals.io/) (Node), which can help you write, run, and integrate into your CI/CD pipeline MCP server evaluations.

While evaluations are useful for ensuring your server tools and prompts work as expected, they alone can’t ensure your server is secure. You will have to take various defensive measures to keep your users safe and your server secure. In the next section, we will discuss some of the most common vulnerabilities that can affect your server and how to mitigate them, how to approach MCP server security from an architectural standpoint, and then wrap up with a few conceptual frameworks that will guide you in designing and building secure MCP servers and, more generally, AI agents.

<a id="id111"></a>

# Server Security

Large language models are powerful tools, but the ability to interact with them using highly variable natural language prompts explodes the attack surface for the models themselves as well as any applications built on top of them, including agents. This means that there are nearly infinite ways to attack and exploit these systems, and so for many attacks, it’s not a matter of detecting all possible permutations of the attack, but designing your agentic applications, including your MCP servers, such that these attacks can’t be successful. To understand how to secure your servers, understanding common vulnerabilities and their potential mitigations is key. Once we have developed a basic intuition for these vulnerabilities, we will zoom out to more general security techniques and principles that you can apply to your servers to keep them secure and your users safe. If you’ve implemented secure multi-tenant systems previously, these points will be familiar to you, including OAuth, the Principle of Least Privilege, humn-in-the-loop, observability, sandboxing, and more. Finally, we will wrap these up with a few conceptual frameworks that will guide you in designing and building secure MCP servers and, more generally, AI agents.

<a id="id112"></a>

## A Taxonomy of Vulnerabilities

Let’s first take a rough inventory of common vulnerabilities and how we can address them. First, we’ll start with vulnerabilities that are not new to the software development work: SQL injection, command injections, , , but are still relevant to MCP server development. Then we will move on to vulnerabilities that have arisen due to the unique properties of LLMs and MCP. This list is not exhaustive, and only focuses on vulnerabilities that can affect MCP servers directly. Still more vulnerabilities exist for agentic applications that use MCP, but we will cover those in Chapter 9.

<a id="id113"></a>

### Injection Vulnerabilities

This class of vulnerabilities includes *SQL injection*, *command injection*, and *prompt injection*. SQL injection is a vulnerability where a user is able to inject arbitrary SQL commands into a database query, which can lead to data exfiltration, exposure of sensitive data, data corruption, and even total system compromise. This vulnerability has been around for decades, with the first known written mention of the exploit published in \[Phrack Magazine\]([*https://web.archive.org/web/20140319065810/http://www.phrack.com/issues.html?issue=54&id=8#article*](https://web.archive.org/web/20140319065810/http://www.phrack.com/issues.html?issue=54&id=8#article)) by Jeff Forristal in 1998. SQL injection was originally exploited in web applications with unsecured forms that allowed users to input text that was used by the application’s backend in a SQL query. These queries used string interpolation to insert the user’s input into the query, and so malicious actors could include a `'` to break out of the string and then include any SQL command they wanted. The classic XKCD comic “Exploits of a Mom” illustrates this vulnerability with a simple example that deletes a hypothetical database table called “Students”:

Command injection is similar, except user input is able to execute arbitrary CLI commands on the system. This, like SQL injection, can lead to similar outcomes as SQL injection, including complete system compromise. Both of these vulnerabilities can be relevant to MCP servers, especially if your server is used to access a database or execute CLI commands. If your tools have this kind of access, your first line of defense shold be to sanitize all user input. Luckily, when your tools are called, their parameters are filled in just like any other function call, so you don’t have to worry about the near-infinite attack surface of LLMs here.

Prompt injection is a common attack vector for LLMs and agentic applications. Prompt injection borrows its name from SQL injection, but instead of injecting SQL commands into a valid database query, prompt injection allows a user to inject arbitrary text into a model’s system prompt. This can lead to a variety of outcomes, similar to that of SQL injection, including remote code execution, data exfiltration, and more. Prompt injection works because both ends of a tool call - on one end, the tool name, description, and parameters, and on the other, tool results - are loaded into the calling model’s context and have the potential to be used as a prompt by the model.

###### Note

Prompt injection is an often-muddied term. We use prompt injection here to refer to the ability of a user to override a model’s behavior by using a user prompt to override a model’s system prompt or other prompts in a prompt chain. This is separate from *jailbreaking* a model, which is sometimes incorrectly referred to as prompt injection and refers to bypassing a model’s built-in safety guardrails.

For MCP servers, prompt injection is a significant risk, and any time an application using your server accesses untrusted input, whether it be webpages, emails, files, or other data, your server can become a vector for prompt injection attacks. A webpage can contain malicious instructions to make additional tool calls, like calling a file read tool to read a sensitive file and then send that output back to the attacker without notifying the user. There are several mitigations to this kind of attack, some of which are your responsibility as the MCP server developer, and some of which are the responsibility of the applications using your server.

As a server developer, you can only partially mitigate these attacks, since a prompt can consist of anything. This means that you will have to consider prompt injection *consequences* that your tools might be vulnerable to (such as restricted file access, privilege escalation, etc.) and how to mitigate them. Once you’ve identified these, you may identify structural mitigations you can implement. For example, you can run your server in a container to isolate it from the host system and prevent a rogue prompt from getting an agent to access private data. Many times, though, either a structural mitigation isn’t enough on its own or doesn’t even exist for a given attack. In these cases, you can turn to code-level mitigations, such as input sanitization, or, in our example of unauthorized filesystem access, a denylist of sensitive directories.

Another common prompt injection attack is to hide malicious instructions on a webpage that a server’s tool is directed to access. The website can look perfectly innocent, but the LLM will be able to see the malicious prompt and potentially return it back to the agent as the output of the tool call. If your server contains tools that access webpages, you should always validate and sanitize the URLs and loaded content of the webpage. This can mean precisely targeting specific HTML tags, detecting encoded or obfuscated content, and more.

These code-based detection techniques are helpful, but alone they are not enough to protect your server from prompt injection attacks. As much as you can, use architectural approaches to mitigate these attacks, such as isolating or sandboxing your server and taking advantage of OS-level permissions to prevent the server from accessing sensitive data or executing dangerous commands.

There are a number of techniques you can use to defend against these exploits: - Use parametrized SQL queries instead of string interpolation for inserting user input into SQL queries - Allowlist shell commands or prompts - Sandboxing the environment in which shell commands are executed - Locking down file permissions for the system in which shell commands are executed - Setting up user permissions in your database to allow tools to have severely restricted database table and command execution permissions

Ideally, you will combine both code-level defenses like input sanitization and allowlists with architectural defenses like sandboxing and defining file and table permissions for your tools.

<a id="id114"></a>

### Access Control Vulnerabilities

Another common web security vulnerability that can affect your remote MCP server is a lack of access control - if your server is remotely accessible, it is most likely a multi-tenant system, which means that you will have to ensure that you have access control at the level of objects that your tools and server access such that user A can’t access objects that belong to user B and vice versa. You may also need to maintain access control at the function or tool level, especially if your server provides segregated tool access like a paid tier or admin-scoped tools. Access control for remote servers is a complex topic, but much of it can be handled via declarative policies, role permissions, and access gateways.

<a id="id115"></a>

### DoS/DDoS Vulnerabilities

*DoS/DDoS* (Denial of Service/Distributed Denial of Service) attacks are another common vulnerability that can affect your remote server. These attacks occur when a malicious actor sends a large number of requests to your server, either from a single node (DoS) or from many, often compromised nodes (DDoS). These attacks can overwhelm your server’s resources, causing it to become unresponsive or even crash. These attacks can be prevented by implementing rate limiting, request throttling, and other techniques to head these attacks off at the pass.

<a id="id116"></a>

### Token Passthrough

*Token passthrough* is an attack vector (as opposed to an attack in and of itself) where an MCP server passes authorization tokens from MCP clients to third party services that the server is providing access to without validating the token. Passing authorization tokens from clients to servers is expressively forbidden in the MCP authorization specification, but there isn’t any technical mechanism to prevent it. What makes it problematic is that authorization tokens are generated for a specific service and user, and allowing clients to pass their tokens through MCP servers to third-party services makes auditing and monitoring more difficult, as tokens will be seen as coming from the MCP client or its user rather than the MCP server that is actually making the requests to the third-party service.

More importantly, if a server passes tokens without any validation, attackers can steal tokens and use them to access sensitive data or perform actions that the tokens were not intended to be used for. Luckily, this is simple to mitigate: do not pass tokens through your server to third-party services. Ideally, your server will have its own tokens that it can use to access third-party services it needs to do its job, which keeps strong responsibility boundaries between the client and server. If you absolutely must use client-provided authorization tokens, you should at least validate the token and its scope to prevent malicious actors from gaining inappropriate access to third-party services or user data.

<a id="id117"></a>

### Confused Deputy

The *confused deputy problem* is an attack vector that predates MCP and LLMs, but is still relevant today. In this attack, a system with privileges is tricked by one with fewer privileges into performing actions on behalf of it while using the privileges of the more priviledged system. Some common examples of these attacks include cross-site scripting (XSS) and cross-site request forgery (CSRF). In the context of MCP servers, this vulnerability manfests when the server is acting as a proxy for a third-party service, much like with token passthrough, and has its own OAuth static client ID while allowing clients to dynamically register their own client IDs to be used by the server with the third-party service. This attack also requires that the third-party service’s authorization flow sets a consent cookie and, key for the server developer, that the server doesn’t segregate user consent boundaries by client.

This allows an attacker to set up a malicious link to the user that hijacks the original consent cookie from the authorization server, skipping user consent and via a malicious redirect URI obtaining the server’s authorization code. This allows the attacker to obtain auth tokens for the server, giving the attacker access to the third-party service without their own authorization or the required user consent. While this is a complex, multi-step attack, it is both a common one in the wider world of web applications as well as within the world of MCP.

Luckily, though, this can be mitigated with a few changes. The first is to remove the single static client ID and instead use per-user client IDs, triggering a consent flow for each user with your MCP server and securely storing the consent decisions and allowing your server to enforce user boundaries. Once approved (or if a lookup has determined that consent has already been granted), then your server can proceed to use a static client ID for the third-party service. This means that your server must display a consent UI to the user that displays the requesting client’s name, the requested API scope or scopes, and the redirect URI where tokens will be sent. This page also needs to implement proper protections against CSRF and clickjacking attacks.

You also will need to validate redirect URIs in authorization requests against a registry of allowed redirect URIs to prevent malicious redirect URIs from being used to hijack the authorization flow. Finally, if your server is using OAuth for authorization, you will need to generate and securely securely store the value of the `state` parameter after MCP server consent is given but before redirecting to the third-party service. Then you will need to ensure that the parameter is exactly the same value as what you have stored and delete them after validation. While this seems like a complex process, it is largely a standard part of properly implementing OAuth in your code.

If there is one theme in all of these vulnerabilities and mitigations, it is the importance of architectural approaches to security. While code-level mitigations are important and are an essential part of your toolkit when it comes to securing your server, they do have limitations and weaknesses, especially when it comes to LLMs where the attack surface spans the space of human language. Beyond targeted code-based mitigations, let’s look at some of the architecutral and process-based approaches to security that can help you secure your server.

<a id="id118"></a>

## Architectural Approaches to Security

Many of the techniques and systems we will discuss here are likely to be familiar to you, either as a software developer or as a user of software. In this section, we will group them by layers: starting with the foundation of your infrastructure, then moving on to access control, and finally operational controls. While this isn’t a strict hierarchy, it is a useful way to think about how to layer security systems into your server. You also may be wondering whether these layers apply to your server at all. Does a local MCP server need OAuth? No, probably not, just like a remote server doesn’t need additional sandboxing. But a local server absolutely does need to be sandboxed to safeguard the host system from the potential damage that can be caused by a rogue tool call. As we dig into the techniques in each layer, you will see how they apply to your specific use case.

<a id="id119"></a>

### Layer 1: Infrastructure Foundations

The first layer of security is really the foundation of your infrastructure. First, we will look at *sandboxing*, which we’ve discussed throughout this chapter, but never really defined. Sandboxing is the process of isolating an application from the host system and other applications, preventing it from accessing or modifying the host system’s resources. This is critical for both local and remote MCP servers, however remote servers are essentially sandboxed by default when they’re deployed to a dedicated server. Local servers, on the other hand, are not. There are a number of ways to sandbox your server if it’s to be run locally, including using container systems like Docker or full virtual machines like VirtualBox to run your server in a isolated environment. While your users can set up your server in a container or virtual machine themselves, you can also provide them with a Dockerfile and instructions to build and run the server that way. All you need to do is create a file in the project root called `Dockerfile` that defines the container’s environment and dependencies. The below is a minimal example that works with the local MCP servers we built in the previous chapters:

<a id="example_dockerfile"></a>

##### Example 7-2. Minimal Dockerfile for a local MCP server

```dockerfile
FROM ghcr.io/astral-sh/uv:python3.14-trixie-slim ①
COPY . /app
WORKDIR /app
RUN uv sync --locked ②
CMD ["uv", "run", "python", "server.py"] ③
```

- ①: Declare the base image to use for this container.
- ②: Run `uv sync` to install dependencies, use `--locked` to ensure the dependencies are the same as the ones in the `pyproject.toml` file.
- ③: Run the server when the container starts, using stdio transport.

In [Example 7-2](#example_dockerfile), we run a few basic commands. First, we tell Docker to use a pre-built base image. In this case, it’s one provided by Astral, the creator of `uv`, for a minimal Python 3.14 environment with `uv` installed. Then we copy from the current directory to the container’s `/app` directory and set it as the working directory. Then, we install dependencies using `uv sync` and then the server command with `CMD`. To use the server inside of a container, users will need to do the following from the MCP server’s project root, assuming they have Docker installed:

```bash
docker build -t my-mcp-server .
docker run -i my-mcp-server
```

There are also a number of ways to set environment variables in a container if you wish to do so. You can either set them in the Dockerfile using the `ENV` command, or users can set them when running the container with the `-e` flag. More commonly, for user-set environment variables, your user will set them in the `StdioServerParameters` object in their own client code where they will connect to the server. Continuing with the `my-mcp-server` example, a `StdioServerParameters` object would look like the following on the client side:

<a id="stdio_server_parameters_container"></a>

##### Example 7-3. StdioServerParameters object for connecting to a containerized MCP server

```python
from mcp.client.stdio import StdioServerParameters

server_parameters = StdioServerParameters(
    command="docker",
    args=["run", "-i", "-e", "ANTHROPIC_API_KEY", "my-mcp-server"], ①
    env={"ANTHROPIC_API_KEY": "my-api-key"}, ②
)
```

- ①: Run the container in interactive mode so that stdio is used, and `-e` to pass the environment variable from the client process to the container.
- ②: Set the environment variable in the client process.

This server parameters object looks a bit different from the ones we’ve seen previously. Instead of running `uv` directly, we are running the container, since the container will run the `uv` command itself. We also set the environment variable in the client process using the `env` parameter, and then pass the values with `-e` to the container when we run it within that process.

You can also use the Streamable HTTP transport in your server, and even if the server is running local to the user in a container, they can still connect to it with that transport. To run the server, they would need to run the container with `docker run -p 8000:8000 my-mcp-server` and then connect to it with the following client code:

<a id="streamable_http_container_client"></a>

##### Example 7-4. Client code for connecting to a local containerized MCP server with Streamable HTTP

```python
from mcp.client.streamable_http import streamablehttp_client

async def main():
    async with streamablehttp_client("http://localhost:8000/mcp") as (
        read_stream,
        write_stream,
        session_id,
    ):
        async with ClientSession(read_stream, write_stream) as session:
            # Initialize the connection
            await session.initialize()
            ...
```

With this technique, the client will connect to the already running server, assuming it’s running on port 8000, using the `streamablehttp_client` context manager. Your users can also use the client as a regular object, as shown in [Chapter 3](chapter_3.html#ch03). In \[Link to Come\], you will learn more about how to build, containerize, and deploy your server.

###### Note

While it is best that you, the server developer, create the tools for your users to use your server in a container, many MCP servers do not have this included out of the box. In such cases, Docker provides an [MCP Toolkit](https://docs.docker.com/ai/mcp-catalog-and-toolkit/toolkit/) that can containerize any MCP server and run any number of them inside a gateway that clients can access. Along with MCP Toolkit, Docker provides an MCP server catalog of vetted server images built and signed by Docker.

With this, you can ensure your locally-running MCP servers are sandboxed and isolated from the host system, giving your users a layer of protection should the server be compromised or used in an unsafe or malicious manner. Your remote servers, on the other hand, are sandboxed by default when they’re deployed to a dedicated server. You can still deploy them with Docker containers if you are comfortable with them, but they aren’t as necessary for sandboxing if you’re deploying to a dedicated server.

Dedicated servers have other issues to consider, however. A single server process is likely serving many users (MCP clients), and so you need to implement some level of access control to ensure that each user has only the access they need to perform their tasks.

<a id="id120"></a>

### Layer 2: Access Control

The next layer of security is access control. This layer defines how you limit who can access your server and resources and shape how they can access them, and at its core is about the *principle of least privilege*. This states that any user or system should have the bare minimum of access necessary to do their authorized tasks. This is a fundamental security principle that should be applied to any system you build, as it reduces the venues of compromise from malware, malicious users, and other threats. All the tools we will discuss can help you implement this principle by helping you minimize access to your server and its resources. Because we are largely talking about limiting user access to our servers, this layer is particularly important for remote MCP servers.

In order to grant a user access to your server, you will need to implement OAuth 2.1 for authorization. OAuth is an open standard protocol for authorization that allows a user to grant a client application access to a resource without sharing their credentials. Practically speaking, this means that you can use your existing credentials via another identity provider, like Google, to authorize your access to another application, like Spotify or, after this section, your MCP server. If you’ve used Single Sign-On (SSO) with a service like Google or Microsoft, the user flow should be familiar to you.

###### Note

This section covers the bare minimum of what you need to know to implement OAuth for your MCP server. If you want to learn more about OAuth, you can refer to the [OAuth 2.0 framework documentation](https://oauth.net/2/), the in-progress [OAuth 2.1 specification](https://oauth.net/2.1/), or the book [Getting Started with OAuth 2.0](https://learning.oreilly.com/library/view/getting-started-with/9781449317843/) by Ryan Boyd.

In the OAuth specification, there are two servers: a *\_resource server (RS)* and an *authorization server (AS)*. When a user wants to access a protected resource from the resource server via a client application, they will request access from the authorization server, which will give the application a token to access the resource depending on the server’s authorization policy. This typically requires the user to authenticate to the identity provider, and upon successful authentication, the authorization server will give the requesting application a token to access the resource. For example, you can have the authorization and resource servers within the same service, as in Google where the authorization server is Google Accounts, and the resource servers include the various Google services like Gmail, Google Drive, Google calendar, YouTube, etc. Another example is single sign-on for third party services, where the authorization server is Google Accounts, Facebook Login, LinkedIn, etc., and the resource servers are the protected parts of the third party applications that you are signing into, like Doordash.

<a id="oauth_authorization_flow"></a>

![MCP Inspector showing a sampling request in progress]({{ site.baseurl }}/assets/ai-agents-with-mcp/chapter_7/oauth_architecture_AvxK.png)

*Figure 7-3. The authorization flow between a client application, an authorization server, and a resource server.*

In [Figure 7-3](#oauth_authorization_flow), you can see a simplified authorization flow between a client application, an authorization server, and a resource server. When the user wants to access a protected resource, the client application sends a request to the authorization server to get a token. The AS will authenticate the user and give the client application a token. The client application will then request the resource from the resource server using the token. The resource server will then send that token to the authorization server to verify that the token is valid and that the user has access to the resource. The authorization server will respond to the resource server with the result, and the resource server will then fulfill or deny the request based on the result.

The vast majority of MCP servers will be resource servers, where the server provides access to protected resources, like a database or API, to an authorized user. In the MCP Python SDK, the way to do this is to create a class that fulfills the `TokenVerifier` protocol, which requires the class to implement the `verify_token` method. This method will be called by the MCP server to verify the token the client gives you and return either `None` or the validated `AccessToken` object. When you instantiate your server, you will need to provide it with your token verifier as well as an `AuthSettings` object to configure the authorization flow with the authorization server.

In [Example 7-5](#mcp_resource_server_example), we will create a simple MCP resource server with `TokenVerifier` and `AuthSettings` objects and then pass them into the instantiated MCP server.

<a id="mcp_resource_server_example"></a>

##### Example 7-5. Example of a MCP resource server implementation

```python
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from pydantic import AnyHttpUrl

AUTHORIZATION_SERVER_SETTINGS = AuthSettings( ①
    issuer_url=AnyHttpUrl("https://authorization-server.com"),
    resource_server_url=AnyHttpUrl("https://localhost:3001"),
    required_scopes=["read", "write"],
)

class MyTokenVerifier(TokenVerifier): ②
    async def verify(self, token: str) -> AccessToken | None:
        # YOUR VALIDATION LOGIC HERE
        pass

# Initialize FastMCP server
mcp = FastMCP(
    "resource-server",
    token_verifier=MyTokenVerifier(), ③
    auth=AUTHORIZATION_SERVER_SETTINGS,
)

@mcp.tool()
async def example_tool(request: str) -> str:
    """Uppercase the request."""
    return request.upper()

if __name__ == "__main__":
    mcp.run(transport="streamable-http")
```

- ①: Configure the settings for the authorization server. The appropriate values should come from your authorization server’s documentation.
- ②: Implement the token verifier.
- ③: Pass the token verifier and settings into the MCP server.

In this example, we are creating two objects to pass into the `FastMCP` constructor: the `AUTHORIZATION_SERVER_SETTINGS` `AuthSettings` object and the `MyTokenVerifier` `TokenVerifier` object. The `AUTHORIZATION_SERVER_SETTINGS` object holds the configuration for the authorization server that you’re using, and you’ll have to get those values from the authorization service provider. `MyTokenVerifier` implements the `verify_token` method, which will be called by the MCP server to verify the token the client gives you, returning either the validated `AccessToken` or `None` if the token is invalid. You can either roll your own verification or use a library like [google-auth](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.id_token.html) to do it for you.

That is the extent of your responsibility when it comes to implementing OAuth for your MCP server. Once you have these object, you can pass them to the `FastMCP` constructor and it will handle the rest. Next, we will look at what we can do to enforce access control on your server and resources. Beyond user boundaries for data access, we might also want to confine what actions a user takes based on their role. This can be achieved with *role-based access control (RBAC)*.

RBAC is a common access control model where policies authorizing certain actions are based on a user’s role in an organization or system, rather than their specific individual identity. This requires modeling the possible roles of your users as well as the actions they should be able to perform, keeping in mind the principle of least privilege. This sort of access control can be found in AWS IAM and Kubernetes as a few examples, but can also be found in your daily life. For example, at your doctor’s office, the receptionist may have access to a patient’s contact information and appointments, but not their medical records. A nurse may be able to view and update their patients’ medical records, but not others, while doctors may be able to view and update all medical records.

So how do we apply this to MCP servers? One way is to use an *MCP gateway*. This is a network-level construct that is situated between your deployed MCP servers and the clients that access them, and its location in the network makes it a perfect place to enforce access control policies. In addition to enforcing these policies, some gateways are able to manage overall traffic, authentication and authorization, routing requests to the appropriate servers, and even providing a control plane to allow administrators to manage the servers that the gateway is proxying requests to. For some examples of MCP gateways, you can see [Microsoft’s MCP Gateway](https://github.com/microsoft/mcp-gateway), [Docker’s Docker MCP Gateway](https://github.com/docker/mcp-gateway), and [Arcade](https://www.arcade.dev/).

Gateways are great for large-scale deployments with multiple servers or a cluster of servers, and can handle and centralize many of the security concerns of individual MCP servers for a cluster of servers. However, without the next layer, operational controls, you will have little visibility into what is happening on your servers and being proactive about security.

<a id="id121"></a>

### Layer 3: Operational Controls

Operational controls are the final layer of this security model. There are a number of tools and techniques to help you implement these controls, but this section will focus on some of the most impactful ones: observability, supply chain management, and human-in-the-loop monitoring.

Observability is the ability to see what is happening on your servers and resources, either in real time or immediately after the fact with logs. In a production deployment, you should include all of the standard observability tools: structured logging, tracing, alarms for critical events, and performance metrics. Which tools you will use will depend on your specific needs and the tools you are comfortable with. While many cloud vendors provide their own observability tooling, vendor-agnostic open-source tools like [OpenTelemetry](https://opentelemetry.io/) exist to help you collect and analyze these metrics and logs no matter where your servers are deployed, and tools like [Prometheus](https://prometheus.io/) help you store, query, and visualize these metrics. There are also several AI-oriented observability platforms that are compatible with OpenTelemetry, like [Langfuse](https://langfuse.com/) which can be useful if your server calls LLMs or if you’re also building agentic applications.

In addition to monitoring various use-based events on your server and any wider deployment infrastructure, you need to monitor the integrity of your server’s supply chain. This means things like keeping dependencies up to date and regular vulnerability scans of your code and its dependencies, including not just your code’s directly imported dependencies but external ones like database server software. Tools like [Trivy](https://github.com/aquasecurity/trivy) and [Semgrep](https://github.com/semgrep/semgrep) can help you with this and are great additions to your CI/CD pipeline.

Finally, inserting a human into the process loop is a critical part of any security infrastructure. For many features, the MCP spec *requires* a human to approve or deny a request (these are largely covered in [Chapter 6](chapter_6.html#ch06)), however there is nothing special that the server developer needs to do to implement this: human approval of server operations is a client-side responsibility. Your calls that require human approval need to be written to handle the HITL process, such as elicitations, and parse the expected approval response from the client. See \[Link to Come\] for an example.

[Table 7-1](#security_techniques_table) summarizes these techniques and tools, including the layer they belong to, what kind of deployment they are most useful for, and any additional notes or descriptions.

<a id="security_techniques_table"></a>

*Table 7-1. Security techniques and tools, by layer and deployment type*

| Technique | layer | Function | Used For | Notes |
| --- | --- | --- | --- | --- |
| Sandboxing | 1 | Limit the resources available to the server | Local | Can be done with container technologies like Docker |
| OAuth | 2 | User boundaries, limited-scope access | Remote | Helps to enforce user boundaries, gives fine-grained access control to resources |
| Role-Based Access Control | 2 | Restrict actions based on user role | Remote | Helps to enforce access based on job function |
| MCP Gateway | 2 | Intercept, manage, and route incoming requests | Remote | Enforce access control and network security policies for many servers |
| Observability | 3 | Monitor and log server and resource usage | Local & Remote | Helps to detect and respond to security and hardware incidents |
| Supply Chain Management | 3 | Keep dependencies up to date and scan for vulnerabilities | Local & Remote | Helps to detect and fix 3rd-party vulnerabilities |
| Human-in-the-Loop Monitoring | 3 | Include human judgment and approval in sensitive operations | Local & Remote | Certain MCP operations require human approval, and humans should be involved in sensitive deployment operations |

This layer-based approach is one way to think about security for your server, but it isn’t the only one. Understanding security through the lenses of different frameworks and principle can help you design and build more secure MCP servers specifically and software generally.

<a id="id122"></a>

## Security Frameworks

As people have used LLMs, agents, and MCP more and more, a number of attacks, best practices, and frameworks have emerged to help the community understand how to safely harness the power of this new kind of software. In \[Link to Come\], we introduced a layer-based approach to MCP server security and the tools and techniques that existed at each layer. In this section, we will discuss two more security frameworks that can help you design and build more secure MCP servers.

The first is Simon Willison’s [Lethal Trifecta](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) framework for guarding against prompt injection, which defines specific capabilities of agent tools and agents themselves that increase the risk of private data exposure via malcicious prompts.

<a id="id123"></a>

### The Lethal Trifecta

The *Lethal Trifecta* is a group of three capabilities that, when used together, make it easy for an attacker to use a malicious prompt to access sensitive data or perform destructive actions. The three capabilities are:

- access to private data
- exposure to untrusted content (like web pages)
- communication with third parties

If an agent has these three capabilities, then they are at risk of being used to exfiltrate private data via prompt injection. An agent with access to private data provides attackers the data they want to retrieve, while the exposure to untrusted content provides the attack vector.

Like we talked about in \[Link to Come\], untrusted malicious content exists everywhere and often uses hidden or otherwise obfuscated text to hide the malicious content. When your agent reads it into its context, it will have that prompt and likely respond to it.

The third capability, the ability to communicate with third parties, is what enables the attacker to actually access the private data that the agent has access to.

All of this goes doubly so for tools or tools that are expected to work together. Make it safer for your users to use your server and your tools by ensuring that your individual tools, higher-level workflows, and server itself don’t have these three capabilities together.

Sometimes, however, that can’t be avoided. For example, in 2025 an attack on the official GitHub MCP server was demonstrated what can happen when individual MCP servers carry this vulnerability on to the agents that use them. A user was able to open a PR with a malicious prompt on a public GitHub repository (exposure to untrusted content) that requested that the agent read all of the user’s READMEs from all the repositories that the agent can see via the GitHub MCP Server (access to private data).

The prompt instructed the agent to update the code with this private data (ability to communicate with third parties) on the repo, which it dutifully did, exposing the private projects to the world. An MCP server like GitHub’s can’t directly address the lethal trifecta: you’ll lose significant and desired functionality if you completely remove all of the tools that belong to any one of the individual capabilities.

###### Note

The GitHub MCP server attack was an example of the Lethal Trifecta in action. You can see the demonstration PR [on GitHub](https://github.com/ukend0464/pacman/issues/1) to get an understanding of what a malicious prompt can look like.

This is where the architectural solutions we’ve been talking about come into play. Docker demonstrated how their [MCP Gateway](https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/) can intercept incoming requests to the server with middleware that detects problematic behavior. For this specific attack, the gateway’s middle way detects a GitHub user attempting to access a repo other than the one they are using to deliver the malicious prompt.

This method surgically removes the “access to private data” capability, not from the agent, not from the server, not even from the malicious user themselves, but from the request iteself attempting to access other repositories. This is no longer a trifecta, and your users’ private repos are safe.

They also present other mitigations that follow our layer framework. For example, at layer 1, we have server sandboxing. This means more than just putting your server in a container: you should put up guardrails around the container to limit its resource usage, network access, and resources it can access. layer 2 is all about access control, and moving from broadly-scoped personal access tokens (PAT) to short-lived fine-grained OAuth scopes would also help mitigate this attack.

This is because OAuth tokens can be scoped to a single repository, taking another approach to removing the “access to private data” capability, and the credentials can be revoked instantly if needed. OAuth also helps us at Layer 3, because OAuth events can be logged and monitored to detect suspicious activity, fulfilling the observability aspect of the layer.

<a id="id124"></a>

### MCP Colors

Inspired by the Lethal Trifecta is Tim Kellogg’s [MCP Colors](https://timkellogg.me/blog/2025/11/03/colors/) framework for determining which tools can safely be used together in an agent. While you won’t use it directly when developing your server, the principles can help guide your decisions about how you build and design your tools to be used by agents. While it focuses even more on agent development and use than the Lethal Trifecta, its lessons and practices can be applied to individual MCP servers as well.

In the framework, there are two colors: *red* for tools that handle untrusted content and *blue* for tools that do what Tim calls “critical actions.” Think of this label as a more general version of the data exfiltration capability in the Lethal Trifecta framework, it refers to actions that a tool may take that you have to be extra careful about because they could lead to data exfiltration, privilege escalation, or other harmful actions. These include things that are normally innocuous but could be dangerous if used by a malicious agent to access private data, like emailing specific users, deleting calendar events, etc.

###### Note

The absence of a color that corresponds with the “access to private data” capability is conspicuous. It isn’t included in this framework because all data is considered private by default. This simplifies the analysis the framework helps with while maintaining a highly defensive posture towards all data.

In applying this framework to your MCP serer, you should go over each tool and label it red, blue, or neither based on the single, specific tool and not any combinations with other tools. Your goal is to not mix red and blue tools in your server (or agent) at all. Then, for each tool, ask yourself why it has the label, and if there are any ways you could remove it.

The true power of MCP Colors lies in this analysis practice. It forces you to think systematically about the risks each of your tools presents to your users and how to mitigate or otherwise address them, while always treating data as private.

As the technology and use patterns evolve, it’s likely that these frameworks will as well. But not only do they today provide you with several ways to analyze your server’s security posture, they also provide a foundation for thinking about MCP server security in a structured way that is evergreen.

<a id="id125"></a>

# Sharing Your Server

Now that you’ve tested and secured your server, you’re ready to share it with the world. Here, we will briefly discuss some of the more common ways to deliver your server to your users. There are a number of options here, whether you intend on your server being used locally or remotely. For local deployments, it’s typically enough to just share your server code in a public repository with instructions on how to add it to `mcp.json`, Claude Desktop, Claude Code, and any other clients you want to specifically call out.

They all have slightly different installation instructions, for example Claude Code has the `/mcp` command to add a server to your `mcp.json` file for you, while installation of a Python server to Claude Desktop can be done by running `uv run mcp install <server_name>.py` from the command line. Alternatively, you can also create an *MCP Bundle (MCPB)* for your local server and distribute it that way.

An MCPB is a zip file with your server code and a manifest file `manifest.json` that contains information about the server to the installation client. Clients can build in support for installing from MCPB files, allowing you to distribute your server to your users in a single file. The [MCPB GitHub repository](https://github.com/modelcontextprotocol/mcpb) contains the specification for MCPB as well as the `mcpb` command line tool which helps automate the creation of MCPB files.

For remote deployments, you have a few more options, but you have some prepwork to do first. At the bare minimum, you need to make sure your server is run with the streamable HTTP transport. For better scalability, you can set your server to run as a stateless server and respond in JSON in the `FastMCP` constructor. [Example 7-6](#remote_deployment_prework) shows an example of how to do this.

<a id="remote_deployment_prework"></a>

##### Example 7-6. Initial setup for remote deployments

```python
"""
Calculator MCP server using FastMCP.
Provides mathematical operations as tools for calculation tasks.
"""

import math

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession

# Initialize FastMCP server
mcp = FastMCP("calculator", stateless_http=True, json_response=True)

...

if __name__ == "__main__":
    # Initialize and run the server
    mcp.run(transport="streamable-http")
```

In [Example 7-6](#remote_deployment_prework), we instantiated a `FastMCP` server object and set the `stateless_http` and `json_response` flags to `True`. Then, in the `if name == "main"` block, we run the server with the `streamable-http` transport by calling the `run()` method on the server object. This is how you’d provide a simple, stateless MCP server with direct access to your users. You will then have to deploy it behind an API gateway using your favorite cloud platform, application platform, or bare server.

You can also use *ASGI* (asynchronous server gateway interface) frameworks like *Starlette* or *FastAPI* to build a more robust and scalable MCP server that you can then deploy to your host of choice. To do this, you just need to add a few things to your server code: first, you need to add a lifespan context manager. This is similar to what we did in [Example 6-5](chapter_6.html#context_object_request_info) in Chapter 6, but you will also need to pass a parameter of type `Starlette` to the lifespan function. After that, in place of `if name == "main"` block, you will need to instantiate a `Starlette` application object and pass in your routes and the lifespan context manager.

If you have a single server you’re mounting, you can just mount it as `"/"`, but if you want to support multiple servers, you’ll need to set individual paths for each one.

<a id="starlette_mount"></a>

##### Example 7-7. Mounting an MCP server in Starlette

```python
"""
Calculator MCP server using FastMCP.
Provides mathematical operations as tools for calculation tasks.
"""

import math
from contextlib import AsyncExitStack, asynccontextmanager

from mcp.server.fastmcp import Context, FastMCP
from mcp.server.session import ServerSession
from starlette.applications import Starlette
from starlette.routing import Mount
import uvicorn

# Initialize FastMCP server
mcp = FastMCP("calculator", stateless_http=True, json_response=True)

...

@asynccontextmanager
async def lifespan(app: Starlette):
    async with AsyncExitStack() as stack:
        await stack.enter_async_context(mcp.session_manager.run()) ①
        yield

app = Starlette(routes=[Mount("/", mcp.streamable_http_app())], lifespan=lifespan) ②

if __name__ == "__main__":
    uvicorn.run(app) ③
```

- ①: Run the MCP server’s session manager. If you’re mounting multiple servers, you will add the same line for each one.
- ②: Instantiate the Starlette application and mount the MCP server at the root path. This will expose the `/mcp` endpoint for the server. If you’re running the server locally, you can access it at `http://localhost:8000/mcp`.
- ③: Run the Starlette application using uvicorn. This is optional, without it you can still run the application from the command line with `uvicorn app:app`, optionally specifying the host and port.

In this example, we set up a function called `lifespan` that manages the MCP server’s lifespan. We then passed that and a `Mount` object to the Starlette constructor to mount the MCP server at the root path. You can make this path whatever you want, and the actual `/mcp` endpoint will be relative to that path. This example is set so that you can run it either as a standalone python application with `uv run` or as a Starlette application with `uvicorn`. The code repository that accompanies this book shows exactly how you would call it from either of those contexts.

From there, you can go on to host it on your favorite cloud platform or server. Before deploying it, you should review your service provider’s instructions on hosting ASGI applications. Often you will need to containerize the server and build an image for it, then upload that image to a container registry like Docker Hub or AWS ECR for deployment. The example below provides a simple Dockerfile for a remote Python MCP server using Starlette.

<a id="remote_deployment_dockerfile"></a>

##### Example 7-8. Dockerfile for a remote Python MCP server using Starlette

```dockerfile
FROM python:3.13-slim

# Install the project into /app
COPY . /app
WORKDIR /app

# Copy only the necessary files
COPY server.py /app/

RUN pip install --no-cache-dir "mcp[cli]>=1.12.3" "starlette>=0.48.0" "uvicorn>=0.38.0"
EXPOSE 8000

# Run the application
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

This is a pretty straightforward Dockerfile. It sets up a Python base image, installs the dependencies for the server, then runs the `uvicorn` command to start the server. You can then build the image and push it to a container registry like Docker Hub or AWS ECR for deployment. You can then deploy it to your favorite cloud platform or server using your service provider’s instructions. If you’re using Docker, you will build the image with `docker build -t mcp-server .` and can run it locally with `docker run -p 8000:8000 mcp-server`.

While there are several avenues by which you can publish your server to the world, the MCP world is coalescing around the [MCP server registry](https://registry.modelcontextprotocol.io/). This is a centralized registry of MCP servers that can be directly hooked into by MCP clients to discover and use your server. Think of it like NPM or PyPI for MCP servers. While the goal with the registry if for users to make specialized subregistries that filter down the official one, as a server developer you will want to focus on publishing to the official one, as the subregistries will largely filter the official one down to a more specific set of servers. As of this writing, the registry is still in preview, so you can expect the tooling to be in flux and improve rapidly over time.

In order to publish to the registry, your server will need to be registered and published to an existing language-based registry like npm or PyPI. After publishing your Python package to PyPI, you will install and use the `mcp-publisher` tool (install instructions are available in the [registry documentation](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx#step-3-install-mcp-publisher)). You will first run `mcp-publisher init` to generate a `server.json` file. For Python packages using PyPI, you will have to update the file manually: set the `version` to your correct version, set any environment variables (or remove the example ones generated by the script), and update the `registryType` field in the `packages` array to `"pypi"`.

Then, you will have to verify the ownership of your server package by including a string in the package README (which you can hide in a comment so that it doesn’t show up in the PyPI project description) of the form `mcp-name: <your_mcp_name>` where `<your_mcp_name>` is the name of your server as described in your `server.json` file. Next, use `mcp-publisher` to login to the registry, which currently accepts login via GitHub OAuth with `mcp-publisher login github`. Once logged in, you will use `mcp-publisher publish` to actually publish your server to the registry and then verify it by calling the registry API’s search endpoint: `https://registry.modelcontextprotocol.io/v0.1/servers?search=<your_mcp_name>`.

In this chapter, we discussed the back half of the MCP server development lifecycle: testing, securing, and sharing your server with the world. You learned how to test and debug your server with MCP Inspector along with other more traditional testing techniques like unit and integration tests. You learned which evaluations are relevant to MCP servers and how to run them, and then dove deep into MCP server security, where we talked about common vulnerabilities, techniques for mitigating them, and frameworks for approaching MCP server security architecturally. Finally, you learned about the myriad of ways to share your new, tested, and secure MCP server with the world, from GitHub and MCP Bundles for local stdio deployments to remote deployments using ASGI frameworks like Starlette and containerization software like Docker. Next, we will talk about the final piece of the MCP core: transports. We’ve talked about how to connect to them from you client applications in [Chapter 3](chapter_3.html#ch03) and how to receive connections from them in your server in this chapter. Now, we will dig into what they are and what they do so that you can better understand how clients and servers communicate with each other.
