export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
export function parseId(raw: unknown): number {
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw) || Number(raw) > 2147483647)
    throw new ApiError(400, 'INVALID_ID', 'id must be a positive int32');
  return Number(raw);
}
export function found<T>(record: T | null): T {
  if (record === null) throw new ApiError(404, 'NOT_FOUND', 'Record does not exist');
  return record;
}
