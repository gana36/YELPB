import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { X, Heart, Star, MapPin, Clock, TrendingUp, Award, Info, Loader2, Phone, ExternalLink, ChefHat, RotateCcw } from 'lucide-react';
import { useYelpSearch } from '../hooks/useYelpSearch';
import { useGeolocation } from '../hooks/useGeolocation';
import { Business, apiService } from '../services/api';

interface SwipeScreenProps {
  onNavigate: (winner: Restaurant | null) => void;
  preferences?: {
    cuisine: string;
    budget: string;
    vibe: string;
    dietary: string;
    distance: string;
  };
}

interface MenuItem {
  name: string;
  price?: string;
  description?: string;
}

interface MenuCategory {
  name: string;
  items: MenuItem[];
}

interface MenuData {
  categories: MenuCategory[];
  highlights?: string[];
  price_range?: string;
}

interface Restaurant {
  id: string | number;
  name: string;
  image: string;
  rating: number;
  reviewCount: number;
  price: string;
  cuisine: string;
  distance: string;
  address: string;
  city: string;
  phone: string;
  url: string;
  menuUrl?: string;
  menuData?: MenuData;
  menuError?: string;
  trending: boolean;
  categories: string[];
}

interface LikedRestaurant {
  id: string;
  name: string;
  timestamp: number;
}

export function SwipeScreen({ onNavigate, preferences }: SwipeScreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [likedRestaurants, setLikedRestaurants] = useState<LikedRestaurant[]>([]);
  const [showYumAnimation, setShowYumAnimation] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [flippedCards, setFlippedCards] = useState<Set<string | number>>(new Set());
  const [loadingMenus, setLoadingMenus] = useState<Set<string | number>>(new Set());

  const { businesses, loading, error, search } = useYelpSearch();
  const { location, requestLocation, error: locationError } = useGeolocation(false);

  useEffect(() => {
    requestLocation();
    fetchRestaurants(location?.latitude, location?.longitude);
  }, []);

  useEffect(() => {
    if (location) {
      fetchRestaurants(location.latitude, location.longitude);
    }
  }, [location]);

  const fetchRestaurants = async (lat?: number, lng?: number) => {
    // Build query and categories from preferences
    const queryParts = [];
    const categories: string[] = [];

    if (preferences?.cuisine) {
      queryParts.push(preferences.cuisine);
      // Map common cuisines to Yelp category aliases
      const cuisineMap: Record<string, string> = {
        'Italian': 'italian', 'Mexican': 'mexican', 'Asian': 'asianfusion',
        'American': 'newamerican', 'Japanese': 'japanese', 'Chinese': 'chinese',
        'Indian': 'indpak', 'Thai': 'thai', 'Mediterranean': 'mediterranean',
        'French': 'french', 'Korean': 'korean', 'Vietnamese': 'vietnamese'
      };
      if (cuisineMap[preferences.cuisine]) {
        categories.push(cuisineMap[preferences.cuisine]);
      }
    }
    if (preferences?.vibe) queryParts.push(preferences.vibe);
    if (preferences?.dietary && preferences.dietary !== 'None') {
      queryParts.push(preferences.dietary);
    }

    // Map budget to price levels
    const priceMap: Record<string, number[]> = {
      '$': [1], '$$': [1, 2], '$$$': [2, 3], '$$$$': [3, 4]
    };
    const price = preferences?.budget ? priceMap[preferences.budget] : undefined;

    const query = queryParts.length > 0
      ? `best ${queryParts.join(' ')} restaurants`
      : 'best restaurants nearby';

    console.log('Using combinedSearch with:', { query, categories, price });

    try {
      const latitude = lat || 37.7749;
      const longitude = lng || -122.4194;

      // Use the new combined search API
      const results = await apiService.combinedSearch({
        query,
        latitude,
        longitude,
        term: 'restaurants',
        categories: categories.length > 0 ? categories : undefined,
        price,
        limit: 10
      });

      console.log(`Combined search returned ${results.length} unique restaurants`);

      const formattedRestaurants: Restaurant[] = results.map((business) => ({
        id: business.id,
        name: business.name,
        image: business.image || business.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4',
        rating: business.rating || 4.0,
        reviewCount: business.reviews || (business as any).review_count || 0,
        price: business.price || '$$',
        cuisine: business.categories?.[0]?.title || 'Restaurant',
        distance: business.distance || 'Nearby',
        address: business.location?.address1 || '',
        city: business.location?.city || '',
        phone: business.phone || '',
        url: business.url || '',
        menuUrl: (business as any).attributes?.MenuUrl || (business as any).menuUrl || (business as any).menu_url || '',
        trending: (business.rating || 0) >= 4.5 && (business.reviews || (business as any).review_count || 0) > 100,
        categories: business.tags || business.categories?.map(c => c.title) || [],
      }));

      setRestaurants(formattedRestaurants);
    } catch (err) {
      console.error('Error fetching restaurants:', err);
    } finally {
      setIsInitialLoad(false);
    }
  };

  // Loading phases for enhanced UX
  const loadingPhases = [
    { message: "Locating nearby gems...", emoji: "📍", duration: 1500 },
    { message: `Filtering by ${preferences?.cuisine || 'your taste'}...`, emoji: "🍽️", duration: 1500 },
    { message: "Ranking the best picks...", emoji: "⭐", duration: 1500 },
    { message: "Almost ready!", emoji: "🎉", duration: 1000 },
  ];

  const [loadingPhase, setLoadingPhase] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    if (loading || isInitialLoad) {
      const interval = setInterval(() => {
        setLoadingPhase(prev => {
          if (prev < loadingPhases.length - 1) return prev + 1;
          return prev;
        });
      }, 1500);

      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev < 100) return prev + 2;
          return prev;
        });
      }, 100);

      return () => {
        clearInterval(interval);
        clearInterval(progressInterval);
      };
    }
  }, [loading, isInitialLoad]);

  // Floating food emojis
  const foodEmojis = ['🍕', '🍣', '🌮', '🍜', '🥗', '🍔', '🍝', '🥘', '🍱', '🥡'];

  if (loading || isInitialLoad) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black">
        {/* Simple gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(249,115,22,0.12) 0%, rgba(0,0,0,0) 60%)',
          }}
        />

        {/* Main content - properly centered */}
        <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">
          {/* Spinner container */}
          <div className="relative h-24 w-24 mb-6">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-[#F97316]/20 blur-2xl animate-pulse" />

            {/* Spinning ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-2 rounded-full border-4 border-gray-800/50 border-t-[#F97316] border-r-orange-400"
            />

            {/* Center emoji */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span
                className="text-3xl"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {loadingPhases[loadingPhase]?.emoji || '🍽️'}
              </motion.span>
            </div>
          </div>

          {/* Phase message */}
          <AnimatePresence mode="wait">
            <motion.p
              key={loadingPhase}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-lg text-white mb-3"
              style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}
            >
              {loadingPhases[loadingPhase]?.message || 'Loading...'}
            </motion.p>
          </AnimatePresence>

          {/* Progress bar */}
          <div className="w-48 mb-5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-gray-800">
              <motion.div
                className="h-full bg-gradient-to-r from-[#F97316] to-orange-400"
                initial={{ width: '0%' }}
                animate={{ width: `${Math.min(loadingProgress, 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-500">{Math.min(loadingProgress, 100)}%</p>
          </div>

          {/* Preferences summary */}
          {preferences && (preferences.cuisine || preferences.budget || preferences.vibe) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <p className="mb-2 text-[10px] text-gray-400 uppercase tracking-wider">Looking for</p>
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {preferences.cuisine && (
                  <span className="rounded-full bg-[#F97316]/20 px-2.5 py-0.5 text-xs text-[#F97316]">
                    {preferences.cuisine}
                  </span>
                )}
                {preferences.budget && (
                  <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs text-green-400">
                    {preferences.budget}
                  </span>
                )}
                {preferences.vibe && (
                  <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-xs text-purple-400">
                    {preferences.vibe}
                  </span>
                )}
                {preferences.dietary && preferences.dietary !== 'None' && (
                  <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs text-blue-400">
                    {preferences.dietary}
                  </span>
                )}
              </div>
            </motion.div>
          )}

          {/* Simple bouncing dots */}
          <div className="mt-6 flex justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
                className="h-1.5 w-1.5 rounded-full bg-[#F97316]/60"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => fetchRestaurants()}
            className="mt-4 rounded-lg bg-[#F97316] px-6 py-2 text-white hover:bg-orange-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black">
        <p className="text-white">No restaurants found.</p>
      </div>
    );
  }

  const currentRestaurant = restaurants[currentIndex];

  const handleSwipe = (swipeDirection: 'left' | 'right') => {
    const currentRestaurant = restaurants[currentIndex];

    if (swipeDirection === 'right' && currentRestaurant) {
      // Show YUM animation
      setShowYumAnimation(true);
      setTimeout(() => setShowYumAnimation(false), 600);

      // Track liked restaurant
      setLikedRestaurants(prev => [...prev, {
        id: currentRestaurant.id.toString(),
        name: currentRestaurant.name,
        timestamp: Date.now(),
      }]);
    }

    setDirection(swipeDirection);

    setTimeout(() => {
      if (currentIndex === restaurants.length - 1) {
        // Find the most liked restaurant (or just pick the first liked one)
        const winner = likedRestaurants.length > 0
          ? restaurants.find(r => r.id.toString() === likedRestaurants[0].id) || null
          : null;
        onNavigate(winner);
      } else {
        setCurrentIndex(currentIndex + 1);
        setDirection(null);
        setShowInfo(false);
      }
    }, 400);
  };

  // Handle card flip and menu loading
  const handleFlip = async (restaurantId: string | number) => {
    const isCurrentlyFlipped = flippedCards.has(restaurantId);

    // Toggle flip state
    setFlippedCards(prev => {
      const newSet = new Set(prev);
      if (isCurrentlyFlipped) {
        newSet.delete(restaurantId);
      } else {
        newSet.add(restaurantId);
      }
      return newSet;
    });

    // If flipping to back and no menu data, fetch it using Yelp AI
    if (!isCurrentlyFlipped) {
      const restaurant = restaurants.find(r => r.id === restaurantId);

      // Only fetch if no data and no prior error
      if (restaurant && !restaurant.menuData && !restaurant.menuError) {
        setLoadingMenus(prev => new Set(prev).add(restaurantId));

        try {
          // Use Yelp AI API to get menu items for this restaurant
          // Include city to help Yelp AI identify the correct restaurant
          const locationContext = restaurant.city ? ` in ${restaurant.city}` : '';
          const chatResponse = await apiService.chat({
            query: `What are the popular menu items and dishes at ${restaurant.name}${locationContext}? Include prices if available.`,
            user_context: {
              locale: 'en_US',
              latitude: location?.latitude,
              longitude: location?.longitude,
            }
          });

          // Parse the response into menu format
          if (chatResponse.response_text) {
            // Create a simple menu structure from the AI response
            const menuData = {
              categories: [{
                name: 'Popular Items',
                items: [{ name: chatResponse.response_text, description: '', price: '' }]
              }],
              highlights: [],
              price_range: restaurant.price || '$$',
              aiResponse: chatResponse.response_text
            };
            setRestaurants(prev => prev.map(r =>
              r.id === restaurantId ? { ...r, menuData } : r
            ));
          } else {
            setRestaurants(prev => prev.map(r =>
              r.id === restaurantId ? { ...r, menuError: 'No menu info available' } : r
            ));
          }

          /* AGENTIC MENU SCRAPING APPROACH - Commented out, keeping for reference
          const urlToScrape = restaurant?.menuUrl || restaurant?.url;
          if (urlToScrape) {
            const result = await apiService.scrapeMenu(urlToScrape);
            if (result.success && result.menu) {
              setRestaurants(prev => prev.map(r =>
                r.id === restaurantId ? { ...r, menuData: result.menu } : r
              ));
            } else {
              setRestaurants(prev => prev.map(r =>
                r.id === restaurantId ? { ...r, menuError: result.error || 'Could not load menu' } : r
              ));
            }
          }
          */
        } catch (err) {
          console.error('Failed to fetch menu:', err);
          setRestaurants(prev => prev.map(r =>
            r.id === restaurantId ? { ...r, menuError: 'Failed to fetch menu info' } : r
          ));
        } finally {
          setLoadingMenus(prev => {
            const newSet = new Set(prev);
            newSet.delete(restaurantId);
            return newSet;
          });
        }
      }
    }
  };

  if (!currentRestaurant) return null;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">
      {/* "YUM!" Explosion Animation */}
      {showYumAnimation && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3.5, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
        >
          <div className="text-[12rem] font-black text-[#F97316] drop-shadow-2xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>
            YUM!
          </div>
        </motion.div>
      )}

      {/* Next card preview - hidden to avoid showing card before swipe
      {currentIndex < restaurants.length - 1 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0.5 }}
            animate={{ scale: 0.95, opacity: 0.8 }}
            className="absolute inset-8 overflow-hidden rounded-[32px]"
            style={{
              backgroundImage: `url(${restaurants[currentIndex + 1].image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        </div>
      )}
      */}

      {/* Current Card */}
      <AnimatePresence mode="wait">
        <SwipeCard
          key={currentRestaurant.id}
          restaurant={currentRestaurant}
          onSwipe={handleSwipe}
          direction={direction}
          showInfo={showInfo}
          onToggleInfo={() => setShowInfo(!showInfo)}
          isFlipped={flippedCards.has(currentRestaurant.id)}
          onFlip={() => handleFlip(currentRestaurant.id)}
          isLoadingMenu={loadingMenus.has(currentRestaurant.id)}
        />
      </AnimatePresence>

      {/* Progress indicator */}
      <div className="absolute left-0 right-0 top-8 z-30 px-6">
        <div className="flex justify-between gap-1.5">
          {restaurants.map((_, index) => (
            <motion.div
              key={index}
              className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/20 backdrop-blur-sm"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <motion.div
                className="h-full bg-gradient-to-r from-[#F97316] to-orange-400 shadow-lg shadow-orange-500/50"
                initial={{ width: '0%' }}
                animate={{ width: index <= currentIndex ? '100%' : '0%' }}
                transition={{ duration: 0.5 }}
              />
            </motion.div>
          ))}
        </div>

        {/* Counter */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center"
        >
          <span className="text-sm text-white/80">
            {currentIndex + 1} / {restaurants.length}
          </span>
        </motion.div>
      </div>

      {/* Swipe indicators */}
      <AnimatePresence>
        {direction === 'left' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: -15 }}
            exit={{ opacity: 0 }}
            className="absolute left-12 top-1/3 z-30 rounded-2xl border-8 border-red-500 bg-red-500/20 px-8 py-4 backdrop-blur-sm"
          >
            <span className="text-5xl text-red-500" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
              NOPE
            </span>
          </motion.div>
        )}
        {direction === 'right' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, rotate: 30 }}
            animate={{ opacity: 1, scale: 1, rotate: 15 }}
            exit={{ opacity: 0 }}
            className="absolute right-12 top-1/3 z-30 rounded-2xl border-8 border-[#F97316] bg-orange-500/20 px-8 py-4 backdrop-blur-sm"
          >
            <span className="text-5xl text-[#F97316]" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800 }}>
              LIKE
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="absolute inset-x-0 bottom-12 z-20 px-8">
        <div className="flex items-center justify-center gap-6">
          <motion.button
            whileHover={{ scale: 1.15, rotate: -5 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => handleSwipe('left')}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-white shadow-2xl shadow-red-500/30 transition-all hover:bg-red-50"
          >
            <X className="h-8 w-8 text-red-500" strokeWidth={3} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowInfo(!showInfo)}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/50 bg-white/10 backdrop-blur-md transition-all hover:bg-white/20"
          >
            <Info className="h-5 w-5 text-white" strokeWidth={2.5} />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.15, rotate: 5 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => handleSwipe('right')}
            className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#F97316] bg-white shadow-2xl transition-all hover:bg-orange-50"
            animate={{
              boxShadow: [
                '0 20px 60px -12px rgba(249,115,22,0.4)',
                '0 20px 80px -12px rgba(249,115,22,0.7)',
                '0 20px 60px -12px rgba(249,115,22,0.4)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Heart className="h-10 w-10 text-[#F97316]" strokeWidth={3} fill="currentColor" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

interface SwipeCardProps {
  restaurant: Restaurant;
  onSwipe: (direction: 'left' | 'right') => void;
  direction: 'left' | 'right' | null;
  showInfo: boolean;
  onToggleInfo: () => void;
  isFlipped: boolean;
  onFlip: () => void;
  isLoadingMenu: boolean;
}

function SwipeCard({ restaurant, onSwipe, direction, showInfo, isFlipped, onFlip, isLoadingMenu }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-30, 30]);
  const opacity = useTransform(x, [-300, -150, 0, 150, 300], [0.5, 1, 1, 1, 0.5]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 120) {
      onSwipe('right');
    } else if (info.offset.x < -120) {
      onSwipe('left');
    }
  };

  return (
    <motion.div
      className="absolute inset-0 z-20"
      style={{ x, rotate, opacity }}
      drag={isFlipped ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={
        direction
          ? { x: direction === 'left' ? -1000 : 1000, opacity: 0, transition: { duration: 0.4 } }
          : { scale: 1, opacity: 1, x: 0 }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative h-full w-full px-4 py-6">
        {/* 3D perspective container with solid background to block next card */}
        <div className="h-full w-full overflow-hidden rounded-[32px] shadow-2xl bg-zinc-900" style={{ perspective: '1200px' }}>
          {/* Flip container - both faces always rendered */}
          <div
            className="relative h-full w-full transition-transform duration-500 ease-in-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
            }}
          >
            {/* Front face */}
            <div
              className="absolute inset-0 h-full w-full bg-cover bg-center cursor-pointer"
              style={{
                backgroundImage: `url(${restaurant.image})`,
                backfaceVisibility: 'hidden'
              }}
              onClick={onFlip}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />

              <div className="absolute right-6 top-20 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur-sm">
                <RotateCcw className="h-3 w-3 text-white" />
                <span className="text-xs text-white">Tap for menu</span>
              </div>

              <div className="absolute left-6 top-20">
                {restaurant.trending && (
                  <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 px-3 py-1.5 shadow-lg">
                    <TrendingUp className="h-4 w-4 text-white" />
                    <span className="text-xs text-white font-bold">TRENDING</span>
                  </div>
                )}
              </div>

              <motion.div className="absolute inset-x-0 bottom-0 p-6 pb-24">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1 rounded-full bg-[#F97316] px-2.5 py-1">
                    <Star className="h-4 w-4 text-white" fill="white" />
                    <span className="text-sm font-bold text-white">{restaurant.rating}</span>
                  </div>
                  <span className="text-sm text-gray-300">({restaurant.reviewCount} reviews)</span>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm text-white">{restaurant.price}</span>
                </div>

                <h2 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                  {restaurant.name}
                </h2>

                <div className="flex items-center gap-2 text-gray-300">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">{restaurant.cuisine} • {restaurant.distance}</span>
                </div>

                <AnimatePresence>
                  {showInfo && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-4 mb-28 max-h-40 overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl"
                    >
                      {restaurant.address && (
                        <div className="flex items-start gap-3 mb-3">
                          <MapPin className="h-4 w-4 mt-0.5 text-orange-400 shrink-0" />
                          <div>
                            <p className="text-sm text-white">{restaurant.address}</p>
                            {restaurant.city && <p className="text-xs text-gray-400">{restaurant.city}</p>}
                          </div>
                        </div>
                      )}
                      {restaurant.phone && (
                        <div className="flex items-center gap-3 mb-3">
                          <Phone className="h-4 w-4 text-orange-400" />
                          <p className="text-sm text-white">{restaurant.phone}</p>
                        </div>
                      )}
                      {restaurant.url && (
                        <a
                          href={restaurant.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-sm font-semibold text-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View on Yelp
                        </a>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Back face - pre-rotated 180deg so it shows when container rotates */}
            <div
              className="absolute inset-0 h-full w-full bg-gradient-to-b from-zinc-900 to-black flex flex-col cursor-pointer"
              style={{
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)'
              }}
              onClick={onFlip}
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChefHat className="h-6 w-6 text-orange-400" />
                    <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                      {restaurant.name}
                    </h2>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFlip(); }}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Back
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">Info from Yelp AI</p>
              </div>

              {/* Content - centered vertically */}
              <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
                {isLoadingMenu ? (
                  <motion.div
                    className="flex flex-col items-center justify-center gap-6"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Animated food emoji */}
                    <motion.div
                      animate={{
                        y: [0, -10, 0],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                      className="text-5xl"
                    >
                      🍽️
                    </motion.div>

                    {/* Spinner */}
                    <div className="relative">
                      <motion.div
                        className="w-12 h-12 rounded-full border-4 border-orange-400/20"
                        style={{ borderTopColor: '#F97316' }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    </div>

                    {/* Animated text */}
                    <div className="text-center">
                      <p className="text-gray-300 text-sm font-medium">Asking Yelp AI...</p>
                      <motion.p
                        className="text-gray-500 text-xs mt-1"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        Finding popular dishes at {restaurant.name}
                      </motion.p>
                    </div>
                  </motion.div>
                ) : restaurant.menuData ? (
                  <div className="space-y-4">
                    {/* If we have an AI response, display it nicely */}
                    {(restaurant.menuData as any).aiResponse ? (
                      <div className="bg-white/5 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">
                          Popular Items & Recommendations
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                          {(restaurant.menuData as any).aiResponse}
                        </p>
                      </div>
                    ) : (
                      /* Fallback to structured categories (for agentic scraping) */
                      <>
                        {restaurant.menuData.highlights && restaurant.menuData.highlights.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {restaurant.menuData.highlights.map((h, i) => (
                              <span key={i} className="rounded-full bg-orange-500/20 px-2.5 py-1 text-xs text-orange-300">
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                        {restaurant.menuData.categories.map((category, idx) => (
                          <div key={idx}>
                            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-3">
                              {category.name}
                            </h3>
                            <div className="space-y-2">
                              {category.items.slice(0, 5).map((item, itemIdx) => (
                                <div key={itemIdx} className="flex justify-between items-start gap-4 rounded-lg bg-white/5 p-3">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-white">{item.name}</p>
                                    {item.description && (
                                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                                    )}
                                  </div>
                                  {item.price && (
                                    <span className="text-sm font-semibold text-green-400 shrink-0">{item.price}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <ChefHat className="h-12 w-12 text-gray-600" />
                    <div>
                      <p className="text-gray-400">Menu not available</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {restaurant.menuError || ((restaurant.menuUrl || restaurant.url) ? 'Could not parse menu from page' : 'No URL available')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}