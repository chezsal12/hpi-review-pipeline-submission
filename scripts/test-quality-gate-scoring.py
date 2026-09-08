#!/usr/bin/env python3
# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Test the quality gate semantic scoring with a sample review.
This will show us what score Claude actually returns.
"""
import sys

# Add lambda directory to path
sys.path.insert(0, '../lambda/quality-gate')

from quality_gate_service import evaluate_semantic_retention

# Sample from fr_001 (from batch test results)
sample_event = {
    "review_id": "fr_001",
    "text": "Franchement top ce casque ! Le son est hyper clair, les basses sont bien présentes sans être too much. Je l'utilise tous les jours dans le métro et ça isole bien du bruit extérieur. Autonomie au top, easy 25h sans recharger. Je recommande à 200% 🎧👍",
    "product_category": "headphones",
    "true_sentiment": "positive",
    "language": "fr",
    "source_language": "fr",
    "translated_text": "This helmet is really great! The sound is super clear, the bass is present without being too much. I use it every day on the subway and it isolates well from outside noise. Maximum autonomy, easy 25 hours without recharging. I recommend 200% 🎧👍",
    "summary_english": "Positive review highlighting clear sound quality, balanced bass, effective noise isolation for commuting, and long battery life (25 hours). The reviewer's satisfaction stems from strong audio performance and extended usage time without recharging.",
    "summary_localized": "Évaluation positive mettant en évidence une qualité sonore claire, des basses équilibrées, une isolation phonique efficace pour les trajets domicile-travail et une longue autonomie de la batterie (25 heures). La satisfaction de l'utilisateur provient de ses excellentes performances audio et de sa durée d'utilisation prolongée sans recharge."
}

print("Testing quality gate semantic scoring...")
print("=" * 80)
print(f"\nReview ID: {sample_event['review_id']}")
print(f"Language: {sample_event['source_language']}")
print(f"\nOriginal text (first 100 chars):")
print(sample_event['text'][:100] + "...")
print(f"\nEnglish summary:")
print(sample_event['summary_english'])
print(f"\nLocalized summary:")
print(sample_event['summary_localized'])

print("\n" + "=" * 80)
print("Calling evaluate_semantic_retention()...")
print("=" * 80)

score = evaluate_semantic_retention(sample_event)

print(f"\n*** SCORE: {score}/10 ***")
print(f"\nThreshold: 7/10")
print(f"Result: {'PASS ✅' if score >= 7 else 'FAIL ❌'}")

if score == 5:
    print("\n⚠️  WARNING: Score is exactly 5 (the default fallback)")
    print("This suggests an error occurred during scoring.")
    print("Check the console output above for error messages.")
