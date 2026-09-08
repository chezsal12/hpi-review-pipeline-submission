#!/usr/bin/env python3
# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Batch test the HPI Review Pipeline with multiple reviews.
Executes reviews through Step Functions and collects metrics.
"""
import boto3
import json
import os
import time
from datetime import datetime

# Configuration
# State machine ARN must be supplied via environment so no account-specific
# identifier is hardcoded in this script. Resolve it at deploy time, e.g.:
#   export STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines \
#     --query "stateMachines[?name=='hpi-review-pipeline'].stateMachineArn" \
#     --output text)
STATE_MACHINE_ARN = os.environ.get('STATE_MACHINE_ARN')
if not STATE_MACHINE_ARN:
    raise SystemExit(
        'STATE_MACHINE_ARN environment variable is required. '
        'Set it to the hpi-review-pipeline state machine ARN before running.'
    )

sfn = boto3.client('stepfunctions', region_name='us-east-1')
  
def load_test_reviews():
    """Load sample reviews from test data."""
    with open('../test-data/reviews-french.json', 'r', encoding='utf-8') as f:
        french = json.load(f)
    with open('../test-data/reviews-german.json', 'r', encoding='utf-8') as f:
        german = json.load(f)
  
    # Select first 5 of each
    return french + german
  
def execute_review(review):
    """Execute a single review through the pipeline."""
    try:
        # Transform review to match Lambda expectations
        review_input = {
            **review,
            'source_language': review['language']  # Lambda expects 'source_language', not 'language'
        }

        response = sfn.start_execution(
            stateMachineArn=STATE_MACHINE_ARN,
            input=json.dumps(review_input)
        )
        return {
            'review_id': review['review_id'],
            'execution_arn': response['executionArn'],
            'start_time': datetime.now().isoformat(),
            'status': 'RUNNING'
        }
    except Exception as e:
        return {
            'review_id': review['review_id'],
            'error': str(e),
            'status': 'FAILED_TO_START'
        }
  
def check_execution(execution_arn):
    """Check status of a pipeline execution."""
    try:
        response = sfn.describe_execution(executionArn=execution_arn)
        return {
            'status': response['status'],
            'output': response.get('output'),
            'error': response.get('error'),
            'cause': response.get('cause')
        }
    except Exception as e:
        return {'status': 'ERROR', 'error': str(e)}
  
def main():
    print("=" * 80)
    print("HPI Review Pipeline - Batch Test")
    print("=" * 80)
  
    # Load reviews
    print("\n1. Loading test reviews...")
    reviews = load_test_reviews()
    print(f"   Loaded {len(reviews)} reviews ({sum(1 for r in reviews if r['language']=='fr')} FR, {sum(1 for r in reviews if r['language']=='de')} DE)")
  
    # Start executions
    print("\n2. Starting pipeline executions...")
    executions = []
    for review in reviews:
        result = execute_review(review)
        executions.append(result)
        print(f"   {result['review_id']}: {result['status']}")
        time.sleep(0.5)  # Avoid throttling
  
    # Wait for completion
    print("\n3. Waiting for executions to complete...")
    print("   (This takes ~5-10 seconds per review)")
  
    completed = 0
    while completed < len(executions):
        time.sleep(5)
        for execution in executions:
            if execution['status'] == 'RUNNING':
                status = check_execution(execution['execution_arn'])
                if status['status'] in ['SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED']:
                    execution['status'] = status['status']
                    execution['output'] = status.get('output')
                    execution['error'] = status.get('error')
                    completed += 1
                    print(f"   {execution['review_id']}: {execution['status']}")
  
    # Save results
    results_file = '../test-results/batch-test-results.json'
    with open(results_file, 'w', encoding='utf-8') as f:
        json.dump({
            'timestamp': datetime.now().isoformat(),
            'total_reviews': len(executions),
            'executions': executions
        }, f, indent=2)
  
    # Summary
    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    succeeded = sum(1 for e in executions if e['status'] == 'SUCCEEDED')
    failed = sum(1 for e in executions if e['status'] != 'SUCCEEDED')
    print(f"Total: {len(executions)}")
    print(f"Succeeded: {succeeded}")
    print(f"Failed: {failed}")
    print(f"\nResults saved to: {results_file}")
  
if __name__ == '__main__':
    main()
