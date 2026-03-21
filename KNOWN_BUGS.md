# Known Bugs & Future Tuning

Issues identified during code review and requirements alignment sessions.

---

## Bugs (Confirmed — Code Does Not Match Intended Behavior)

### BUG-001: AutoMod evaluates join requests even when auto-process is OFF

**File:** `electron/services/AutoModService.ts` ~line 140–230
**Expected:** If the "auto-process join requests" toggle is OFF, AutoMod should not fetch, evaluate, or log join requests at all.
**Actual:** The service still fetches the user's full profile, evaluates all rules, adds the user to the dedup cache, broadcasts a violation to the UI, and fires a Discord webhook — it only skips the final API reject/accept call.
**Impact:** Users see confusing violation logs and receive Discord alerts for activity that should be invisible when the toggle is off. The dedup cache is also poisoned, so if the toggle is later turned on, those users won't be re-evaluated.

---

### BUG-002: Instance Guard silently lets whitelist win over blacklist with no warning

**File:** `electron/services/InstanceGuardService.ts` ~line 231–245
**Expected:** If a world appears on both the whitelist and blacklist, the UI should warn the user about the conflict and take no action until resolved.
**Actual:** The whitelist check runs first with a `continue` statement — if whitelisted, the blacklist is never evaluated and the world is silently skipped. No conflict is detected or surfaced to the user.
**Impact:** A moderator who accidentally adds a world to both lists will have no idea the blacklist entry is being ignored.

---

### BUG-003: Watchlist critical/malicious users are auto-rejected even when AutoMod is disabled

**File:** `electron/services/AutoModService.ts` ~line 163–173
**Expected:** The AutoMod toggle should be respected. If AutoMod (auto-process) is off, no automated rejections should occur — including for watchlist-flagged users.
**Actual:** After rule evaluation, the code unconditionally overrides the result to `REJECT` for users marked `critical`, `priority <= -10`, or tagged `malicious`/`nuisance` on the watchlist, regardless of whether auto-process is enabled.
**Impact:** Users are silently auto-rejected from join requests even when the moderator has explicitly disabled automated processing.

---

## Future Tuning (Behavior to Revisit)

_None yet — add items here as more requirements are clarified._
