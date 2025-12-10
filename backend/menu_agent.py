"""
Menu Scraper using LangChain
Scrapes restaurant menu URLs and extracts structured menu data
Uses LangChain WebBaseLoader + Google Gemini for parsing
"""

import os
import json
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from langchain_community.document_loaders import WebBaseLoader
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage


# Initialize Gemini via LangChain
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    google_api_key=os.getenv("GEMINI_API_KEY"),
    temperature=0
)


async def scrape_menu(menu_url: str) -> dict:
    """
    Scrape a restaurant menu from the given URL using LangChain
    
    Args:
        menu_url: The URL of the restaurant's menu page
        
    Returns:
        Structured menu data with categories, items, and prices
    """
    if not menu_url:
        return {"success": False, "error": "No menu URL provided"}
    
    try:
        # Use LangChain WebBaseLoader to fetch and parse the webpage
        loader = WebBaseLoader(
            web_paths=[menu_url],
            bs_kwargs={
                "parse_only": None  # Parse everything
            }
        )
        
        # Load documents (runs synchronously, but that's fine for now)
        docs = loader.load()
        
        if not docs:
            return {"success": False, "error": "Could not load webpage"}
        
        # Get the text content
        text_content = docs[0].page_content[:8000]  # Limit to avoid token limits
        
        # Use Gemini via LangChain to parse the menu
        prompt = f"""Extract menu information from this restaurant website text and return ONLY a valid JSON object.

Website text:
{text_content}

Return this exact JSON structure (no markdown, no code blocks, ONLY the JSON):
{{
    "categories": [
        {{
            "name": "Category Name",
            "items": [
                {{
                    "name": "Dish Name",
                    "price": "$XX.XX",
                    "description": "Brief description"
                }}
            ]
        }}
    ],
    "highlights": ["Notable features like 'Farm-to-table'"],
    "price_range": "$ or $$ or $$$ or $$$$"
}}

If you cannot find menu items, return: {{"categories": [], "error": "No menu found"}}
"""
        
        # Call Gemini through LangChain
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        result_text = response.content.strip()
        
        # Clean up response - remove markdown code blocks if present
        if result_text.startswith("```"):
            lines = result_text.split("\n")
            result_text = "\n".join(lines[1:-1]) if lines[-1] == "```" else "\n".join(lines[1:])
        
        # Extract JSON from response
        start_idx = result_text.find('{')
        end_idx = result_text.rfind('}') + 1
        if start_idx != -1 and end_idx > start_idx:
            json_str = result_text[start_idx:end_idx]
            menu_data = json.loads(json_str)
            
            # Check if we actually got menu items
            categories = menu_data.get("categories", [])
            has_items = any(len(cat.get("items", [])) > 0 for cat in categories)
            
            if has_items:
                return {"success": True, "menu": menu_data}
            else:
                # Menu was parsed but no items found (JS-rendered page likely)
                return {"success": False, "error": "Menu items not found - page may use JavaScript rendering"}
        else:
            return {"success": False, "error": "Could not parse menu", "raw": result_text[:500]}
            
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"JSON parse error: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": str(e)}
