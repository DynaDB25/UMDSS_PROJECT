import os
import json
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

# Try to get the API key from environment
API_KEY = os.environ.get("GEMINI_API_KEY")

# Set up the Gemini client if key is available
client = None
if API_KEY:
    try:
        client = genai.Client(api_key=API_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Gemini client: {e}")


def smart_extract_from_text(text: str) -> dict:
    """
    Uses Gemini API to extract structured scholarship data from raw text.
    Returns a dict containing the parsed fields or an empty dict if the LLM fails
    or no API key is provided.
    """
    if not client:
        return {}
        
    prompt = f"""
You are an expert AI data extractor for a Ghanaian scholarship platform.
Extract the following information from the scholarship text below into a strict JSON object.

Only output valid JSON with the exact following keys. If a field is not stated in the text, return null or empty values as specified below, do NOT invent data.
- "deadline": (string) ISO format "YYYY-MM-DD" or null if not found.
- "amount": (string) Human readable amount (e.g. "Full tuition and GH₵ 5,000 stipends").
- "amount_value": (number) The total annual numeric value in GHS (Ghana Cedis). Try to convert other currencies or monthly amounts to annual GHS if stated, else return 0. If fully funded but no amount is given, return 0.
- "level_scope": (string) One of ["shs", "tertiary_entry", "tertiary_continuing", "tertiary_any", "postgraduate", "unknown"]. Default to "unknown" if not explicitly stated.
- "region": (array of strings) Any Ghanaian regions restricting eligibility. If nationwide, return ["All"].
- "programmes": (array of strings) Specific degree programmes required. If any/all, return ["All"].
- "need_based": (boolean) true if the text mentions financial need/needy students, else false.
- "slots": (number) Number of awards available. Return 0 if not stated.
- "max_aggregate": (number) The maximum WASSCE aggregate score required, e.g. 15. If not stated, return 36.
- "benefits": (array of strings) specific benefits listed (e.g. "Laptop", "Tuition").
- "documents": (array of strings) required documents (e.g. "CV", "Transcript").
- "summary": (string) A concise 2-3 sentence description of the scholarship.

Text to parse:
---
{text[:8000]}
---
"""
    try:
        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,
            ),
        )
        if response.text:
            raw_text = response.text.strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text[7:]
            elif raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]
            
            parsed = json.loads(raw_text.strip())
            
            # Post-process nulls to expected blanks
            out = {}
            if parsed.get('deadline'):
                out['deadline'] = parsed['deadline']
            if parsed.get('amount'):
                out['amount'] = parsed['amount']
            if parsed.get('amount_value') is not None:
                out['amount_value'] = parsed['amount_value']
            if parsed.get('level_scope'):
                out['level_scope'] = parsed['level_scope']
            if parsed.get('region'):
                out['region'] = parsed['region']
            if parsed.get('programmes'):
                out['programmes'] = parsed['programmes']
            if parsed.get('need_based') is not None:
                out['need_based'] = parsed['need_based']
            if parsed.get('slots'):
                out['slots'] = parsed['slots']
            if parsed.get('max_aggregate'):
                out['max_aggregate'] = parsed['max_aggregate']
            if parsed.get('benefits'):
                out['benefits'] = parsed['benefits']
            if parsed.get('documents'):
                out['documents'] = parsed['documents']
            if parsed.get('summary'):
                out['summary'] = parsed['summary']
            
            return out
    except Exception as e:
        logger.error(f"Gemini API extraction failed: {e}")
        
    return {}
