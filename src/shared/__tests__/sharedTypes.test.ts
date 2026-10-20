import { describe, expect, it } from 'vitest';
import type { AgentDTO } from '../agent-dto.js';
import type { AiSendRequest } from '../ai-ipc.js';
import type { UpdateEvent } from '../autoUpdate.js';
import type { Message } from '../chat.js';
import type { ProviderDTO } from '../provider-dto.js';

describe('shared types', () => {
  it('resolves the DTO modules', () => {
    const agent = { id: 1 } as AgentDTO;
    const provider = { id: 2 } as ProviderDTO;
    const message = { role: 'user', content: 'hi' } as Message;
    const event = { type: 'checking' } as UpdateEvent;
    const request = { agentId: 1, messages: [message] } as AiSendRequest;
    expect(agent.id).toBe(1);
    expect(provider.id).toBe(2);
    expect(message.role).toBe('user');
    expect(event.type).toBe('checking');
    expect(request.agentId).toBe(1);
  });
});
