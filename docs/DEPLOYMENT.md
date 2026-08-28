# Deployment Guide - HPI Review Pipeline

## Current State

The pipeline is **deployed and operational** in the HPI sandbox account
(us-east-1). It was first deployed on 2026-08-17 (Day 4) and has been
updated through 2026-08-28 (Day 9), including S3 versioning, Step Functions
error handling/retries, and CloudWatch monitoring.

Before doing anything below, understand that the infrastructure already
exists. Use the steps in "Verify the Existing Deployment" first. The
"Deploy or Redeploy" section is for redeploying after code changes or
standing the stack up in a new account — not a first-time deployment of
missing infrastructure.

### Deployed Resources

| Resource | Identifier |
|----------|------------|
| CloudFormation stack | `HpiReviewPipelineStack` |
| Step Functions state machine | `arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline` |
| Data S3 bucket | `hpi-review-pipeline-data-248062189474` |
| Access-logs S3 bucket | `hpi-review-pipeline-access-logs-248062189474` |
| Lambda functions | Translate, Summarize, Localize, QualityGate (Python 3.13) |
| CloudWatch dashboard | `hpi-review-pipeline` |
| CloudWatch alarms | `hpi-pipeline-execution-failures`, `hpi-pipeline-lambda-errors`, `hpi-pipeline-slow-execution` |
| Region | `us-east-1` |
| Account | `248062189474` (HPI sandbox) |

Lambda physical function names carry CDK-generated suffixes; retrieve the
current values from the stack rather than hardcoding them:

```bash
aws cloudformation describe-stack-resources \
  --stack-name HpiReviewPipelineStack \
  --query "StackResources[?ResourceType=='AWS::Lambda::Function'].[LogicalResourceId,PhysicalResourceId]" \
  --output table --region us-east-1
```

## Prerequisites

### AWS Account Access

- Account: 248062189474 (HPI customer account)
- Region: us-east-1
- Access method: PEP cross-account role via aws-vault

### Required Tools

- AWS CLI (v2+)
- Node.js (v18+)
- AWS CDK (v2+)
- Python 3.13+ (matches the Lambda runtime)
- Git

### Authentication Setup

```bash
# Console access
aws-vault login hpi --duration=12h

# CLI access
aws-vault exec hpi --duration=12h

# Verify access
aws sts get-caller-identity
# Should show Account: 248062189474
```

## Repository Setup

### Clone Repository

```bash
git clone https://git-codecommit.us-east-1.amazonaws.com/v1/repos/hpi-review-pipeline
cd hpi-review-pipeline
```

### Install Dependencies

```bash
# Python dependencies (Lambda functions)
pip install -r lambda/requirements.txt

# CDK / Node dependencies
npm install
```

## Project Structure

```
hpi-review-pipeline/
├── lambda/
│   ├── translate/handler.py      # Translate to English
│   ├── summarize/handler.py      # Generate summary (Claude)
│   ├── localize/handler.py       # Translate to source language
│   ├── quality-gate/handler.py   # Quality validation
│   └── shared/                   # Shared helpers (bedrock_utils, translate_utils)
├── lib/
│   └── hpi-review-pipeline-stack.ts   # CDK stack definition
├── scripts/
│   ├── generate-french-reviews.py
│   ├── generate-german-reviews.py
│   ├── package-lambdas.sh         # Copies shared/ into each function for packaging
│   └── generate-dashboard.py      # Regenerates the CloudWatch dashboard JSON
├── test-data/
│   ├── reviews-french.json (50)
│   ├── reviews-german.json (50)
│   └── all-reviews.json (100)
└── docs/
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md (this file)
    ├── OPERATIONS.md
    └── DAILY_LOG.md
```

## Verify the Existing Deployment

Run these read-only checks to confirm the deployed pipeline is healthy
before making any changes.

```bash
# 1. Confirm the stack exists and is in a good state
aws cloudformation describe-stacks --stack-name HpiReviewPipelineStack \
  --query "Stacks[0].StackStatus" --output text --region us-east-1
# Expect: CREATE_COMPLETE or UPDATE_COMPLETE

# 2. Confirm the state machine is present
aws stepfunctions describe-state-machine \
  --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline \
  --query "{name:name,status:status}" --output json --region us-east-1

# 3. Confirm the data bucket security posture
aws s3api get-bucket-versioning --bucket hpi-review-pipeline-data-248062189474
aws s3api get-public-access-block --bucket hpi-review-pipeline-data-248062189474

# 4. Smoke-test a single review end to end
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline \
  --input file://test-input.json --name verify-$(date +%s) --region us-east-1
```

## Testing Locally

### Test Individual Lambda Functions

```bash
# Run the full mocked unit-test suite (no AWS calls)
pytest lambda/ -v

# Or a single stage
cd lambda/translate && python3 test_local.py
```

### Test Amazon Translate API

```bash
cd scripts
python3 test-translate.py
```

## Deploy or Redeploy

Use these steps to redeploy after code changes, or to stand the stack up
in a new account. In the already-deployed HPI account, `cdk bootstrap` has
already been run, so start at step 2.

### 1. Bootstrap CDK (first-time per account/region only)

```bash
aws-vault exec hpi -- cdk bootstrap aws://248062189474/us-east-1
```

### 2. Package Lambda functions

```bash
# Copies lambda/shared/ into each function directory for bundling
bash scripts/package-lambdas.sh
```

### 3. Synthesize the CloudFormation template

```bash
aws-vault exec hpi -- cdk synth
```

### 4. Deploy the stack

```bash
aws-vault exec hpi -- cdk deploy
```

### 5. Verify the deployment

```bash
# List the deployed Lambda functions
aws lambda list-functions \
  --query "Functions[?contains(FunctionName, 'HpiReviewPipeline')].FunctionName" \
  --region us-east-1

# Confirm the state machine
aws stepfunctions list-state-machines \
  --query "stateMachines[?name=='hpi-review-pipeline'].stateMachineArn" \
  --output text --region us-east-1
```

## Post-Deployment Testing

### Test a Single Review Through the Pipeline

```bash
STATE_MACHINE_ARN=arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline

aws stepfunctions start-execution \
  --state-machine-arn "$STATE_MACHINE_ARN" \
  --input file://test-input.json --region us-east-1
```

### Monitor Execution

```bash
EXECUTION_ARN="<execution-arn from previous command>"

aws stepfunctions describe-execution \
  --execution-arn "$EXECUTION_ARN" --region us-east-1
```

### View CloudWatch Logs

```bash
# Resolve the physical function name first (see Deployed Resources)
aws logs tail /aws/lambda/<FUNCTION_NAME> --follow --region us-east-1
```

## Rollback Procedure

### Roll Back a Failed Update

```bash
# CloudFormation automatically rolls back a failed update. To cancel an
# in-progress update:
aws cloudformation cancel-update-stack --stack-name HpiReviewPipelineStack --region us-east-1
```

### Tear Down the Stack

```bash
aws-vault exec hpi -- cdk destroy   # removes Lambda, Step Functions, S3, IAM, logs
```

## Configuration

### Environment Variables

```bash
# Set on the Lambda functions via the CDK stack
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-5
LOG_LEVEL=INFO
QUALITY_THRESHOLD=5  # Semantic-retention pass threshold (lowered from 7 after 100-review analysis)
```

The `scripts/batch-test-pipeline.py` helper reads the state machine ARN
from the `STATE_MACHINE_ARN` environment variable (no hardcoded ARN):

```bash
export STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines \
  --query "stateMachines[?name=='hpi-review-pipeline'].stateMachineArn" \
  --output text --region us-east-1)
```

### Cost Monitoring

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-08-01,End=2026-08-31 \
  --granularity DAILY \
  --metrics BlendedCost \
  --filter file://cost-filter.json
```

## Troubleshooting

For detailed operational troubleshooting, see [OPERATIONS.md](OPERATIONS.md).

### Lambda Function Errors

Symptom: Translation fails. Check:

```bash
aws logs tail /aws/lambda/<FUNCTION_NAME> --since 10m --region us-east-1
```

Common causes:

- IAM permissions missing for `translate:TranslateText`
- Timeout (increase from 30s to 60s)
- Invalid source language code

Symptom: Bedrock InvokeModel fails. Check:

```bash
aws bedrock list-foundation-models --by-provider anthropic --region us-east-1
```

Common causes:

- Model access not granted in the Bedrock console
- Invalid model ID (use `us.anthropic.claude-sonnet-5`)
- Temperature parameter (deprecated for Sonnet 5)

### Step Functions Errors

Symptom: Execution stuck in RUNNING state. Resolution:

- Check Lambda function logs for timeouts
- Verify each Lambda has a proper IAM execution role
- Check the Step Functions definition syntax

### CDK Deployment Errors

Symptom: `cdk deploy` fails with "No stacks to deploy". Resolution:

```bash
cdk list   # Verify the stack exists
cdk synth  # Check for synthesis errors
```

Symptom: IAM permissions error during deployment. Resolution:

- Verify the PEP cross-account role has CloudFormation permissions
- Check the role trust policy allows CDK operations

## Security Best Practices

Implemented:

- No hardcoded credentials in code
- IAM roles with least privilege
- Test data is synthetic (no real PII)
- TLS 1.2+ enforced for all AWS API calls
- S3: encryption (SSE-S3), versioning, block public access, access logging

Future production hardening:

- Enable AWS CloudTrail for audit logging
- Use AWS Secrets Manager for any API keys
- Enable VPC endpoints for Lambda functions
- Implement AWS WAF if exposing via API Gateway

## Maintenance

### Update Lambda Function Code

```bash
# Make code changes, then redeploy via CDK
aws-vault exec hpi -- cdk deploy
```

### Update Test Data

```bash
cd scripts
python3 generate-french-reviews.py

git add test-data/
git commit -m "Update test reviews"
git push
```

### Monitor Costs

- Set an AWS Budget alert at a $50/month threshold
- Review Cost Explorer weekly
- Tag all resources: `Project=hpi-pipeline`, `Environment=dev`

## Support & Handoff

- Repository: https://git-codecommit.us-east-1.amazonaws.com/v1/repos/hpi-review-pipeline
- Region: us-east-1
- Account: 248062189474

Key contacts:

- Project Lead: Chezsal Robinson (chezsal@amazon.com)
- Customer: HPI (simulated)
