#!/usr/bin/env python3
"""
Generate CloudWatch dashboard JSON with current Lambda function names.
Resolves function names dynamically from CloudFormation stack.
"""
import boto3
import json
import sys

def get_lambda_functions(stack_name='HpiReviewPipelineStack'):
    """Get Lambda function names from CloudFormation stack."""
    cfn = boto3.client('cloudformation', region_name='us-east-1')

    try:
        response = cfn.describe_stack_resources(
            StackName=stack_name,
            LogicalResourceId='TranslateFn'
        )
        translate_fn = response['StackResources'][0]['PhysicalResourceId']

        response = cfn.describe_stack_resources(
            StackName=stack_name,
            LogicalResourceId='SummarizeFn'
        )
        summarize_fn = response['StackResources'][0]['PhysicalResourceId']

        response = cfn.describe_stack_resources(
            StackName=stack_name,
            LogicalResourceId='LocalizeFn'
        )
        localize_fn = response['StackResources'][0]['PhysicalResourceId']

        response = cfn.describe_stack_resources(
            StackName=stack_name,
            LogicalResourceId='QualityGateFn'
        )
        quality_gate_fn = response['StackResources'][0]['PhysicalResourceId']

        return {
            'translate': translate_fn,
            'summarize': summarize_fn,
            'localize': localize_fn,
            'quality_gate': quality_gate_fn
        }
    except Exception as e:
        print(f"Error retrieving Lambda functions: {e}", file=sys.stderr)
        sys.exit(1)

def get_state_machine_arn(stack_name='HpiReviewPipelineStack'):
    """Get Step Functions state machine ARN from CloudFormation stack."""
    cfn = boto3.client('cloudformation', region_name='us-east-1')

    try:
        response = cfn.describe_stack_resources(
            StackName=stack_name,
            LogicalResourceId='ReviewPipeline1D6B1C6F'
        )
        return response['StackResources'][0]['PhysicalResourceId']
    except Exception as e:
        print(f"Error retrieving state machine ARN: {e}", file=sys.stderr)
        sys.exit(1)

def generate_dashboard(functions, state_machine_arn):
    """Generate CloudWatch dashboard JSON."""
    return {
        "widgets": [
            {
                "type": "metric",
                "properties": {
                    "metrics": [
                        ["AWS/States", "ExecutionsFailed", "StateMachineArn", state_machine_arn, {"stat": "Sum", "label": "Failed"}],
                        ["AWS/States", "ExecutionsSucceeded", "StateMachineArn", state_machine_arn, {"stat": "Sum", "label": "Succeeded"}],
                        ["AWS/States", "ExecutionsStarted", "StateMachineArn", state_machine_arn, {"stat": "Sum", "label": "Started"}]
                    ],
                    "view": "timeSeries",
                    "stacked": False,
                    "region": "us-east-1",
                    "title": "Pipeline Executions",
                    "period": 300
                }
            },
            {
                "type": "metric",
                "properties": {
                    "metrics": [
                        ["AWS/States", "ExecutionTime", "StateMachineArn", state_machine_arn, {"stat": "Average"}]
                    ],
                    "view": "timeSeries",
                    "region": "us-east-1",
                    "title": "Average Execution Time (ms)",
                    "period": 300
                }
            },
            {
                "type": "metric",
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "Errors", "FunctionName", functions['translate'], {"stat": "Sum", "label": "Translate"}],
                        ["AWS/Lambda", "Errors", "FunctionName", functions['summarize'], {"stat": "Sum", "label": "Summarize"}],
                        ["AWS/Lambda", "Errors", "FunctionName", functions['localize'], {"stat": "Sum", "label": "Localize"}],
                        ["AWS/Lambda", "Errors", "FunctionName", functions['quality_gate'], {"stat": "Sum", "label": "QualityGate"}]
                    ],
                    "view": "timeSeries",
                    "region": "us-east-1",
                    "title": "Lambda Errors by Function",
                    "period": 300
                }
            },
            {
                "type": "metric",
                "properties": {
                    "metrics": [
                        ["AWS/Lambda", "Duration", "FunctionName", functions['translate'], {"stat": "Average", "label": "Translate"}],
                        ["AWS/Lambda", "Duration", "FunctionName", functions['summarize'], {"stat": "Average", "label": "Summarize"}],
                        ["AWS/Lambda", "Duration", "FunctionName", functions['localize'], {"stat": "Average", "label": "Localize"}],
                        ["AWS/Lambda", "Duration", "FunctionName", functions['quality_gate'], {"stat": "Average", "label": "QualityGate"}]
                    ],
                    "view": "timeSeries",
                    "region": "us-east-1",
                    "title": "Lambda Duration by Function (ms)",
                    "period": 300
                }
            }
        ]
    }

def main():
    """Generate and output dashboard JSON."""
    print("Retrieving Lambda function names from CloudFormation stack...", file=sys.stderr)
    functions = get_lambda_functions()

    print("Retrieving state machine ARN...", file=sys.stderr)
    state_machine_arn = get_state_machine_arn()

    print("Generating dashboard JSON...", file=sys.stderr)
    dashboard = generate_dashboard(functions, state_machine_arn)

    print(json.dumps(dashboard, indent=2))

if __name__ == '__main__':
    main()
