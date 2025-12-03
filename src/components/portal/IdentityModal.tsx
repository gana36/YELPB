'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalMode = 'host' | 'join';

interface IdentityModalProps {
  isOpen: boolean;
  mode: ModalMode;
  onClose: () => void;
  onSubmit: (name: string, roomCode?: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

export default function IdentityModal({
  isOpen,
  mode,
  onClose,
  onSubmit,
  isLoading = false,
  error = null,
}: IdentityModalProps) {
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  const isValid = mode === 'host' 
    ? name.trim().length >= 2 
    : name.trim().length >= 2 && roomCode.length === 4;

  useEffect(() => {
    if (isOpen) {
      // Focus the appropriate input after animation
      const timer = setTimeout(() => {
        if (mode === 'join' && codeInputRef.current) {
          codeInputRef.current.focus();
        } else if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // Reset state when modal closes
      setName('');
      setRoomCode('');
    }
  }, [isOpen, mode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isLoading) return;
    onSubmit(name.trim(), mode === 'join' ? roomCode.toUpperCase() : undefined);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (value.length <= 4) {
      setRoomCode(value);
      // Auto-focus name input when code is complete
      if (value.length === 4 && nameInputRef.current) {
        nameInputRef.current.focus();
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
            }}
            className="fixed bottom-0 left-0 right-0 z-50 h-[55vh] min-h-[400px]"
          >
            <div className="h-full rounded-t-[32px] bg-white shadow-2xl shadow-stone-400/30">
              {/* Handle */}
              <div className="flex justify-center pt-4 pb-2">
                <div className="h-1.5 w-12 rounded-full bg-stone-200" />
              </div>

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute right-6 top-6 rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Content */}
              <form onSubmit={handleSubmit} className="flex h-full flex-col px-8 pb-8">
                <div className="flex-1">
                  <h2 className="mb-8 text-2xl font-semibold tracking-tight text-stone-900">
                    Let&apos;s get started.
                  </h2>

                  <div className="space-y-6">
                    {/* Room Code Input (Join mode only) */}
                    {mode === 'join' && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-stone-500">
                          Room Code
                        </label>
                        <input
                          ref={codeInputRef}
                          type="text"
                          value={roomCode}
                          onChange={handleCodeChange}
                          placeholder="XXXX"
                          maxLength={4}
                          className={cn(
                            'w-full rounded-2xl border-2 bg-stone-50 px-6 py-4',
                            'font-mono text-2xl tracking-[0.3em] text-center uppercase',
                            'text-stone-900 placeholder:text-stone-300',
                            'transition-all duration-200',
                            'focus:border-[#F05A28] focus:bg-white focus:outline-none',
                            'border-stone-200'
                          )}
                        />
                      </div>
                    )}

                    {/* Name Input */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-stone-500">
                        Your Name
                      </label>
                      <input
                        ref={nameInputRef}
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your name"
                        className={cn(
                          'w-full rounded-2xl border-2 bg-stone-50 px-6 py-4',
                          'text-2xl font-medium text-stone-900 placeholder:text-stone-300',
                          'transition-all duration-200',
                          'focus:border-[#F05A28] focus:bg-white focus:outline-none',
                          'border-stone-200'
                        )}
                      />
                    </div>

                    {/* Error Message */}
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm font-medium text-red-500"
                      >
                        {error}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <AnimatePresence>
                  {isValid && (
                    <motion.button
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.2 }}
                      type="submit"
                      disabled={isLoading}
                      className={cn(
                        'mt-6 w-full rounded-2xl bg-[#F05A28] px-8 py-5',
                        'text-lg font-semibold text-white',
                        'shadow-lg shadow-[#F05A28]/30',
                        'transition-all duration-200',
                        'hover:bg-[#E04D1B] hover:shadow-xl hover:shadow-[#F05A28]/40',
                        'active:scale-[0.98]',
                        'disabled:cursor-not-allowed disabled:opacity-70'
                      )}
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="inline-block h-5 w-5 rounded-full border-2 border-white/30 border-t-white"
                          />
                          Loading...
                        </span>
                      ) : (
                        'Enter Kitchen'
                      )}
                    </motion.button>
                  )}
                </AnimatePresence>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
