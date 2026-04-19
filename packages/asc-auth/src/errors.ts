/** Base error for all ASC auth failures. */
export class ASCAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ASCAuthError";
  }
}

/** PEM parsing or key import failure. */
export class ASCAuthPEMError extends ASCAuthError {
  constructor(message: string) {
    super(message);
    this.name = "ASCAuthPEMError";
  }
}
