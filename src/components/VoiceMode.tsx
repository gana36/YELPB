import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mic, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';

interface VoiceModeProps {
    isOpen: boolean;
    onClose: () => void;
    onTranscription: (text: string) => void;
    onAIResponse: (text: string) => void;
    onPreferencesDetected?: (prefs: any) => void;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export function VoiceMode({ isOpen, onClose, onTranscription, onAIResponse, onPreferencesDetected }: VoiceModeProps) {
    const [voiceState, setVoiceState] = useState<VoiceState>('idle');
    const [transcription, setTranscription] = useState<string>('');
    const [aiResponse, setAiResponse] = useState<string>('');
    const [audioLevel, setAudioLevel] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSpeechTimeRef = useRef<number>(Date.now());
    const animationFrameRef = useRef<number | null>(null);
    const isRecordingRef = useRef<boolean>(false);
    const lastValidTranscriptionRef = useRef<boolean>(false); // Track if last transcription was valid

    const SILENCE_THRESHOLD = 15; // Audio level below this is considered silence
    const SILENCE_DURATION = 2000; // Stop after 2 seconds of silence
    const MIN_RECORDING_TIME = 1000; // Minimum recording time before silence detection kicks in

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    const cleanup = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(() => { });
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    };

    // Auto-start listening when opened
    useEffect(() => {
        if (isOpen && voiceState === 'idle') {
            startListening();
        }
    }, [isOpen]);

    const startListening = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // Set up audio analysis for silence detection
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);

            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];
            lastSpeechTimeRef.current = Date.now();

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await processAudio(audioBlob);
            };

            mediaRecorder.start();
            setVoiceState('listening');
            isRecordingRef.current = true; // Set recording flag for closure

            // Start monitoring audio levels for silence detection
            monitorAudioLevel();
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
            onClose();
        }
    };

    const monitorAudioLevel = () => {
        if (!analyserRef.current || !isRecordingRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average audio level
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average);

        const now = Date.now();
        const recordingStartTime = lastSpeechTimeRef.current - SILENCE_DURATION;
        const recordingDuration = now - recordingStartTime;

        if (average > SILENCE_THRESHOLD) {
            // Speech detected - reset silence timer
            lastSpeechTimeRef.current = now;
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = null;
            }
        } else if (recordingDuration > MIN_RECORDING_TIME) {
            // Silence detected - check if we should stop
            const silenceDuration = now - lastSpeechTimeRef.current;
            if (silenceDuration > SILENCE_DURATION && !silenceTimerRef.current) {
                console.log('Silence detected for', silenceDuration, 'ms, stopping...');
                silenceTimerRef.current = setTimeout(() => {
                    if (isRecordingRef.current) {
                        console.log('Auto-stopping recording due to silence');
                        stopListening();
                    }
                }, 100);
            }
        }

        // Continue monitoring only if still recording
        if (isRecordingRef.current) {
            animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
        }
    };

    const stopListening = () => {
        if (mediaRecorderRef.current && isRecordingRef.current) {
            isRecordingRef.current = false; // Clear recording flag
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
            }
            mediaRecorderRef.current.stop();
            setVoiceState('processing');

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(() => { });
            }
        }
    };

    const processAudio = async (audioBlob: Blob) => {
        try {
            // Convert audio to base64
            const reader = new FileReader();
            reader.onload = async () => {
                const base64Audio = (reader.result as string).split(',')[1];

                // Transcribe audio
                const transcriptResult = await apiService.transcribeAudio(base64Audio, 'audio/webm');
                const text = transcriptResult.transcription || '';
                setTranscription(text);
                onTranscription(text);

                // Track if this was a valid transcription (for restart logic)
                const isValidTranscription = text &&
                    !text.toLowerCase().includes('no speech') &&
                    !text.toLowerCase().includes('no clear speech') &&
                    !text.toLowerCase().includes('typing sound');
                lastValidTranscriptionRef.current = isValidTranscription;
                console.log('Transcription valid:', isValidTranscription, 'Text:', text);

                // Analyze for preferences
                if (transcriptResult.analysis) {
                    onPreferencesDetected?.(transcriptResult.analysis);
                }

                // Generate AI response (simplified for demo)
                const responseText = generateResponse(text, transcriptResult.analysis);
                setAiResponse(responseText);
                onAIResponse(responseText); // Send AI response to chat

                // Convert to speech
                setVoiceState('speaking');
                await speakResponse(responseText);
            };
            reader.readAsDataURL(audioBlob);
        } catch (error) {
            console.error('Error processing audio:', error);
            setVoiceState('idle');
        }
    };

    const generateResponse = (text: string, analysis: any): string => {
        // Parse the text directly for common food-related terms
        const lowerText = text.toLowerCase();

        // Detect cuisines mentioned in text
        const cuisineKeywords = ['sushi', 'japanese', 'italian', 'mexican', 'indian', 'chinese', 'thai', 'korean', 'vietnamese', 'pizza', 'burger', 'tacos', 'ramen', 'seafood', 'steakhouse', 'mediterranean', 'greek', 'french', 'spanish'];
        const detectedCuisines = cuisineKeywords.filter(c => lowerText.includes(c));

        // Detect budget mentioned
        const budgetMatch = lowerText.match(/\$(\d+)/);
        const budgetMentioned = budgetMatch ? `$${budgetMatch[1]}` : null;

        // Detect vibe/mood
        const vibeKeywords = ['casual', 'fancy', 'romantic', 'family', 'quick', 'cozy', 'trendy', 'outdoor'];
        const detectedVibes = vibeKeywords.filter(v => lowerText.includes(v));

        // Build contextual response
        const mentions: string[] = [];

        if (detectedCuisines.length > 0) {
            mentions.push(`${detectedCuisines.join(', ')}`);
        }
        if (budgetMentioned) {
            mentions.push(`around ${budgetMentioned}`);
        }
        if (detectedVibes.length > 0) {
            mentions.push(`something ${detectedVibes.join(', ')}`);
        }

        if (mentions.length > 0) {
            return `Perfect! I've noted your preferences: ${mentions.join(', ')}. I'll help you find great options. Is there anything else you'd like to add, or should we start looking?`;
        }

        // Also check the API analysis
        const cuisinesFromApi = analysis?.cuisine_preferences?.length > 0;
        const budgetFromApi = analysis?.price_sensitivity;

        if (cuisinesFromApi || budgetFromApi) {
            const parts: string[] = [];
            if (cuisinesFromApi) {
                parts.push(analysis.cuisine_preferences.join(' or '));
            }
            if (budgetFromApi) {
                parts.push(`${budgetFromApi} budget`);
            }
            return `Got it! You're looking for ${parts.join(' with a ')}. Anything else to narrow it down?`;
        }

        // Default response for greetings or unclear input
        if (lowerText.includes('hi') || lowerText.includes('hello') || lowerText.includes('hey')) {
            return "Hi there! I'm here to help you find the perfect restaurant. What are you in the mood for? You can tell me about cuisine type, budget, or vibe.";
        }

        return "I'm listening! Tell me what kind of food you're craving, your budget, or any preferences you have.";
    };

    const speakResponse = async (text: string) => {
        // Use browser speech directly - it's fast and reliable
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech first
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            utterance.onend = () => {
                console.log('Speech ended, waiting before restart...');
                setVoiceState('idle');
                // Always restart after speaking if modal is still open and last transcription was valid
                setTimeout(() => {
                    if (isOpen && lastValidTranscriptionRef.current) {
                        console.log('Restarting listening...');
                        startListening();
                    } else {
                        console.log('Not restarting - modal closed or invalid transcription');
                    }
                }, 1000);
            };

            utterance.onerror = (e) => {
                console.error('Speech synthesis error:', e);
                setVoiceState('idle');
            };

            window.speechSynthesis.speak(utterance);
            console.log('Speaking:', text);
        } else {
            console.error('No speech synthesis available');
            setVoiceState('idle');
        }
    };

    const handleOrbClick = () => {
        if (voiceState === 'listening') {
            stopListening();
        } else if (voiceState === 'idle') {
            startListening();
        }
    };

    const handleClose = () => {
        if (mediaRecorderRef.current && voiceState === 'listening') {
            mediaRecorderRef.current.stop();
        }
        if (audioRef.current) {
            audioRef.current.pause();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setVoiceState('idle');
        onClose();
    };

    const getStatusText = () => {
        switch (voiceState) {
            case 'listening':
                return 'Listening...';
            case 'processing':
                return 'Processing...';
            case 'speaking':
                return 'Speaking...';
            default:
                return 'Tap to speak';
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl"
                >
                    {/* Close button */}
                    <motion.button
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        onClick={handleClose}
                        className="absolute top-8 right-8 rounded-full p-3 bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <X className="h-6 w-6 text-white" />
                    </motion.button>

                    {/* Animated Orb */}
                    <div className="relative flex items-center justify-center" onClick={handleOrbClick}>
                        {/* Outer rings - wave animation */}
                        {voiceState === 'listening' && (
                            <>
                                {[1, 2, 3].map((ring) => (
                                    <motion.div
                                        key={ring}
                                        className="absolute rounded-full border-2 border-orange-500/30"
                                        initial={{ width: 120, height: 120, opacity: 0.8 }}
                                        animate={{
                                            width: [120, 200 + ring * 40],
                                            height: [120, 200 + ring * 40],
                                            opacity: [0.6, 0],
                                        }}
                                        transition={{
                                            duration: 2,
                                            delay: ring * 0.4,
                                            repeat: Infinity,
                                            ease: 'easeOut',
                                        }}
                                    />
                                ))}
                            </>
                        )}

                        {/* Processing pulse */}
                        {voiceState === 'processing' && (
                            <motion.div
                                className="absolute rounded-full bg-orange-500/20"
                                animate={{
                                    width: [160, 180, 160],
                                    height: [160, 180, 160],
                                    opacity: [0.5, 0.8, 0.5],
                                }}
                                transition={{
                                    duration: 1,
                                    repeat: Infinity,
                                    ease: 'easeInOut',
                                }}
                            />
                        )}

                        {/* Speaking animation */}
                        {voiceState === 'speaking' && (
                            <>
                                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="absolute w-1 bg-gradient-to-t from-orange-500 to-orange-300 rounded-full"
                                        style={{
                                            height: 40,
                                            transform: `rotate(${i * 45}deg) translateY(-60px)`,
                                            transformOrigin: 'center 80px',
                                        }}
                                        animate={{
                                            scaleY: [1, 1.5, 0.8, 1.2, 1],
                                            opacity: [0.8, 1, 0.6, 0.9, 0.8],
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            delay: i * 0.1,
                                            repeat: Infinity,
                                            ease: 'easeInOut',
                                        }}
                                    />
                                ))}
                            </>
                        )}

                        {/* Core orb */}
                        <motion.div
                            className="relative z-10 flex items-center justify-center rounded-full cursor-pointer"
                            style={{
                                width: 140,
                                height: 140,
                                background: 'linear-gradient(135deg, #F97316 0%, #fb923c 50%, #F97316 100%)',
                                boxShadow: voiceState === 'listening'
                                    ? '0 0 60px rgba(249, 115, 22, 0.6)'
                                    : '0 0 40px rgba(249, 115, 22, 0.4)',
                            }}
                            animate={{
                                scale: voiceState === 'listening' ? [1, 1.05, 1] : 1,
                            }}
                            transition={{
                                duration: 1.5,
                                repeat: voiceState === 'listening' ? Infinity : 0,
                                ease: 'easeInOut',
                            }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {voiceState === 'processing' ? (
                                <Loader2 className="h-12 w-12 text-white animate-spin" />
                            ) : (
                                <Mic className="h-12 w-12 text-white" />
                            )}
                        </motion.div>
                    </div>

                    {/* Status text */}
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-12 text-2xl text-white font-medium"
                        style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                        {getStatusText()}
                    </motion.p>

                    {/* Transcription display */}
                    {transcription && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 max-w-md text-center"
                        >
                            <p className="text-gray-400 text-sm">You said:</p>
                            <p className="text-white mt-1">{transcription}</p>
                        </motion.div>
                    )}

                    {/* AI response display */}
                    {aiResponse && voiceState === 'speaking' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-4 max-w-md text-center"
                        >
                            <p className="text-orange-400 text-sm">AI:</p>
                            <p className="text-white/80 mt-1 text-sm">{aiResponse}</p>
                        </motion.div>
                    )}

                    {/* Hint text */}
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="absolute bottom-12 text-gray-500 text-sm"
                    >
                        {voiceState === 'listening'
                            ? 'Speak naturally — I\'ll respond when you pause'
                            : 'Having a conversation with CommonPlate AI'}
                    </motion.p>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
