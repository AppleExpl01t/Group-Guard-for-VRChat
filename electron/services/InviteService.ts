/**
 * InviteService
 * 
 * Centralized service for VRChat invite management.
 * Handles invite slot management, cooldowns, and recruitment caching.
 */

import log from 'electron-log';

const logger = log.scope('InviteService');

// ============================================
// TYPES
// ============================================

export interface SlotState {
    index: number;
    message: string | null;
    lastUpdate: number;
    cooldownRemaining: number;
}

export interface SlotDecision {
    slot?: number;
    reuse?: boolean;
    error?: string;
    cooldownMins?: number;
}

// ============================================
// CONSTANTS
// ============================================

const INVITE_SLOTS = [10, 11, 12]; // VRChat custom invite message slots
const SLOT_COOLDOWN_MS = 60 * 60 * 1000; // 60 minutes cooldown per slot

// ============================================
// RECRUITMENT CACHE
// ============================================

// Track invited users per instance to prevent spam re-invites
// Key: fullInstanceId, Value: Set<userId>
const recruitmentCache = new Map<string, Set<string>>();

/**
 * Check if a user has already been invited to this instance
 */
export function isUserInvitedThisInstance(fullInstanceKey: string, userId: string): boolean {
    return recruitmentCache.has(fullInstanceKey) && recruitmentCache.get(fullInstanceKey)!.has(userId);
}

/**
 * Mark a user as invited to this instance
 */
export function markUserInvited(fullInstanceKey: string, userId: string): void {
    if (!recruitmentCache.has(fullInstanceKey)) {
        recruitmentCache.set(fullInstanceKey, new Set());
    }
    recruitmentCache.get(fullInstanceKey)!.add(userId);
}

/**
 * Clear the recruitment cache for a specific instance
 */
export function clearRecruitmentCache(fullInstanceKey: string): void {
    if (recruitmentCache.has(fullInstanceKey)) {
        recruitmentCache.delete(fullInstanceKey);
        logger.info(`Cleared recruitment cache for ${fullInstanceKey}`);
    }
}

// ============================================
// INVITE SLOT MANAGER
// ============================================

// In-memory state: map slot index to last update info
const slotState = INVITE_SLOTS.map(s => ({
    index: s,
    lastUpdate: 0,
    message: null as string | null
}));

/**
 * Get an available slot for the given invite message.
 * Handles slot reuse, cooldowns, and availability.
 * 
 * @param message The invite message content (max 64 chars)
 * @returns Decision object with slot number or error with cooldown info
 */
export function getSlotForMessage(message: string): SlotDecision {
    const now = Date.now();
    const cleanMessage = message.trim();

    // 1. Check for Reuse (Message Match - same message can reuse its slot)
    const existing = slotState.find(s => s.message === cleanMessage);
    if (existing) {
        logger.info(`Reusing Slot ${existing.index} for message match.`);
        return { slot: existing.index, reuse: true };
    }

    // 2. Find Available Slot (Cooldown Expired or Never Used)
    // Prefer slots never used (lastUpdate = 0) or oldest update
    const available = slotState
        .filter(s => (now - s.lastUpdate) > SLOT_COOLDOWN_MS)
        .sort((a, b) => a.lastUpdate - b.lastUpdate);

    if (available.length > 0) {
        const selected = available[0];
        return { slot: selected.index, reuse: false };
    }

    // 3. All Busy - Calculate Wait
    const freeTimes = slotState.map(s => s.lastUpdate + SLOT_COOLDOWN_MS);
    const nextFreeTime = Math.min(...freeTimes);
    const waitMs = nextFreeTime - now;
    const waitMins = Math.ceil(waitMs / 60000);

    return { 
        error: 'SLOTS_FULL', 
        cooldownMins: waitMins > 0 ? waitMins : 1 
    };
}

/**
 * Mark a slot as successfully updated with a new message
 */
export function markSlotUpdated(slotIndex: number, message: string): void {
    const slot = slotState.find(s => s.index === slotIndex);
    if (slot) {
        slot.lastUpdate = Date.now();
        slot.message = message.trim();
        logger.info(`Slot ${slotIndex} updated. Next available: ${new Date(slot.lastUpdate + SLOT_COOLDOWN_MS).toLocaleTimeString()}`);
    }
}

/**
 * Mark a slot update as failed (for error recovery)
 */
export function markSlotUpdateFailed(slotIndex: number): void {
    logger.warn(`Slot ${slotIndex} update failed. Reverting state assumption.`);
}

/**
 * Get the current state of all invite slots
 */
export function getInviteSlotsState(): SlotState[] {
    const now = Date.now();
    return slotState.map(s => ({
        index: s.index,
        message: s.message,
        lastUpdate: s.lastUpdate,
        cooldownRemaining: Math.max(0, (s.lastUpdate + SLOT_COOLDOWN_MS) - now)
    }));
}

// ============================================
// INVITE SENDING HELPER
// ============================================

/**
 * Send an invite with optional custom message support.
 * Handles slot selection, API calls, and state management.
 * 
 * @param client The VRChat SDK client
 * @param userId Target user to invite
 * @param location Full instance location string (worldId:instanceId)
 * @param message Optional custom invite message (max 64 chars)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendInvite(client: any, userId: string, location: string, message?: string): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = { instanceId: location };
    let usedSlot: number | undefined;

    if (message) {
        const cleanMessage = message.substring(0, 64);
        
        // Ask Manager for Slot
        const slotDecision = getSlotForMessage(cleanMessage);

        if (slotDecision.error) {
            // ALL SLOTS BUSY -> Throw cooldown error for UI handling
            throw { 
                message: `Invite Message Cooldown: Please wait ${slotDecision.cooldownMins} minutes.`,
                code: 'SLOT_COOLDOWN',
                cooldownMins: slotDecision.cooldownMins 
            };
        }

        if (slotDecision.slot) {
            usedSlot = slotDecision.slot;

            // Only call API if it's NOT a reuse
            if (!slotDecision.reuse) {
                try {
                    logger.info(`Overwriting Invite Slot ${usedSlot} with: "${cleanMessage}"`);
                    await client.updateInviteMessage({
                        path: { slot: usedSlot },
                        body: { message: cleanMessage }
                    });
                    
                    // Update Internal State
                    markSlotUpdated(usedSlot, cleanMessage);
                    
                    // Small delay for API stability
                    await new Promise(r => setTimeout(r, 200));
                } catch (error: unknown) {
                    const e = error as Error;
                    logger.warn(`Failed to update slot ${usedSlot}: ${e.message}`);
                    
                    // Mark failed
                    markSlotUpdateFailed(usedSlot);
                    
                    // Fallback: Don't use slot
                    usedSlot = undefined;
                }
            }
        }
    }

    if (usedSlot) {
        body.messageSlot = usedSlot;
    }

    await client.inviteUser({ 
        path: { userId },
        body: body
    });
}

// ============================================
// SERVICE EXPORT
// ============================================

export const inviteService = {
    // Recruitment
    isUserInvitedThisInstance,
    markUserInvited,
    clearRecruitmentCache,
    
    // Slot Management
    getSlotForMessage,
    markSlotUpdated,
    markSlotUpdateFailed,
    getInviteSlotsState,
    
    // Invite Helper
    sendInvite
};
