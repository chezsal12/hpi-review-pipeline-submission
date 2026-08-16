import boto3
import json
  
translate = boto3.client('translate', region_name='us-east-1')
  
# Load sample reviews
with open('../test-data/reviews-french.json', 'r', encoding='utf-8') as f:
    french_reviews = json.load(f)
  
with open('../test-data/reviews-german.json', 'r', encoding='utf-8') as f:
    german_reviews = json.load(f)
  
# Test French → English
print("Testing French → English translation...")
sample_fr = french_reviews[0]
result_fr = translate.translate_text(
    Text=sample_fr['text'],
    SourceLanguageCode='fr',
    TargetLanguageCode='en'
)
  
print(f"\nOriginal (FR): {sample_fr['text'][:200]}...")
print(f"\nTranslated (EN): {result_fr['TranslatedText'][:200]}...")
  
# Test German → English 
print("\n" + "="*80)
print("Testing German → English translation...")
sample_de = german_reviews[0]
result_de = translate.translate_text(
    Text=sample_de['text'],
    SourceLanguageCode='de',
    TargetLanguageCode='en'
)
  
print(f"\nOriginal (DE): {sample_de['text'][:200]}...")
print(f"\nTranslated (EN): {result_de['TranslatedText'][:200]}...")
  
# Calculate cost estimate
total_chars = sum(len(r['text']) for r in french_reviews + german_reviews)
estimated_cost = (total_chars / 1_000_000) * 15  # $15 per million chars
  
print("\n" + "="*80)
print(f"Total characters: {total_chars:,}")
print(f"Estimated translation cost: ${estimated_cost:.4f}")
