import json
import sys
sys.path.insert(0, '.')
from handler import handler

sample = {
"review_id": "fr_001",
"text": "Franchement top ce casque !",
"source_language": "fr",
"language": "fr",
"product_category": "headphones",
"true_sentiment": "positive",
"translated_text": "Great headphones! Clear sound, good bass, long battery life.",
"summary_english": "Positive review highlighting clear sound quality, good bass, and long battery life."
}

print("Testing LocalizeLambda...\n")
result = handler(sample, None)
print(f"English summary: {result['summary_english']}")
print(f"Localized (FR): {result['summary_localized']}")
print(f"\n✓ Localization successful!")
