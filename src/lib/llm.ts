import {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
  temperature: 0,
});

const embeddingModel = new GoogleGenerativeAIEmbeddings({
  model: "models/text-embedding-004",
});

export { model, embeddingModel };
