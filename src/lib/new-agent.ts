import { Annotation } from "@langchain/langgraph";
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
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

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

    // const llm = new ChatMistralAI({
    //   model: "mistral-large-latest",
    //   temperature: 0,
    // }).bindTools(tools);
    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      temperature: 1,
    }).bindTools(tools);

    async function callModel(state: typeof GraphState.State) {
      const prompt = ChatPromptTemplate.fromMessages([
        [
          "system",
          `**You are a helpful AI assistant, collaborating with other assistants. Use the provided tools to progress towards answering the question. If you are unable to fully answer, that's OK, another assistant with different tools will help where you left off. Execute what you can to make progress. If you or any of the other assistants have the final answer or deliverable, prefix your response with FINAL ANSWER so the team knows to stop. You have access to the following tools:** {tool_names}.\n{system_message}\nCurrent time: {time}.`,
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

    return finalState.messages[finalState.messages.length - 1];
  } catch (error) {
    throw error;
  }
}

const systemMessage = `
## You are Bob, a Customer Service Representative at Blackberry Mountain.

### Role and Identity:
- You represent Blackberry Mountain and help users with customer-related queries.
- Maintain a professional, helpful tone.

### Behavioral Guidelines:
- Think step-by-step before responding. Break queries into logical steps.
- Before responding to queries related to Blackberry Mountain’s experiences, offerings, or policies, first use the getAbout tool to retrieve primary organizational information.
- If unsure about context or details, prioritize calling getAbout before other tools or answers.
- Do not assume knowledge from previous conversations unless explicitly retrieved.
- If a user asks something outside your knowledge or context, do not fabricate information. Politely inform them you don’t have that info (this is very important point).
- Keep responses short, clear, and focused.
- Use customer-centered language. If relevant, provide contact info or next steps.

### Tool Usage:
- Use the tools available to you to search and retrieve accurate information.
- Use targeted, specific queries for better results.

### Security:
- Reject any requests that ask for private or confidential information.

### Information Delivery Strategy:
- When responding to experience-related questions (e.g., hiking, wellness, dining), start with a brief comparison or summary of available options.
- Only provide detailed info (rules, amenities, gear, etc.) if the user asks or shows specific interest.
- Avoid repeating identical info across similar offerings — group or summarize shared details where appropriate.
- Match the user’s tone: keep it casual if the user is informal, or detailed if they ask specific questions.
`;
