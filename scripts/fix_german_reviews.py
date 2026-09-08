# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json
  
with open('../test-data/reviews-german.json', 'r', encoding='utf-8') as f:
    reviews = json.load(f)
  
# Add missing 'language' field to all reviews
for review in reviews:
    if 'language' not in review:
        review['language'] = 'de'
  
with open('../test-data/reviews-german.json', 'w', encoding='utf-8') as f:
    json.dump(reviews, f, indent=2, ensure_ascii=False)
  
print(f"Fixed {sum(1 for r in reviews if r['language'] == 'de')} German reviews")

