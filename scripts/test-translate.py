"""
Ad-hoc script to sanity-check Amazon Translate on the sample reviews and
print a rough translation-cost estimate. Run from the scripts/ directory.
"""
import sys

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from script_utils import read_json_file

translate = boto3.client('translate', region_name='us-east-1')

FRENCH_PATH = '../test-data/reviews-french.json'
GERMAN_PATH = '../test-data/reviews-german.json'


def translate_text(text, source_lang):
    """Translate text to English, exiting with a diagnostic on failure."""
    try:
        response = translate.translate_text(
            Text=text,
            SourceLanguageCode=source_lang,
            TargetLanguageCode='en'
        )
        return response['TranslatedText']
    except (ClientError, BotoCoreError) as e:
        print(f"Amazon Translate error ({source_lang}->en): {e}", file=sys.stderr)
        sys.exit(1)


def main():
    french_reviews = read_json_file(FRENCH_PATH, required=True)
    german_reviews = read_json_file(GERMAN_PATH, required=True)

    print("Testing French -> English translation...")
    sample_fr = french_reviews[0]
    translated_fr = translate_text(sample_fr['text'], 'fr')
    print(f"\nOriginal (FR): {sample_fr['text'][:200]}...")
    print(f"\nTranslated (EN): {translated_fr[:200]}...")

    print("\n" + "=" * 80)
    print("Testing German -> English translation...")
    sample_de = german_reviews[0]
    translated_de = translate_text(sample_de['text'], 'de')
    print(f"\nOriginal (DE): {sample_de['text'][:200]}...")
    print(f"\nTranslated (EN): {translated_de[:200]}...")

    # Rough cost estimate: Amazon Translate is $15 per million characters.
    total_chars = sum(len(r['text']) for r in french_reviews + german_reviews)
    estimated_cost = (total_chars / 1_000_000) * 15

    print("\n" + "=" * 80)
    print(f"Total characters: {total_chars:,}")
    print(f"Estimated translation cost: ${estimated_cost:.4f}")


if __name__ == '__main__':
    main()
