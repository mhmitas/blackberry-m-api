import { tool } from "@langchain/core/tools";
import { mongoClient, vectorStore } from "./db.js";
import { optional, z } from "zod";

const retriever = tool(
  async ({ query, limit }) => {
    const result = await vectorStore.similaritySearchWithScore(query, limit);
    return JSON.stringify(result);
  },
  {
    name: "retrieve_experience_data",
    description:
      "This system retrieves information about experiences related to a specific query. To ensure accurate results, it's essential to clearly define what you're looking for—the query must be explicit and well-structured.",
    schema: z.object({
      query: z.string().describe("The search query"),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Number of results to return"),
    }),
  }
);

const getAbout = tool(
  async () => {
    const result = await mongoClient
      .db("blackberry_mountain")
      .collection("documents")
      .findOne({ slug: "primary-info-for-agent" });
    return result?.content;
  },
  {
    name: "get_about",
    description:
      "Get primary information about the organization. This is for you (the assistant), not for the users—you will learn from here",
    schema: z.object({}),
  }
);

const tools = [retriever, getAbout];

export { tools };
