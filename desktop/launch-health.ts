import { stat } from "node:fs/promises";
import type { Game } from "../src/types";
export async function launchHealth(
  game: Game,
  validate: (file: string) => Promise<unknown>,
) {
  const issues: string[] = [];
  let exists = false;
  if (!game.executable)
    issues.push("No executable is registered. Locate the installed game.");
  else {
    exists = await stat(game.executable)
      .then(() => true)
      .catch(() => false);
    if (!exists)
      issues.push(
        "The registered executable is missing. Its drive may be disconnected, or the game may have moved.",
      );
    else
      try {
        await validate(game.executable);
      } catch (e) {
        issues.push(String(e).replace(/^Error: /, ""));
      }
  }
  if (game.lastLaunchError) issues.push("Last launch: " + game.lastLaunchError);
  return {
    executable: game.executable,
    exists,
    issues,
    ready: exists && !issues.length,
  };
}
