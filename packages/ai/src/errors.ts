export class ParseError extends Error {}
export class AiInvalidOutputError extends Error {}
export class AiUnavailableError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}
export class RateLimitedError extends Error {}
