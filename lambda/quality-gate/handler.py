import boto3
import json
import re 
  
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
  
def handler(event, context):
    """
    Evaluate quality of localized summary.
      
    Checks:
    1. Sentence count (1-2)
    2. Length (15-50 words)
    3. No truncation markers
    4. Semantic retention via LLM
      
    Returns: adds 'quality_checks' and 'quality_passed' fields
    """
    try:
        summary = event['summary_localized']
  
        # Rule-based checks
        sentence_count = len(re.split(r'[.!?]+', summary.strip())) - 1
        word_count = len(summary.split())
  
        checks = {
            'sentence_count_valid': 1 <= sentence_count <= 2,
            'length_valid': 15 <= word_count <= 50,
            'no_truncation': not summary.endswith('...'),
        }
  
        # LLM semantic check
        semantic_score = evaluate_semantic_retention(event)
        checks['semantic_retention'] = semantic_score >= 7
  
        # Overall pass/fail
        quality_passed = all(checks.values())
  
        return {
            **event,
            'quality_checks': checks,
            'quality_score': semantic_score,
            'quality_passed': quality_passed,
            'word_count': word_count,
            'sentence_count': sentence_count
        }
  
    except Exception as e:
        print(f"Quality gate error: {str(e)}")
        raise
  
  
def evaluate_semantic_retention(event):
    """
    Use Claude to score semantic accuracy of translation chain.
      
    Returns: score 1-10
    """
    prompt = f"""Evaluate the quality of this review summary translation.
  
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
  
    try:
        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-sonnet-5',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 10,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0
            })
        )
  
        result = json.loads(response['body'].read())
  
        # Find text content
        score_text = None
        for block in result['content']:
            if block['type'] == 'text':
                score_text = block['text'].strip()
                break
           score = int(re.search(r'\d+', score_text).group())
  
        return score
  
    except Exception as e:
        print(f"Semantic evaluation error: {str(e)}")
        return 5  # Default to middle score on error
