# Steam dashboard in Ember 2

Use Library → Refresh Steam, or let the initial refresh finish. Steam playtime comes from available local Steam account data and, when connected, GetOwnedGames. Steam lifetime playtime and Ember's directly tracked sessions are never added together for the same Steam entry. Missing per-game time displays Unavailable; Home aggregates available values only.

Achievements/icons come from Steam's local library cache. Not every game/account caches complete achievements. Open the game's Steam Library page to populate its data, then refresh Ember. With multiple accounts, Ember uses the verified connected account; without a verified account it reads only an unambiguous single local account.

Descriptions come from the official Steam store; Deck ratings come from Valve's compatibility report. Public metadata caches for 24 hours; failed refreshes retain previous valid fields and record errors. Deck ratings apply to Steam Deck, not macOS.

The new catalog adds public reviews, platform flags, publisher details and screenshots. Ownership remains separate from installation. See README for account setup and docs/PROGRESS.md for tested coverage and current limitations.
