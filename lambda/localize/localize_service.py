"""
Service layer for the localize stage.

Holds the Amazon Translate client and localization business logic so the
Lambda entry point (handler.py) stays a thin adapter.
"""
import boto3

translate = boto3.client('translate', region_name='us-east-1')


def localize_summary(summary, target_language, source_language='en'):
    """
    Translate an English summary into the review's source language.

    Returns the localized string. Botocore exceptions propagate to the
    caller so the handler can log and surface a typed failure.
    """
    response = translate.translate_text(
        Text=summary,
        SourceLanguageCode=source_language,
        TargetLanguageCode=target_language
    )
    return response['TranslatedText']
