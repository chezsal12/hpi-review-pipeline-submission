import boto3
from botocore.config import Config
import json
  
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1',
                         config=Config(read_timeout=180))
  
prompt = """Generate 10 realistic German product reviews for consumer electronics.
  
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
      "language": "fr",
      "length_category": "medium"
   }
 ]
  
Output ONLY valid JSON, no markdown code blocks."""
  
print("Generating German reviews...")
response = bedrock.invoke_model(
    modelId='us.anthropic.claude-sonnet-5',
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 10000,
        "messages": [{"role": "user", "content": prompt}]
    })
)
  
result = json.loads(response['body'].read())
print("DEBUG - Full result:", json.dumps(result, indent=2))
content = None
for block in result['content']:
      if block['type'] == 'text':
          content = block['text']
          break


with open('../test-data/debug-content.txt', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Content length: {len(content)} characters")
print(f"First 100 chars: {content[:100]}")
print(f"Last 100 chars: {content[-100:]}")
  
reviews = json.loads(content)
  
import os
existing_reviews = []
if os.path.exists('../test-data/reviews-german.json'):
    with open('../test-data/reviews-german.json', 'r', encoding='utf-8') as f:
        existing_reviews = json.load(f)
    print(f"Found {len(existing_reviews)} existing reviews")
  
# Append new reviews with updated IDs
start_id = len(existing_reviews) + 1
for i, review in enumerate(reviews):
    review['review_id'] = f"de_{start_id + i:03d}"
  
all_reviews = existing_reviews + reviews
  
# Save combined reviews
with open('../test-data/reviews-german.json', 'w', encoding='utf-8') as f:
    json.dump(all_reviews, f, indent=2, ensure_ascii=False)
  
print(f"Generated {len(reviews)} new German reviews, total now: {len(all_reviews)}")
for r in reviews[:3]:
    print(f"  - {r['review_id']}: {r['text'][:60]}...")
