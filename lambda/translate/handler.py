"""
TranslateLambda entry point.

Thin adapter: parses the event, delegates to the service layer, and
returns the enriched event (pass-through pattern).
"""
from translate_service import translate_review


def handler(event, context):
    """
    Translate a review from its source language to English.

    Input event requires 'text' and 'source_language'.
    Returns: the full event with a 'translated_text' field added.
    """
    try:
        review_text = event['text']
        source_lang = event['source_language']

        translated_text = translate_review(review_text, source_lang)

        return {
            **event,
            'translated_text': translated_text
        }

    except Exception as e:
        print(f"Translation error: {str(e)}")
        raise
