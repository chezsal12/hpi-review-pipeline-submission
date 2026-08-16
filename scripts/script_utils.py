"""
Shared helpers for the data-generation / test scripts.

Consolidates the Amazon Bedrock invocation, response parsing, and JSON/text
file I/O that the generator scripts previously duplicated, so this logic
lives in exactly one place. Bedrock response text extraction delegates to
the shared lambda/shared/bedrock_utils helper.
"""
import json
import os
import sys

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

# Make the Lambda shared helpers importable from the scripts directory.
_SHARED = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lambda', 'shared')
if _SHARED not in sys.path:
    sys.path.insert(0, _SHARED)

from bedrock_utils import extract_text_block  # noqa: E402

MODEL_ID = 'us.anthropic.claude-sonnet-5'

bedrock = boto3.client(
    'bedrock-runtime',
    region_name='us-east-1',
    config=Config(read_timeout=180),
)


def invoke_model(prompt, max_tokens=10000):
    """Call Bedrock with a single user prompt and return the parsed body.

    Exits with a diagnostic on client/service errors or malformed JSON.
    """
    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        return json.loads(response['body'].read())
    except (ClientError, BotoCoreError) as e:
        print(f"Amazon Bedrock invocation failed: {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Failed to parse Bedrock response envelope as JSON: {e}", file=sys.stderr)
        sys.exit(1)


def extract_content(result):
    """Extract the first text block from a model response, exiting if none."""
    content = extract_text_block(result)
    if content is None:
        print("Model response contained no text block.", file=sys.stderr)
        sys.exit(1)
    return content


def read_json_file(path, default=None, required=False):
    """Read a JSON file.

    Returns `default` if the file is absent and `required` is False;
    exits with a diagnostic if the file is required-but-missing or unreadable.
    """
    if not os.path.exists(path):
        if required:
            print(f"Required file not found: {path}", file=sys.stderr)
            sys.exit(1)
        return default
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"Error reading {path}: {e}", file=sys.stderr)
        sys.exit(1)


def write_json_file(path, obj):
    """Write an object as pretty UTF-8 JSON, exiting with a diagnostic on error."""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(obj, f, indent=2, ensure_ascii=False)
    except OSError as e:
        print(f"Error writing {path}: {e}", file=sys.stderr)
        sys.exit(1)


def write_text_file(path, text):
    """Write text to a UTF-8 file, exiting with a diagnostic on error."""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
    except OSError as e:
        print(f"Error writing {path}: {e}", file=sys.stderr)
        sys.exit(1)
