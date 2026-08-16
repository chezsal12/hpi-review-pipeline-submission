import json
import sys
sys.path.insert(0, '.')
from handler import handler
  
# Load a sample review
with open('../../test-data/reviews-french.json', 'r') as f:
    reviews = json.load(f)
  
sample = reviews[0]

sample['source_language'] = sample['language']
print("Testing TranslateLambda locally...\n")
print(f"Input review_id: {sample['review_id']}")
print(f"Original (FR): {sample['text'][:100]}...\n")
  
result = handler(sample, None)
print(f"Translated (EN): {result['translated_text'][:100]}...")
print(f"\n✓ Translation successful!")
