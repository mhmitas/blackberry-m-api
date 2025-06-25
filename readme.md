# Blackberry Mountain AI Agent API

This project provides an Express-based API server for interacting with a LangGraph-powered AI agent, designed to assist with customer service and information retrieval for Blackberry Mountain. The agent leverages advanced language models and integrates with MongoDB for vector search and persistent conversation state.

## Features

- Conversational AI agent using LangGraph and Mistral/Google Gemini models
- Tool integration for organization info and semantic search
- MongoDB vector search for experience data
- Persistent conversation state (checkpointing)
- REST API for starting and continuing chat threads

## Project Structure

```
.env
.gitignore
package.json
tsconfig.json
src/
  index.ts              # Express server entry point
  config/
    db.ts              # MongoDB and vector store setup
  lib/
    agent.ts           # Original agent implementation
    llm.ts             # Language model and embeddings setup
    new-agent.mts      # Updated agent logic (used by API)
    tools.ts           # Tool definitions for the agent
```

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas cluster (or compatible MongoDB instance)
- API keys for Google Generative AI and Mistral

### Installation

1. **Clone the repository**

   ```sh
   git clone <repo-url>
   cd blackberry-m-api
   ```

2. **Install dependencies**

   ```sh
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root directory (see `.env` example):

   ```
   MONGO_URI="your-mongodb-uri"
   GOOGLE_API_KEY="your-google-api-key"
   MISTRAL_API_KEY="your-mistral-api-key"
   ```

4. **Build the project**

   ```sh
   npm run build
   ```

5. **Start the server**

   ```sh
   npm start
   ```

   For development with hot-reload:

   ```sh
   npm run dev
   ```

## API Documentation

### Base URL

```
http://localhost:5000
```

### Health Check

**GET /**

Returns a simple status message.

**Response:**

```json
"LangGraph Agent Server"
```

---

### Start a New Chat

**POST /chat**

Start a new conversation thread.

**Request Body:**

```json
{
  "message": "What experiences are available at Blackberry Mountain?"
}
```

**Response:**

```json
{
  "threadId": "1718040000000",
  "response": "FINAL ANSWER: ..."
}
```

---

### Continue a Chat

**POST /chat/:threadId**

Continue an existing conversation thread.

**Path Parameter:**

- `threadId` (string): The thread ID returned from the initial `/chat` call.

**Request Body:**

```json
{
  "message": "Tell me more about the spa services."
}
```

**Response:**

```json
{
  "response": "FINAL ANSWER: ..."
}
```

---

### Error Responses

- `500 Internal Server Error`
  Returned if there is a server or database error.

**Example:**

```json
{
  "error": "Internal server error"
}
```

---

## Customization

- **Tools**: Add or modify tools in [`src/lib/tools.ts`](src/lib/tools.ts).
- **System Prompt**: Adjust agent behavior in [`src/lib/new-agent.mts`](src/lib/new-agent.mts) (`systemMessage` variable).
- **Models**: Change LLM or embedding models in [`src/lib/llm.ts`](src/lib/llm.ts).

## License

ISC

---

\*Built with [LangChain](https://js.langchain.com/), [Express](https://expressjs.com/)
