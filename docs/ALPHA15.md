# Alpha 15 — immediate launch exits

The reported BOMBANANA launch reached its registered executable and exited approximately 12 ms later. Read-only Windows Defender history showed successful detections against the game's winmm.dll immediately before launch; that DLL is absent from the installation. No game files, quarantine settings, or user profile data were changed, and the game was not executed during diagnosis.

Local launches now report immediate exits (including exit code zero), display decimal and hexadecimal exit codes, and do not count processes that close within three seconds as played sessions. Startup request history is deferred until the process survives that interval. Spawn failures include the game name. The threshold is a heuristic: bootstrap launchers that hand off to another process can also exit quickly; the message therefore asks whether a game window opened instead of asserting a crash.

Validation: 67 unit tests passed, including immediate zero/nonzero exit handling, Windows status-code formatting, and normal session outcomes. TypeScript and production build passed during portable packaging. This update improves diagnostics; it does not repair the quarantined game installation.
