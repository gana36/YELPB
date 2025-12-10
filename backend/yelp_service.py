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

            # Extract menu URL from attributes (Yelp uses PascalCase "MenuUrl")
            menu_url = None
            attributes = entity_data.get("attributes", {})
            if isinstance(attributes, dict):
                menu_url = attributes.get("MenuUrl")
            if not menu_url:
                menu_url = entity_data.get("menu_url")

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
                menu_url=menu_url,
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

    async def business_search(
        self,
        latitude: float,
        longitude: float,
        term: str = "restaurants",
        radius: Optional[int] = None,
        categories: Optional[List[str]] = None,
        price: Optional[List[int]] = None,
        open_now: bool = False,
        attributes: Optional[List[str]] = None,
        sort_by: str = "best_match",
        limit: int = 50,
        offset: int = 0,
        locale: str = "en_US"
    ) -> List[Business]:
        """
        Search for businesses using Yelp Business Search API v3
        Returns up to 50 businesses per request (240 max with pagination)
        
        Args:
            latitude: User's latitude
            longitude: User's longitude
            term: Search term (e.g., "restaurants", "Italian")
            radius: Search radius in meters (max 40000)
            categories: List of category aliases (e.g., ["italian", "pizza"])
            price: Price levels [1, 2, 3, 4] for $, $$, $$$, $$$$
            open_now: Only return currently open businesses
            attributes: List of attribute filters (e.g., ["hot_and_new", "outdoor_seating"])
            sort_by: Sort mode: "best_match", "rating", "review_count", "distance"
            limit: Number of results (max 50)
            offset: Offset for pagination (max 1000)
            locale: Locale code
            
        Returns:
            List of Business objects
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json"
        }
        
        # Build query params
        params: Dict[str, Any] = {
            "latitude": latitude,
            "longitude": longitude,
            "term": term,
            "sort_by": sort_by,
            "limit": min(limit, 50),  # Max 50 per request
            "offset": min(offset, 1000),
            "locale": locale
        }
        
        if radius:
            params["radius"] = min(radius, 40000)  # Max 40km
            
        if categories:
            params["categories"] = ",".join(categories)
            
        if price:
            params["price"] = ",".join(str(p) for p in price)
            
        if open_now:
            params["open_now"] = True
            
        if attributes:
            params["attributes"] = ",".join(attributes)
        
        endpoint = f"{self.base_url}/v3/businesses/search"
        
        logger.info(f"Business Search API request: {params}")
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    endpoint,
                    params=params,
                    headers=headers
                )
                response.raise_for_status()
                data = response.json()
                
                businesses_data = data.get("businesses", [])
                total = data.get("total", 0)
                
                logger.info(f"Business Search returned {len(businesses_data)} of {total} total businesses")
                
                businesses = []
                for biz in businesses_data:
                    try:
                        # Calculate distance
                        distance = None
                        if "distance" in biz:
                            dist_meters = biz["distance"]
                            distance = f"{(dist_meters * 0.000621371):.1f} mi"
                        
                        # Extract tags from categories
                        tags = []
                        if biz.get("categories"):
                            tags = [cat.get("title", "") for cat in biz["categories"] if cat.get("title")]
                        
                        business = Business(
                            id=biz.get("id", ""),
                            name=biz.get("name", ""),
                            rating=biz.get("rating"),
                            review_count=biz.get("review_count", 0),
                            price=biz.get("price"),
                            distance=distance,
                            image_url=biz.get("image_url"),
                            tags=tags,
                            votes=0,
                            location=biz.get("location"),
                            coordinates=biz.get("coordinates"),
                            phone=biz.get("phone"),
                            url=biz.get("url"),
                            menu_url=biz.get("attributes", {}).get("menu_url"),
                            categories=biz.get("categories")
                        )
                        businesses.append(business)
                    except Exception as e:
                        logger.warning(f"Failed to parse business: {e}")
                        
                return businesses
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Business Search API error: {e.response.status_code} - {e.response.text}")
            raise Exception(f"Yelp API error: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Business Search error: {e}")
            raise

    async def combined_search(
        self,
        latitude: float,
        longitude: float,
        query: str = "best restaurants",
        term: str = "restaurants",
        radius: Optional[int] = None,
        categories: Optional[List[str]] = None,
        price: Optional[List[int]] = None,
        limit: int = 10
    ) -> List[Business]:
        """
        Combined search: AI Chat API (rich data with MenuUrl) + Business Search API (quantity).
        Deduplicates results, prioritizing AI Chat results.
        """
        all_businesses: Dict[str, Business] = {}
        
        # 1. Get curated results from AI Chat API (has MenuUrl, summaries)
        try:
            chat_response = await self.chat(
                query=query,
                latitude=latitude,
                longitude=longitude
            )
            for biz in chat_response.businesses:
                all_businesses[biz.id] = biz
            logger.info(f"AI Chat returned {len(chat_response.businesses)} businesses with rich data")
        except Exception as e:
            logger.warning(f"AI Chat failed, continuing with Search API: {e}")
        
        # 2. Get more results from Business Search API
        try:
            search_results = await self.business_search(
                latitude=latitude,
                longitude=longitude,
                term=term,
                radius=radius,
                categories=categories,
                price=price,
                limit=limit
            )
            added = 0
            for biz in search_results:
                if biz.id not in all_businesses:
                    all_businesses[biz.id] = biz
                    added += 1
            logger.info(f"Business Search added {added} new businesses")
        except Exception as e:
            logger.warning(f"Business Search failed: {e}")
        
        result = list(all_businesses.values())
        logger.info(f"Combined search total: {len(result)} unique businesses")
        return result


# Create a singleton instance
yelp_service = YelpAIService()
