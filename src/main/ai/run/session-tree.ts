import type { Message } from '../../../shared/chat.js';

export type SessionNode = {
  id: string;
  parentId: string | null;
  agentId: number;
  createdAt: number;
  messages: Message[];
};

export class SessionTree {
  private readonly nodes = new Map<string, SessionNode>();
  private readonly order: string[] = [];
  private readonly nowFn: () => number;

  constructor(nowFn: () => number = () => Date.now()) {
    this.nowFn = nowFn;
  }

  createRoot(runId: string, agentId: number, messages: Message[]): SessionNode {
    return this.pushNode({
      id: runId,
      parentId: null,
      agentId,
      createdAt: this.nowFn(),
      messages: [...messages],
    });
  }

  addChild(parentRunId: string, runId: string, agentId: number, messages: Message[]): SessionNode {
    if (!this.nodes.has(parentRunId)) {
      throw new Error(`Unknown parent run: ${parentRunId}`);
    }
    return this.pushNode({
      id: runId,
      parentId: parentRunId,
      agentId,
      createdAt: this.nowFn(),
      messages: [...messages],
    });
  }

  appendAssistant(runId: string, text: string, thinking = ''): void {
    const node = this.nodes.get(runId);
    if (!node) {
      return;
    }
    const content = thinking ? `<think>\n${thinking}\n</think>\n${text}` : text;
    node.messages.push({
      role: 'assistant',
      content,
    });
  }

  get(runId: string): SessionNode | undefined {
    return this.nodes.get(runId);
  }

  list(): SessionNode[] {
    return this.order.map((id) => this.nodes.get(id)).filter((node): node is SessionNode => !!node);
  }

  clear(): void {
    this.nodes.clear();
    this.order.length = 0;
  }

  private pushNode(node: SessionNode): SessionNode {
    this.nodes.set(node.id, node);
    this.order.push(node.id);
    return node;
  }
}
