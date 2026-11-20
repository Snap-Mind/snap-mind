import { describe, it, expect } from 'vitest';
import { SessionTree } from '../session-tree.js';
import type { Message } from '../../../../shared/chat.js';

describe('SessionTree', () => {
  it('createRoot stores a flat node with parentId null and createdAt', () => {
    const tree = new SessionTree(() => 1000);
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const node = tree.createRoot('root', 1, messages);

    expect(node.id).toBe('root');
    expect(node.parentId).toBeNull();
    expect(node.agentId).toBe(1);
    expect(node.createdAt).toBe(1000);
    expect(node.messages).toEqual(messages);
    expect(tree.get('root')).toBe(node);
    expect(tree.list()).toEqual([node]);
  });

  it('addChild appends a sibling node, not a nested children array', () => {
    let t = 1000;
    const tree = new SessionTree(() => ++t);
    const rootMessages: Message[] = [{ role: 'user', content: 'Hello' }];
    const childMessages: Message[] = [{ role: 'user', content: 'Hi' }];

    tree.createRoot('root', 1, rootMessages);
    const child = tree.addChild('root', 'c1', 2, childMessages);

    expect(child.id).toBe('c1');
    expect(child.parentId).toBe('root');
    expect(child.agentId).toBe(2);
    expect(child.createdAt).toBeGreaterThan(1000);
    expect('children' in child).toBe(false);

    const listed = tree.list();
    expect(listed.map((n) => n.id)).toEqual(['root', 'c1']);
    expect(listed[0]).not.toHaveProperty('children');
    expect(tree.get('c1')).toBe(child);
  });

  it('addChild throws for unknown parent', () => {
    const tree = new SessionTree();
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    expect(() => {
      tree.addChild('unknown', 'c1', 2, messages);
    }).toThrow(/Unknown parent run: unknown/);
  });

  it('appendAssistant stores thinking inside think tags', () => {
    const tree = new SessionTree(() => 1);
    tree.createRoot('root', 1, [{ role: 'user', content: 'Hello' }]);
    tree.appendAssistant('root', 'Response', 'plan');

    const node = tree.get('root')!;
    expect(node.messages[1]).toEqual({
      role: 'assistant',
      content: '<think>\nplan\n</think>\nResponse',
    });
  });

  it('appendAssistant is silent no-op for unknown runId', () => {
    const tree = new SessionTree();
    tree.createRoot('root', 1, [{ role: 'user', content: 'Hello' }]);
    tree.appendAssistant('unknown', 'Response');
    expect(tree.get('root')!.messages).toHaveLength(1);
  });

  it('clear drops all nodes', () => {
    const tree = new SessionTree();
    tree.createRoot('root', 1, [{ role: 'user', content: 'Hello' }]);
    tree.addChild('root', 'c1', 2, [{ role: 'user', content: 'x' }]);
    tree.clear();
    expect(tree.list()).toEqual([]);
    expect(tree.get('root')).toBeUndefined();
  });

  it('stores a copy of incoming messages', () => {
    const tree = new SessionTree();
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    tree.createRoot('root', 1, messages);
    messages.push({ role: 'assistant', content: 'Hi' });
    expect(tree.get('root')!.messages).toHaveLength(1);
  });
});
