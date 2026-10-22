export const STARTUP_GRACE_MS = 3000;
export function launchResult(name: string, elapsed: number, code: number | null, signal: string | null) {
  const early = elapsed < STARTUP_GRACE_MS;
  const status = signal ? `signal ${signal}` : code === null ? 'unknown exit status' : `code ${code} (0x${(code >>> 0).toString(16).toUpperCase()})`;
  return {
    recordPlaytime: !early,
    message: early
      ? `${name} exited immediately (${status}). If no game window opened, check Windows Security → Protection history and the game's installation or required runtimes. Ember cannot restore missing game files.`
      : code || signal ? `${name} exited with ${status}.` : '',
  };
}
