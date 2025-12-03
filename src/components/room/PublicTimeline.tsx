'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ThumbsUp, MessageSquare, Lock, Utensils, DollarSign, Sparkles, Info, UserPlus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface RoomEvent {
  id: string;
  type: 'proposal' | 'lock' | 'info' | 'join';
  category?: string;
  value?: string;
  text: string;
  authorName?: string;
  timestamp: Date;
}

interface PublicTimelineProps {
  roomId: string;
}

const categoryIcons: Record<string, typeof Utensils> = {
  cuisine: Utensils,
  budget: DollarSign,
  vibe: Sparkles,
  general: MessageSquare,
};

export default function PublicTimeline({ roomId }: PublicTimelineProps) {
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const eventsRef = collection(db, 'rooms', roomId, 'events');
    const q = query(eventsRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const newEvents: RoomEvent[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          newEvents.push({
            id: doc.id,
            type: data.type,
            category: data.category,
            value: data.value,
            text: data.text,
            authorName: data.authorName,
            timestamp: data.timestamp?.toDate() || new Date(),
          });
        });
        setEvents(newEvents);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error listening to events:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="h-6 w-6 rounded-full border-2 border-stone-200 border-t-[#F05A28]"
        />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100">
          <MessageSquare className="h-8 w-8 text-stone-400" strokeWidth={1.5} />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-[#1C1917]">No activity yet</h3>
        <p className="text-sm text-[#57534E]">
          Use the chat below to start making proposals
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="relative mx-auto max-w-md">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-stone-200 via-stone-200 to-transparent" />

        {/* Events */}
        <AnimatePresence mode="popLayout">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
                delay: index * 0.05,
              }}
              className="relative mb-4 pl-10"
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-2 top-4 h-4 w-4 rounded-full border-2 border-white shadow-sm',
                  event.type === 'proposal'
                    ? 'bg-[#F05A28]'
                    : event.type === 'lock'
                    ? 'bg-emerald-500'
                    : event.type === 'join'
                    ? 'bg-blue-500'
                    : 'bg-stone-300'
                )}
              />

              {/* Event Card */}
              {event.type === 'proposal' ? (
                <ProposalCard event={event} />
              ) : event.type === 'lock' ? (
                <LockCard event={event} />
              ) : event.type === 'join' ? (
                <JoinCard event={event} />
              ) : (
                <InfoCard event={event} />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ProposalCard({ event }: { event: RoomEvent }) {
  const Icon = categoryIcons[event.category || 'general'] || MessageSquare;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-lg shadow-stone-200/50">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F05A28]/10">
            <Icon className="h-4 w-4 text-[#F05A28]" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-xs font-medium text-stone-500">{event.authorName}</p>
            <p className="text-[10px] text-stone-400">
              {formatTime(event.timestamp)}
            </p>
          </div>
        </div>
        {event.value && (
          <span className="rounded-full bg-[#F05A28]/10 px-2.5 py-1 text-xs font-semibold text-[#F05A28]">
            {event.value}
          </span>
        )}
      </div>

      <p className="mb-4 text-sm leading-relaxed text-[#1C1917]">{event.text}</p>

      {/* Vote Button (Stub) */}
      <button className="flex items-center gap-2 rounded-xl bg-stone-50 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100">
        <ThumbsUp className="h-4 w-4" strokeWidth={1.5} />
        <span>Vote</span>
      </button>
    </div>
  );
}

function LockCard({ event }: { event: RoomEvent }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
          <Lock className="h-4 w-4 text-white" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-semibold text-emerald-800">{event.text}</p>
          <p className="text-xs text-emerald-600">{formatTime(event.timestamp)}</p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ event }: { event: RoomEvent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-stone-50 px-4 py-3">
      <Info className="h-4 w-4 text-stone-400" strokeWidth={1.5} />
      <p className="text-sm text-stone-500">{event.text}</p>
      <span className="ml-auto text-xs text-stone-400">
        {formatTime(event.timestamp)}
      </span>
    </div>
  );
}

function JoinCard({ event }: { event: RoomEvent }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500">
        <UserPlus className="h-3.5 w-3.5 text-white" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">{event.authorName}</p>
        <p className="text-xs text-blue-600">joined the room</p>
      </div>
      <span className="text-xs text-blue-400">
        {formatTime(event.timestamp)}
      </span>
    </div>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString();
}
