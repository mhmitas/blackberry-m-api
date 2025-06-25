import "dotenv/config";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { MongoClient } from "mongodb";
import { embeddingModel } from "../lib/llm";

const client = new MongoClient(process.env.MONGO_URI || "");
const collection = client.db("blackberry_mountain").collection("embeddings");

const vectorStore = new MongoDBAtlasVectorSearch(embeddingModel, {
  collection: collection,
  indexName: "blackberry_mountain_vector_index",
  textKey: "text",
  embeddingKey: "embedding",
});

export { vectorStore, client as mongoClient };
