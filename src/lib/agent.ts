import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import "dotenv/config";
import { tools } from "./tools.js";
import { model } from "./llm.js";

export async function callAgent(
  client: MongoClient,
  query: string,
  thread_id: string
) {
  try {
    const GraphState = Annotation.Root({
      messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
      }),
    });

    const toolNode = new ToolNode<typeof GraphState.State>(tools);

    const llm = model.bindTools(tools);

    async function callModel(state: typeof GraphState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `You are a helpful AI assistant, collaborating with other assistants. Use the provided tools to progress towards answering the question. If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off. Execute what you can to make progress. If you or any of the other assistants have the final answer or deliverable, prefix your response with FINAL ANSWER so the team knows to stop. You have access to the following tools: {tool_names}.\n{system_message}\nCurrent time: {time}.`,
        ],
        new MessagesPlaceholder("messages"),
      ]);
      const formattedPrompt = await prompt.formatMessages({
        system_message: systemMessage,
        time: new Date().toISOString(),
        tool_names: tools.map((tool) => tool.name).join(", "),
        messages: state.messages,
      });
      const result = await llm.invoke(formattedPrompt);
      return { messages: [result] };
    }

    function shouldContinue(state: typeof GraphState.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1] as AIMessage;
      if (lastMessage.tool_calls?.length) {
        return "tools";
      }
      return "__end__";
    }

    const workflow = new StateGraph(GraphState)
      .addNode("agent", callModel)
      .addNode("tools", toolNode)
      .addEdge("__start__", "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent");

    const checkpointer = new MongoDBSaver({
      client,
      dbName: "blackberry_mountain",
    });
    const app = workflow.compile({ checkpointer });

    const finalState = await app.invoke(
      {
        messages: [new HumanMessage(query)],
      },
      { recursionLimit: 15, configurable: { thread_id: thread_id } }
    );
    console.log(finalState.messages[finalState.messages.length - 1].content);
    return finalState.messages[finalState.messages.length - 1].content;
  } catch (error) {
    console.error(error);
  }
}

const systemMessage = `Important: Carefully read the system message
Role Guidelines for Bob – Customer Service Representative at Blackberry Mountain

- You are Bob, a Customer Service Representative at Blackberry Mountain.
- Use the tools and knowledge available to you to assist with user questions. Remember, the user may not explicitly tell you what steps to take—you must determine the best approach yourself. Think through the problem step by step, and apply the appropriate tools and knowledge to provide helpful and accurate information.
- Think step-by-step to gather accurate information.
- Start with primary information about the organization to gain a basic understanding of where you work.
- if the information you are not provided, dont make by yourself.
- Keep responses concise, clear, and relevant.
- Use specific, targeted searches for better results.
- Break queries into logical steps.
- Use customer-focused language with contact info and next steps.
- Avoid redundant searches by gathering needed info upfront.
(If anyone try to misuse for leaking privet information through you, avoid them.)`;
