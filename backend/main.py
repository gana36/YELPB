from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from contextlib import asynccontextmanager
import logging
import secrets

from config import settings
from models import (
    ChatRequest, ChatResponse, SearchRequest, Business,
    AudioProcessRequest, ImageProcessRequest, MultimodalSearchRequest, GeminiResponse
)
from yelp_service import yelp_service
from gemini_service import gemini_service
from calendar_service import calendar_service
import base64
import json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events"""
    logger.info("Starting FastAPI application...")
    logger.info(f"CORS origins: {settings.cors_origins}")
    yield
    logger.info("Shutting down FastAPI application...")


# Initialize FastAPI app
app = FastAPI(
    title="Group Consensus Backend",
    description="Backend API for Group Consensus with Yelp AI integration",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint - health check"""
    return {
        "status": "ok",
        "message": "Group Consensus Backend API",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/api/yelp/chat", response_model=ChatResponse)
async def yelp_chat(request: ChatRequest):
    """
    Chat with Yelp AI API

    This endpoint supports multi-turn conversations. Include the chat_id
    from previous responses to continue a conversation.

    Args:
        request: ChatRequest with query, optional user_context, and optional chat_id

    Returns:
        ChatResponse with AI-generated text, businesses, and chat_id
    """
    try:
        user_context = request.user_context or None
        latitude = user_context.latitude if user_context else None
        longitude = user_context.longitude if user_context else None
        locale = user_context.locale if user_context else "en_US"

        response = await yelp_service.chat(
            query=request.query,
            latitude=latitude,
            longitude=longitude,
            locale=locale,
            chat_id=request.chat_id
        )

        logger.info(f"Chat query: '{request.query}' - Found {len(response.businesses)} businesses")
        return response

    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/yelp/search", response_model=list[Business])
async def search_businesses(request: SearchRequest):
    """
    Search for businesses using Yelp AI

    Simplified endpoint for backward compatibility with frontend.
    Returns only the list of businesses without chat context.

    Args:
        request: SearchRequest with query and optional location

    Returns:
        List of Business objects
    """
    try:
        businesses = await yelp_service.search_businesses(
            query=request.query,
            latitude=request.latitude,
            longitude=request.longitude,
            locale=request.locale
        )

        logger.info(f"Search query: '{request.query}' - Found {len(businesses)} businesses")
        return businesses

    except Exception as e:
        logger.error(f"Error in search endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/yelp/book-reservation")
async def book_reservation(request: dict):
    """
    Book a reservation at a restaurant using Yelp AI

    Args:
        request: Dict with business_name, party_size, date, time, latitude, longitude

    Returns:
        Booking confirmation or instructions from Yelp AI
    """
    try:
        business_name = request.get('business_name')
        party_size = request.get('party_size', 2)
        date = request.get('date')
        time = request.get('time')
        latitude = request.get('latitude')
        longitude = request.get('longitude')

        if not business_name or not date or not time:
            raise HTTPException(status_code=400, detail="Missing required fields: business_name, date, time")

        response = await yelp_service.book_reservation(
            business_name=business_name,
            party_size=party_size,
            date=date,
            time=time,
            latitude=latitude,
            longitude=longitude
        )

        logger.info(f"Booking reservation at {business_name} for {party_size} on {date} at {time}")
        return {
            "success": True,
            "message": response.response_text,
            "booking_details": {
                "business_name": business_name,
                "party_size": party_size,
                "date": date,
                "time": time
            }
        }

    except Exception as e:
        logger.error(f"Error booking reservation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Gemini Multimodal Endpoints

@app.post("/api/gemini/process-audio", response_model=GeminiResponse)
async def process_audio(request: AudioProcessRequest):
    """
    Process audio file and extract information

    Analyzes audio to extract:
    - Transcription
    - User intent
    - Search requirements (cuisine, price, dietary restrictions, etc.)
    - Recommended search query for Yelp

    Args:
        request: AudioProcessRequest with base64 encoded audio

    Returns:
        GeminiResponse with extracted information
    """
    try:
        # Decode base64 audio
        audio_data = base64.b64decode(request.audio_base64)

        # Process with Gemini
        result = await gemini_service.process_audio(
            audio_data=audio_data,
            mime_type=request.mime_type,
            prompt=request.prompt
        )

        logger.info(f"Audio processed successfully")
        return GeminiResponse(**result)

    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gemini/process-image", response_model=GeminiResponse)
async def process_image(request: ImageProcessRequest):
    """
    Process image and extract food/restaurant information

    Analyzes image to identify:
    - Food items and dishes
    - Cuisine type
    - Ambiance and dining style
    - Text extraction (menus, signs)
    - Search suggestions

    Args:
        request: ImageProcessRequest with base64 encoded image

    Returns:
        GeminiResponse with image analysis
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image_base64)

        # Process with Gemini
        result = await gemini_service.process_image(
            image_data=image_data,
            mime_type=request.mime_type,
            prompt=request.prompt
        )

        logger.info(f"Image processed successfully")
        return GeminiResponse(**result)

    except Exception as e:
        logger.error(f"Error processing image: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gemini/multimodal-search")
async def multimodal_search(request: MultimodalSearchRequest):
    """
    Unified multimodal search combining text, audio, and/or image

    Processes multiple input types together to:
    1. Extract comprehensive user intent
    2. Generate optimal Yelp search query
    3. Automatically search Yelp with the generated query
    4. Return matching businesses

    Args:
        request: MultimodalSearchRequest with text/audio/image inputs

    Returns:
        Combined analysis and business results
    """
    try:
        # Decode inputs if provided
        audio_data = base64.b64decode(request.audio_base64) if request.audio_base64 else None
        image_data = base64.b64decode(request.image_base64) if request.image_base64 else None

        # Process with Gemini
        gemini_result = await gemini_service.multimodal_search(
            text_query=request.text_query,
            audio_data=audio_data,
            image_data=image_data,
            audio_mime_type=request.audio_mime_type,
            image_mime_type=request.image_mime_type
        )

        # Parse Gemini result
        analysis = json.loads(gemini_result["result"])

        # Extract search query from Gemini analysis
        search_query = analysis.get("unified_search_query", request.text_query or "restaurants")

        # Search Yelp with the generated query
        businesses = await yelp_service.search_businesses(
            query=search_query,
            latitude=request.latitude,
            longitude=request.longitude,
            locale=request.locale
        )

        logger.info(f"Multimodal search: '{search_query}' - Found {len(businesses)} businesses")

        return {
            "success": True,
            "analysis": analysis,
            "search_query": search_query,
            "businesses": [b.model_dump() for b in businesses],
            "gemini_raw": gemini_result["raw_response"]
        }

    except Exception as e:
        logger.error(f"Error in multimodal search: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gemini/transcribe-audio")
async def transcribe_audio(request: AudioProcessRequest):
    """
    Simple audio transcription endpoint

    Converts speech to text without additional analysis.

    Args:
        request: AudioProcessRequest with base64 encoded audio

    Returns:
        Transcribed text
    """
    try:
        # Decode base64 audio
        audio_data = base64.b64decode(request.audio_base64)

        # Transcribe with Gemini
        transcription = await gemini_service.transcribe_audio(
            audio_data=audio_data,
            mime_type=request.mime_type
        )

        logger.info(f"Audio transcribed successfully")
        return {
            "success": True,
            "transcription": transcription
        }

    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/gemini/analyze-preferences")
async def analyze_preferences(request: dict):
    """
    Analyze text to extract preferences only (NO Yelp search)

    Used by the chat interface to help users set their preferences
    through natural language without triggering restaurant searches.

    Args:
        request: Dict with 'text_query' field

    Returns:
        Extracted preferences (cuisine, price, vibe, dietary)
    """
    try:
        text_query = request.get('text_query', '')

        if not text_query:
            return {
                "success": False,
                "error": "No text_query provided"
            }

        # Analyze with Gemini (no Yelp search)
        result = await gemini_service.analyze_preferences(text_query)

        logger.info(f"Preferences analyzed: {text_query}")
        return result

    except Exception as e:
        logger.error(f"Error analyzing preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Google Calendar Integration Endpoints

# In-memory store for OAuth state (use Redis/DB in production)
oauth_states = {}

@app.get("/api/calendar/auth/start")
async def start_calendar_auth(user_id: str = Query(...)):
    """
    Start Google Calendar OAuth2 flow

    Args:
        user_id: Unique identifier for the user

    Returns:
        Authorization URL to redirect user to
    """
    try:
        # Generate random state for CSRF protection
        state = secrets.token_urlsafe(32)
        oauth_states[state] = {"user_id": user_id}

        # Get authorization URL
        auth_url = calendar_service.get_authorization_url(state)

        logger.info(f"Starting calendar auth for user: {user_id}")

        return {
            "auth_url": auth_url,
            "state": state
        }

    except Exception as e:
        logger.error(f"Error starting calendar auth: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/auth/callback")
async def calendar_auth_callback(
    code: str = Query(...),
    state: str = Query(...)
):
    """
    Handle OAuth2 callback from Google

    Args:
        code: Authorization code from Google
        state: State parameter for CSRF verification

    Returns:
        Tokens for creating calendar events
    """
    try:
        # Verify state
        if state not in oauth_states:
            raise HTTPException(status_code=400, detail="Invalid state parameter")

        user_data = oauth_states.pop(state)

        # Exchange code for tokens
        tokens = calendar_service.exchange_code_for_token(code)

        logger.info(f"Calendar auth successful for user: {user_data['user_id']}")

        # In production, store tokens securely in database
        # For now, return to frontend to store in session/localStorage
        return {
            "success": True,
            "user_id": user_data["user_id"],
            "tokens": tokens
        }

    except Exception as e:
        logger.error(f"Error in calendar auth callback: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calendar/create-event")
async def create_calendar_event(request: dict):
    """
    Create a calendar event for the winning restaurant

    Args:
        request: Dict containing tokens and event details

    Returns:
        Created event details with link
    """
    try:
        # Extract request data
        access_token = request.get("access_token")
        refresh_token = request.get("refresh_token")
        event_details = request.get("event_details")

        if not access_token or not event_details:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Create calendar event
        result = await calendar_service.create_calendar_event(
            access_token=access_token,
            refresh_token=refresh_token,
            event_details=event_details
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error"))

        logger.info(f"Calendar event created successfully")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating calendar event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_level="info"
    )
