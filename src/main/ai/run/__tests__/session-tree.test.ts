import { describe, it, expect } from 'vitest';
import { SessionTree } from '../session-tree.js';
import type { Message } from '../../../../shared/chat.js';

describe('SessionTree', () => {
  it('createRoot stores node with parentId null', () => {
    const tree = new SessionTree();
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    const node = tree.createRoot('root', 1, messages);

    expect(node.id).toBe('root');
    expect(node.parentId).toBeNull();
    expect(node.agentId).toBe(1);
    expect(node.messages).toEqual(messages);
    expect(node.children).toEqual([]);
    expect(tree.get('root')).toBe(node);
  });

  it('addChild links child under parent', () => {
    const tree = new SessionTree();
    const rootMessages: Message[] = [{ role: 'user', content: 'Hello' }];
    const childMessages: Message[] = [{ role: 'assistant', content: 'Hi' }];

    tree.createRoot('root', 1, rootMessages);
    const child = tree.addChild('root', 'c1', 2, childMessages);

    expect(child.id).toBe('c1');
    expect(child.parentId).toBe('root');
    expect(child.agentId).toBe(2);
    expect(child.messages).toEqual(childMessages);
    expect(child.children).toEqual([]);

    const parent = tree.get('root')!;
    expect(parent.children[0].id).toBe('c1');
    expect(tree.get('c1')).toBe(child);
  });

  it('addChild throws for unknown parent', () => {
    const tree = new SessionTree();
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];

    expect(() => {
      tree.addChild('unknown', 'c1', 2, messages);
    }).toThrow(/Unknown parent run: unknown/);
  });

  it('appendAssistant pushes { role: "assistant", content: text }', () => {
    const tree = new SessionTree();
    const initialMessages: Message[] = [{ role: 'user', content: 'Hello' }];
    tree.createRoot('root', 1, initialMessages);

    tree.appendAssistant('root', 'Response');

    const node = tree.get('root')!;
    expect(node.messages).toHaveLength(2);
    expect(node.messages[1]).toEqual({
      role: 'assistant',
      content: 'Response',
    });
  });

  it('appendAssistant is silent no-op for unknown runId', () => {
    const tree = new SessionTree();
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    tree.createRoot('root', 1, messages);

    // Should not throw
    tree.appendAssistant('unknown', 'Response');

    const node = tree.get('root')!;
    expect(node.messages).toHaveLength(1);
  });

  it('clear drops all nodes', () => {
    const tree = new SessionTree();
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    tree.createRoot('root', 1, messages);
    tree.addChild('root', 'c1', 2, messages);

    tree.clear();

    expect(tree.get('root')).toBeUndefined();
    expect(tree.get('c1')).toBeUndefined();
  });

  it('createRoot while root exists adds another node', () => {
    const tree = new SessionTree();
    const messages1: Message[] = [{ role: 'user', content: 'First' }];
    const messages2: Message[] = [{ role: 'user', content: 'Second' }];

    const root1 = tree.createRoot('root1', 1, messages1);
    const root2 = tree.createRoot('root2', 2, messages2);

    expect(tree.get('root1')).toBe(root1);
    expect(tree.get('root2')).toBe(root2);
  });

  it('stores a copy of incoming messages', () => {
    const tree = new SessionTree();
    const messages: Message[] = [{ role: 'user', content: 'Hello' }];
    tree.createRoot('root', 1, messages);

    // Mutate original array
    messages.push({ role: 'assistant', content: 'Hi' });

    const node = tree.get('root')!;
    expect(node.messages).toHaveLength(1);
  });
});
