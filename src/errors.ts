import * as Types from './types';

// Shared by index.ts and admin.ts's toErrorList array branch, so a future
// extensions.* field is only wired in one place instead of drifting between
// two copies (this is itself a fix for exactly that: admin.ts's copy had no
// test coverage of its own).
//
// `code` is attached as a non-enumerable property: an additive field that
// changes Object.keys()/JSON.stringify() output on every error with a code
// isn't truly invisible to existing consumers, and this way it actually is.
export function toSDKError(item: unknown): Types.AuthorizerSDKError {
  if (item instanceof Error) return item;
  if (item && typeof item === 'object' && 'message' in item) {
    const err: Types.AuthorizerSDKError = new Error(
      String((item as { message: unknown }).message),
    );
    const extensions = (item as { extensions?: unknown }).extensions;
    if (extensions && typeof extensions === 'object') {
      const code = (extensions as { code?: unknown }).code;
      if (typeof code === 'string') {
        Object.defineProperty(err, 'code', {
          value: code,
          enumerable: false,
          writable: true,
          configurable: true,
        });
      }
    }
    return err;
  }
  return new Error(String(item));
}
