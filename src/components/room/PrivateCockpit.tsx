'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { collection, doc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsExecuted?: string[];
  timestamp: Date;
}

interface ManifestSlot {
  value: string | null;
  locked: boolean;
}

interface RoomContext {
  manifest: {
    budget: ManifestSlot;
    cuisine: ManifestSlot;
    vibe: ManifestSlot;
  };
  participants?: { name: string }[];
}

interface ToolCall {
  name: string;
  args: any;
}

interface PrivateCockpitProps {
  roomId: string;
  roomContext: RoomContext;
  userName: string;
}

async function executeToolCalls(roomId: string, userName: string, toolCalls: ToolCall[]) {
  const roomRef = doc(db, 'rooms', roomId);
  const eventsRef = collection(db, 'rooms', roomId, 'events');

  for (const call of toolCalls) {
    if (call.name === 'propose_update') {
      const { target, value, reason } = call.args as {
        target: string;
        value: string;
        reason: string;
      };

      await Promise.all([
        addDoc(eventsRef, {
          type: 'proposal',
          category: target,
          value,
          text: reason,
          authorName: userName || 'Anonymous',
          timestamp: serverTimestamp(),
        }),
        updateDoc(roomRef, {
          [`manifest.${target}.value`]: value,
        }),
      ]);
    } else if (call.name === 'lock_slot') {
      const { target, value } = call.args as { target: string; value: string };

      await Promise.all([
        updateDoc(roomRef, {
          [`manifest.${target}.value`]: value,
          [`manifest.${target}.locked`]: true,
        }),
        addDoc(eventsRef, {
          type: 'lock',
          category: target,
          value,
          text: `${target.charAt(0).toUpperCase() + target.slice(1)} locked: ${value}`,
          authorName: userName || 'Anonymous',
          timestamp: serverTimestamp(),
        }),
      ]);
    }
  }
}

export default function PrivateCockpit({
  roomId,
  roomContext,
  userName,
}: PrivateCockpitProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "I'm your private strategist. Tell me what you're craving, and I'll help you influence the group decision. What are you in the mood for?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.trim(),
          roomId,
          roomContext,
          userName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      // If the AI decided to act (toolCalls), run them client-side
      if (Array.isArray(data.toolCalls) && data.toolCalls.length > 0) {
        const actionMessage: Message = {
          id: `action-${Date.now()}`,
          role: 'assistant',
          content: 'Posting proposal to the room...',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, actionMessage]);

        await executeToolCalls(roomId, userName, data.toolCalls as ToolCall[]);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.message,
        toolsExecuted: data.toolsExecuted,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex h-full flex-col rounded-t-[32px] border-t border-stone-200 bg-white shadow-[0_-20px_60px_-15px_rgba(15,23,42,0.18)]">
      {/* Header */}
      <div className="flex items-center justify-center px-4 pt-4 pb-2">
        <div className="h-1 w-10 rounded-full bg-stone-300" />
      </div>
      <div className="border-b border-stone-200 bg-white px-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F05A28]">
            <Bot className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </div>
          <span className="text-sm font-medium text-stone-700">Private Strategist</span>
          <span className="ml-auto text-xs text-stone-400">Only you can see this</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={cn(
                'mb-3 flex',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5',
                  message.role === 'user'
                    ? 'bg-[#F05A28] text-white'
                    : 'bg-stone-100 text-[#1C1917]'
                )}
              >
                <p className="text-sm leading-relaxed">{message.content}</p>
                {message.toolsExecuted && message.toolsExecuted.length > 0 && (
                  <div className="mt-2 border-t border-stone-200 pt-2">
                    {message.toolsExecuted.map((tool, i) => (
                      <p key={i} className="text-xs text-emerald-600">
                        {tool}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-2 rounded-2xl bg-stone-100 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-[#F05A28]" />
              <span className="text-sm text-stone-500">Thinking...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-stone-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you want..."
            disabled={isLoading}
            className={cn(
              'flex-1 rounded-xl bg-stone-50 px-4 py-3 text-sm text-[#1C1917] placeholder-stone-400',
              'border border-stone-200 outline-none transition-colors',
              'focus:border-[#F05A28] focus:ring-1 focus:ring-[#F05A28]/40',
              'disabled:opacity-50'
            )}
          />
          <motion.button
            type="submit"
            disabled={!input.trim() || isLoading}
            whileTap={{ scale: 0.95 }}
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
              input.trim() && !isLoading
                ? 'bg-[#F05A28] text-white hover:bg-[#E04D1B]'
                : 'bg-stone-100 text-stone-400'
            )}
          >
            <Send className="h-5 w-5" strokeWidth={1.5} />
          </motion.button>
        </div>
      </form>
    </div>
  );
}
