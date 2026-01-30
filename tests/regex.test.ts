
import { describe, it, expect } from 'vitest';

// Copied from LogWatcherService.ts for verification
const RE_JOINING = /(?:Joining|Entering)\s+(wrld_[a-zA-Z0-9-]+):([^\s]+)/;
const RE_ENTERING = /Entering Room:\s+(.+)/;
const RE_AVATAR = /\[Avatar\] Loading Avatar:\s+(avtr_[a-f0-9-]{36})/;
const RE_VOTE_KICK = /A vote kick has been initiated against\s+(.+)\s+by\s+(.+?),\s+do you agree\?/;

describe('LogWatcher Regex Verification', () => {
  it('should match Joining lines', () => {
    const line = '2024.01.29 20:00:00 Log        -  [NetworkManager] Joining wrld_1234-5678:88888~hidden(usr_test)...';
    const match = line.match(RE_JOINING);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('wrld_1234-5678');
    expect(match![2]).toContain('88888~hidden');
  });

  it('should match Entering Room lines', () => {
    const line = '2024.01.29 20:00:05 Log        -  [RoomManager] Entering Room: The Great Pug';
    const match = line.match(RE_ENTERING);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('The Great Pug');
  });

  it('should match Avatar Loading', () => {
    const line = '2024.01.29 20:05:00 Log        -  [Avatar] Loading Avatar: avtr_88888888-4444-4444-4444-123456789012';
    const match = line.match(RE_AVATAR);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('avtr_88888888-4444-4444-4444-123456789012');
  });

  it('should match Vote Kicks', () => {
    const line = '2024.01.29 20:10:00 Log        -  [Moderation] A vote kick has been initiated against BadActor by GoodUser, do you agree?';
    const match = line.match(RE_VOTE_KICK);
    expect(match).not.toBeNull();
    expect(match![1]).toBe('BadActor');
    expect(match![2]).toBe('GoodUser');
  });
});
