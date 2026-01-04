import { create } from 'zustand';

interface UserProfileState {
    userId: string | null;
    isOpen: boolean;
    openProfile: (userId: string) => void;
    closeProfile: () => void;
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
    userId: null,
    isOpen: false,
    openProfile: (userId) => set({ userId, isOpen: true }),
    closeProfile: () => set({ isOpen: false, userId: null }),
}));
