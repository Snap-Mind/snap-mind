import { ipcMain } from 'electron';
import type { AIService } from '../ai/run/ai-service.js';
import type { RunRef, RunEvent } from '../ai/runtime/types.js';
import type { AiSendRequest, AiApprovalResponse } from '../../shared/ai-ipc.js';
import logService from '../log-service.js';
import { redactValue } from '../ai/redact.js';

const ipcLog = logService.scope('ai.ipc');

export function registerAiIpc(getAIService: () => AIService): void {
  ipcMain.handle('ai:send', async (event, req: AiSendRequest) => {
    ipcLog.debug(
      'ai:send',
      redactValue({
        agentId: req.agentId,
        loopEnabled: req.loopEnabled,
        messageCount: req.messages.length,
      })
    );
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

    ipcLog.debug('ai:send result', redactValue(result));
    return result;
  });

  ipcMain.handle('ai:abort', async (_event, runId: string) => {
    ipcLog.debug('ai:abort', redactValue({ runId }));
    getAIService().abort(runId);
    return { ok: true };
  });

  ipcMain.handle('ai:approval-response', async (_event, res: AiApprovalResponse) => {
    ipcLog.debug(
      'ai:approval-response',
      redactValue({ requestId: res.requestId, approved: res.approved })
    );
    getAIService().respondApproval(res.requestId, res.approved);
    return { ok: true };
  });
}
