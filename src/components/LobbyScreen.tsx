import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Send, Sparkles, Copy, Check, Users, Zap, Bell, MapPin, Apple, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
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
  'from-orange-500 to-red-500',
  'from-purple-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-green-500 to-emerald-500',
  'from-yellow-500 to-orange-500',
  'from-pink-500 to-rose-500',
];

interface Activity {
  id: number;
  type: 'join' | 'preference' | 'ready' | 'like';
  user: string;
  userColor: string;
  message: string;
  timestamp: Date;
}

export function LobbyScreen({ sessionCode, onNavigate }: LobbyScreenProps) {
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
    <div className="flex h-screen flex-col bg-gradient-to-b from-zinc-950 via-black to-zinc-950">
      {/* Background effects */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1657593088889-5105c637f2a8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwaW50ZXJpb3IlMjBtb29keXxlbnwxfHx8fDE3NjUxNDA0NDN8MA&ixlib=rb-4.1.0&q=80&w=1080')`,
        backgroundSize: 'cover'
      }} />

      <motion.div
        className="absolute left-1/2 top-20 h-96 w-96 -translate-x-1/2 rounded-full bg-orange-500/10 blur-[120px] pointer-events-none"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Fixed Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-20 flex-shrink-0 border-b border-white/5 bg-black/40 p-4 backdrop-blur-xl"
      >
        {/* Title and Room Code on same line */}
        <div className="mb-3 flex items-center justify-center gap-3">
          <h2 className="text-2xl text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
            THE LOBBY
          </h2>
          <motion.button
            onClick={handleCopyCode}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 backdrop-blur-md transition-colors hover:bg-white/10"
          >
            <span className="text-xs text-gray-400">CODE:</span>
            <span className="text-sm text-orange-400" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
              {sessionCode}
            </span>
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 text-gray-400" />}
          </motion.button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Users className="h-3 w-3 text-gray-400" />
          <div className="flex -space-x-2">
            {onlineUsers.map((user, index) => (
              <motion.div
                key={user.id}
                initial={{ scale: 0, x: -20 }}
                animate={{ scale: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
                style={{ zIndex: hoveredUserId === user.id ? 50 : 10 }}
                onMouseEnter={() => setHoveredUserId(user.id)}
                onMouseLeave={() => setHoveredUserId(null)}
              >
                <div className={`h-7 w-7 rounded-full bg-gradient-to-br ${user.color} ring-2 ${hoveredUserId === user.id ? 'ring-[#F97316]' : 'ring-black'} flex items-center justify-center cursor-pointer transition-all duration-200 ${hoveredUserId === user.id ? 'scale-110' : 'scale-100'}`}>
                  <span className="text-[10px] font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                    {user.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-black bg-green-500" />

                {/* Tooltip */}
                {hoveredUserId === user.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none"
                  >
                    <div className="bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-xl shadow-orange-500/50 whitespace-nowrap">
                      {user.name}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-0.5">
                      <div className="border-[5px] border-transparent border-t-[#F97316]" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
          <span className="text-xs text-gray-400">{onlineUsers.length} online</span>
        </div>
      </motion.div>

      {/* Activity Feed - Compact */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="relative z-10 flex-shrink-0 px-4 pt-3"
      >
        <div className="glassmorphism-premium overflow-hidden rounded-xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent px-3 py-2">
            <div className="flex items-center gap-2">
              <motion.div animate={{ rotate: showNewActivity ? [0, -10, 10, -10, 0] : 0 }}>
                <Bell className="h-3 w-3 text-[#F97316]" />
              </motion.div>
              <h3 className="text-xs text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                Activity Feed
              </h3>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5">
              <div className="h-1 w-1 animate-pulse rounded-full bg-orange-400" />
              <span className="text-xs text-orange-400">Live</span>
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
                  className="flex items-center gap-2 rounded-lg bg-white/5 p-2 hover:bg-white/10 transition-colors"
                >
                  <div className={`h-5 w-5 rounded-full bg-gradient-to-br ${activity.userColor} flex-shrink-0`} />
                  <p className="flex-1 text-xs text-gray-300 truncate min-w-0">
                    <span className="text-white font-semibold">{activity.user}</span> {activity.message}
                  </p>
                  <span className="text-sm flex-shrink-0">{getActivityIcon(activity.type)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Group Consensus Summary */}
      {onlineUsers.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 px-4 pt-3"
        >
          <div className="glassmorphism-premium overflow-hidden rounded-xl backdrop-blur-xl border border-orange-500/20">
            <div className="bg-gradient-to-r from-orange-500/20 to-transparent px-3 py-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-[#F97316]" />
                <h3 className="text-xs text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                  GROUP CONSENSUS
                </h3>
              </div>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-red-400 font-semibold mb-0.5">MUST-HAVES</p>
                  <p className="text-xs text-gray-300">
                    Budget max: {budget || '—'} • Distance: {distance} • Dietary: {dietary}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] text-yellow-400 font-semibold mb-0.5">PREFERENCES</p>
                  <p className="text-xs text-gray-300">
                    Cuisine: {cuisine || '—'} • Vibe: {vibe || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Scrollable Preferences Section */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2.5 pb-4">
          {/* Group Location Map */}
          <GroupMap
            users={mapUsers}
            currentUserLocation={userLocation ? {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude
            } : undefined}
            distanceRadius={distanceToMiles(distance)}
          />

          {/* Budget */}
          <CompactPreference
            label="BUDGET"
            icon="💰"
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
                      className={`relative flex-1 rounded-lg px-2.5 py-2 text-sm transition-all ${budget === opt
                        ? 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg shadow-orange-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                    >
                      {opt}
                      {voteCount > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-black"
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
          <CompactPreference label="CUISINE" icon="🍽️" value={cuisine} locked={locked}>
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
                        className={`relative flex-shrink-0 rounded-lg px-3 py-2 text-xs transition-all whitespace-nowrap ${cuisine === opt
                          ? 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg shadow-orange-500/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                      >
                        {opt}
                        {voteCount > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-black"
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
          <CompactPreference label="VIBE" icon="✨" value={vibe} locked={locked}>
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
                        className={`relative flex-shrink-0 rounded-lg px-3 py-2 text-xs transition-all whitespace-nowrap ${vibe === opt
                          ? 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg shadow-orange-500/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                      >
                        {opt}
                        {voteCount > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-black"
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
          <CompactPreference label="DISTANCE" icon={<MapPin className="h-4 w-4" />} value={distance} locked={locked}>
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
                      className={`relative flex-1 rounded-lg px-2 py-2 text-xs transition-all ${distance === opt
                        ? 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg shadow-orange-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                        }`}
                      style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                    >
                      {opt}
                      {voteCount > 0 && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-black"
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
          <CompactPreference label="DIETARY" icon={<Apple className="h-4 w-4" />} value={dietary} locked={locked}>
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
                        className={`relative flex-shrink-0 rounded-lg px-3 py-2 text-xs transition-all whitespace-nowrap ${dietary === opt
                          ? 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg shadow-orange-500/30'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                      >
                        {opt}
                        {voteCount > 0 && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white ring-2 ring-black"
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
            className="glassmorphism-premium rounded-xl p-3 backdrop-blur-xl transition-all relative overflow-visible"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">📅</span>
                <span className="text-xs tracking-wider text-gray-400">DATE & TIME</span>
              </div>
              {locked && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
                  <Lock className="h-3 w-3 text-[#F97316]" />
                </motion.div>
              )}
            </div>
            {!locked ? (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => {
                    setBookingDate(e.target.value);
                    addActivity(`set date to ${e.target.value}`);
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-[#F97316] focus:outline-none"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
                />
                <input
                  type="time"
                  value={bookingTime}
                  onChange={(e) => {
                    setBookingTime(e.target.value);
                    addActivity(`set time to ${e.target.value}`);
                  }}
                  className="w-24 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-[#F97316] focus:outline-none"
                  style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <motion.div
                  key={`${bookingDate}-${bookingTime}`}
                  initial={{ y: -8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="flex-1 rounded-lg p-2 text-center transition-all bg-gradient-to-r from-[#F97316]/20 to-orange-600/20 shadow-[0_0_20px_rgba(249,115,22,0.15)]"
                >
                  <span
                    className="text-sm text-[#F97316]"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}
                  >
                    {new Date(bookingDate).toLocaleDateString()} at {bookingTime}
                  </span>
                </motion.div>
              </div>
            )}
          </motion.div>

          {/* Action Button */}
          {!locked ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setLocked(true)}
              className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#F97316] to-[#fb923c] py-3 shadow-xl shadow-orange-500/30"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
              <div className="relative flex items-center justify-center gap-2">
                <Lock className="h-4 w-4" />
                <span className="text-sm" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                  Lock Preferences
                </span>
              </div>
            </motion.button>
          ) : (
            <>
              {/* Merged Preferences Summary */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="text-xs font-semibold text-green-400">SEARCHING FOR</span>
                </div>
                {(() => {
                  const m = getMergedPreferences();
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {m.dietary && m.dietary !== 'None' && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300">
                          🥗 {m.dietary}
                        </span>
                      )}
                      {m.cuisine && (
                        <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">
                          🍽️ {m.cuisine} {m.hasCuisineTie && '(tied)'}
                        </span>
                      )}
                      {m.vibe && (
                        <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
                          ✨ {m.vibe} {m.hasVibeTie && '(tied)'}
                        </span>
                      )}
                      <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                        💰 {m.budget}
                      </span>
                      <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
                        📍 {m.distance}
                      </span>
                    </div>
                  );
                })()}
              </motion.div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  const merged = getMergedPreferences();
                  console.log('🎯 Merged preferences:', merged);
                  onNavigate({
                    cuisine: merged.cuisine,
                    budget: merged.budget,
                    vibe: merged.vibe,
                    dietary: merged.dietary,
                    distance: merged.distance,
                    bookingDate,
                    bookingTime,
                    partySize,
                    isOwner
                  });
                }}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#F97316] via-orange-500 to-[#fb923c] py-3 shadow-xl shadow-orange-500/40"
                animate={{
                  boxShadow: [
                    '0 20px 40px -12px rgba(249,115,22,0.4)',
                    '0 20px 60px -12px rgba(249,115,22,0.6)',
                    '0 20px 40px -12px rgba(249,115,22,0.4)',
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="relative flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4" fill="currentColor" />
                  <span className="text-sm" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                    Start Swiping
                  </span>
                </div>
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* Fixed AI Assistant at Bottom - Now with Multimodal Support */}
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
        minimized={chatMinimized}
        onToggleMinimized={() => setChatMinimized(!chatMinimized)}
        onPreferencesDetected={(prefs) => {
          // Auto-populate preferences from AI analysis
          if (prefs.cuisine) {
            setCuisine(prefs.cuisine);
            addActivity(`AI suggested ${prefs.cuisine} cuisine`);
          }
          if (prefs.budget) {
            setBudget(prefs.budget);
            addActivity(`AI suggested ${prefs.budget} budget`);
          }
          if (prefs.vibe) {
            setVibe(prefs.vibe);
            addActivity(`AI suggested ${prefs.vibe} vibe`);
          }
          if (prefs.dietary) {
            setDietary(prefs.dietary);
            addActivity(`AI suggested ${prefs.dietary} dietary preference`);
          }
        }}
      />
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
      className="glassmorphism-premium rounded-xl p-3 backdrop-blur-xl transition-all relative overflow-visible"
      style={{ zIndex: children ? 30 : 10 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {typeof icon === 'string' ? <span className="text-sm">{icon}</span> : icon}
          <span className="text-xs tracking-wider text-gray-400">{label}</span>
        </div>
        {locked && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}>
            <Lock className="h-3 w-3 text-[#F97316]" />
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
      <button
        onClick={onToggle}
        className="flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-2 text-xs text-white transition-colors hover:bg-white/20"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-2xl backdrop-blur-xl"
          >
            <div className="max-h-40 overflow-y-auto">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    onToggle();
                  }}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors ${value === opt
                    ? 'bg-[#F97316] text-white'
                    : 'text-gray-300 hover:bg-white/10'
                    }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}