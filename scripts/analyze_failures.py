import json

with open('../test-results/batch-test-results.json') as f:
    data = json.load(f)

# Parse all outputs
outputs = []
for e in data['executions']:
    if e['status'] == 'SUCCEEDED' and e.get('output'):
        outputs.append(json.loads(e['output']))

# Categorize failures
qc_passed = [o for o in outputs if o.get('quality_passed')]
qc_failed = [o for o in outputs if not o.get('quality_passed')]

print(f"Passed: {len(qc_passed)}")
print(f"Failed: {len(qc_failed)}\n")

# Analyze failure reasons
length_fail = [o for o in qc_failed if not o['quality_checks']['length_valid']]
sentence_fail = [o for o in qc_failed if not o['quality_checks']['sentence_count_valid']]
semantic_fail = [o for o in qc_failed if not o['quality_checks']['semantic_retention']]

print(f"Length violations: {len(length_fail)}")
print(f"Sentence count violations: {len(sentence_fail)}")
print(f"Semantic retention failures: {len(semantic_fail)}")

# Score distribution
scores = [o.get('quality_score', 0) for o in outputs]
print(f"\nScore distribution:")
for score in range(4, 10):
    count = sum(1 for s in scores if s == score)
    print(f"  Score {score}: {count}")

# Show borderline cases (score 5)
score_5 = [o for o in qc_failed if o.get('quality_score') == 5]
print(f"\n{len(score_5)} reviews scored exactly 5 (just below threshold of 6)")
print("\nSample score-5 failures:")
for o in score_5[:3]:
    print(f"\n{o['review_id']}:")
    print(f"  Original: {o['text'][:100]}...")
    print(f"  Summary: {o['summary_localized'][:100]}...")
    print(f"  Score: {o['quality_score']}/10")
