import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic, Image as ImageIcon, X, Loader2, ChevronDown } from 'lucide-react';
import { apiService } from '../services/api';

interface Message {
  id: number;
  sender: 'user' | 'ai';
  text: string;
  hasAudio?: boolean;
  hasImage?: boolean;
}

interface MultimodalChatProps {
  preferences?: {
    cuisine?: string;
    budget?: string;
    vibe?: string;
    distance?: string;
    dietary?: string;
  };
  minimized?: boolean;
  onToggleMinimized?: () => void;
  onPreferencesDetected?: (prefs: {
    cuisine?: string;
    budget?: string;
    vibe?: string;
    dietary?: string;
  }) => void;
}

export function MultimodalChat({ preferences, minimized = false, onToggleMinimized, onPreferencesDetected }: MultimodalChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'ai',
      text: 'Hey! Tell me what you\'re craving and I\'ll help set your preferences! 🍽️'
    },
  ]);
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64.split(',')[1]); // Remove data:image/jpeg;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendAudioMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Send audio message
  const sendAudioMessage = async (audioBlob: Blob) => {
    try {
      // Add user message indicator
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'user',
        text: '🎤 Voice message',
        hasAudio: true
      }]);

      setIsTyping(true);

      // Convert audio to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Audio = (reader.result as string).split(',')[1];

        // First transcribe the audio
        const transcriptResult = await apiService.transcribeAudio(base64Audio, 'audio/webm');
        const transcription = transcriptResult.transcription || '';

        setIsTyping(false);

        if (transcription) {
          // Show what we heard (shortened for better UX)
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'ai',
            text: `🎤 "${transcription}"`
          }]);

          // Now analyze preferences from the transcription
          setIsTyping(true);
          const prefResult = await apiService.analyzePreferences(transcription);

          let voiceDetectedPrefs: any = {};

          if (prefResult.success && prefResult.result && onPreferencesDetected) {
            try {
              const analysis = JSON.parse(prefResult.result);

              // Same mapping logic as text
              if (Array.isArray(analysis.cuisine_preferences) && analysis.cuisine_preferences.length > 0) {
                const cuisineMap: Record<string, string> = {
                  'italian': 'Italian', 'japanese': 'Japanese', 'mexican': 'Mexican',
                  'french': 'French', 'thai': 'Thai', 'indian': 'Indian', 'korean': 'Korean',
                  'spanish': 'Spanish', 'chinese': 'Chinese', 'sushi': 'Japanese',
                  'ramen': 'Japanese', 'pasta': 'Italian', 'pizza': 'Italian',
                  'tacos': 'Mexican', 'curry': 'Indian'
                };
                const firstCuisine = String(analysis.cuisine_preferences[0]).toLowerCase();
                voiceDetectedPrefs.cuisine = cuisineMap[firstCuisine] || analysis.cuisine_preferences[0];
              }

              if (analysis.price_range && typeof analysis.price_range === 'string') {
                const priceMap: Record<string, string> = {
                  'budget': '$', 'cheap': '$', 'inexpensive': '$',
                  'moderate': '$$', 'mid-range': '$$',
                  'expensive': '$$$', 'upscale': '$$$',
                  'luxury': '$$$$', 'fine dining': '$$$$'
                };
                const priceKey = analysis.price_range.toLowerCase();
                voiceDetectedPrefs.budget = priceMap[priceKey] || '$$';
              }

              if (analysis.ambiance_preferences && typeof analysis.ambiance_preferences === 'string') {
                const vibeMap: Record<string, string> = {
                  'casual': 'Casual', 'trendy': 'Trendy', 'romantic': 'Romantic',
                  'cozy': 'Cozy', 'lively': 'Lively', 'fine dining': 'Fine Dining',
                  'family-friendly': 'Family-Friendly', 'family friendly': 'Family-Friendly'
                };
                const vibeKey = analysis.ambiance_preferences.toLowerCase();
                voiceDetectedPrefs.vibe = vibeMap[vibeKey] || analysis.ambiance_preferences;
              }

              if (Array.isArray(analysis.dietary_requirements) && analysis.dietary_requirements.length > 0) {
                const dietaryMap: Record<string, string> = {
                  'vegetarian': 'Vegetarian', 'vegan': 'Vegan',
                  'gluten-free': 'Gluten-Free', 'gluten free': 'Gluten-Free',
                  'halal': 'Halal', 'kosher': 'Kosher'
                };
                const firstDietary = String(analysis.dietary_requirements[0]).toLowerCase();
                voiceDetectedPrefs.dietary = dietaryMap[firstDietary] || analysis.dietary_requirements[0];
              }

              if (Object.keys(voiceDetectedPrefs).length > 0) {
                onPreferencesDetected(voiceDetectedPrefs);
              }
            } catch (error) {
              console.error('Error parsing voice preferences:', error);
            }
          }

          setIsTyping(false);

          // Use smart response for voice too
          const voiceResponse = getSmartResponse(transcription, voiceDetectedPrefs);
          setMessages(prev => [...prev, {
            id: Date.now() + 2,
            sender: 'ai',
            text: voiceResponse
          }]);
        }
      };
      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error('Error sending audio:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: 'Sorry, I had trouble processing your voice message. Please try again or type your message.'
      }]);
    }
  };

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Send image message
  const sendImageMessage = async () => {
    if (!selectedImage) return;

    try {
      // Add user message with image indicator
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'user',
        text: '📷 Photo of food',
        hasImage: true
      }]);

      setIsTyping(true);

      // Convert image to base64
      const base64Image = await fileToBase64(selectedImage);

      // Process image to identify food type
      const result = await apiService.processImage(base64Image, selectedImage.type);

      setIsTyping(false);

      let imageDetectedPrefs: any = {};

      if (result.success && result.result && onPreferencesDetected) {
        try {
          const analysis = JSON.parse(result.result);

          // Extract cuisine from image analysis
          if (analysis.requirements && analysis.requirements.cuisine) {
            const cuisine = analysis.requirements.cuisine;
            const cuisineMap: Record<string, string> = {
              'italian': 'Italian', 'japanese': 'Japanese', 'mexican': 'Mexican',
              'french': 'French', 'thai': 'Thai', 'indian': 'Indian', 'korean': 'Korean',
              'chinese': 'Chinese', 'spanish': 'Spanish'
            };
            const mapped = cuisineMap[cuisine.toLowerCase()] || cuisine;
            imageDetectedPrefs.cuisine = mapped;
            onPreferencesDetected({ cuisine: mapped });
          }

          const foodType = analysis.intent || analysis.requirements?.cuisine || 'food';
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'ai',
            text: `📷 I see ${foodType}! ${imageDetectedPrefs.cuisine ? `Cuisine set to ${imageDetectedPrefs.cuisine}.` : ''} Want to add price or vibe?`
          }]);
        } catch (error) {
          console.error('Error parsing image:', error);
          setMessages(prev => [...prev, {
            id: Date.now() + 1,
            sender: 'ai',
            text: `I see your food photo! Try describing what you want in text for better preference detection.`
          }]);
        }
      }

      // Clear image
      setSelectedImage(null);
      setImagePreview(null);
    } catch (error) {
      console.error('Error sending image:', error);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: 'Sorry, I had trouble analyzing that image. Please try again.'
      }]);
    }
  };

  // Enhanced casual message detection
  const isCasualMessage = (text: string): boolean => {
    const casual = text.toLowerCase().trim();
    const casualPatterns = [
      /^hi$/i, /^hi\!*$/i, /^hello$/i, /^hello\!*$/i, /^hey$/i, /^hey\!*$/i,
      /^sup$/i, /^yo$/i, /^what'?s up$/i, /^wassup$/i,
      /^thanks$/i, /^thank you$/i, /^thx$/i,
      /^ok$/i, /^okay$/i, /^sure$/i, /^alright$/i,
      /^cool$/i, /^nice$/i, /^great$/i, /^awesome$/i, /^perfect$/i,
      /^bye$/i, /^goodbye$/i, /^see you$/i, /^cya$/i,
      /^help$/i, /^help me$/i, /^what can you do$/i,
    ];

    // Check for food/restaurant-related keywords that indicate intent
    const foodKeywords = [
      'food', 'restaurant', 'eat', 'cuisine', 'meal', 'dinner', 'lunch', 'breakfast',
      'cheap', 'expensive', 'budget', 'price', 'cost', 'affordable',
      'romantic', 'casual', 'vibe', 'atmosphere', 'ambiance',
      'spicy', 'sweet', 'savory', 'hot', 'mild', 'flavor',
      'italian', 'mexican', 'japanese', 'chinese', 'french', 'thai', 'indian', 'korean',
      'pizza', 'pasta', 'sushi', 'tacos', 'burgers', 'ramen', 'curry',
      'vegetarian', 'vegan', 'gluten-free', 'halal', 'kosher',
      'nearby', 'close', 'local', 'around', 'near me',
      'want', 'need', 'looking for', 'craving', 'hungry', 'starving'
    ];

    const hasFood = foodKeywords.some(kw => casual.includes(kw));

    // Only consider it casual if it matches a pattern AND has no food keywords
    return casualPatterns.some(pattern => pattern.test(casual)) && !hasFood;
  };

  // Generate intelligent response based on context
  const getSmartResponse = (userMessage: string, detectedPrefs: any): string => {
    const hasPrefs = Object.keys(detectedPrefs).length > 0;
    const currentPrefs = { ...preferences, ...detectedPrefs };
    const msgLower = userMessage.toLowerCase();

    if (hasPrefs) {
      const prefList = [];
      if (detectedPrefs.cuisine) prefList.push(`cuisine: ${detectedPrefs.cuisine}`);
      if (detectedPrefs.budget) prefList.push(`budget: ${detectedPrefs.budget}`);
      if (detectedPrefs.vibe) prefList.push(`vibe: ${detectedPrefs.vibe}`);
      if (detectedPrefs.dietary) prefList.push(`dietary: ${detectedPrefs.dietary}`);

      const missingPrefs = [];
      if (!currentPrefs.cuisine) missingPrefs.push('cuisine');
      if (!currentPrefs.budget) missingPrefs.push('budget');
      if (!currentPrefs.vibe) missingPrefs.push('vibe');

      if (prefList.length > 0) {
        let response = `✓ Got it! I've set: ${prefList.join(', ')}.`;

        if (missingPrefs.length > 0) {
          response += ` Want to add ${missingPrefs.join(' or ')}?`;
        } else {
          response += ` Lock them in and hit "Start Swiping"! 🎯`;
        }
        return response;
      }
    }

    // Check if user expressed clear intent even without standard preferences
    const intentKeywords = {
      spicy: ['spicy', 'hot', 'heat', 'fire', 'chili'],
      flavor: ['sweet', 'savory', 'salty', 'sour', 'umami', 'rich', 'light'],
      craving: ['craving', 'want', 'need', 'hungry for', 'in the mood'],
      quality: ['good', 'best', 'top', 'popular', 'trending', 'famous'],
      speed: ['quick', 'fast', 'nearby', 'close', 'delivery']
    };

    let hasIntent = false;
    let intentType = '';

    for (const [type, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some(kw => msgLower.includes(kw))) {
        hasIntent = true;
        intentType = type;
        break;
      }
    }

    if (hasIntent) {
      // User has clear intent but AI didn't map it to standard preferences
      const responses: Record<string, string[]> = {
        spicy: [
          "🌶️ Love spicy! What cuisine? Mexican, Thai, Indian, or Korean?",
          "🔥 Spicy food coming up! Which type? Thai, Indian, Mexican, or Sichuan?",
          "🌶️ Got it - heat seeker! What cuisine: Thai curries, Indian vindaloo, or Mexican salsa?"
        ],
        flavor: [
          "Got your flavor vibe! What cuisine matches that? Italian, Japanese, French?",
          "Nice! What type of restaurant? Italian, Asian, Mediterranean?"
        ],
        craving: [
          "I hear you! What cuisine are you craving? Italian, Mexican, Asian, or something else?",
          "What kind of food? Pizza, tacos, sushi, or something else?"
        ],
        quality: [
          "Want the best! What cuisine? Italian, Japanese, steakhouse, or French?",
          "Top spots - got it! What type: fine dining, casual, or trendy?"
        ],
        speed: [
          "Quick bite! What are you feeling? Burgers, tacos, pizza, or Asian?",
          "Nearby spots! What cuisine: casual American, Mexican, or Asian?"
        ]
      };

      const options = responses[intentType] || responses.craving;
      return options[Math.floor(Math.random() * options.length)];
    }

    // No preferences detected and no clear intent - provide helpful guidance
    const hints = [
      'Try: "Thai food with spicy curry"',
      'Try: "Italian pasta under $20"',
      'Try: "Mexican tacos nearby"',
      'Try: "Cozy ramen place"',
    ];
    const randomHint = hints[Math.floor(Math.random() * hints.length)];

    return `Could you be more specific? ${randomHint} 💡`;
  };

  // Send text message
  const handleSendMessage = async () => {
    if (!message.trim() && !selectedImage) return;

    if (selectedImage) {
      await sendImageMessage();
      setMessage('');
      return;
    }

    const userMessage = message.trim();
    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userMessage }]);
    setMessage('');

    setIsTyping(true);

    try {
      // Check if it's a casual message
      if (isCasualMessage(userMessage)) {
        setIsTyping(false);

        // Smart greeting responses based on current preferences
        const hasPrefs = preferences && (preferences.cuisine || preferences.budget || preferences.vibe);

        let casualResponse;
        if (hasPrefs) {
          casualResponse = "Hi! I see you already have some preferences set. Want to adjust them or add more details?";
        } else {
          const casualResponses = [
            "Hey! What kind of food are you in the mood for? 🍽️",
            "Hi! Tell me your cravings - cuisine, price, vibe - I'll handle the rest! 💭",
            "Hello! Describe your perfect meal and I'll find the spot! 🎯",
          ];
          casualResponse = casualResponses[Math.floor(Math.random() * casualResponses.length)];
        }

        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'ai',
          text: casualResponse
        }]);
        return;
      }

      // Analyze preferences ONLY (no Yelp search)
      console.log('Analyzing preferences:', userMessage);

      const result = await apiService.analyzePreferences(userMessage);

      setIsTyping(false);

      console.log('Preference analysis result:', result);

      // Build response message
      let aiMessage = '';
      let detectedPrefs: any = {};
      let analysis: any = null;

      // Extract preferences from AI analysis
      if (result.success && result.result && onPreferencesDetected) {
        try {
          analysis = JSON.parse(result.result);

          // Map cuisine preferences
          if (Array.isArray(analysis.cuisine_preferences) && analysis.cuisine_preferences.length > 0) {
            const cuisineMap: Record<string, string> = {
              'italian': 'Italian',
              'japanese': 'Japanese',
              'mexican': 'Mexican',
              'french': 'French',
              'thai': 'Thai',
              'indian': 'Indian',
              'korean': 'Korean',
              'spanish': 'Spanish',
              'chinese': 'Chinese',
              'sushi': 'Japanese',
              'ramen': 'Japanese',
              'pasta': 'Italian',
              'pizza': 'Italian',
              'tacos': 'Mexican',
              'curry': 'Indian'
            };

            const firstCuisine = String(analysis.cuisine_preferences[0]).toLowerCase();
            detectedPrefs.cuisine = cuisineMap[firstCuisine] || analysis.cuisine_preferences[0];
          }

          // Map price range
          if (analysis.price_range && typeof analysis.price_range === 'string') {
            const priceMap: Record<string, string> = {
              'budget': '$',
              'cheap': '$',
              'inexpensive': '$',
              'moderate': '$$',
              'mid-range': '$$',
              'expensive': '$$$',
              'upscale': '$$$',
              'luxury': '$$$$',
              'fine dining': '$$$$'
            };

            const priceKey = analysis.price_range.toLowerCase();
            detectedPrefs.budget = priceMap[priceKey] || '$$';
          }

          // Map ambiance/vibe
          if (analysis.ambiance_preferences && typeof analysis.ambiance_preferences === 'string') {
            const vibeMap: Record<string, string> = {
              'casual': 'Casual',
              'fine dining': 'Fine Dining',
              'trendy': 'Trendy',
              'cozy': 'Cozy',
              'lively': 'Lively',
              'romantic': 'Romantic',
              'family-friendly': 'Family-Friendly',
              'family friendly': 'Family-Friendly'
            };

            const vibeKey = analysis.ambiance_preferences.toLowerCase();
            detectedPrefs.vibe = vibeMap[vibeKey] || analysis.ambiance_preferences;
          }

          // Map dietary requirements
          if (Array.isArray(analysis.dietary_requirements) && analysis.dietary_requirements.length > 0) {
            const dietaryMap: Record<string, string> = {
              'vegetarian': 'Vegetarian',
              'vegan': 'Vegan',
              'gluten-free': 'Gluten-Free',
              'gluten free': 'Gluten-Free',
              'halal': 'Halal',
              'kosher': 'Kosher'
            };

            const firstDietary = String(analysis.dietary_requirements[0]).toLowerCase();
            detectedPrefs.dietary = dietaryMap[firstDietary] || analysis.dietary_requirements[0];
          }

          console.log('AI detected preferences:', detectedPrefs);

          // Trigger callback to update preferences
          if (Object.keys(detectedPrefs).length > 0) {
            onPreferencesDetected(detectedPrefs);
          }
        } catch (error) {
          console.error('Error parsing AI preferences:', error);
          // Silently fail - don't show error to user
        }
      }

      // Build intelligent response using smart response function
      aiMessage = getSmartResponse(userMessage, detectedPrefs);

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: aiMessage
      }]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      setIsTyping(false);

      const errorMsg = error?.message || 'Unknown error';
      const isBackendDown = errorMsg.includes('Network error') || errorMsg.includes('connect');

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'ai',
        text: isBackendDown
          ? '⚠️ Backend server not running. Please start the Python backend: cd backend && python main.py'
          : `Sorry, I encountered an error: ${errorMsg}. Please try again.`
      }]);
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{
        y: 0,
        opacity: 1,
        height: minimized ? 'auto' : '16rem'
      }}
      transition={{ delay: 0.4, height: { duration: 0.3 } }}
      className={`relative z-20 flex flex-shrink-0 flex-col border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl ${minimized ? 'h-auto' : 'h-64'}`}
    >
      {/* Header */}
      <button
        onClick={onToggleMinimized}
        className="w-full border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-transparent px-4 py-2.5 transition-colors hover:from-orange-500/15"
      >
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: isTyping ? [0, 360] : 0 }}
            transition={{ duration: 3, repeat: isTyping ? Infinity : 0, ease: 'linear' }}
          >
            <span className="text-sm">🧠</span>
          </motion.div>
          <div className="flex-1 text-left">
            <h3 className="text-sm text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
              Private Strategist
            </h3>
            <p className="text-xs text-gray-500">Gemini AI • Multimodal</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-green-500/20 px-2 py-0.5">
              <div className="h-1 w-1 animate-pulse rounded-full bg-green-400" />
              <span className="text-xs text-green-400">Active</span>
            </div>
            <motion.div
              animate={{ rotate: minimized ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Chat Messages */}
      <AnimatePresence>
        {!minimized && (
          <>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex-1 space-y-2 overflow-y-auto p-3"
            >
              <AnimatePresence mode="popLayout">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.sender === 'ai'
                          ? 'border border-green-500/20 bg-gradient-to-br from-zinc-900 to-zinc-800/50 text-gray-100 shadow-lg shadow-green-500/10'
                          : 'bg-gradient-to-r from-[#F97316] to-[#fb923c] text-white shadow-lg shadow-orange-500/20'
                      }`}
                      style={{
                        fontFamily: msg.sender === 'ai' ? 'Montserrat, sans-serif' : 'inherit',
                        fontSize: '0.85rem',
                        fontWeight: msg.sender === 'ai' ? 500 : 400
                      }}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-green-400"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </motion.div>

            {/* Image Preview */}
            {imagePreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="border-t border-white/5 p-2"
              >
                <div className="relative inline-block">
                  <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-lg object-cover" />
                  <button
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* Input Area */}
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/5 bg-black/40 p-3"
            >
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageSelect}
                  accept="image/*"
                  className="hidden"
                />

                {/* Image Upload Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-zinc-900/80 p-2 transition-all hover:bg-zinc-800"
                >
                  <ImageIcon className="h-4 w-4 text-gray-400" />
                </motion.button>

                {/* Voice Recording Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`rounded-lg p-2 transition-all ${
                    isRecording
                      ? 'bg-red-500 animate-pulse'
                      : 'bg-zinc-900/80 hover:bg-zinc-800'
                  }`}
                >
                  {isRecording ? (
                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                      <Mic className="h-4 w-4 text-white" />
                    </motion.div>
                  ) : (
                    <Mic className="h-4 w-4 text-gray-400" />
                  )}
                </motion.button>

                {/* Text Input */}
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    preferences?.cuisine && preferences?.budget && preferences?.vibe
                      ? "Add more details or lock preferences..."
                      : preferences?.cuisine
                      ? "Add budget or vibe..."
                      : "Try: 'Italian food under $20'"
                  }
                  disabled={isRecording}
                  className="flex-1 rounded-lg bg-zinc-900/80 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-all focus:bg-zinc-900 focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50"
                />

                {/* Send Button */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSendMessage}
                  disabled={(!message.trim() && !selectedImage) || isRecording}
                  className="rounded-lg bg-gradient-to-r from-[#F97316] to-[#fb923c] p-2 shadow-lg shadow-orange-500/30 transition-all disabled:opacity-40"
                >
                  <Send className="h-4 w-4 text-white" />
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
