import "dotenv/config";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import { callNewAgent } from "./lib/new-agent.js";
import { mongoClient } from "./lib/db.js";
import { Binary } from "mongodb";

const app: Express = express();
app.use(express.json());

// Allow CORS for ...
app.use(
  cors({
    origin: ["http://localhost:3000", "https://blackberry-mountain.vercel.app"],
  })
);

// Main function to start the server and connect to MongoDB
async function startServer() {
  try {
    // Connect to MongoDB and verify connection
    await mongoClient.connect();
    await mongoClient.db("admin").command({ ping: 1 });

    // Root endpoint for health check
    app.get("/", (req: Request, res: Response) => {
      res.send("LangGraph Agent Server");
    });

    // Start a new chat thread
    app.post("/chat", async (req: Request, res: Response) => {
      const { message } = req.body;
      const threadId = Date.now().toString();
      try {
        const response = await callNewAgent(mongoClient, message, threadId);
        res.json({ threadId, response });
      } catch (error) {
        console.error("Error starting conversation:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Continue an existing chat thread
    app.post("/chat/:threadId", async (req: Request, res: Response) => {
      const { threadId } = req.params;
      const { message } = req.body;
      try {
        const response = await callNewAgent(mongoClient, message, threadId);
        res.json({ response });
      } catch (error) {
        console.error("Error in chat:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // get history with a thread id
    app.get("/chat/history/:threadId", async (req: Request, res: Response) => {
      const { threadId } = req.params;

      try {
        const checkpoints = await mongoClient
          .db("blackberry_mountain")
          .collection("checkpoints")
          .find({ thread_id: threadId })
          .sort({ step: 1 }) // ensure chronological order
          .toArray();

        const allMessages = [];

        for (const checkpoint of checkpoints) {
          if (!checkpoint.checkpoint?.buffer) continue;

          const decoded = JSON.parse(
            checkpoint.checkpoint.buffer.toString("utf-8")
          );

          const messages = extractMessages(decoded);
          allMessages.push(...messages);
        }

        res.json({ messages: allMessages });
      } catch (error: any) {
        console.error("Error in chat history:", error);
        res.status(500).json({ error: error.message });
      }
    });

    // Start listening on the specified port
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    // Handle MongoDB connection errors
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

// Entry point:
startServer();

function extractMessages(decoded: any) {
  const result = [];
  const allMessages = decoded.channel_values?.messages || [];

  let aiBuffer = "";

  for (const msg of allMessages) {
    const type = msg.id?.[2]; // e.g. "HumanMessage" or "AIMessageChunk"
    const content = msg.kwargs?.content?.trim();

    if (type === "HumanMessage" && content) {
      // flush previous AI chunk if any
      if (aiBuffer) {
        result.push({ role: "ai", content: aiBuffer });
        aiBuffer = "";
      }
      result.push({ role: "human", content });
    } else if (type === "AIMessageChunk") {
      if (content) aiBuffer += content;
    }
  }

  // flush remaining AI buffer
  if (aiBuffer) {
    result.push({ role: "ai", content: aiBuffer });
  }

  return result;
}
