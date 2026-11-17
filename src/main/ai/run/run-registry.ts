interface InFlight {
  controller: AbortController;
  parentRunId: string | null;
  parentAbortListener: (() => void) | null;
}

export class RunRegistry {
  private runs = new Map<string, InFlight>();

  open(runId: string, parentRunId: string | null): AbortSignal {
    const controller = new AbortController();

    let parentAbortListener: (() => void) | null = null;

    if (parentRunId !== null) {
      const parent = this.runs.get(parentRunId);
      if (parent !== undefined) {
        if (parent.controller.signal.aborted) {
          // Parent is already aborted — immediately abort the child
          controller.abort();
        } else {
          // Link: abort child when parent aborts
          parentAbortListener = () => {
            controller.abort();
          };
          parent.controller.signal.addEventListener('abort', parentAbortListener, { once: true });
        }
      }
      // If parent is unknown/closed, treat as root (no link)
    }

    this.runs.set(runId, { controller, parentRunId, parentAbortListener });
    return controller.signal;
  }

  abort(runId: string): void {
    const entry = this.runs.get(runId);
    if (entry === undefined) return;
    entry.controller.abort();
  }

  abortAll(): void {
    for (const [, entry] of this.runs) {
      entry.controller.abort();
    }
  }

  close(runId: string): void {
    const entry = this.runs.get(runId);
    if (entry === undefined) return;

    // Remove the abort listener from the parent signal to avoid leaks
    if (entry.parentRunId !== null && entry.parentAbortListener !== null) {
      const parent = this.runs.get(entry.parentRunId);
      if (parent !== undefined) {
        parent.controller.signal.removeEventListener('abort', entry.parentAbortListener);
      }
    }

    this.runs.delete(runId);
  }

  isOpen(runId: string): boolean {
    return this.runs.has(runId);
  }
}
