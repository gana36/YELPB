import { useState } from 'react';
import { motion } from 'motion/react';
import { Users, LogIn, Sparkles, Utensils } from 'lucide-react';

interface WelcomeScreenProps {
  onNavigate: (sessionCode: string) => void;
}

export function WelcomeScreen({ onNavigate }: WelcomeScreenProps) {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [userName, setUserName] = useState('');
  const [isHost, setIsHost] = useState(false);

  const handleHostSession = () => {
    setIsHost(true);
    setShowNameInput(true);
  };

  const handleJoinClick = () => {
    setIsHost(false);
    setShowJoinInput(true);
  };

  const handleJoinSession = () => {
    if (joinCode.trim()) {
      setShowNameInput(true);
    }
  };

  const handleContinue = () => {
    if (userName.trim()) {
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

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* Animated background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1721073954161-5aa2ca4fff0b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwZGlubmVyJTIwdGFibGUlMjB3YXJtJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzY1MTQwNDQyfDA&ixlib=rb-4.1.0&q=80&w=1080')`,
        }}
      >
        <motion.div 
          className="absolute inset-0 bg-black/60"
          animate={{
            background: [
              'radial-gradient(circle at 20% 50%, rgba(249,115,22,0.15) 0%, rgba(0,0,0,0.6) 50%)',
              'radial-gradient(circle at 80% 50%, rgba(249,115,22,0.15) 0%, rgba(0,0,0,0.6) 50%)',
              'radial-gradient(circle at 20% 50%, rgba(249,115,22,0.15) 0%, rgba(0,0,0,0.6) 50%)',
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-orange-500/30 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.5, 1],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="glassmorphism-premium w-full max-w-md rounded-[32px] p-10 text-center backdrop-blur-2xl"
        >
          {/* Logo with icon */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8, type: 'spring', bounce: 0.4 }}
            className="mb-4 flex justify-center"
          >
            <div className="relative">
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(249,115,22,0.3)',
                    '0 0 40px rgba(249,115,22,0.6)',
                    '0 0 20px rgba(249,115,22,0.3)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="rounded-full bg-gradient-to-br from-[#F97316] to-[#fb923c] p-5"
              >
                <Utensils className="h-10 w-10 text-white" strokeWidth={2.5} />
              </motion.div>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute -inset-4 rounded-full border-2 border-dashed border-orange-500/30"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <h1 className="mb-2 bg-gradient-to-r from-white via-orange-100 to-white bg-clip-text text-5xl text-transparent" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>
              CommonPlate
            </h1>
            <p className="mb-3 text-gray-300" style={{ fontSize: '1.1rem' }}>
              Dine together, decide together
            </p>
            <div className="mb-10 flex items-center justify-center gap-2 text-xs text-orange-400/80">
              <Sparkles className="h-3 w-3" />
              <span>Powered by AI matchmaking</span>
            </div>
          </motion.div>

          {/* Buttons */}
          <div className="flex flex-col gap-4">
            {showNameInput ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="mb-4 text-center">
                  <h3 className="text-lg text-white mb-1" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                    What&apos;s your name?
                  </h3>
                  <p className="text-sm text-gray-400">
                    {isHost ? 'Let your friends know who\'s hosting!' : `Joining room ${joinCode}`}
                  </p>
                </div>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleContinue()}
                  placeholder="Enter your name"
                  maxLength={20}
                  className="w-full rounded-2xl border-2 border-orange-500/50 bg-black/40 px-6 py-4 text-center text-xl text-white placeholder-gray-500 outline-none backdrop-blur-sm transition-all focus:border-orange-500 focus:shadow-lg focus:shadow-orange-500/30"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowNameInput(false);
                      setUserName('');
                      if (!isHost) setShowJoinInput(true);
                    }}
                    className="flex-1 rounded-xl border border-white/30 bg-white/5 px-4 py-3 text-sm text-gray-300 transition-colors hover:bg-white/10"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleContinue}
                    disabled={userName.trim().length < 2}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#F97316] to-[#fb923c] px-4 py-3 text-sm text-white shadow-lg shadow-orange-500/30 transition-all disabled:opacity-40 disabled:shadow-none"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            ) : !showJoinInput ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  onClick={handleHostSession}
                  className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F97316] to-[#fb923c] px-8 py-5 shadow-xl shadow-orange-500/30 transition-shadow hover:shadow-orange-500/50"
                >
                  <motion.div 
                    className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                    animate={{ x: ['-200%', '200%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                  <div className="relative flex items-center justify-center gap-3">
                    <Users className="h-6 w-6 text-white" strokeWidth={2.5} />
                    <span className="text-lg text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                      Host a Session
                    </span>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 }}
                  onClick={handleJoinClick}
                  className="group rounded-2xl border-2 border-white/30 bg-white/5 px-8 py-5 backdrop-blur-md transition-all hover:border-orange-400/50 hover:bg-white/10"
                >
                  <div className="flex items-center justify-center gap-3">
                    <LogIn className="h-6 w-6 text-white transition-colors group-hover:text-orange-400" strokeWidth={2.5} />
                    <span className="text-lg text-white transition-colors group-hover:text-orange-400" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                      Join Room
                    </span>
                  </div>
                </motion.button>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinSession()}
                  placeholder="Enter room code"
                  maxLength={6}
                  className="w-full rounded-2xl border-2 border-orange-500/50 bg-black/40 px-6 py-4 text-center text-xl tracking-widest text-white placeholder-gray-500 outline-none backdrop-blur-sm transition-all focus:border-orange-500 focus:shadow-lg focus:shadow-orange-500/30"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowJoinInput(false)}
                    className="flex-1 rounded-xl border border-white/30 bg-white/5 px-4 py-3 text-sm text-gray-300 transition-colors hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleJoinSession}
                    disabled={joinCode.length < 4}
                    className="flex-1 rounded-xl bg-gradient-to-r from-[#F97316] to-[#fb923c] px-4 py-3 text-sm text-white shadow-lg shadow-orange-500/30 transition-all disabled:opacity-40 disabled:shadow-none"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                  >
                    Join Now
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Bottom tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 text-sm text-gray-400"
        >
          The future of group dining is here
        </motion.p>
      </div>
    </div>
  );
}