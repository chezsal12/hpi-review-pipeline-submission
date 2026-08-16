import boto3
import json
  
translate = boto3.client('translate')
  
def handler(event, context):
    """
    Translate review from source language to English.
      
    Input event:
    {
        "review_id": "fr_001",
        "text": "review text in French...",
        "source_language": "fr",
        "product_category": "headphones",
        "true_sentiment": "positive"
    }
      
    Returns: same fields + translated_text
    """
    try:
        review_text = event['text']
        source_lang = event['source_language']
  
        # Translate to English
        response = translate.translate_text(
            Text=review_text,
            SourceLanguageCode=source_lang,
            TargetLanguageCode='en'
        )
  
        # Add translation to event
        result = {
            **event,
            'translated_text': response['TranslatedText']
        }
  
        return result
  
    except Exception as e:
        print(f"Translation error: {str(e)}")
        raise
