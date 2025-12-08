import httpx
from typing import Dict, Any, List, Optional
from models import Business, ChatResponse
from config import settings
import logging

logger = logging.getLogger(__name__)


class YelpAIService:
    """Service for interacting with Yelp AI Chat API"""

    def __init__(self):
        self.api_key = settings.yelp_api_key
        self.base_url = settings.yelp_api_base_url
        self.endpoint = f"{self.base_url}/ai/chat/v2"

    async def chat(
        self,
        query: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        locale: str = "en_US",
        chat_id: Optional[str] = None
    ) -> ChatResponse:
        """
        Send a chat query to Yelp AI API

        Args:
            query: Natural language query
            latitude: User's latitude coordinate
            longitude: User's longitude coordinate
            locale: User's locale (default: en_US)
            chat_id: Optional conversation ID for multi-turn conversations

        Returns:
            ChatResponse with AI response and extracted businesses
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload: Dict[str, Any] = {
            "query": query
        }

        # Add user context if location is provided
        if latitude is not None and longitude is not None:
            payload["user_context"] = {
                "locale": locale,
                "latitude": latitude,
                "longitude": longitude
            }
        elif locale:
            payload["user_context"] = {
                "locale": locale
            }

        # Add chat_id for conversation continuity
        if chat_id:
            payload["chat_id"] = chat_id

        logger.info(f"Sending Yelp API request: {payload}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.endpoint,
                    json=payload,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()

                logger.info(f"Yelp API response status: {response.status_code}")
                logger.debug(f"Yelp API raw response: {data}")

                # Extract response text
                response_text = data.get("response", {}).get("text", "")

                # Extract chat_id for conversation continuity
                chat_id = data.get("chat_id")

                # Extract businesses from entities
                businesses = self._extract_businesses(data)

                # Extract response types
                types = data.get("types", [])

                return ChatResponse(
                    response_text=response_text,
                    chat_id=chat_id,
                    businesses=businesses,
                    types=types,
                    raw_response=data
                )

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error from Yelp API: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Yelp API error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Request error: {str(e)}")
            raise Exception(f"Failed to connect to Yelp API: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise

    def _extract_businesses(self, data: Dict[str, Any]) -> List[Business]:
        """
        Extract business entities from Yelp AI API response

        Args:
            data: Raw API response

        Returns:
            List of Business objects
        """
        businesses = []
        entities = data.get("entities", [])

        # Handle list format (new Yelp API response structure)
        if isinstance(entities, list):
            for entity in entities:
                if isinstance(entity, dict) and "businesses" in entity:
                    # Extract businesses from the nested array
                    for business_data in entity.get("businesses", []):
                        businesses.extend(self._parse_business(business_data))
                elif isinstance(entity, dict) and "name" in entity:
                    # Direct business object
                    businesses.extend(self._parse_business(entity))
            return businesses

        # Handle dict format (legacy)
        if isinstance(entities, dict):
            for entity_id, entity_data in entities.items():
                if isinstance(entity_data, dict) and "name" in entity_data:
                    businesses.extend(self._parse_business(entity_data))
            return businesses

        logger.warning(f"Unexpected entities format: {type(entities)}")
        return businesses

    def _parse_business(self, entity_data: Dict[str, Any]) -> List[Business]:
        """
        Parse a single business entity into a Business object

        Args:
            entity_data: Business data from Yelp API

        Returns:
            List containing one Business object, or empty list if parsing fails
        """
        try:
            # Check if this entity has business-like properties
            if "name" not in entity_data:
                return []

            # Extract categories and create tags
            tags = []
            if "categories" in entity_data and entity_data["categories"]:
                tags = [cat.get("title", "") for cat in entity_data["categories"] if cat.get("title")]

            # Get image URL - check multiple possible locations
            image_url = None

            # Try image_url field first
            if "image_url" in entity_data:
                image_url = entity_data["image_url"]

            # Try contextual_info.photos (new Yelp API format)
            elif "contextual_info" in entity_data:
                contextual_info = entity_data["contextual_info"]
                if isinstance(contextual_info, dict) and "photos" in contextual_info:
                    photos = contextual_info["photos"]
                    if isinstance(photos, list) and len(photos) > 0:
                        if isinstance(photos[0], dict):
                            image_url = photos[0].get("original_url")
                        else:
                            image_url = photos[0]

            # Try photos field directly
            elif "photos" in entity_data and entity_data["photos"]:
                photos = entity_data["photos"]
                if isinstance(photos, list) and len(photos) > 0:
                    if isinstance(photos[0], dict):
                        image_url = photos[0].get("original_url")
                    else:
                        image_url = photos[0]

            # Extract coordinates
            coordinates = None
            coords_data = entity_data.get("coordinates")
            if coords_data and isinstance(coords_data, dict):
                if "latitude" in coords_data and "longitude" in coords_data:
                    coordinates = {
                        "latitude": coords_data["latitude"],
                        "longitude": coords_data["longitude"]
                    }

            # Calculate distance if available
            distance = None
            if "distance" in entity_data:
                dist_meters = entity_data["distance"]
                if dist_meters:
                    # Convert meters to miles
                    distance = f"{(dist_meters * 0.000621371):.1f} mi"

            business = Business(
                id=entity_data.get("id", entity_data.get("alias", str(hash(entity_data.get("name"))))),
                name=entity_data.get("name", ""),
                rating=entity_data.get("rating"),
                review_count=entity_data.get("review_count", 0),
                price=entity_data.get("price"),
                distance=distance,
                image_url=image_url,
                tags=tags,
                votes=0,  # Initialize votes to 0 for new businesses
                location=entity_data.get("location"),
                coordinates=coordinates,
                phone=entity_data.get("phone"),
                url=entity_data.get("url"),
                categories=entity_data.get("categories")
            )
            return [business]

        except Exception as e:
            logger.warning(f"Failed to parse business entity: {str(e)}")
            return []

    async def search_businesses(
        self,
        query: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        locale: str = "en_US"
    ) -> List[Business]:
        """
        Simplified search method that returns only businesses

        Args:
            query: Search query
            latitude: User's latitude
            longitude: User's longitude
            locale: User's locale

        Returns:
            List of Business objects
        """
        response = await self.chat(
            query=query,
            latitude=latitude,
            longitude=longitude,
            locale=locale
        )
        return response.businesses

    async def book_reservation(
        self,
        business_name: str,
        party_size: int,
        date: str,
        time: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        locale: str = "en_US"
    ) -> ChatResponse:
        """
        Book a reservation at a restaurant using Yelp AI

        Args:
            business_name: Name of the restaurant
            party_size: Number of people
            date: Date in format YYYY-MM-DD
            time: Time in format HH:MM (24-hour)
            latitude: User's latitude
            longitude: User's longitude
            locale: User's locale

        Returns:
            ChatResponse with booking confirmation or instructions
        """
        query = f"Book a table for {party_size} people at {business_name} on {date} at {time}"

        response = await self.chat(
            query=query,
            latitude=latitude,
            longitude=longitude,
            locale=locale
        )

        logger.info(f"Booking request: {query}")
        return response


# Create a singleton instance
yelp_service = YelpAIService()
