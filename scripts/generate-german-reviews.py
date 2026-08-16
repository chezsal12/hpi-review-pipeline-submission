"""
Generate synthetic German product reviews via Amazon Bedrock (Claude) and
append them to test-data/reviews-german.json. Run from the scripts/ dir.

Shared Bedrock/file-I/O logic lives in script_utils; this file only holds
the language-specific prompt, paths, and review-ID prefix.
"""
import json
import sys

from script_utils import (
    extract_content,
    invoke_model,
    read_json_file,
    write_json_file,
    write_text_file,
)

REVIEWS_PATH = '../test-data/reviews-german.json'
DEBUG_CONTENT_PATH = '../test-data/debug-content.txt'
ID_PREFIX = 'de'

PROMPT = """Generate 10 realistic German product reviews for consumer electronics.

Products: headphones, laptops, smartphones, tablets, cameras, smartwatches

Requirements:
  - Sentiments: 4 positive, 3 negative, 2 mixed, 1 neutral
  - Lengths: 2 short (50-100 words), 5 medium (100-200 words), 2 long (200-400 words)
  - Include natural German expressions, slang, product terms
  - Add realistic complaints: battery life, sound quality, screen issues, durability
  - Include typos and colloquialisms
  - Some with emojis or special characters

Format as JSON array:
[
   {
      "review_id": "de_001",
      "text": "full review text in German...",
      "product_category": "headphones",
      "true_sentiment": "positive",
      "language": "de",
      "length_category": "medium"
   }
 ]

Output ONLY valid JSON, no markdown code blocks."""


def main():
    print("Generating German reviews...")
    result = invoke_model(PROMPT)

    content = extract_content(result)
    write_text_file(DEBUG_CONTENT_PATH, content)
    print(f"Content length: {len(content)} characters")
    print(f"First 100 chars: {content[:100]}")
    print(f"Last 100 chars: {content[-100:]}")

    try:
        reviews = json.loads(content)
    except json.JSONDecodeError as e:
        print(f"Model did not return valid JSON reviews: {e}", file=sys.stderr)
        sys.exit(1)

    existing_reviews = read_json_file(REVIEWS_PATH, default=[])
    if existing_reviews:
        print(f"Found {len(existing_reviews)} existing reviews")

    # Append new reviews with updated IDs
    start_id = len(existing_reviews) + 1
    for i, review in enumerate(reviews):
        review['review_id'] = f"{ID_PREFIX}_{start_id + i:03d}"

    all_reviews = existing_reviews + reviews
    write_json_file(REVIEWS_PATH, all_reviews)

    print(f"Generated {len(reviews)} new German reviews, total now: {len(all_reviews)}")
    for r in reviews[:3]:
        print(f"  - {r['review_id']}: {r['text'][:60]}...")


if __name__ == '__main__':
    main()
