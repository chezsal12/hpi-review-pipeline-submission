import json
  
with open('../test-data/reviews-french.json', 'r', encoding='utf-8') as f:
    french = json.load(f)
  
with open('../test-data/reviews-german.json', 'r', encoding='utf-8') as f:
    german = json.load(f)
  
combined = french + german
  
with open('../test-data/all-reviews.json', 'w', encoding='utf-8') as f:
    json.dump(combined, f, indent=2, ensure_ascii=False)
  
print(f"✅ Combined: {len(combined)} reviews")
print(f"   French: {len(french)}")
print(f"   German: {len(german)}")
