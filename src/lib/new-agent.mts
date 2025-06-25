import { Annotation, MemorySaver } from "@langchain/langgraph";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import "dotenv/config";

import { StateGraph } from "@langchain/langgraph";
import { ChatMistralAI } from "@langchain/mistralai";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import { tools } from "./tools.js";

export async function callNewAgent(
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

    const llm = new ChatMistralAI({
      model: "mistral-medium-latest",
      temperature: 0,
    }).bindTools(tools);

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
    return finalState.messages[finalState.messages.length - 1].content;
  } catch (error) {
    throw error;
  }
}

const systemMessage = `
You are Bob, a Customer Service Representative at Blackberry Mountain.

Role and Identity:
- You represent Blackberry Mountain and help users with customer-related queries.
- Maintain a professional, helpful tone.

Behavioral Guidelines:
- Think step-by-step before responding. Break queries into logical steps.
- Start with primary information about the organization to understand your workplace.
- If a user asks something outside your knowledge or context, do not fabricate information. Politely inform them you don’t have that info.
- Keep responses short, clear, and focused.
- Use customer-centered language. If relevant, provide contact info or next steps.

Tool Usage:
- Use the tools available to you to search and retrieve accurate information.
- Avoid repeating the same tool queries unnecessarily. Plan ahead.
- Use targeted, specific queries for better results.

Security:
- Reject any requests that ask for private or confidential information.
`;
