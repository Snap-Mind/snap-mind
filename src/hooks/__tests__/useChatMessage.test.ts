import { describe, it, expect } from 'vitest';
import { parseThinkingBlocks } from '../useChatMessage';

describe('parseThinkingBlocks', () => {
  it('returns plain content when there are no <think> blocks', () => {
    const result = parseThinkingBlocks('Hello world');
    expect(result).toEqual({ thinking: '', main: 'Hello world', isThinking: false });
  });

  it('extracts a single thinking block', () => {
    const result = parseThinkingBlocks('<think>reasoning</think>answer');
    expect(result).toEqual({ thinking: 'reasoning', main: 'answer', isThinking: false });
  });

  it('joins multiple thinking blocks with double newline separator', () => {
    const content = '<think>first block</think>middle<think>second block</think>end';
    const result = parseThinkingBlocks(content);
    expect(result.thinking).toBe('first block\n\nsecond block');
    expect(result.main).toBe('middleend');
  });

  it('preserves internal whitespace within thinking blocks', () => {
    const content = '<think>  line1\n  line2  </think>answer';
    const result = parseThinkingBlocks(content);
    expect(result.thinking).toBe('line1\n  line2');
    expect(result.main).toBe('answer');
  });

  it('skips empty thinking blocks', () => {
    const content = '<think></think>text<think>real</think>end';
    const result = parseThinkingBlocks(content);
    expect(result.thinking).toBe('real');
    expect(result.main).toBe('textend');
  });

  it('handles unclosed <think> block (streaming)', () => {
    const content = 'prefix<think>partial reasoning';
    const result = parseThinkingBlocks(content);
    expect(result.thinking).toBe('partial reasoning');
    expect(result.main).toBe('prefix');
    expect(result.isThinking).toBe(true);
  });

  it('handles unclosed <think> after a closed block', () => {
    const content = '<think>done</think>answer<think>still going';
    const result = parseThinkingBlocks(content);
    expect(result.thinking).toBe('done\n\nstill going');
    expect(result.main).toBe('answer');
    expect(result.isThinking).toBe(true);
  });

  it('returns empty thinking for content with no think tags', () => {
    const result = parseThinkingBlocks('just plain text\nwith newlines');
    expect(result.thinking).toBe('');
    expect(result.main).toBe('just plain text\nwith newlines');
    expect(result.isThinking).toBe(false);
  });

  it('handles empty string', () => {
    const result = parseThinkingBlocks('');
    expect(result).toEqual({ thinking: '', main: '', isThinking: false });
  });

  it('preserves code formatting inside thinking blocks', () => {
    const code = '```js\nconst x = 1;\n```';
    const content = `<think>${code}</think>answer`;
    const result = parseThinkingBlocks(content);
    expect(result.thinking).toBe(code);
  });

  describe('Anthropic interleaved thinking', () => {
    it('handles 3+ interleaved thinking blocks with content between them', () => {
      const content =
        '<think>step 1: analyze</think>Point A.\n' +
        '<think>step 2: compare</think>Point B.\n' +
        '<think>step 3: conclude</think>Final answer.';
      const result = parseThinkingBlocks(content);
      expect(result.thinking).toBe('step 1: analyze\n\nstep 2: compare\n\nstep 3: conclude');
      expect(result.main).toBe('Point A.\nPoint B.\nFinal answer.');
      expect(result.isThinking).toBe(false);
    });

    it('handles interleaved blocks with newlines around tags', () => {
      const content =
        '<think>\nLet me analyze the question.\n</think>\n\n' +
        'Here is my first point.\n\n' +
        '<think>\nNow considering the second part.\n</think>\n\n' +
        'And here is my second point.';
      const result = parseThinkingBlocks(content);
      expect(result.thinking).toBe(
        'Let me analyze the question.\n\nNow considering the second part.'
      );
      expect(result.main).toBe('Here is my first point.\n\nAnd here is my second point.');
      expect(result.isThinking).toBe(false);
    });

    it('handles interleaved blocks with last block still streaming', () => {
      const content =
        '<think>step 1</think>Point A.\n' +
        '<think>step 2</think>Point B.\n' +
        '<think>step 3 still going';
      const result = parseThinkingBlocks(content);
      expect(result.thinking).toBe('step 1\n\nstep 2\n\nstep 3 still going');
      expect(result.main).toBe('Point A.\nPoint B.\n');
      expect(result.isThinking).toBe(true);
    });

    it('handles many short interleaved blocks', () => {
      const content = '<think>a</think>1<think>b</think>2<think>c</think>3<think>d</think>4';
      const result = parseThinkingBlocks(content);
      expect(result.thinking).toBe('a\n\nb\n\nc\n\nd');
      expect(result.main).toBe('1234');
      expect(result.isThinking).toBe(false);
    });
  });
});
