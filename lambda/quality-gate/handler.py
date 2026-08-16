"""
QualityGateLambda entry point.

Thin adapter: parses the event, delegates the rule-based and semantic
quality checks to the service layer, and returns the enriched event.
"""
from quality_gate_service import (
    SEMANTIC_PASS_THRESHOLD,
    evaluate_semantic_retention,
    run_rule_based_checks,
)


def handler(event, context):
    """
    Evaluate the quality of a localized summary.

    Adds 'quality_checks', 'quality_score', 'quality_passed', 'word_count',
    and 'sentence_count' to the event.
    """
    try:
        summary = event['summary_localized']

        checks, word_count, sentence_count = run_rule_based_checks(summary)

        semantic_score = evaluate_semantic_retention(event)
        checks['semantic_retention'] = semantic_score >= SEMANTIC_PASS_THRESHOLD

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
