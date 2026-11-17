import { ipcMain } from 'electron';
import type { AIService } from '../ai/run/ai-service.js';
import type { RunRef, RunEvent } from '../ai/runtime/types.js';

export function registerAiIpc(getAIService: () => AIService): void {
  ipcMain.handle('ai:send', async (event, req) => {
    const wc = event.sender;
    const ai = getAIService();

    const result = await ai.send(
      { ...req, loopEnabled: req.loopEnabled ?? false },
      (ref: RunRef, ev: RunEvent) => {
        // Only forward root run events to the renderer (Task 14 will expose child events)
        if (ref.parentRunId !== null) return;

        const streamId: string = ref.runId;

        switch (ev.type) {
          case 'text-delta':
            wc.send('ai:token', { streamId, text: ev.text });
            break;
          case 'reasoning-delta':
            wc.send('ai:reasoning', { streamId, text: ev.text });
            break;
          case 'source':
            wc.send('ai:source', { streamId, source: { url: ev.url, title: ev.title } });
            break;
          case 'done':
            wc.send('ai:done', { streamId, reason: ev.reason });
            break;
          case 'error':
            wc.send('ai:error', { streamId, message: ev.message });
            break;
          default:
            // drop tool-call, tool-result, approval-request events for now
            break;
        }
      }
    );

    return result;
  });

  ipcMain.handle('ai:abort', async (_event, streamId: string) => {
    getAIService().abort(streamId);
    return { ok: true };
  });
}
