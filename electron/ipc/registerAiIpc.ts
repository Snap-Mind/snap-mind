import { ipcMain } from 'electron';
import type { AIService } from '../ai/AIService.js';
import type { Message } from '../../src/types/chat.js';

type AiSendRequest = {
  agentId: number;
  messages: Message[];
};

export function registerAiIpc(getAIService: () => AIService): void {
  ipcMain.handle('ai:send', async (event, req: AiSendRequest) => {
    const wc = event.sender;
    const ai = getAIService();
    let streamId: string | null = null;

    const result = await ai.send(req.agentId, req.messages, {
      onStreamReady: (id) => {
        streamId = id;
      },
      onToken: (text) => {
        if (streamId) wc.send('ai:token', { streamId, text });
      },
      onReasoning: (text) => {
        if (streamId) wc.send('ai:reasoning', { streamId, text });
      },
      onSource: (source) => {
        if (streamId) wc.send('ai:source', { streamId, source });
      },
      onDone: (reason) => {
        if (streamId) wc.send('ai:done', { streamId, reason });
      },
      onError: (message) => {
        if (streamId) wc.send('ai:error', { streamId, message });
      },
    });

    return result;
  });

  ipcMain.handle('ai:abort', async (_event, streamId: string) => {
    getAIService().abort(streamId);
    return { ok: true };
  });
}
