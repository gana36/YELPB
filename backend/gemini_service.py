import os
import logging
from typing import Dict, Any, Optional, List
from google import genai
from google.genai import types
from config import settings
import base64

logger = logging.getLogger(__name__)


class GeminiService:
    """Service for interacting with Google Gemini API for multimodal processing"""

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.client = genai.Client(api_key=self.api_key)
        self.model = "gemini-2.5-flash"  # Fast and cost-effective model

    async def process_audio(
        self,
        audio_data: bytes,
        mime_type: str = "audio/mp3",
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process audio file and extract information

        Args:
            audio_data: Raw audio bytes
            mime_type: MIME type of audio (audio/mp3, audio/wav, etc.)
            prompt: Optional custom prompt. Defaults to transcription + intent extraction

        Returns:
            Dictionary with transcription, intent, and extracted information
        """
        try:
            # Default prompt for restaurant search
            if prompt is None:
                prompt = """
                Please analyze this audio and provide:
                1. A complete transcription of the speech
                2. The user's intent (what they're looking for)
                3. Extract any specific requirements mentioned (cuisine type, price range, dietary restrictions, location, etc.)

                Format your response as JSON with these fields:
                - transcription: the full text
                - intent: brief description of what they want
                - requirements: object with extracted details (cuisine, price, dietary, location, etc.)
                - search_query: a natural language search query for Yelp based on the audio
                """

            # Process audio with Gemini
            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=audio_data, mime_type=mime_type)
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text
            logger.info(f"Audio processed successfully")

            return {
                "success": True,
                "result": result,
                "raw_response": response.text
            }

        except Exception as e:
            logger.error(f"Error processing audio: {str(e)}")
            raise Exception(f"Failed to process audio: {str(e)}")

    async def process_image(
        self,
        image_data: bytes,
        mime_type: str = "image/jpeg",
        prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process image and extract information about food/restaurants

        Args:
            image_data: Raw image bytes
            mime_type: MIME type of image (image/jpeg, image/png, etc.)
            prompt: Optional custom prompt. Defaults to food analysis

        Returns:
            Dictionary with image analysis, detected items, and search suggestions
        """
        try:
            # Default prompt for food/restaurant images
            if prompt is None:
                prompt = """
                Please analyze this image and provide:
                1. What type of food or dining scene is shown
                2. Identify specific dishes, cuisines, or restaurant types visible
                3. Describe the ambiance, setting, or dining style if visible
                4. Extract any text visible in the image (menu items, restaurant names, etc.)
                5. Suggest what the user might be looking for based on this image

                Format your response as JSON with these fields:
                - description: detailed description of what's in the image
                - food_items: list of identified food items or dishes
                - cuisine_type: detected cuisine type(s)
                - ambiance: description of setting/ambiance if visible
                - extracted_text: any text visible in the image
                - search_suggestions: list of search queries that would find similar places/food
                - dietary_notes: any visible dietary attributes (vegan, gluten-free, etc.)
                """

            # Process image with Gemini
            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=image_data, mime_type=mime_type)
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text
            logger.info(f"Image processed successfully")

            return {
                "success": True,
                "result": result,
                "raw_response": response.text
            }

        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            raise Exception(f"Failed to process image: {str(e)}")

    async def analyze_food_image_advanced(
        self,
        image_data: bytes,
        mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        Advanced food image analysis with object detection

        Args:
            image_data: Raw image bytes
            mime_type: MIME type of image

        Returns:
            Dictionary with detailed object detection and segmentation
        """
        try:
            prompt = """
            Detect all food items and dining elements in this image.
            For each item provide:
            - name: what it is
            - category: type (appetizer, main, dessert, beverage, etc.)
            - bounding_box: coordinates [ymin, xmin, ymax, xmax] normalized to 0-1000

            Also identify:
            - overall_cuisine: the cuisine type
            - dining_style: (casual, fine dining, fast food, etc.)
            - price_indicator: estimate (budget $, moderate $$, expensive $$$)

            Format as JSON with 'detected_items' array and 'analysis' object.
            """

            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    prompt,
                    types.Part.from_bytes(data=image_data, mime_type=mime_type)
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text
            logger.info(f"Advanced image analysis completed")

            return {
                "success": True,
                "result": result,
                "raw_response": response.text
            }

        except Exception as e:
            logger.error(f"Error in advanced image analysis: {str(e)}")
            raise Exception(f"Failed to analyze image: {str(e)}")

    async def transcribe_audio(
        self,
        audio_data: bytes,
        mime_type: str = "audio/mp3"
    ) -> str:
        """
        Simple audio transcription

        Args:
            audio_data: Raw audio bytes
            mime_type: MIME type of audio

        Returns:
            Transcribed text
        """
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=[
                    "Generate a transcript of the speech in this audio.",
                    types.Part.from_bytes(data=audio_data, mime_type=mime_type)
                ]
            )

            transcription = response.text
            logger.info(f"Audio transcribed successfully")

            return transcription

        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            raise Exception(f"Failed to transcribe audio: {str(e)}")

    async def multimodal_search(
        self,
        text_query: Optional[str] = None,
        audio_data: Optional[bytes] = None,
        image_data: Optional[bytes] = None,
        audio_mime_type: str = "audio/mp3",
        image_mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        Process multiple input types together for comprehensive search

        Args:
            text_query: Optional text query
            audio_data: Optional audio bytes
            image_data: Optional image bytes
            audio_mime_type: MIME type for audio
            image_mime_type: MIME type for image

        Returns:
            Unified analysis with search query recommendation
        """
        try:
            contents = []

            # Build multimodal prompt
            prompt_parts = ["Based on the provided inputs, help me find the perfect restaurant or dining experience."]

            if text_query:
                prompt_parts.append(f"Text query: {text_query}")

            if audio_data:
                prompt_parts.append("Analyze the audio for additional context.")
                contents.append(types.Part.from_bytes(data=audio_data, mime_type=audio_mime_type))

            if image_data:
                prompt_parts.append("Analyze the image for visual preferences.")
                contents.append(types.Part.from_bytes(data=image_data, mime_type=image_mime_type))

            prompt_parts.append("""
            Provide a comprehensive analysis in JSON format:
            - combined_intent: what the user is looking for overall
            - cuisine_preferences: extracted cuisine types
            - dietary_requirements: any dietary needs
            - ambiance_preferences: preferred setting/ambiance
            - price_range: budget indication
            - location_hints: any location mentions
            - unified_search_query: single best search query for Yelp
            - confidence: how confident you are (0-1)
            """)

            contents.insert(0, "\n".join(prompt_parts))

            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text
            logger.info(f"Multimodal search processed successfully")

            return {
                "success": True,
                "result": result,
                "raw_response": response.text
            }

        except Exception as e:
            logger.error(f"Error in multimodal search: {str(e)}")
            raise Exception(f"Failed to process multimodal search: {str(e)}")

    async def analyze_preferences(
        self,
        text_query: str
    ) -> Dict[str, Any]:
        """
        Analyze text to extract restaurant preferences only (NO Yelp search)

        Args:
            text_query: User's text describing preferences

        Returns:
            Dictionary with extracted preferences
        """
        try:
            prompt = f"""
            Analyze this user message and extract restaurant preferences ONLY.

            User message: "{text_query}"

            Extract the following if mentioned:
            - cuisine_preferences: array of cuisine types (e.g., ["Italian", "Japanese"])
            - price_range: one of "$", "$$", "$$$", "$$$$" based on keywords like cheap/expensive/moderate
            - ambiance_preferences: dining vibe (e.g., "Casual", "Romantic", "Trendy", "Fine Dining")
            - dietary_restrictions: array of dietary needs (e.g., ["Vegetarian", "Vegan", "Gluten-Free"])
            - user_intent: brief summary of what they're looking for

            IMPORTANT: Only extract preferences that are explicitly mentioned. Don't make assumptions.
            If nothing is mentioned, return empty arrays/null values.

            Format response as JSON with these fields only.
            """

            response = self.client.models.generate_content(
                model=self.model,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = response.text
            logger.info(f"Preferences analyzed: {text_query}")

            return {
                "success": True,
                "result": result,
                "raw_response": response.text
            }

        except Exception as e:
            logger.error(f"Error analyzing preferences: {str(e)}")
            raise Exception(f"Failed to analyze preferences: {str(e)}")


    async def chat(
        self,
        user_message: str,
        session_context: str = "",
        current_preferences: dict = None
    ) -> Dict[str, Any]:
        """
        Pure conversational AI for preference-setting chat
        
        Args:
            user_message: User's chat message
            session_context: Context about the session (users, votes, etc.)
            current_preferences: Current preference settings
            
        Returns:
            Dictionary with AI response message
        """
        try:
            prefs = current_preferences or {}
            
            system_prompt = f"""You are the Group Consensus Facilitator for CommonPlate, a collaborative restaurant selection app.

YOUR MISSION:
- Help the group reach consensus on dining preferences
- Analyze voting patterns and identify where people agree/disagree
- Suggest compromises when preferences conflict
- Help resolve DISTANCE conflicts when group members are spread out
- Keep the energy fun and the conversation moving toward a decision

SESSION CONTEXT:
{session_context or 'Solo user - help them pick preferences!'}

CURRENT LOCKED PREFERENCES:
- Cuisine: {prefs.get('cuisine', 'Not decided')}
- Budget: {prefs.get('budget', 'Not decided')} (Options: $, $$, $$$, $$$$)
- Vibe: {prefs.get('vibe', 'Not decided')} (Options: Casual, Fine Dining, Trendy, Cozy, Lively, Romantic, Family-Friendly)
- Dietary: {prefs.get('dietary', 'None set')} (Options: None, Vegetarian, Vegan, Gluten-Free, Halal, Kosher)
- Distance: {prefs.get('distance', 'Not decided')} (Options: 0.5mi, 1mi, 2mi, 5mi, 10mi)

HOW TO FACILITATE CONSENSUS:
1. If voting data shows agreement: "Great news! Everyone seems to want X! Should we lock that in?"
2. If there's a split: "I see split votes between X and Y. What if we tried Z as a middle ground?"
3. If someone is undecided: Ask fun questions like "Pizza or tacos - quick, don't overthink it!"
4. Point out overlapping preferences: "Sarah and Mike both love Italian - that's 2 votes!"
5. For deadlocks, suggest creative compromises or coin-flip decisions

DISTANCE FAIRNESS:
- If users mention being far away or outside the radius, acknowledge it kindly
- Suggest increasing the distance if needed: "Since Mike is a bit further out, would everyone be okay with a 3mi radius?"
- Point out that the meeting point is calculated at the center of everyone's locations
- Frame extra travel positively: "Worth the drive for great food!"
- If one person needs to travel more, thank them for being flexible

PERSONALITY:
- Be enthusiastic and encouraging ("Ooh, great choice!")
- Use food emojis occasionally 🍕🌮🍣
- Keep messages SHORT (2-3 sentences max)
- Never recommend specific restaurants - just help decide PREFERENCES
- If everyone agrees, encourage them to lock preferences and start swiping!

User message: "{user_message}"

Respond as a helpful group facilitator (be warm, brief, and decisive):"""

            response = self.client.models.generate_content(
                model=self.model,
                contents=[system_prompt]
            )

            message = response.text.strip()
            logger.info(f"Chat response generated for: {user_message[:50]}...")

            return {
                "success": True,
                "message": message
            }

        except Exception as e:
            logger.error(f"Error in chat: {str(e)}")
            raise Exception(f"Failed to generate chat response: {str(e)}")


# Create singleton instance
gemini_service = GeminiService()
