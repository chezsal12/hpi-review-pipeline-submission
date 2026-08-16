import boto3
import json
  
bedrock = boto3.client('bedrock-runtime', region_name='us-east-1')
  
def handler(event, context):
    """
    Generate 1-2 sentence summary of translated review using Claude.
      
    Input: output from TranslateLambda
    Returns: adds 'summary_english' field
    """
    try:
        translated_text = event['translated_text']
  
        prompt = f"""You are a product review summarizer for e-commerce PDPs.
  
Review: {translated_text}
  
Generate a concise 1-2 sentence summary that captures:
1. Overall sentiment (positive/negative/mixed)
2. Key product aspects mentioned (e.g., battery, sound quality, build)
3. Main reason for the rating
  
Requirements:
- Exactly 1-2 sentences
- 15-50 words total
- Factual and specific
- No promotional language
- Clear sentiment indicator
  
Summary:"""
  
        response = bedrock.invoke_model(
            modelId='us.anthropic.claude-sonnet-5',
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 150,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }],
            })
        ) 
  
        result_body = json.loads(response['body'].read())
  
        # Find text content (skip thinking blocks)
        summary = None
        for block in result_body['content']:
            if block['type'] == 'text':
                summary = block['text'].strip()
                break
  
        # Add summary to event
        return {
            **event,
            'summary_english': summary
        }
  
    except Exception as e:
        print(f"Summarization error: {str(e)}")
        raise

