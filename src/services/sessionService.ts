import { db } from '../config/firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  addDoc,
  serverTimestamp,
  Unsubscribe,
  getDoc,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';

export interface SessionUser {
  id: string;
  name: string;
  color: string;
  joinedAt: number;
}

export interface SessionPreferences {
  budget: string;
  cuisine: string;
  vibe: string;
  dietary: string;
  distance: string;
  bookingDate: string;
  bookingTime: string;
}

export interface UserVote {
  userId: string;
  userName: string;
  timestamp: number;
}

export interface SessionVotes {
  budget: Record<string, UserVote[]>;
  cuisine: Record<string, UserVote[]>;
  vibe: Record<string, UserVote[]>;
  dietary: Record<string, UserVote[]>;
  distance: Record<string, UserVote[]>;
}

export interface Activity {
  id?: string;
  type: 'join' | 'preference' | 'ready' | 'like';
  user: string;
  userColor: string;
  message: string;
  timestamp: number;
}

export interface SessionData {
  code: string;
  ownerId: string; // User ID of the session creator
  users: Record<string, SessionUser>;
  votes: SessionVotes;
  locked: boolean;



  winnerId?: string;
  winningReason?: string;
  sharedRestaurants?: any[];
  finishedUsers?: string[];
  createdAt: number;
  activities: Activity[];
}

class SessionService {
  private getSessionRef(sessionCode: string) {
    return doc(db, 'rooms', sessionCode);
  }

  private getUsersRef(sessionCode: string) {
    return collection(db, 'rooms', sessionCode, 'users');
  }

  private getActivitiesRef(sessionCode: string) {
    return collection(db, 'rooms', sessionCode, 'events');
  }

  // Alternative: Store users in main document instead of subcollection
  private async addUserToMainDoc(sessionCode: string, user: SessionUser): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const currentUsers = sessionDoc.data().users || {};
      currentUsers[user.id] = user;
      await updateDoc(sessionRef, { users: currentUsers });
    }
  }

  private async removeUserFromMainDoc(sessionCode: string, userId: string): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const currentUsers = sessionDoc.data().users || {};
      delete currentUsers[userId];
      await updateDoc(sessionRef, { users: currentUsers });
    }
  }

  // Join a session
  async joinSession(sessionCode: string, user: SessionUser): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    const userRef = doc(this.getUsersRef(sessionCode), user.id);

    console.log('🔥 [joinSession] Starting join process:', {
      sessionCode,
      userId: user.id,
      userName: user.name,
      sessionPath: `rooms/${sessionCode}`,
      userPath: `rooms/${sessionCode}/users/${user.id}`
    });

    try {
      // Check if session exists, if not create it
      console.log('🔥 [joinSession] Checking if session exists...');
      const sessionDoc = await getDoc(sessionRef);

      if (!sessionDoc.exists()) {
        console.log('🔥 [joinSession] Session does not exist, creating new session...');
        await setDoc(sessionRef, {
          code: sessionCode,
          ownerId: user.id, // First user to join becomes the owner
          votes: {
            budget: {},
            cuisine: {},
            vibe: {},
            dietary: {},
            distance: {}
          },
          locked: false,
          createdAt: Date.now(),
          users: {},  // Initialize users object in main doc
          finishedUsers: []  // Initialize finishedUsers array
        });
        console.log('✅ [joinSession] Session created successfully');
      } else {
        console.log('✅ [joinSession] Session already exists:', sessionDoc.data());
      }

      // Add user to main document (as backup/alternative to subcollection)
      console.log('🔥 [joinSession] Adding user to main document...');
      await this.addUserToMainDoc(sessionCode, user);
      console.log('✅ [joinSession] User added to main document');

      // Add user to subcollection (original approach)
      console.log('🔥 [joinSession] Adding user to subcollection...');
      await setDoc(userRef, user);
      console.log('✅ [joinSession] User added to subcollection:', user);

      // Add join activity
      console.log('🔥 [joinSession] Adding join activity...');
      const activityData = {
        type: 'join',
        user: user.name,
        userColor: user.color,
        message: 'joined the session',
        timestamp: Date.now()
      };
      await addDoc(this.getActivitiesRef(sessionCode), activityData);
      console.log('✅ [joinSession] Join activity added:', activityData);

      console.log('✅ [joinSession] Join process completed successfully');
    } catch (error: any) {
      console.error('❌ [joinSession] Error joining session:', {
        error: error.message,
        code: error.code,
        details: error,
        sessionCode,
        user
      });
      throw error;
    }
  }

  // Leave a session
  async leaveSession(sessionCode: string, userId: string): Promise<void> {
    console.log('🔥 [leaveSession] Removing user:', userId, 'from session:', sessionCode);

    // Remove from main document
    await this.removeUserFromMainDoc(sessionCode, userId);
    console.log('✅ [leaveSession] User removed from main document');

    // Remove from subcollection
    const userRef = doc(this.getUsersRef(sessionCode), userId);
    await deleteDoc(userRef);
    console.log('✅ [leaveSession] User removed from subcollection');
  }

  // Cast a vote
  async castVote(
    sessionCode: string,
    category: 'budget' | 'cuisine' | 'vibe' | 'dietary' | 'distance',
    value: string,
    user: { id: string; name: string }
  ): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);

    try {
      const sessionDoc = await getDoc(sessionRef);
      if (!sessionDoc.exists()) return;

      const currentVotes = (sessionDoc.data().votes || {}) as SessionVotes;
      const categoryVotes = currentVotes[category] || {};

      // Remove user's previous vote from all options in this category
      Object.keys(categoryVotes).forEach(option => {
        categoryVotes[option] = (categoryVotes[option] || []).filter(
          v => v.userId !== user.id
        );
        if (categoryVotes[option].length === 0) {
          delete categoryVotes[option];
        }
      });

      // Add new vote
      if (!categoryVotes[value]) {
        categoryVotes[value] = [];
      }
      categoryVotes[value].push({
        userId: user.id,
        userName: user.name,
        timestamp: Date.now()
      });

      // Update session
      await updateDoc(sessionRef, {
        [`votes.${category}`]: categoryVotes
      });

      // Add activity
      await addDoc(this.getActivitiesRef(sessionCode), {
        type: 'preference',
        user: user.name,
        userColor: 'from-orange-500 to-red-500',
        message: `voted for ${value} ${category}`,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Error casting vote:', error);
      throw error;
    }
  }

  // Lock preferences
  async lockPreferences(sessionCode: string, preferences: SessionPreferences): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    await updateDoc(sessionRef, {
      locked: true,
      consensus: preferences
    });
  }



  // Mark a user as finished with swiping
  async markUserFinished(sessionCode: string, userId: string): Promise<void> {
    console.log('🏁 [markUserFinished] Marking user as finished:', { sessionCode, userId });
    const sessionRef = this.getSessionRef(sessionCode);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const currentFinished = sessionDoc.data().finishedUsers || [];
      console.log('🏁 [markUserFinished] Current finished users:', currentFinished);

      if (!currentFinished.includes(userId)) {
        const updatedFinished = [...currentFinished, userId];
        await updateDoc(sessionRef, {
          finishedUsers: updatedFinished
        });
        console.log('✅ [markUserFinished] User marked as finished. Updated list:', updatedFinished);
      } else {
        console.log('⚠️ [markUserFinished] User already marked as finished');
      }
    } else {
      console.error('❌ [markUserFinished] Session does not exist:', sessionCode);
    }
  }

  // Save shared restaurants list (called by owner after fetching from Yelp)
  async saveRestaurants(sessionCode: string, restaurants: any[]): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    await updateDoc(sessionRef, {
      sharedRestaurants: restaurants,
      restaurantsLoadedAt: Date.now()
    });
    console.log('📦 Saved', restaurants.length, 'restaurants to Firebase');
  }

  // Set the final winner for the session
  async setWinner(sessionCode: string, winnerId: string, reason?: string): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    await updateDoc(sessionRef, {
      winnerId,
      winningReason: reason || 'Group Consensus'
    });
  }

  // Cache menu data for a restaurant (shared across all users)
  async cacheMenuData(sessionCode: string, restaurantId: string, menuData: any): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const cachedMenus = sessionDoc.data().cachedMenus || {};
      cachedMenus[restaurantId] = {
        data: menuData,
        cachedAt: Date.now(),
        cachedBy: localStorage.getItem('userId')
      };

      await updateDoc(sessionRef, {
        cachedMenus
      });
      console.log('💾 Cached menu for restaurant:', restaurantId);
    }
  }

  // Get cached menu data for a restaurant
  async getCachedMenuData(sessionCode: string, restaurantId: string): Promise<any | null> {
    const sessionRef = this.getSessionRef(sessionCode);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const cachedMenus = sessionDoc.data().cachedMenus || {};
      const cached = cachedMenus[restaurantId];

      if (cached) {
        console.log('📥 Retrieved cached menu for restaurant:', restaurantId);
        return cached.data;
      }
    }

    return null;
  }

  // Get shared restaurants (returns null if not loaded yet)
  async getRestaurants(sessionCode: string): Promise<any[] | null> {
    const sessionRef = this.getSessionRef(sessionCode);
    const docSnap = await getDoc(sessionRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data.sharedRestaurants || null;
    }
    return null;
  }

  // Record a user's swipe on a restaurant
  async swipeRestaurant(
    sessionCode: string,
    restaurantId: string,
    direction: 'left' | 'right',
    userId: string,
    userName: string
  ): Promise<void> {
    const sessionRef = this.getSessionRef(sessionCode);
    const docSnap = await getDoc(sessionRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const swipes = data.swipes || {};

      // Store swipe: swipes[restaurantId] = { likes: [...], dislikes: [...] }
      if (!swipes[restaurantId]) {
        swipes[restaurantId] = { likes: [], dislikes: [] };
      }

      // Remove any previous swipe from this user on this restaurant
      swipes[restaurantId].likes = swipes[restaurantId].likes.filter((s: any) => s.oderId !== userId);
      swipes[restaurantId].dislikes = swipes[restaurantId].dislikes.filter((s: any) => s.userId !== userId);

      // Add new swipe
      if (direction === 'right') {
        swipes[restaurantId].likes.push({ userId, userName, timestamp: Date.now() });
      } else {
        swipes[restaurantId].dislikes.push({ userId, userName, timestamp: Date.now() });
      }

      await updateDoc(sessionRef, { swipes });
    }
  }


  // Get the restaurant with most likes from all users
  async getGroupWinner(sessionCode: string): Promise<{ restaurantId: string; likeCount: number; reason?: string } | null> {
    const sessionRef = this.getSessionRef(sessionCode);
    const docSnap = await getDoc(sessionRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const swipes = data.swipes || {};
      const restaurants = data.sharedRestaurants || [];
      const preferences = data.consensus || {};

      // Calculate likes for each restaurant
      const restaurantLikes: Record<string, number> = {};
      let maxLikes = 0;

      for (const [restaurantId, votes] of Object.entries(swipes)) {
        const likes = ((votes as any).likes || []).length;
        restaurantLikes[restaurantId] = likes;
        if (likes > maxLikes) {
          maxLikes = likes;
        }
      }

      if (maxLikes === 0) return null;

      // Find all restaurants with max likes
      const winners = Object.entries(restaurantLikes)
        .filter(([_, likes]) => likes === maxLikes)
        .map(([id, _]) => id);

      // Single winner
      if (winners.length === 1) {
        return { restaurantId: winners[0], likeCount: maxLikes, reason: 'Most voted by the group!' };
      }

      // Tie detected - resolve with AI
      console.log(`👔 Tie detected between ${winners.length} restaurants. Consulting AI...`);
      const tiedRestaurants = restaurants.filter((r: any) => winners.includes(r.id.toString()));

      if (tiedRestaurants.length > 0) {
        try {
          // Import apiService dynamically to avoid circular dependency if any, 
          // or just assume it's available. 
          // Since we are in the same module structure, we can import it at top level, 
          // but I'll use the one I'm about to add.
          const { apiService } = await import('./api');
          const resolution = await apiService.resolveTie(tiedRestaurants, preferences);

          if (resolution.winner_id) {
            console.log(`🤖 AI resolved tie. Winner: ${resolution.winner_id}`);
            return {
              restaurantId: resolution.winner_id.toString(),
              likeCount: maxLikes,
              reason: resolution.reason || 'Selected by AI tie-breaker'
            };
          }
        } catch (error) {
          console.error('❌ AI tie-breaking failed, falling back to random:', error);
        }
      }

      // Fallback: Randomly pick one if AI fails or data missing
      const randomWinner = winners[Math.floor(Math.random() * winners.length)];
      return {
        restaurantId: randomWinner,
        likeCount: maxLikes,
        reason: 'Randomly selected tie-breaker'
      };
    }
    return null;
  }


  // Get full winner restaurant data
  async getWinnerRestaurant(sessionCode: string): Promise<any | null> {
    const winner = await this.getGroupWinner(sessionCode);
    if (!winner) return null;

    const restaurants = await this.getRestaurants(sessionCode);
    if (!restaurants) return null;

    const restaurant = restaurants.find((r: any) => r.id === winner.restaurantId || r.id.toString() === winner.restaurantId);

    if (restaurant) {
      return {
        ...restaurant,
        restaurantId: winner.restaurantId,  // Add restaurantId for Firebase
        winningReason: winner.reason
      };
    }

    return null;
  }

  // Subscribe to session updates
  subscribeToSession(
    sessionCode: string,
    callback: (data: Partial<SessionData>) => void
  ): Unsubscribe {
    const sessionRef = this.getSessionRef(sessionCode);

    return onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as Partial<SessionData>);
      }
    });
  }

  // Subscribe to users
  subscribeToUsers(
    sessionCode: string,
    callback: (users: SessionUser[]) => void
  ): Unsubscribe {
    const usersRef = this.getUsersRef(sessionCode);
    console.log('🔥 [subscribeToUsers] Setting up subscription for:', `rooms/${sessionCode}/users`);

    return onSnapshot(
      usersRef,
      (snapshot) => {
        console.log('🔥 [subscribeToUsers] Snapshot received:', {
          size: snapshot.size,
          empty: snapshot.empty,
          metadata: snapshot.metadata
        });

        const users: SessionUser[] = [];
        snapshot.forEach((doc) => {
          console.log('👤 [subscribeToUsers] User doc:', {
            id: doc.id,
            data: doc.data()
          });
          users.push(doc.data() as SessionUser);
        });

        console.log('✅ [subscribeToUsers] Total users:', users.length, users);
        callback(users);
      },
      (error) => {
        console.error('❌ [subscribeToUsers] Subscription error:', {
          error: error.message,
          code: error.code,
          details: error
        });
      }
    );
  }

  // Subscribe to activities
  subscribeToActivities(
    sessionCode: string,
    callback: (activities: Activity[]) => void
  ): Unsubscribe {
    const activitiesRef = this.getActivitiesRef(sessionCode);
    console.log('🔥 [subscribeToActivities] Setting up subscription for:', `rooms/${sessionCode}/events`);

    return onSnapshot(
      activitiesRef,
      (snapshot) => {
        console.log('🔥 [subscribeToActivities] Snapshot received:', {
          size: snapshot.size,
          empty: snapshot.empty
        });

        const activities: Activity[] = [];
        snapshot.forEach((doc) => {
          activities.push({ id: doc.id, ...doc.data() } as Activity);
        });
        // Sort by timestamp
        activities.sort((a, b) => a.timestamp - b.timestamp);

        console.log('✅ [subscribeToActivities] Total activities:', activities.length);
        callback(activities);
      },
      (error) => {
        console.error('❌ [subscribeToActivities] Subscription error:', {
          error: error.message,
          code: error.code,
          details: error
        });
      }
    );
  }
}

export const sessionService = new SessionService();
