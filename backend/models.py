from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class UserContext(BaseModel):
    """User context for location and locale information"""
    locale: str = Field(default="en_US", description="User's locale (e.g., en_US)")
    latitude: Optional[float] = Field(default=None, description="User's latitude coordinate")
    longitude: Optional[float] = Field(default=None, description="User's longitude coordinate")


class ChatRequest(BaseModel):
    """Request model for Yelp AI Chat API"""
    query: str = Field(..., description="User's natural language query")
    user_context: Optional[UserContext] = Field(default=None, description="User context with location")
    chat_id: Optional[str] = Field(default=None, description="Conversation ID for multi-turn chat")


class Coordinates(BaseModel):
    """Geographic coordinates"""
    latitude: float
    longitude: float


class Business(BaseModel):
    """Business entity from Yelp API response"""
    id: str
    name: str
    rating: Optional[float] = None
    reviews: Optional[int] = Field(default=0, alias="review_count")
    price: Optional[str] = None
    distance: Optional[str] = None
    image: Optional[str] = Field(default=None, alias="image_url")
    tags: List[str] = Field(default_factory=list)
    votes: int = Field(default=0, description="Vote count from poll participants")
    location: Optional[Dict[str, Any]] = None
    coordinates: Optional[Coordinates] = None
    phone: Optional[str] = None
    url: Optional[str] = None
    menuUrl: Optional[str] = Field(default=None, alias="menu_url", description="Restaurant menu URL")
    categories: Optional[List[Dict[str, str]]] = None

    class Config:
        populate_by_name = True


class ChatResponse(BaseModel):
    """Response model for Yelp AI Chat API"""
    response_text: str = Field(..., description="Natural language response from AI")
    chat_id: Optional[str] = Field(default=None, description="Conversation ID for follow-up queries")
    businesses: List[Business] = Field(default_factory=list, description="Extracted business entities")
    types: Optional[List[str]] = Field(default=None, description="Response types (e.g., business_search)")
    raw_response: Optional[Dict[str, Any]] = Field(default=None, description="Full raw API response")


class SearchRequest(BaseModel):
    """Simplified search request for backward compatibility"""
    query: str = Field(..., description="Search query")
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locale: str = "en_US"


# Gemini Multimodal Models

class AudioProcessRequest(BaseModel):
    """Request for processing audio data"""
    audio_base64: str = Field(..., description="Base64 encoded audio data")
    mime_type: str = Field(default="audio/mp3", description="MIME type of audio file")
    prompt: Optional[str] = Field(default=None, description="Custom prompt for audio analysis")


class ImageProcessRequest(BaseModel):
    """Request for processing image data"""
    image_base64: str = Field(..., description="Base64 encoded image data")
    mime_type: str = Field(default="image/jpeg", description="MIME type of image file")
    prompt: Optional[str] = Field(default=None, description="Custom prompt for image analysis")


class MultimodalSearchRequest(BaseModel):
    """Request for multimodal search combining text, audio, and/or image"""
    text_query: Optional[str] = Field(default=None, description="Text search query")
    audio_base64: Optional[str] = Field(default=None, description="Base64 encoded audio data")
    image_base64: Optional[str] = Field(default=None, description="Base64 encoded image data")
    audio_mime_type: str = Field(default="audio/mp3", description="MIME type of audio")
    image_mime_type: str = Field(default="image/jpeg", description="MIME type of image")
    latitude: Optional[float] = Field(default=None, description="User latitude")
    longitude: Optional[float] = Field(default=None, description="User longitude")
    locale: str = Field(default="en_US", description="User locale")


class GeminiResponse(BaseModel):
    """Generic response from Gemini API"""
    success: bool = Field(..., description="Whether the request was successful")
    result: Any = Field(..., description="Processed result (usually JSON)")
    raw_response: Optional[str] = Field(default=None, description="Raw API response")
    error: Optional[str] = Field(default=None, description="Error message if failed")
