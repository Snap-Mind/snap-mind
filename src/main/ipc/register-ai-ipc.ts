import { ipcMain } from 'electron';
import type { AIService } from '../ai/run/ai-service.js';
import type { RunRef, RunEvent } from '../ai/runtime/types.js';
import type { AiSendRequest, AiApprovalResponse } from '../../shared/ai-ipc.js';

export function registerAiIpc(getAIService: () => AIService): void {
  ipcMain.handle('ai:send', async (event, req: AiSendRequest) => {
    const wc = event.sender;
    const ai = getAIService();

    const result = await ai.send(req, (ref: RunRef, ev: RunEvent) => {
      if (wc.isDestroyed()) return;

      switch (ev.type) {
        case 'text-delta':
          wc.send('ai:token', { ...ref, text: ev.text });
          break;
        case 'reasoning-delta':
          wc.send('ai:reasoning', { ...ref, text: ev.text });
          break;
        case 'source':
          wc.send('ai:source', { ...ref, source: { url: ev.url, title: ev.title } });
          break;
        case 'tool-call':
          wc.send('ai:tool-call', {
            ...ref,
            toolCallId: ev.toolCallId,
            toolName: ev.toolName,
            input: ev.input,
          });
          break;
        case 'approval-request':
          wc.send('ai:approval-request', {
            ...ref,
            toolCallId: ev.toolCallId,
            toolName: ev.toolName,
            input: ev.input,
            requestId: ev.requestId,
          });
          break;
        case 'tool-result':
          wc.send('ai:tool-result', {
            ...ref,
            toolCallId: ev.toolCallId,
            toolName: ev.toolName,
            output: ev.output,
            isError: ev.isError,
          });
          break;
        case 'done':
          wc.send('ai:done', { ...ref, reason: ev.reason });
          break;
        case 'error':
          wc.send('ai:error', { ...ref, message: ev.message });
          break;
      }
    });

    return result;
  });

  ipcMain.handle('ai:abort', async (_event, runId: string) => {
    getAIService().abort(runId);
    return { ok: true };
  });

  ipcMain.handle('ai:approval-response', async (_event, res: AiApprovalResponse) => {
    getAIService().respondApproval(res.requestId, res.approved);
    return { ok: true };
  });
}
