"""
Service layer for the translate stage.

Holds the Amazon Translate client and translation business logic so the
Lambda entry point (handler.py) stays a thin adapter.
"""
import boto3

translate = boto3.client('translate', region_name='us-east-1')


def translate_review(text, source_language, target_language='en'):
    """
    Translate review text into the target language (English by default).

    Returns the translated string. Botocore exceptions propagate to the
    caller so the handler can log and surface a typed failure.
    """
    response = translate.translate_text(
        Text=text,
        SourceLanguageCode=source_language,
        TargetLanguageCode=target_language
    )
    return response['TranslatedText']
