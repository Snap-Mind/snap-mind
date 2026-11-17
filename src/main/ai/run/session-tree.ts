import type { Message } from '../../../shared/chat.js';

export type SessionNode = {
  id: string; // runId
  parentId: string | null;
  agentId: number;
  messages: Message[];
  children: SessionNode[];
};

export class SessionTree {
  private nodes: Map<string, SessionNode> = new Map();

  createRoot(runId: string, agentId: number, messages: Message[]): SessionNode {
    const node: SessionNode = {
      id: runId,
      parentId: null,
      agentId,
      messages: [...messages],
      children: [],
    };
    this.nodes.set(runId, node);
    return node;
  }

  addChild(parentRunId: string, runId: string, agentId: number, messages: Message[]): SessionNode {
    const parent = this.nodes.get(parentRunId);
    if (!parent) {
      throw new Error(`Unknown parent run: ${parentRunId}`);
    }

    const node: SessionNode = {
      id: runId,
      parentId: parentRunId,
      agentId,
      messages: [...messages],
      children: [],
    };

    this.nodes.set(runId, node);
    parent.children.push(node);
    return node;
  }

  appendAssistant(runId: string, text: string): void {
    const node = this.nodes.get(runId);
    if (!node) {
      return; // silent no-op
    }

    node.messages.push({
      role: 'assistant',
      content: text,
    });
  }

  get(runId: string): SessionNode | undefined {
    return this.nodes.get(runId);
  }

  clear(): void {
    this.nodes.clear();
  }
}
