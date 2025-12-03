'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, onSnapshot, updateDoc, arrayUnion, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { PartyPopper } from 'lucide-react';
import { db } from '@/lib/firebase';
import { useUserStore } from '@/store/userStore';
import ManifestHeader from '@/components/room/ManifestHeader';
import PublicTimeline from '@/components/room/PublicTimeline';
import PrivateCockpit from '@/components/room/PrivateCockpit';

// New manifest schema
interface ManifestSlot {
  value: string | null;
  locked: boolean;
}

interface RoomManifest {
  budget: ManifestSlot;
  cuisine: ManifestSlot;
  vibe: ManifestSlot;
}

interface RoomData {
  code: string;
  hostId: string;
  hostName: string;
  status: string;
  manifest: RoomManifest;
  participants?: { uid: string; name: string; isHost?: boolean }[];
}

// Default manifest for fallback
const defaultManifest: RoomManifest = {
  budget: { value: null, locked: false },
  cuisine: { value: null, locked: false },
  vibe: { value: null, locked: false },
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { displayName, uid } = useUserStore();
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);
  const [showVictory, setShowVictory] = useState(false);

  // Subscribe to room data
  useEffect(() => {
    if (!code) return;

    const roomRef = doc(db, 'rooms', code);
    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as RoomData;
          // Normalize manifest to new schema
          if (data.manifest && !('budget' in data.manifest && 'locked' in (data.manifest.budget || {}))) {
            // Old schema detected, convert
            data.manifest = defaultManifest;
          }
          setRoomData(data);
        } else {
          router.push('/');
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching room:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [code, router]);

  // Win condition: Check if all 3 slots are locked
  useEffect(() => {
    if (!roomData?.manifest) return;

    const manifest = roomData.manifest;
    const allLocked =
      manifest.budget?.locked &&
      manifest.cuisine?.locked &&
      manifest.vibe?.locked;

    if (allLocked && !showVictory) {
      setShowVictory(true);
      // Redirect to vote page after 3 seconds
      setTimeout(() => {
        router.push(`/room/${code}/vote`);
      }, 3000);
    }
  }, [roomData?.manifest, code, router, showVictory]);

  // Add participant to room when joining
  useEffect(() => {
    if (!roomData || !uid || !displayName || hasJoined) return;

    const isAlreadyInRoom = roomData.participants?.some((p) => p.uid === uid);
    if (isAlreadyInRoom) {
      setHasJoined(true);
      return;
    }

    const roomRef = doc(db, 'rooms', code);
    const eventsRef = collection(db, 'rooms', code, 'events');

    Promise.all([
      updateDoc(roomRef, {
        participants: arrayUnion({ uid, name: displayName, isHost: false }),
      }),
      addDoc(eventsRef, {
        type: 'join',
        text: `${displayName} joined the room`,
        authorName: displayName,
        timestamp: serverTimestamp(),
      }),
    ])
      .then(() => setHasJoined(true))
      .catch(console.error);
  }, [roomData, uid, displayName, code, hasJoined]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAF9]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-stone-200 border-t-[#F05A28]" />
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAFAF9] px-6">
        <p className="text-[#57534E]">Room not found</p>
      </div>
    );
  }

  const manifest = roomData.manifest || defaultManifest;
  const roomContext = {
    manifest,
    participants: roomData.participants || [],
  };

  return (
    <div className="flex h-screen flex-col bg-[#FAFAF9]">
      {/* Victory Overlay */}
      <AnimatePresence>
        {showVictory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#F05A28]"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
              className="text-center text-white"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.5, delay: 0.5 }}
                className="mb-6 inline-block"
              >
                <PartyPopper className="h-20 w-20" strokeWidth={1.5} />
              </motion.div>
              <h1 className="mb-4 text-4xl font-bold tracking-tight">
                Decision Made!
              </h1>
              <div className="mb-6 space-y-2 text-lg opacity-90">
                <p><strong>Cuisine:</strong> {manifest.cuisine?.value}</p>
                <p><strong>Budget:</strong> {manifest.budget?.value}</p>
                <p><strong>Vibe:</strong> {manifest.vibe?.value}</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-white/70">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                />
                <span>Finding restaurants...</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manifest Header - Sticky */}
      <ManifestHeader
        roomCode={code}
        manifest={manifest}
        participants={roomData.participants || []}
      />

      {/* Split Screen Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Public Timeline - Top 60% */}
        <div className="h-[60%] overflow-hidden bg-[#FAFAF9]">
          <PublicTimeline roomId={code} />
        </div>

        {/* Private Cockpit - Bottom 40% */}
        <div className="h-[40%] min-h-[280px]">
          <PrivateCockpit
            roomId={code}
            roomContext={roomContext}
            userName={displayName || 'Guest'}
          />
        </div>
      </div>
    </div>
  );
}
