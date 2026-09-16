import { describe, expect, it } from 'vitest';
import { describeAiError } from '../describeAiError.js';

function apiCallError(fields: {
  message: string;
  statusCode?: number;
  responseBody?: string;
}): Error {
  return Object.assign(new Error(fields.message), {
    name: 'AI_APICallError',
    statusCode: fields.statusCode,
    responseBody: fields.responseBody,
  });
}

describe('describeAiError', () => {
  it('prefixes the status code so a bare status text is understandable', () => {
    const error = apiCallError({ message: 'Gone', statusCode: 410 });
    expect(describeAiError(error)).toBe('HTTP 410: Gone');
  });

  it('appends the response body when it carries detail the message lacks', () => {
    const error = apiCallError({
      message: 'Gone',
      statusCode: 410,
      responseBody: '{"error":"model not found"}',
    });
    expect(describeAiError(error)).toBe('HTTP 410: Gone\n{"error":"model not found"}');
  });

  it('omits the response body when it only repeats the message', () => {
    const message = 'GitHub Models is temporarily unavailable as part of a scheduled brownout.';
    const error = apiCallError({
      message,
      statusCode: 503,
      responseBody: `{"error":{"code":"unavailable","message":"${message}"}}`,
    });
    expect(describeAiError(error)).toBe(`HTTP 503: ${message}`);
  });

  it('truncates a long response body', () => {
    const error = apiCallError({
      message: 'Bad Gateway',
      statusCode: 502,
      responseBody: `<html>${'x'.repeat(800)}</html>`,
    });
    const described = describeAiError(error);
    expect(described.startsWith('HTTP 502: Bad Gateway\n<html>')).toBe(true);
    expect(described.endsWith('…')).toBe(true);
    expect(described.length).toBeLessThan(600);
  });

  it('returns the plain message when there is no status code', () => {
    expect(describeAiError(new Error('connect ECONNREFUSED 127.0.0.1:11434'))).toBe(
      'connect ECONNREFUSED 127.0.0.1:11434'
    );
  });

  it('stringifies a non-error value', () => {
    expect(describeAiError('upstream exploded')).toBe('upstream exploded');
  });

  it('falls back to a generic message when nothing is readable', () => {
    expect(describeAiError({})).toBe('The provider returned an error.');
  });
});
