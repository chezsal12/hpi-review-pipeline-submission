"""
Shared helper for Amazon Translate calls.

Used by the translate and localize service layers so the Translate client
construction and translate_text invocation live in exactly one place
(mirrors the pattern in bedrock_utils.py).
"""
import boto3

_translate = boto3.client('translate', region_name='us-east-1')


def translate_text(text, source_language, target_language):
    """
    Translate text from source_language to target_language via Amazon
    Translate and return the translated string.

    Botocore exceptions propagate to the caller so the handler can log and
    surface a typed failure.
    """
    response = _translate.translate_text(
        Text=text,
        SourceLanguageCode=source_language,
        TargetLanguageCode=target_language,
    )
    return response['TranslatedText']
