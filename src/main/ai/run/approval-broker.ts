import type { ToolCall } from '../runtime/types.js';

interface PendingRequest {
  runId: string;
  resolve: (_decision: 'allow' | 'deny') => void;
}

export class ApprovalBroker {
  private pending = new Map<string, PendingRequest>();

  request(
    runId: string,
    _call: ToolCall
  ): { requestId: string; decision: Promise<'allow' | 'deny'> } {
    const requestId = crypto.randomUUID();
    const decision = new Promise<'allow' | 'deny'>((resolve) => {
      this.pending.set(requestId, { runId, resolve });
    });
    return { requestId, decision };
  }

  respond(requestId: string, approved: boolean): boolean {
    const entry = this.pending.get(requestId);
    if (entry === undefined) return false;
    entry.resolve(approved ? 'allow' : 'deny');
    this.pending.delete(requestId);
    return true;
  }

  cancelRun(runId: string): void {
    for (const [requestId, entry] of this.pending) {
      if (entry.runId === runId) {
        entry.resolve('deny');
        this.pending.delete(requestId);
      }
    }
  }
}
