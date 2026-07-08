import errors from './errors.json';

export interface ErrorInfo {
  code: number;
  contract: string;
  name: string;
}

const byCode = new Map<number, ErrorInfo>((errors as ErrorInfo[]).map((e) => [e.code, e]));
export const knownErrorCodes: number[] = [...byCode.keys()];
export const errorInfo = (code: number): ErrorInfo | undefined => byCode.get(code);

/** i18n keys for a contract error; unknown codes fall back to a generic message instead of leaking internals. */
export function errorKeys(code: number | undefined): { what: string; todo: string } {
  return code !== undefined && byCode.has(code) ? { what: `errors.${code}.what`, todo: `errors.${code}.todo` } : { what: 'errors.generic.what', todo: 'errors.generic.todo' };
}
