export const SAVE_LIMIT: number;
export type SavePayload = {
  key: string;
  name: string;
  files: { path: string; data: string; sha256: string }[];
};
export function validateSave(value: unknown): SavePayload;
