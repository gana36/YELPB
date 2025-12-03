'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChefHat, Ticket } from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { useUserStore } from '@/store/userStore';
import { generateRoomCode } from '@/lib/utils';
import IdentityModal from '@/components/portal/IdentityModal';

type ModalMode = 'host' | 'join' | null;

export default function Home() {
  const router = useRouter();
  const { setUser, uid } = useUserStore();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Anonymous auth on mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user.uid, user.displayName);
      } else {
        try {
          await signInAnonymously(auth);
        } catch (err) {
          console.error('Anonymous auth failed:', err);
        }
      }
    });

    return () => unsubscribe();
  }, [setUser]);

  const handleHostSession = async (name: string) => {
    if (!uid) {
      setError('Authentication in progress. Please try again.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Generate unique room code
      let code = generateRoomCode();
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts) {
        const roomRef = doc(db, 'rooms', code);
        const roomSnap = await getDoc(roomRef);

        if (!roomSnap.exists()) {
          // Create the room with structured manifest
          await setDoc(roomRef, {
            code,
            hostId: uid,
            hostName: name,
            createdAt: serverTimestamp(),
            status: 'active',
            manifest: {
              budget: { value: null, locked: false },
              cuisine: { value: null, locked: false },
              vibe: { value: null, locked: false },
            },
            participants: [{ uid, name, isHost: true }],
          });

          // Create initial events
          const eventsRef = collection(db, 'rooms', code, 'events');
          await addDoc(eventsRef, {
            type: 'info',
            text: `${name} created the room. Let's decide where to eat!`,
            authorName: name,
            timestamp: serverTimestamp(),
          });

          // Store display name
          useUserStore.getState().setDisplayName(name);

          // Redirect to room
          router.push(`/room/${code}`);
          return;
        }

        code = generateRoomCode();
        attempts++;
      }

      setError('Unable to create room. Please try again.');
    } catch (err) {
      console.error('Error creating room:', err);
      setError('Failed to create room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (name: string, roomCode?: string) => {
    if (!uid || !roomCode) {
      setError('Please enter a valid room code.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const normalizedCode = roomCode.toUpperCase();
      const roomRef = doc(db, 'rooms', normalizedCode);
      const roomSnap = await getDoc(roomRef);

      if (!roomSnap.exists()) {
        setError('Room not found. Check the code and try again.');
        setIsLoading(false);
        return;
      }

      // Store display name
      useUserStore.getState().setDisplayName(name);

      // Redirect to room
      router.push(`/room/${normalizedCode}`);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Failed to join room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (name: string, roomCode?: string) => {
    if (modalMode === 'host') {
      handleHostSession(name);
    } else if (modalMode === 'join') {
      handleJoinRoom(name, roomCode);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF9]">
      {/* Header */}
      <header className="flex items-center justify-center px-6 pt-12 pb-8">
        <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#1C1917]">
          CommonPlate
        </h1>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-4">
          {/* Host Card */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setError(null);
              setModalMode('host');
            }}
            className="group relative w-full overflow-hidden rounded-3xl bg-white p-8 text-left shadow-xl shadow-stone-200/50 transition-shadow duration-300 hover:shadow-2xl hover:shadow-stone-300/50"
          >
            <div className="relative z-10">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F05A28] to-[#E04D1B] shadow-lg shadow-[#F05A28]/30">
                <ChefHat className="h-8 w-8 text-white" strokeWidth={1.5} />
              </div>
              <h2 className="mb-2 text-xl font-semibold tracking-[-0.02em] text-[#1C1917]">
                Start a Session
              </h2>
              <p className="text-sm text-[#57534E]">
                Host a new room and invite others to join
              </p>
            </div>
            {/* Subtle gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#F05A28]/0 to-[#F05A28]/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </motion.button>

          {/* Join Card */}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setError(null);
              setModalMode('join');
            }}
            className="group relative w-full overflow-hidden rounded-3xl border-2 border-dashed border-stone-300 bg-transparent p-8 text-left transition-all duration-300 hover:border-stone-400 hover:bg-white/50"
          >
            <div className="relative z-10">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-stone-200 bg-stone-50 transition-colors duration-300 group-hover:border-stone-300 group-hover:bg-stone-100">
                <Ticket className="h-8 w-8 text-[#57534E]" strokeWidth={1.5} />
              </div>
              <h2 className="mb-2 text-xl font-semibold tracking-[-0.02em] text-[#1C1917]">
                Join Room
              </h2>
              <p className="text-sm text-[#57534E]">
                Enter a code to join an existing session
              </p>
            </div>
          </motion.button>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center px-6 pb-8">
        <p className="text-xs text-stone-400">
          Share meals, share moments
        </p>
      </footer>

      {/* Identity Modal */}
      <IdentityModal
        isOpen={modalMode !== null}
        mode={modalMode || 'host'}
        onClose={() => setModalMode(null)}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}
