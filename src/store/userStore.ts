import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
  uid: string | null;
  displayName: string | null;
  isAuthenticated: boolean;
  setUser: (uid: string, displayName: string | null) => void;
  setDisplayName: (name: string) => void;
  clearUser: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      uid: null,
      displayName: null,
      isAuthenticated: false,
      setUser: (uid, displayName) =>
        set({ uid, displayName, isAuthenticated: true }),
      setDisplayName: (name) => set({ displayName: name }),
      clearUser: () =>
        set({ uid: null, displayName: null, isAuthenticated: false }),
    }),
    {
      name: 'commonplate-user',
    }
  )
);
