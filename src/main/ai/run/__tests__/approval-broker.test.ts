import { describe, it, expect } from 'vitest';
import { ApprovalBroker } from '../approval-broker.js';
import type { ToolCall } from '../../runtime/types.js';

const makeCall = (id: string): ToolCall => ({
  toolCallId: id,
  toolName: 'test_tool',
  input: {},
});

describe('ApprovalBroker', () => {
  it('respond true resolves allow', async () => {
    const broker = new ApprovalBroker();
    const call = makeCall('tc1');
    const { requestId, decision } = broker.request('run1', call);

    broker.respond(requestId, true);
    const result = await decision;
    expect(result).toBe('allow');
  });

  it('respond false resolves deny', async () => {
    const broker = new ApprovalBroker();
    const call = makeCall('tc2');
    const { requestId, decision } = broker.request('run1', call);

    broker.respond(requestId, false);
    const result = await decision;
    expect(result).toBe('deny');
  });

  it('respond on unknown id returns false', () => {
    const broker = new ApprovalBroker();
    const result = broker.respond('nonexistent-id', true);
    expect(result).toBe(false);
  });

  it('cancelRun resolves pending as deny and leaves other runs pending', async () => {
    const broker = new ApprovalBroker();
    const call1 = makeCall('tc3');
    const call2 = makeCall('tc4');
    const call3 = makeCall('tc5');

    const { decision: d1 } = broker.request('run1', call1);
    const { decision: d2 } = broker.request('run1', call2);
    const { decision: d3 } = broker.request('run2', call3);

    broker.cancelRun('run1');

    // run1's decisions should resolve as deny
    expect(await d1).toBe('deny');
    expect(await d2).toBe('deny');

    // run2's decision should still be pending
    const race = await Promise.race([d3, Promise.resolve('pending')]);
    expect(race).toBe('pending');
  });
});
