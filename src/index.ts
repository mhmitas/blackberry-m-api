import "dotenv/config";
import express, { Express, Request, Response } from "express";
import { callNewAgent } from "./lib/new-agent.mjs";
import { mongoClient } from "./lib/db.js";
const app: Express = express();
app.use(express.json());

async function startServer() {
  try {
    await mongoClient.connect();
    await mongoClient.db("admin").command({ ping: 1 });

    app.get("/", (req: Request, res: Response) => {
      res.send("LangGraph Agent Server");
    });

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

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}
startServer();
