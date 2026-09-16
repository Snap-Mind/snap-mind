const MAX_BODY_CHARS = 400;

type ErrorFields = {
  message?: unknown;
  statusCode?: unknown;
  responseBody?: unknown;
};

function fieldsOf(error: unknown): ErrorFields {
  return error !== null && typeof error === 'object' ? (error as ErrorFields) : {};
}

function headline(error: unknown): string {
  const { message } = fieldsOf(error);
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'The provider returned an error.';
}

function responseBody(error: unknown): string {
  const { responseBody: body } = fieldsOf(error);
  if (typeof body !== 'string') return '';
  const trimmed = body.trim();
  if (trimmed.length <= MAX_BODY_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_BODY_CHARS)}…`;
}

/**
 * Builds the text shown to the user for a provider failure. The wording comes from
 * the provider, not from this app: the status code makes bare status texts such as
 * "Gone" readable, and the response body is kept only when it adds detail.
 */
export function describeAiError(error: unknown): string {
  const message = headline(error);
  const { statusCode } = fieldsOf(error);
  const head = typeof statusCode === 'number' ? `HTTP ${statusCode}: ${message}` : message;

  const body = responseBody(error);
  if (!body || body.includes(message)) return head;
  return `${head}\n${body}`;
}
