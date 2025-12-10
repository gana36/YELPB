import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UtensilsCrossed } from 'lucide-react';

interface WelcomeScreenProps {
  onNavigate: (sessionCode: string) => void;
}

type View = 'LANDING' | 'JOIN_CODE' | 'NAME_INPUT';

export function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  const [view, setView] = useState<View>('LANDING');
  const [isHost, setIsHost] = useState(false);
  const [userName, setUserName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const handleHostSession = () => {
    setIsHost(true);
    setView('NAME_INPUT');
  };

  const handleJoinClick = () => {
    setIsHost(false);
    setView('JOIN_CODE');
  };

  const handleJoinSession = () => {
    if (joinCode.trim().length >= 4) {
      setView('NAME_INPUT');
    }
  };

  const handleContinue = () => {
    if (userName.trim().length >= 2) {
      if (isHost) {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem('userName', userName.trim());
        onNavigate(code);
      } else {
        localStorage.setItem('userName', userName.trim());
        onNavigate(joinCode.trim().toUpperCase());
      }
    }
  };

  const handleBack = () => {
    setUserName('');
    if (isHost) {
      setView('LANDING');
    } else {
      setView('JOIN_CODE');
    }
  };

  const handleCancel = () => {
    setJoinCode('');
    setView('LANDING');
  };

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: '#ffffff' }}>
      {/* Header - Professional */}
      <div className="flex items-center justify-center gap-2.5 px-4 py-5">
        <div className="flex items-center justify-center" style={{ color: '#F05A28' }}>
          <UtensilsCrossed className="w-6 h-6" strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-bold tracking-tight" style={{ color: '#1C1917' }}>
          CommonPlate
        </h1>
      </div>

      {/* Hero Image with Text Overlay - Mobile Optimized */}
      <div className="relative w-full h-56 overflow-hidden" style={{ backgroundColor: '#f9fafb' }}>
        <img
          src="/dining-vibe.png"
          alt="Dining together"
          className="w-full h-full object-cover"
        />
        {/* Gradient Overlay for Text Visibility */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 100%)'
          }}
        />
        {/* Headline & Subtitle Overlay */}
        <div className="absolute inset-0 flex items-center justify-center px-5">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-1.5 leading-tight">
              <span style={{ color: '#FFFFFF', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                Dining decisions,
              </span>
              <span style={{ color: '#F05A28', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                simplified.
              </span>
            </h1>
            <p
              className="text-sm leading-snug"
              style={{
                color: '#F5F5F4',
                textShadow: '0 1px 4px rgba(0,0,0,0.4)'
              }}
            >
              No more endless group chats. Match, decide, and eat in seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content - Centered - Mobile Optimized */}
      <div className="flex-1 flex items-center justify-center px-5 py-6">
        <div className="w-full max-w-sm text-center">
          <AnimatePresence mode="wait">
            {/* Landing View */}
            {view === 'LANDING' && (
              <motion.div
                key="landing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-3xl font-bold mb-3" style={{ color: '#111827' }}>
                  Welcome
                </h2>
                <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
                  Start a session or join an existing room
                </p>
              </motion.div>
            )}

            {/* Join Code View */}
            {view === 'JOIN_CODE' && (
              <motion.div
                key="join-code"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-3xl font-bold mb-3" style={{ color: '#111827' }}>
                  Join Room
                </h2>
                <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                  Enter the 4-6 character room code
                </p>

                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
                  placeholder="ABCD"
                  maxLength={6}
                  className="w-full text-center text-3xl font-bold tracking-widest py-5 rounded-lg border-2 focus:outline-none transition-colors"
                  style={{
                    backgroundColor: '#f9fafb',
                    color: '#111827',
                    borderColor: '#e5e7eb',
                    fontFamily: 'monospace'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                  autoFocus
                />
              </motion.div>
            )}

            {/* Name Input View */}
            {view === 'NAME_INPUT' && (
              <motion.div
                key="name-input"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-3xl font-bold mb-3" style={{ color: '#111827' }}>
                  {isHost ? 'Almost There' : `Joining ${joinCode}`}
                </h2>
                <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
                  What should we call you?
                </p>

                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleContinue()}
                  placeholder="Your name"
                  maxLength={20}
                  className="w-full text-center text-2xl font-semibold py-5 rounded-lg border-2 focus:outline-none transition-colors"
                  style={{
                    backgroundColor: '#f9fafb',
                    color: '#111827',
                    borderColor: '#e5e7eb'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#f97316'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                  autoFocus
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Card with Buttons - Mobile Optimized */}
      <div className="px-5 pb-6">
        <div
          className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-5 space-y-3"
          style={{
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            border: '1px solid #f3f4f6'
          }}
        >
          <AnimatePresence mode="wait">
            {/* Landing View Buttons */}
            {view === 'LANDING' && (
              <motion.div
                key="landing-buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <button
                  onClick={handleHostSession}
                  className="w-full font-semibold py-4 rounded-xl transition-colors shadow-sm"
                  style={{ backgroundColor: '#f97316', color: '#ffffff' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ea580c'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f97316'}
                >
                  Host a Session
                </button>
                <button
                  onClick={handleJoinClick}
                  className="w-full font-semibold py-4 rounded-xl transition-colors"
                  style={{ backgroundColor: '#f3f4f6', color: '#111827' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                >
                  Join a Room
                </button>
              </motion.div>
            )}

            {/* Join Code View Buttons */}
            {view === 'JOIN_CODE' && (
              <motion.div
                key="join-buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3"
              >
                <button
                  onClick={handleCancel}
                  className="flex-1 font-semibold py-4 rounded-xl transition-colors"
                  style={{ backgroundColor: '#f3f4f6', color: '#111827' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleJoinSession}
                  disabled={joinCode.length < 4}
                  className="flex-1 font-semibold py-4 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: joinCode.length < 4 ? '#fdba74' : '#f97316',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    if (joinCode.length >= 4) e.currentTarget.style.backgroundColor = '#ea580c';
                  }}
                  onMouseLeave={(e) => {
                    if (joinCode.length >= 4) e.currentTarget.style.backgroundColor = '#f97316';
                  }}
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* Name Input View Buttons */}
            {view === 'NAME_INPUT' && (
              <motion.div
                key="name-buttons"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex gap-3"
              >
                <button
                  onClick={handleBack}
                  className="flex-1 font-semibold py-4 rounded-xl transition-colors"
                  style={{ backgroundColor: '#f3f4f6', color: '#111827' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  disabled={userName.trim().length < 2}
                  className="flex-1 font-semibold py-4 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: userName.trim().length < 2 ? '#fdba74' : '#f97316',
                    color: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    if (userName.trim().length >= 2) e.currentTarget.style.backgroundColor = '#ea580c';
                  }}
                  onMouseLeave={(e) => {
                    if (userName.trim().length >= 2) e.currentTarget.style.backgroundColor = '#f97316';
                  }}
                >
                  {isHost ? 'Start' : 'Join'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
