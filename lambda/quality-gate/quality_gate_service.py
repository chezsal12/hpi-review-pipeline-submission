"""
Service layer for the quality-gate stage.

Holds the rule-based quality checks and the LLM semantic-retention scoring
so the Lambda entry point (handler.py) stays a thin adapter. Bedrock
response parsing is delegated to the shared bedrock_utils helper.
"""
import json
import os
import re
import sys

import boto3

# Make the shared helpers importable both locally and when packaged
# alongside this function.
_SHARED = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'shared')
if _SHARED not in sys.path:
    sys.path.insert(0, _SHARED)

from bedrock_utils import extract_text_block  # noqa: E402

bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')

MODEL_ID = 'us.anthropic.claude-sonnet-5'
MIN_WORDS = 15
MAX_WORDS = 50
MIN_SENTENCES = 1
MAX_SENTENCES = 2
SEMANTIC_PASS_THRESHOLD = 7
DEFAULT_SCORE = 5


def run_rule_based_checks(summary):
    """
    Run the rule-based quality checks on a localized summary.

    Returns: (checks_dict, word_count, sentence_count)
    """
    sentence_count = len(re.split(r'[.!?]+', summary.strip())) - 1
    word_count = len(summary.split())

    checks = {
        'sentence_count_valid': MIN_SENTENCES <= sentence_count <= MAX_SENTENCES,
        'length_valid': MIN_WORDS <= word_count <= MAX_WORDS,
        'no_truncation': not summary.endswith('...'),
    }
    return checks, word_count, sentence_count


def build_semantic_prompt(event):
    """Construct the semantic-retention scoring prompt."""
    return f"""Evaluate the quality of this review summary translation.

Original Review ({event['source_language']}):
{event['text'][:500]}...

English Summary:
{event['summary_english']}

Localized Summary ({event['source_language']}):
{event['summary_localized']}

Rate the semantic retention on a scale of 1-10:
- Does the localized summary accurately convey the original review's sentiment?
- Are key product aspects preserved?
- Is the translation natural and readable?

Respond with ONLY a single number 1-10, no explanation."""


def evaluate_semantic_retention(event):
    """
    Use Claude to score semantic accuracy of the translation chain.

    Returns a score in the 1-10 range. Falls back to DEFAULT_SCORE (5) on
    any error or unparseable response rather than failing the pipeline.
    """
    prompt = build_semantic_prompt(event)

    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0
            })
        )

        result = json.loads(response['body'].read())
        score_text = extract_text_block(result)

        if score_text is None:
            print("Semantic evaluation error: no text block in model response")
            return DEFAULT_SCORE

        match = re.search(r'\d+', score_text)
        if match is None:
            print(f"Semantic evaluation error: no numeric score found in {score_text!r}")
            return DEFAULT_SCORE

        return max(1, min(int(match.group()), 10))

    except Exception as e:
        print(f"Semantic evaluation error: {str(e)}")
        return DEFAULT_SCORE
