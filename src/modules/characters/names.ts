// Whisper syntax uses a single nickname token. Existing names are not migrated.
export function isValidCharacterName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64 && !/[\s\u0000-\u001f\u007f]/u.test(value);
}
