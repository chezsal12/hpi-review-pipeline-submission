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
"translated_text": "Great headphones! Clear sound, good bass, long battery life."
}

print("Testing SummarizeLambda...\n")
result = handler(sample, None)
print(f"Summary: {result['summary_english']}")
print(f"Words: {len(result['summary_english'].split())}")
