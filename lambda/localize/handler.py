import boto3

translate = boto3.client('translate')

def handler(event, context):
	summary = event['summary_english']
	target_lang = event['source_language']
	response = translate.translate_text(Text=summary, SourceLanguageCode='en', TargetLanguageCode=target_lang)
	result = event.copy()
	result['summary_localized'] = response['TranslatedText']
	return result

