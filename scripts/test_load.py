# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
with open('../test-data/reviews-french.json', 'r', encoding='utf-8') as f:
    french = json.load(f)
with open('../test-data/reviews-german.json', 'r', encoding='utf-8') as f:
    german = json.load(f)
reviews = french + german
print('Total:', len(reviews))
print('First review has language?', 'language' in reviews[0])
print('Last review has language?', 'language' in reviews[-1])
missing = [i for i, r in enumerate(reviews) if 'language' not in r]
print('Missing language at indices:', missing)
if missing:
    for idx in missing[:3]:
        print(f'Review {idx} keys:', list(reviews[idx].keys()))
