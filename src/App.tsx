import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { SwipeScreen } from './components/SwipeScreen';
import { WinnerScreen } from './components/WinnerScreen';
import { PageTransition } from './components/PageTransition';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'lobby' | 'swipe' | 'winner'>('welcome');
  const [sessionCode, setSessionCode] = useState('');
  const [preferences, setPreferences] = useState({
    cuisine: '',
    budget: '',
    vibe: '',
    dietary: 'None',
    distance: '2 mi',
    bookingDate: '',
    bookingTime: '19:00',
    partySize: 2
  });
  const [winnerRestaurant, setWinnerRestaurant] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);

  const handleStartSession = (code: string) => {
    setSessionCode(code);
    setCurrentScreen('lobby');
  };

  const handleStartSwiping = (prefs: typeof preferences & { isOwner?: boolean }) => {
    setPreferences(prefs);
    setIsOwner(prefs.isOwner ?? false);
    setCurrentScreen('swipe');
  };

  return (
    <div className="min-h-screen bg-black overflow-hidden">
      <AnimatePresence mode="wait">
        {currentScreen === 'welcome' && (
          <PageTransition key="welcome">
            <WelcomeScreen onNavigate={handleStartSession} />
          </PageTransition>
        )}
        {currentScreen === 'lobby' && (
          <PageTransition key="lobby">
            <LobbyScreen sessionCode={sessionCode} onNavigate={handleStartSwiping} />
          </PageTransition>
        )}
        {currentScreen === 'swipe' && (
          <PageTransition key="swipe">
            <SwipeScreen
              preferences={preferences}
              onNavigate={(winner) => {
                setWinnerRestaurant(winner);
                setCurrentScreen('winner');
              }}
            />
          </PageTransition>
        )}
        {currentScreen === 'winner' && (
          <PageTransition key="winner">
            <WinnerScreen
              restaurant={winnerRestaurant}
              preferences={{
                bookingDate: preferences.bookingDate,
                bookingTime: preferences.bookingTime,
                partySize: preferences.partySize
              }}
              isOwner={isOwner}
              onNavigate={() => setCurrentScreen('welcome')}
            />
          </PageTransition>
        )}
      </AnimatePresence>
    </div>
  );
}
