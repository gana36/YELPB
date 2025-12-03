'use client';

import { motion } from 'framer-motion';
import { Lock, Unlock, DollarSign, Utensils, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManifestSlot {
  value: string | null;
  locked: boolean;
}

interface Manifest {
  budget: ManifestSlot;
  cuisine: ManifestSlot;
  vibe: ManifestSlot;
}

interface Participant {
  uid: string;
  name: string;
  isHost?: boolean;
}

interface ManifestHeaderProps {
  roomCode: string;
  manifest: Manifest;
  participants?: Participant[];
}

const constraintConfig = {
  budget: { icon: DollarSign, label: 'Budget' },
  cuisine: { icon: Utensils, label: 'Cuisine' },
  vibe: { icon: Sparkles, label: 'Vibe' },
};

export default function ManifestHeader({ roomCode, manifest, participants = [] }: ManifestHeaderProps) {
  const constraints = ['budget', 'cuisine', 'vibe'] as const;
  
  // Count locked slots for progress
  const lockedCount = constraints.filter((key) => manifest[key]?.locked).length;

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto max-w-2xl px-4 py-3">
        {/* Room Code & Participants */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-[-0.03em] text-[#1C1917]">
              CommonPlate
            </h1>
            {/* Progress indicator */}
            <div className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={false}
                  animate={{
                    backgroundColor: i < lockedCount ? '#F05A28' : '#D6D3D1',
                    scale: i < lockedCount ? 1 : 0.8,
                  }}
                  className="h-2 w-2 rounded-full"
                />
              ))}
              <span className="ml-1 text-xs font-medium text-stone-500">
                {lockedCount}/3
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Participants */}
            {participants.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {participants.slice(0, 4).map((p, i) => (
                    <div
                      key={p.uid}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-semibold',
                        p.isHost
                          ? 'bg-[#F05A28] text-white'
                          : 'bg-stone-200 text-stone-600'
                      )}
                      style={{ zIndex: participants.length - i }}
                      title={p.name}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {participants.length > 4 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-stone-100 text-xs font-medium text-stone-500">
                      +{participants.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Room Code */}
            <div className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5">
              <span className="font-mono text-sm font-bold tracking-wider text-[#1C1917]">
                {roomCode}
              </span>
            </div>
          </div>
        </div>

        {/* Constraints */}
        <div className="flex gap-2">
          {constraints.map((key) => {
            const config = constraintConfig[key];
            const Icon = config.icon;
            const slot = manifest[key] || { value: null, locked: false };
            const hasValue = !!slot.value;
            const isLocked = slot.locked;

            return (
              <motion.div
                key={key}
                initial={false}
                animate={{
                  scale: isLocked ? 1 : 1,
                  borderColor: isLocked ? '#F05A28' : hasValue ? '#FBBF24' : '#E7E5E4',
                }}
                className={cn(
                  'flex flex-1 items-center gap-2 rounded-xl px-3 py-2 transition-colors border',
                  isLocked
                    ? 'bg-[#F05A28]/10'
                    : hasValue
                    ? 'bg-amber-50'
                    : 'bg-stone-50'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4',
                    isLocked
                      ? 'text-[#F05A28]'
                      : hasValue
                      ? 'text-amber-500'
                      : 'text-stone-400'
                  )}
                  strokeWidth={1.5}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                    {config.label}
                  </p>
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      isLocked
                        ? 'text-[#1C1917]'
                        : hasValue
                        ? 'text-amber-700'
                        : 'text-stone-400'
                    )}
                  >
                    {slot.value || 'Open'}
                  </p>
                </div>
                {isLocked ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <Lock className="h-3.5 w-3.5 text-[#F05A28]" />
                  </motion.div>
                ) : (
                  <Unlock className="h-3 w-3 text-stone-300" />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
