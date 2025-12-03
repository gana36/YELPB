'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { doc, onSnapshot } from 'firebase/firestore';
import { MapPin, Star, DollarSign, ExternalLink, ArrowLeft } from 'lucide-react';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

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
  manifest: RoomManifest;
  participants?: { uid: string; name: string; isHost?: boolean }[];
}

// Placeholder restaurant data - in production, this would come from Yelp/Google API
const mockRestaurants = [
  {
    id: '1',
    name: 'Spice Garden',
    cuisine: 'Thai',
    rating: 4.5,
    priceLevel: '$$',
    distance: '0.3 mi',
    image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?w=400&h=300&fit=crop',
    address: '123 Main St',
  },
  {
    id: '2',
    name: 'Noodle House',
    cuisine: 'Thai',
    rating: 4.2,
    priceLevel: '$$',
    distance: '0.5 mi',
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=300&fit=crop',
    address: '456 Oak Ave',
  },
  {
    id: '3',
    name: 'Bangkok Bistro',
    cuisine: 'Thai',
    rating: 4.7,
    priceLevel: '$$$',
    distance: '0.8 mi',
    image: 'https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=400&h=300&fit=crop',
    address: '789 Elm Blvd',
  },
];

export default function VotePage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const roomRef = doc(db, 'rooms', code);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        setRoomData(snapshot.data() as RoomData);
      }
    });

    return () => unsubscribe();
  }, [code]);

  const manifest = roomData?.manifest;

  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/room/${code}`)}
              className="flex items-center gap-2 text-stone-500 hover:text-stone-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Room</span>
            </button>
            <div className="rounded-full bg-stone-100 px-3 py-1.5">
              <span className="font-mono text-sm font-bold tracking-wider text-[#1C1917]">
                {code}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Decision Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-2xl bg-gradient-to-br from-[#F05A28] to-[#E04D1B] p-6 text-white shadow-xl"
        >
          <h1 className="mb-4 text-2xl font-bold tracking-tight">
            Time to Pick a Spot!
          </h1>
          <div className="flex flex-wrap gap-3">
            {manifest?.cuisine?.value && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur-sm">
                {manifest.cuisine.value}
              </span>
            )}
            {manifest?.budget?.value && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur-sm">
                {manifest.budget.value}
              </span>
            )}
            {manifest?.vibe?.value && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur-sm">
                {manifest.vibe.value}
              </span>
            )}
          </div>
        </motion.div>

        {/* Restaurant Cards */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#1C1917]">
            Top Picks Near You
          </h2>

          {mockRestaurants.map((restaurant, index) => (
            <motion.button
              key={restaurant.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => setSelectedRestaurant(restaurant.id)}
              className={cn(
                'w-full overflow-hidden rounded-2xl border-2 bg-white text-left shadow-lg transition-all',
                selectedRestaurant === restaurant.id
                  ? 'border-[#F05A28] ring-4 ring-[#F05A28]/20'
                  : 'border-transparent hover:border-stone-200'
              )}
            >
              <div className="flex">
                <div className="h-32 w-32 flex-shrink-0">
                  <img
                    src={restaurant.image}
                    alt={restaurant.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="font-semibold text-[#1C1917]">
                      {restaurant.name}
                    </h3>
                    <p className="text-sm text-stone-500">{restaurant.cuisine}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="h-4 w-4 fill-current" />
                      {restaurant.rating}
                    </span>
                    <span className="text-stone-400">{restaurant.priceLevel}</span>
                    <span className="flex items-center gap-1 text-stone-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {restaurant.distance}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Vote Button */}
        {selectedRestaurant && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white p-4"
          >
            <div className="mx-auto max-w-2xl">
              <button
                onClick={() => {
                  // TODO: Implement voting logic
                  alert('Voting coming soon!');
                }}
                className="w-full rounded-xl bg-[#F05A28] py-4 text-lg font-semibold text-white shadow-lg shadow-[#F05A28]/30 transition-all hover:bg-[#E04D1B] hover:shadow-xl"
              >
                Cast My Vote
              </button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
