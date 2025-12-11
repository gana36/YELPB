import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Send, Sparkles, Copy, Check, Users, Zap, Bell, MapPin, Apple, ChevronDown, ChevronUp, CheckCircle, X, MessageSquare } from 'lucide-react';
import { MultimodalChat } from './MultimodalChat';
import { GroupMap } from './GroupMap';
import { sessionService, SessionUser, UserVote } from '../services/sessionService';
import { useGeolocation } from '../hooks/useGeolocation';
interface LobbyScreenProps {
  sessionCode: string;
  onNavigate: (preferences: {
    cuisine: string;
    budget: string;
    vibe: string;
    dietary: string;
    distance: string;
    bookingDate: string;
    bookingTime: string;
    partySize: number;
    isOwner: boolean;
  }) => void;
}

const budgetOptions = ['$', '$$', '$$$', '$$$$'];
const cuisineOptions = ['Italian', 'Japanese', 'Mexican', 'French', 'Thai', 'Indian', 'Korean', 'Spanish'];
const vibeOptions = ['Casual', 'Fine Dining', 'Trendy', 'Cozy', 'Lively', 'Romantic', 'Family-Friendly'];
const dietaryOptions = ['None', 'Vegetarian', 'Vegan', 'Gluten-Free', 'Halal', 'Kosher'];
const distanceOptions = ['0.5 mi', '1 mi', '2 mi', '5 mi', '10 mi'];

const userColors = [
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-purple-400 to-purple-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-indigo-400 to-indigo-600',
  'from-emerald-400 to-emerald-600',
  'from-sky-400 to-sky-600'
];

interface Activity {
  id: number;
  type: 'join' | 'preference' | 'ready' | 'like';
  user: string;
  userColor: string;
  message: string;
  timestamp: Date;
}

type LobbyView = 'preferences' | 'map' | 'chat';

export function LobbyScreen({ sessionCode, onNavigate }: LobbyScreenProps) {
  // View management
  const [activeView, setActiveView] = useState<LobbyView>('preferences');

  const [budget, setBudget] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [vibe, setVibe] = useState('');
  const [dietary, setDietary] = useState('None');
  const [distance, setDistance] = useState('2 mi');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('19:00');
  const [partySize, setPartySize] = useState(2);
  const [locked, setLocked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [chatMinimized, setChatMinimized] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<SessionUser[]>([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [currentUserId] = useState(() => `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false); // Track if current user is session owner

  // Multi-user voting state from Firebase
  const [userVotes, setUserVotes] = useState<{
    budget: Record<string, UserVote[]>;
    cuisine: Record<string, UserVote[]>;
    vibe: Record<string, UserVote[]>;
    dietary: Record<string, UserVote[]>;
    distance: Record<string, UserVote[]>;
  }>({
    budget: {},
    cuisine: {},
    vibe: {},
    dietary: {},
    distance: {}
  });

  // Get current user's location for the group map
  const { location: userLocation, requestLocation } = useGeolocation(true);

  // Convert distance string to miles number for map
  const distanceToMiles = (dist: string): number => {
    const match = dist.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 2;
  };

  // Generate user locations for map (using current user + simulated positions for demo)
  const mapUsers = onlineUsers.map((user, index) => ({
    id: user.id,
    name: user.name,
    color: user.color.includes('orange') ? '#F97316' :
      user.color.includes('purple') ? '#a855f7' :
        user.color.includes('blue') ? '#3b82f6' :
          user.color.includes('green') ? '#22c55e' :
            user.color.includes('yellow') ? '#eab308' : '#ec4899',
    latitude: userLocation?.latitude
      ? userLocation.latitude + (Math.random() - 0.5) * 0.02 * (index + 1)
      : 37.7749 + (Math.random() - 0.5) * 0.02 * (index + 1),
    longitude: userLocation?.longitude
      ? userLocation.longitude + (Math.random() - 0.5) * 0.02 * (index + 1)
      : -122.4194 + (Math.random() - 0.5) * 0.02 * (index + 1),
    isCurrentUser: user.id === currentUserId
  }));

  // Firebase: Join session and subscribe to updates
  useEffect(() => {
    const userName = localStorage.getItem('userName') || 'You';
    const userColorIndex = Math.floor(Math.random() * userColors.length);
    const userColor = userColors[userColorIndex];

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setBookingDate(tomorrow.toISOString().split('T')[0]);

    // Join Firebase session
    const currentUser: SessionUser = {
      id: currentUserId,
      name: userName,
      color: userColor,
      joinedAt: Date.now()
    };

    console.log('🔥 Joining Firebase session:', sessionCode, 'as', currentUser);
    sessionService.joinSession(sessionCode, currentUser).catch(err => {
      console.error('❌ Failed to join session:', err);
    });

    // Subscribe to users
    const unsubscribeUsers = sessionService.subscribeToUsers(sessionCode, (users) => {
      console.log('👥 Users updated:', users);
      setOnlineUsers(users);
    });

    // Subscribe to activities
    const unsubscribeActivities = sessionService.subscribeToActivities(sessionCode, (acts) => {
      const formattedActivities: Activity[] = acts.map(act => ({
        id: act.timestamp,
        type: act.type,
        user: act.user,
        userColor: act.userColor,
        message: act.message,
        timestamp: new Date(act.timestamp)
      }));
      setActivities(formattedActivities);
      if (formattedActivities.length > 0) {
        setShowNewActivity(true);
        setTimeout(() => setShowNewActivity(false), 300);
      }
    });

    // Subscribe to session votes and users from main document
    const unsubscribeSession = sessionService.subscribeToSession(sessionCode, (data) => {
      if (data.votes) {
        setUserVotes(data.votes);
      }
      if (data.locked !== undefined) {
        setLocked(data.locked);
      }
      // Check if current user is the session owner
      if ((data as any).ownerId) {
        setIsOwner((data as any).ownerId === currentUserId);
        console.log('👑 Owner check:', { ownerId: (data as any).ownerId, currentUserId, isOwner: (data as any).ownerId === currentUserId });
      }
      // Also get users from main document (backup method)
      if (data.users) {
        const usersArray = Object.values(data.users) as SessionUser[];
        console.log('👥 Users from main document:', usersArray);
        if (usersArray.length > 0) {
          setOnlineUsers(usersArray);
        }
      }
    });

    // Cleanup on unmount
    return () => {
      unsubscribeUsers();
      unsubscribeActivities();
      unsubscribeSession();
      sessionService.leaveSession(sessionCode, currentUserId).catch(err => {
        console.error('Failed to leave session:', err);
      });
    };
  }, [sessionCode, currentUserId]);

  const addActivity = (message: string) => {
    const newActivity: Activity = {
      id: Date.now(),
      type: 'preference',
      user: 'You',
      userColor: 'from-orange-500 to-red-500',
      message,
      timestamp: new Date()
    };
    setActivities(prev => [...prev, newActivity]);
    setShowNewActivity(true);
    setTimeout(() => setShowNewActivity(false), 300);
  };

  // Update vote tracking when user selects a preference (Firebase)
  const updateVote = async (category: keyof typeof userVotes, value: string) => {
    const userName = localStorage.getItem('userName') || 'You';
    try {
      await sessionService.castVote(sessionCode, category, value, {
        id: currentUserId,
        name: userName
      });
    } catch (error) {
      console.error('Failed to cast vote:', error);
    }
  };

  // Get vote count for an option
  const getVoteCount = (category: keyof typeof userVotes, value: string): number => {
    return (userVotes[category][value] || []).length;
  };

  // Get voters for an option
  const getVoters = (category: keyof typeof userVotes, value: string): string[] => {
    return (userVotes[category][value] || []).map(v => v.userName);
  };

  // Smart preference merging for group consensus
  const getMergedPreferences = () => {
    const budgetRank = ['$', '$$', '$$$', '$$$$'];
    const distanceRank = ['0.5 mi', '1 mi', '2 mi', '5 mi', '10 mi'];

    // Helper: Get top voted options (handles ties)
    const getTopVoted = (category: keyof typeof userVotes, options: string[]): string[] => {
      const voteCounts = options.map(opt => ({
        option: opt,
        count: getVoteCount(category, opt)
      })).filter(v => v.count > 0);

      if (voteCounts.length === 0) return [];

      const maxVotes = Math.max(...voteCounts.map(v => v.count));
      return voteCounts.filter(v => v.count === maxVotes).map(v => v.option);
    };

    // Budget: Use LOWEST voted (no one gets priced out)
    const budgetVotes = getTopVoted('budget', budgetOptions);
    let mergedBudget = budget; // fallback to user's selection
    if (budgetVotes.length > 0) {
      // Find the lowest budget among top votes
      mergedBudget = budgetVotes.reduce((lowest, current) =>
        budgetRank.indexOf(current) < budgetRank.indexOf(lowest) ? current : lowest
      );
    }

    // Cuisine: Include ALL top voted (ties included)
    const cuisineVotes = getTopVoted('cuisine', cuisineOptions);
    const mergedCuisine = cuisineVotes.length > 0 ? cuisineVotes.join(' ') : cuisine;

    // Vibe: Include ALL top voted (ties included)
    const vibeVotes = getTopVoted('vibe', vibeOptions);
    const mergedVibe = vibeVotes.length > 0 ? vibeVotes.join(' ') : vibe;

    // Dietary: Use MOST restrictive (if anyone needs it, include it)
    const dietaryPriority = ['Vegan', 'Vegetarian', 'Gluten-Free', 'Halal', 'Kosher', 'None'];
    let mergedDietary = dietary;
    for (const diet of dietaryPriority) {
      if (getVoteCount('dietary', diet) > 0) {
        mergedDietary = diet;
        break;
      }
    }

    // Distance: Use HIGHEST voted (include all locations)
    const distanceVotes = getTopVoted('distance', distanceOptions);
    let mergedDistance = distance;
    if (distanceVotes.length > 0) {
      mergedDistance = distanceVotes.reduce((highest, current) =>
        distanceRank.indexOf(current) > distanceRank.indexOf(highest) ? current : highest
      );
    }

    return {
      cuisine: mergedCuisine,
      budget: mergedBudget,
      vibe: mergedVibe,
      dietary: mergedDietary,
      distance: mergedDistance,
      // Include info about ties for display
      hasCuisineTie: cuisineVotes.length > 1,
      hasVibeTie: vibeVotes.length > 1,
      cuisineOptions: cuisineVotes,
      vibeOptions: vibeVotes
    };
  };

  useEffect(() => {
    if (locked) {
      const newActivity: Activity = {
        id: Date.now(),
        type: 'ready',
        user: 'You',
        userColor: 'from-orange-500 to-red-500',
        message: 'locked preferences and is ready!',
        timestamp: new Date()
      };
      setActivities(prev => [...prev, newActivity]);
      setShowNewActivity(true);
      setTimeout(() => setShowNewActivity(false), 300);
    }
  }, [locked]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'join':
        return '👋';
      case 'preference':
        return '⚙️';
      case 'ready':
        return '✅';
      case 'like':
        return '❤️';
    }
  };

  return (
    <div className="flex h-screen flex-col" style={{ backgroundColor: '#ffffff' }}>

      {/* Header - Mobile Optimized */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-20 flex-shrink-0 border-b px-4 py-3"
        style={{ borderColor: '#e5e7eb', backgroundColor: '#ffffff' }}
      >
        <div className="flex items-center justify-between">
          {/* Online Users - Clickable */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOnlineUsers(!showOnlineUsers)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all border"
              style={{
                backgroundColor: showOnlineUsers ? '#fef3f2' : '#f9fafb',
                borderColor: showOnlineUsers ? '#F05A28' : '#d1d5db'
              }}
            >
              <Users className="h-4 w-4" style={{ color: '#F05A28' }} />
              <span className="text-sm font-bold" style={{ color: '#1C1917' }}>
                {onlineUsers.length}
              </span>
            </motion.button>

            {/* Users Dropdown */}
            <AnimatePresence>
              {showOnlineUsers && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-2 rounded-xl border shadow-lg overflow-hidden"
                  style={{ backgroundColor: '#ffffff', borderColor: '#d1d5db', minWidth: '200px', zIndex: 60 }}
                >
                  <div className="px-3 py-2 border-b" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
                    <span className="text-xs font-bold" style={{ color: '#6b7280' }}>ONLINE USERS</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {onlineUsers.map((user, index) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 transition-colors"
                        style={{ borderColor: '#f3f4f6' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
                      >
                        <div className="relative">
                          <div
                            className={`h-8 w-8 rounded-full bg-gradient-to-br ${user.color} flex items-center justify-center ring-2 ring-white`}
                          >
                            <span className="text-xs font-bold text-white">
                              {user.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 bg-green-500" style={{ borderColor: '#ffffff' }} />
                        </div>
                        <span className="text-sm font-medium" style={{ color: '#1C1917' }}>
                          {user.name}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Title */}
          <h1 className="absolute left-1/2 -translate-x-1/2 text-base font-bold tracking-wide" style={{ color: '#1C1917' }}>
            LOBBY
          </h1>

          {/* Session Code */}
          <motion.button
            onClick={handleCopyCode}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 transition-all"
            style={{
              backgroundColor: copied ? '#fef3f2' : '#f9fafb',
              borderColor: copied ? '#F05A28' : '#d1d5db'
            }}
          >
            <span className="text-xs font-mono font-bold tracking-wide" style={{ color: '#1C1917' }}>
              {sessionCode}
            </span>
            {copied ? (
              <Check className="h-3 w-3" style={{ color: '#F05A28' }} />
            ) : (
              <Copy className="h-3 w-3" style={{ color: '#6b7280' }} />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* View Content with Transitions */}
      <AnimatePresence mode="wait">
        {activeView === 'preferences' && (
          <motion.div
            key="preferences"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col flex-1 overflow-y-auto min-h-0 scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Activity Feed - Light Mode */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative z-10 flex-shrink-0 px-4 pt-3"
            >
              <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: '#ffffff', borderColor: '#d1d5db' }}>
                <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: '#f3f4f6', backgroundColor: '#fef3f2' }}>
                  <div className="flex items-center gap-2">
                    <motion.div animate={{ rotate: showNewActivity ? [0, -10, 10, -10, 0] : 0 }}>
                      <Bell className="h-3 w-3" style={{ color: '#F05A28' }} />
                    </motion.div>
                    <h3 className="text-xs font-bold" style={{ color: '#1C1917' }}>
                      Activity Feed
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: '#fed7aa' }}>
                    <div className="h-1 w-1 animate-pulse rounded-full" style={{ backgroundColor: '#f97316' }} />
                    <span className="text-xs font-medium" style={{ color: '#c2410c' }}>Live</span>
                  </div>
                </div>

                <div className="max-h-24 overflow-y-auto p-2 space-y-1.5">
                  <AnimatePresence mode="popLayout">
                    {activities.slice(-3).reverse().map((activity) => (
                      <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, x: -20, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: 'auto' }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        className="flex items-center gap-2 rounded-lg p-2 transition-colors"
                        style={{ backgroundColor: '#f9fafb' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      >
                        <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${activity.userColor} flex-shrink-0`} />
                        <p className="flex-1 text-xs truncate min-w-0" style={{ color: '#6b7280' }}>
                          <span className="font-semibold" style={{ color: '#1C1917' }}>{activity.user}</span> {activity.message}
                        </p>
                        <span className="text-sm flex-shrink-0">{getActivityIcon(activity.type)}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Group Consensus Summary - Light Mode */}
            {onlineUsers.length > 1 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 px-4 pt-3"
              >
                <div className="overflow-hidden rounded-xl border" style={{ backgroundColor: '#ffffff', borderColor: '#d1d5db' }}>
                  <div className="px-3 py-2 border-b" style={{ backgroundColor: '#fff7ed', borderColor: '#fdba74' }}>
                    <div className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" style={{ color: '#F05A28' }} />
                      <h3 className="text-xs font-bold" style={{ color: '#1C1917' }}>
                        GROUP CONSENSUS
                      </h3>
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#ef4444' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#dc2626' }}>MUST-HAVES</p>
                        <p className="text-xs" style={{ color: '#6b7280' }}>
                          Budget max: {budget || '—'} • Distance: {distance} • Dietary: {dietary}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: '#eab308' }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#ca8a04' }}>PREFERENCES</p>
                        <p className="text-xs" style={{ color: '#6b7280' }}>
                          Cuisine: {cuisine || '—'} • Vibe: {vibe || '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Preferences Content - No nested scroll */}
            <div className="px-4 py-3 pb-32">
              <div className="space-y-3">
                {/* Budget */}
                <CompactPreference
                  label="BUDGET"
                  icon=""
                  value={budget}
                  locked={locked}
                >
                  {!locked && (
                    <div className="flex gap-1.5">
                      {budgetOptions.map(opt => {
                        const voteCount = getVoteCount('budget', opt);
                        const voters = getVoters('budget', opt);
                        return (
                          <motion.button
                            key={opt}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setBudget(opt);
                              updateVote('budget', opt);
                              addActivity(`voted for ${opt} budget`);
                            }}
                            className={`relative flex-1 rounded-lg px-2.5 py-2.5 text-[13px] font-bold transition-all border ${budget === opt
                              ? 'border-orange-500'
                              : 'border-gray-300'
                              }`}
                            style={{
                              backgroundColor: budget === opt ? '#f97316' : '#ffffff',
                              color: budget === opt ? '#ffffff' : '#374151',
                              minHeight: '44px'
                            }}
                            onMouseEnter={(e) => {
                              if (budget !== opt) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                                e.currentTarget.style.borderColor = '#9ca3af';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (budget !== opt) {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#d1d5db';
                              }
                            }}
                          >
                            {opt}
                            {voteCount > 0 && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
                                style={{ backgroundColor: '#f97316' }}
                              >
                                {voteCount}
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </CompactPreference>

                {/* Cuisine */}
                <CompactPreference label="CUISINE" icon="" value={cuisine} locked={locked}>
                  {!locked && (
                    <div className="w-full -mr-3">
                      <div className="flex gap-1.5 overflow-x-auto pb-1 pr-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {cuisineOptions.map(opt => {
                          const voteCount = getVoteCount('cuisine', opt);
                          return (
                            <motion.button
                              key={opt}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setCuisine(opt);
                                updateVote('cuisine', opt);
                                addActivity(`prefers ${opt} cuisine`);
                              }}
                              className={`relative flex-shrink-0 rounded-lg px-2.5 py-2.5 text-xs font-bold transition-all whitespace-nowrap border ${cuisine === opt
                                ? 'shadow-lg border-orange-500'
                                : 'border-gray-300'
                                }`}
                              style={{
                                backgroundColor: cuisine === opt ? '#f97316' : '#ffffff',
                                color: cuisine === opt ? '#ffffff' : '#374151'
                              }}
                              onMouseEnter={(e) => {
                                if (cuisine !== opt) {
                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                  e.currentTarget.style.borderColor = '#9ca3af';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (cuisine !== opt) {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                  e.currentTarget.style.borderColor = '#d1d5db';
                                }
                              }}
                            >
                              {opt}
                              {voteCount > 0 && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-white"
                                >
                                  {voteCount}
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CompactPreference>

                {/* Vibe */}
                <CompactPreference label="VIBE" icon="" value={vibe} locked={locked}>
                  {!locked && (
                    <div className="w-full -mr-3">
                      <div className="flex gap-1.5 overflow-x-auto pb-1 pr-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {vibeOptions.map(opt => {
                          const voteCount = getVoteCount('vibe', opt);
                          return (
                            <motion.button
                              key={opt}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setVibe(opt);
                                updateVote('vibe', opt);
                                addActivity(`wants ${opt} vibe`);
                              }}
                              className={`relative flex-shrink-0 rounded-lg px-2.5 py-2.5 text-xs font-bold transition-all whitespace-nowrap border ${vibe === opt
                                ? 'shadow-lg border-orange-500'
                                : 'border-gray-300'
                                }`}
                              style={{
                                backgroundColor: vibe === opt ? '#f97316' : '#ffffff',
                                color: vibe === opt ? '#ffffff' : '#374151'
                              }}
                              onMouseEnter={(e) => {
                                if (vibe !== opt) {
                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                  e.currentTarget.style.borderColor = '#9ca3af';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (vibe !== opt) {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                  e.currentTarget.style.borderColor = '#d1d5db';
                                }
                              }}
                            >
                              {opt}
                              {voteCount > 0 && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-white"
                                >
                                  {voteCount}
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CompactPreference>

                {/* Distance */}
                <CompactPreference label="DISTANCE" icon="" value={distance} locked={locked}>
                  {!locked && (
                    <div className="flex gap-1.5">
                      {distanceOptions.map(opt => {
                        const voteCount = getVoteCount('distance', opt);
                        return (
                          <motion.button
                            key={opt}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setDistance(opt);
                              updateVote('distance', opt);
                              addActivity(`set distance to ${opt}`);
                            }}
                            className={`relative flex-1 rounded-lg px-2 py-2.5 text-xs font-bold transition-all border ${distance === opt
                              ? 'shadow-lg border-orange-500'
                              : 'border-gray-300'
                              }`}
                            style={{
                              backgroundColor: distance === opt ? '#f97316' : '#ffffff',
                              color: distance === opt ? '#ffffff' : '#374151'
                            }}
                            onMouseEnter={(e) => {
                              if (distance !== opt) {
                                e.currentTarget.style.backgroundColor = '#f9fafb';
                                e.currentTarget.style.borderColor = '#9ca3af';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (distance !== opt) {
                                e.currentTarget.style.backgroundColor = '#ffffff';
                                e.currentTarget.style.borderColor = '#d1d5db';
                              }
                            }}
                          >
                            {opt}
                            {voteCount > 0 && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-white"
                              >
                                {voteCount}
                              </motion.div>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </CompactPreference>

                {/* Dietary */}
                <CompactPreference label="DIETARY" icon="" value={dietary} locked={locked}>
                  {!locked && (
                    <div className="w-full -mr-3">
                      <div className="flex gap-1.5 overflow-x-auto pb-1 pr-3" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {dietaryOptions.map(opt => {
                          const voteCount = getVoteCount('dietary', opt);
                          return (
                            <motion.button
                              key={opt}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setDietary(opt);
                                updateVote('dietary', opt);
                                addActivity(`set dietary to ${opt}`);
                              }}
                              className={`relative flex-shrink-0 rounded-lg px-2.5 py-2.5 text-xs font-bold transition-all whitespace-nowrap border ${dietary === opt
                                ? 'shadow-lg border-orange-500'
                                : 'border-gray-300'
                                }`}
                              style={{
                                backgroundColor: dietary === opt ? '#f97316' : '#ffffff',
                                color: dietary === opt ? '#ffffff' : '#374151'
                              }}
                              onMouseEnter={(e) => {
                                if (dietary !== opt) {
                                  e.currentTarget.style.backgroundColor = '#f9fafb';
                                  e.currentTarget.style.borderColor = '#9ca3af';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (dietary !== opt) {
                                  e.currentTarget.style.backgroundColor = '#ffffff';
                                  e.currentTarget.style.borderColor = '#d1d5db';
                                }
                              }}
                            >
                              {opt}
                              {voteCount > 0 && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-white"
                                >
                                  {voteCount}
                                </motion.div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CompactPreference>

                {/* Date & Time */}
                <motion.div
                  whileHover={!locked ? { scale: 1.005 } : {}}
                  className="rounded-xl p-3 transition-all relative overflow-visible border"
                  style={{ backgroundColor: '#ffffff', borderColor: '#d1d5db' }}
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] tracking-widest font-extrabold uppercase" style={{ color: '#9ca3af' }}>DATE & TIME</span>
                    </div>
                    {locked && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                        <Lock className="h-3 w-3" style={{ color: '#F05A28' }} />
                      </motion.div>
                    )}
                  </div>
                  {!locked ? (
                    <div className="flex gap-1.5">
                      <input
                        type="date"
                        value={bookingDate}
                        onChange={(e) => {
                          setBookingDate(e.target.value);
                          addActivity(`set date to ${e.target.value}`);
                        }}
                        min={new Date().toISOString().split('T')[0]}
                        className="flex-1 rounded-lg border px-2.5 py-2.5 text-sm font-medium focus:outline-none transition-all"
                        style={{ backgroundColor: '#f9fafb', borderColor: '#d1d5db', color: '#1C1917', minHeight: '44px' }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#f97316';
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                      />
                      <input
                        type="time"
                        value={bookingTime}
                        onChange={(e) => {
                          setBookingTime(e.target.value);
                          addActivity(`set time to ${e.target.value}`);
                        }}
                        className="w-24 rounded-lg border px-2.5 py-2.5 text-sm font-medium focus:outline-none transition-all"
                        style={{ backgroundColor: '#f9fafb', borderColor: '#d1d5db', color: '#1C1917', minHeight: '44px' }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = '#f97316';
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = '#d1d5db';
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <motion.div
                        key={`${bookingDate} - ${bookingTime}`}
                        initial={{ y: -8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="flex-1 rounded-lg px-2.5 py-2 text-center transition-all"
                        style={{ backgroundColor: '#ffedd5', minHeight: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <span className="text-sm font-bold" style={{ color: '#F05A28' }}>
                          {new Date(bookingDate).toLocaleDateString()} at {bookingTime}
                        </span>
                      </motion.div>
                    </div>
                  )}
                </motion.div>

                {/* Action Button - iPhone 15 Pro Optimized */}
                {!locked ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setLocked(true)}
                    className="relative w-full overflow-hidden rounded-lg py-3.5 font-bold text-white border border-orange-500"
                    style={{ backgroundColor: '#f97316', minHeight: '52px', fontSize: '15px' }}
                  >
                    <div className="relative flex items-center justify-center gap-2">
                      <Lock className="h-4 w-4" />
                      <span>
                        Lock Preferences
                      </span>
                    </div>
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onNavigate({ cuisine, budget, vibe, dietary, distance, bookingDate, bookingTime, partySize })}
                    className="relative w-full overflow-hidden rounded-lg py-3.5 font-bold text-white border border-orange-600"
                    style={{ backgroundColor: '#f97316', minHeight: '52px', fontSize: '15px' }}
                  >
                    <div className="relative flex items-center justify-center gap-2">
                      <Zap className="h-4 w-4" fill="currentColor" />
                      <span>
                        Start Swiping
                      </span>
                    </div>
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden h-[calc(100%-80px)]"
          >
            <GroupMap
              users={mapUsers}
              currentUserLocation={userLocation ? {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
              } : undefined}
              distanceRadius={distanceToMiles(distance)}
              mobileView={true}
            />
          </motion.div>
        )}

        {activeView === 'chat' && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <div className="h-full">
              <MultimodalChat
                preferences={{
                  cuisine,
                  budget,
                  vibe,
                  distance,
                  dietary
                }}
                activities={activities}
                onlineUsers={onlineUsers}
                userVotes={userVotes}
                sessionCode={sessionCode}
                minimized={false}
                onToggleMinimized={() => { }} // No-op since we're in full screen mode
                onPreferencesDetected={(prefs) => {
                  // Auto-populate preferences from AI analysis
                  if (prefs.cuisine) {
                    setCuisine(prefs.cuisine);
                    updateVote('cuisine', prefs.cuisine);
                    addActivity(`AI suggested ${prefs.cuisine} cuisine`);
                  }
                  if (prefs.budget) {
                    setBudget(prefs.budget);
                    updateVote('budget', prefs.budget);
                    addActivity(`AI suggested ${prefs.budget} budget`);
                  }
                  if (prefs.vibe) {
                    setVibe(prefs.vibe);
                    updateVote('vibe', prefs.vibe);
                    addActivity(`AI suggested ${prefs.vibe} vibe`);
                  }
                  if (prefs.dietary) {
                    setDietary(prefs.dietary);
                    updateVote('dietary', prefs.dietary);
                    addActivity(`AI suggested ${prefs.dietary} dietary preference`);
                  }
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Bottom Navigation Bar - Sleek Mobile Design */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.12)'
        }}
      >
        <div className="flex items-center justify-around max-w-md mx-auto px-2 py-2">
          {/* Preferences Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveView('preferences')}
            className="flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 flex-1 transition-all relative"
            style={{
              backgroundColor: 'transparent',
            }}
          >
            <Lock className="h-5 w-5" style={{ color: activeView === 'preferences' ? '#F05A28' : '#9ca3af' }} />
            <span className="text-[9px] font-semibold" style={{ color: activeView === 'preferences' ? '#F05A28' : '#9ca3af' }}>Preferences</span>
            {activeView === 'preferences' && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                style={{
                  width: '40%',
                  backgroundColor: '#F05A28'
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </motion.button>

          {/* Map Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveView('map')}
            className="flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 flex-1 transition-all relative"
            style={{
              backgroundColor: 'transparent',
            }}
          >
            <MapPin className="h-5 w-5" style={{ color: activeView === 'map' ? '#F05A28' : '#9ca3af' }} />
            <span className="text-[9px] font-semibold" style={{ color: activeView === 'map' ? '#F05A28' : '#9ca3af' }}>Map</span>
            {activeView === 'map' && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                style={{
                  width: '40%',
                  backgroundColor: '#F05A28'
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </motion.button>

          {/* Assistant Button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setActiveView('chat')}
            className="flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 flex-1 transition-all relative"
            style={{
              backgroundColor: 'transparent',
            }}
          >
            <MessageSquare className="h-5 w-5" style={{ color: activeView === 'chat' ? '#F05A28' : '#9ca3af' }} />
            <span className="text-[9px] font-semibold" style={{ color: activeView === 'chat' ? '#F05A28' : '#9ca3af' }}>Assistant</span>
            {activeView === 'chat' && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
                style={{
                  width: '40%',
                  backgroundColor: '#F05A28'
                }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Hide scrollbar CSS */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}

function CompactPreference({ label, icon, value, locked, children }: {
  label: string;
  icon: string | React.ReactNode;
  value: string;
  locked: boolean;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      whileHover={!locked ? { scale: 1.005 } : {}}
      className="rounded-xl p-3 transition-all relative overflow-visible border"
      style={{ zIndex: children ? 30 : 10, backgroundColor: '#ffffff', borderColor: '#d1d5db' }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] tracking-widest font-extrabold uppercase" style={{ color: '#9ca3af' }}>{label}</span>
        </div>
        {locked && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
            <Lock className="h-3 w-3" style={{ color: '#F05A28' }} />
          </motion.div>
        )}
      </div>
      {children}
    </motion.div>
  );
}

function MiniDropdown({ options, value, onChange, open, onToggle }: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={onToggle}
        className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-medium transition-all w-full shadow-sm"
        style={{ backgroundColor: '#f9fafb', borderColor: '#d1d5db', color: '#1C1917', minHeight: '44px' }}
      >
        <span>{value}</span>
        {open ? <ChevronUp className="h-4 w-4" style={{ color: '#6b7280' }} /> : <ChevronDown className="h-4 w-4" style={{ color: '#6b7280' }} />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden z-50"
            style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}
          >
            {options.map((opt) => (
              <motion.button
                key={opt}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  onChange(opt);
                  onToggle();
                }}
                className="w-full px-3 py-3 text-left text-sm font-medium transition-colors border-b last:border-b-0"
                style={{
                  backgroundColor: value === opt ? '#fef3f2' : '#ffffff',
                  color: value === opt ? '#F05A28' : '#1C1917',
                  borderColor: '#f3f4f6',
                  minHeight: '44px'
                }}
                onMouseEnter={(e) => {
                  if (value !== opt) e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  if (value !== opt) e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                {opt}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
