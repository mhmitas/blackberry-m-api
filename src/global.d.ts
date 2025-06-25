// Override problematic LangGraph types
declare module "@langchain/langgraph/dist/pregel" {
  interface Pregel {
    withConfig(_config: any): this;
  }
}
