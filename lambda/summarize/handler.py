"""
SummarizeLambda entry point.

Thin adapter: parses the event, delegates summarization to the service
layer, and returns the enriched event (pass-through pattern).
"""
from summarize_service import generate_summary


def handler(event, context):
    """
    Generate a 1-2 sentence summary of a translated review.

    Input: output from TranslateLambda (must contain 'translated_text').
    Returns: the full event with a 'summary_english' field added.
    """
    try:
        translated_text = event['translated_text']
        summary = generate_summary(translated_text)

        return {
            **event,
            'summary_english': summary
        }

    except Exception as e:
        print(f"Summarization error: {str(e)}")
        raise
