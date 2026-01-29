import React, { useState } from 'react';
import { useUserProfileStore } from '../../../stores/userProfileStore';
import { UserProfileModal } from '../../../components/modals/UserProfileModal';
import { GroupProfileModal } from '../../../components/modals/GroupProfileModal';

/**
 * UserProfileDialog
 * 
 * Wrapper around UserProfileModal for the Dashboard/Global access.
 * Replaces the duplicate implementation with the unified modal.
 * 
 * Now handles Group Profile navigation by opening a GroupProfileModal
 * (consistent with Friend Manager behavior and supports external groups).
 */
export const UserProfileDialog: React.FC = () => {
    const { isOpen, userId, closeProfile } = useUserProfileStore();
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

    const handleOpenGroup = (groupId: string) => {
        setSelectedGroupId(groupId);
        // We do NOT close the user profile, allowing user to go back
        // OR we can stack them? Modals usually stack via z-index or just overlay.
        // If we want to close user profile, we can:
        // closeProfile(); 
        // But keeping it open in background is often nicer if they cancel.
        // However, if Modals compete for focus, closing might be safer.
        // Friend Manager likely keeps it open?
        // Let's keep User Profile open for now (stacking).
    };

    if (!isOpen || !userId) return null;

    return (
        <>
            <UserProfileModal
                userId={userId}
                onClose={closeProfile}
                openGroupProfile={handleOpenGroup}
            />
            {selectedGroupId && (
                <GroupProfileModal
                    groupId={selectedGroupId}
                    onClose={() => setSelectedGroupId(null)}
                // Recursion: Group Modal can open User Profile (Owner).
                // openUserProfile={(id) => ...} // Already handled by GroupProfileModal props?
                // GroupProfileModal.tsx: openUserProfile prop exists.
                // If we pass a handler, it might open another UserProfileModal on top.
                // Let's just allow it or rely on default behavior.
                />
            )}
        </>
    );
};
