# Deployment Guide - HPI Review Pipeline
  
  ## Prerequisites 
  
  ### AWS Account Access
  - Account: 248062189474 (HPI customer account)
  - Region: us-east-1
  - Access method: PEP cross-account role via aws-vault
  
  ### Required Tools
  - AWS CLI (v2+)
  - Node.js (v18+)
  - AWS CDK (v2+)
  - Python 3.11+
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
  pip install boto3
  
  # CDK dependencies (when CDK code is added)
  npm install
  ```
  
  ## Project Structure
  ```
  
  hpi-review-pipeline/
  ├── lambda/
  │   ├── translate/handler.py      # Translate to English
  │   ├── summarize/handler.py      # Generate summary (Claude)
  │   ├── localize/handler.py       # Translate to source language
  │   └── quality-gate/handler.py   # Quality validation
  ├── scripts/
  │   ├── generate-french-reviews.py
  │   ├── generate-german-reviews.py
  │   └── test-translate.py
  ├── test-data/
  │   ├── reviews-french.json (50)
  │   ├── reviews-german.json (50)
  │   └── all-reviews.json (100)
  └── docs/
      ├── ARCHITECTURE.md
      ├── DEPLOYMENT.md (this file)
      └── DAILY_LOG.md
  ```
  
  ## Current State (Day 2)
  
  ✅ Completed:
  - CodeCommit repository created
  - 100 synthetic test reviews generated
  - 4 Lambda function handlers written
  - Local testing successful
  - Amazon Translate validated
  
  ❌ Not Yet Deployed:
  - CDK infrastructure (Day 3)
  - Lambda functions to AWS
  - Step Functions state machine
  - S3 buckets, IAM roles
  
## Testing Locally
  
### Test Individual Lambda Functions
  
**TranslateLambda:**
```bash
  cd lambda/translate
  python3 test_local.py
  
  SummarizeLambda:
  cd lambda/summarize
  python3 test_local.py
  
  LocalizeLambda:
  cd lambda/localize
  python3 test_local.py
  
```

### Test Amazon Translate API
```bash
  
  cd scripts
  python3 test-translate.py
  
```

## Deployment Steps (Planned - Day 3+)
  
### 1. Bootstrap CDK (First-Time Only)
```bash
  
  aws-vault exec hpi -- cdk bootstrap aws://248062189474/us-east-1
  
```

### 2. Synthesize CloudFormation Template
```bash
  
  aws-vault exec hpi -- cdk synth
  
```

### 3. Deploy Stack
```bash
  
  aws-vault exec hpi -- cdk deploy
  
```

### 4. Verify Deployment
```bash
  
  # List Lambda functions
  aws lambda list-functions --query 'Functions[?contains(FunctionName, `hpi`)].FunctionName'
  
  # List Step Functions state machines
  aws stepfunctions list-state-machines --query 'stateMachines[?contains(name, `hpi`)].name'
  
```

## Post-Deployment Testing
  
### Test Single Review Through Pipeline
```bash
  
  # Get state machine ARN
  STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines \
    --query 'stateMachines[0].stateMachineArn' \
    --output text)
  
  # Execute with sample French review
  aws stepfunctions start-execution \
    --state-machine-arn $STATE_MACHINE_ARN \
    --input file://test-data/sample-input.json
  
```

### Monitor Execution
```bash
  
  # Get execution ARN from previous command output
  EXECUTION_ARN="<execution-arn>"
  
  # Check status
  aws stepfunctions describe-execution \
    --execution-arn $EXECUTION_ARN
  
```

### View CloudWatch Logs
```bash
  
  # Lambda logs
  aws logs tail /aws/lambda/hpi-translate --follow
  
  # Step Functions logs
  aws logs tail /aws/stepfunctions/hpi-pipeline --follow
  
```

## Rollback Procedure
  
### Rollback Deployment
```bash
  
  aws-vault exec hpi -- cdk destroy
  
```

### Rollback to Previous Version
```bash
  
  # List CloudFormation stacks
  aws cloudformation list-stacks
  
  # Rollback specific stack
  aws cloudformation cancel-update-stack --stack-name HpiReviewPipelineStack
  
```

## Configuration
  
### Environment Variables (Future)
```bash
  
  # Lambda environment variables set via CDK
  BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-5
  LOG_LEVEL=INFO
  QUALITY_THRESHOLD=5  # Lowered from 7 based on 100-review analysis
  
```

### Cost Monitoring
```bash
  
  # Enable cost allocation tags
  aws ce get-cost-and-usage \
    --time-period Start=2026-08-01,End=2026-08-31 \
    --granularity DAILY \
    --metrics BlendedCost \
    --filter file://cost-filter.json
  
```

## Troubleshooting
  
### Lambda Function Errors
  
  Symptom: Translation fails
  Check:
  aws logs tail /aws/lambda/hpi-translate --since 10m
  Common causes:
  - IAM permissions missing for translate:TranslateText
  - Timeout (increase from 30s to 60s)
  - Invalid source language code
  
  Symptom: Bedrock InvokeModel fails
  Check:
  aws bedrock list-foundation-models --by-provider anthropic
  Common causes:
  - Model access not granted in Bedrock console
  - Invalid model ID (use us.anthropic.claude-sonnet-5)
  - Temperature parameter (deprecated for Sonnet 5)
  
### Step Functions Errors
  
  Symptom: Execution stuck in RUNNING state
  Resolution:
  - Check Lambda function logs for timeouts
  - Verify each Lambda has proper IAM execution role
  - Check Step Functions definition syntax
  
### CDK Deployment Errors
  
  Symptom: cdk deploy fails with "No stacks to deploy"
  Resolution:
  cdk list  # Verify stack exists
  cdk synth  # Check for synthesis errors
  
  Symptom: IAM permissions error during deployment
  Resolution:
  - Verify PEP cross-account role has CloudFormation permissions
  - Check role trust policy allows CDK operations
  
## Security Best Practices
  
  ✅ Implemented:
  - No hardcoded credentials in code
  - IAM roles with least-privilege
  - Test data is synthetic (no real PII)
  - TLS 1.2+ for all AWS API calls
  
  ⚠️  Future Production:
  - Enable AWS CloudTrail for audit logging
  - Use AWS Secrets Manager for any API keys
  - Enable VPC endpoints for Lambda functions
  - Implement AWS WAF if exposing via API Gateway
  
## Maintenance
  
### Update Lambda Function Code
```bash
  
  # Make code changes
  nano lambda/translate/handler.py
  
  # Deploy update via CDK
  aws-vault exec hpi -- cdk deploy
  
```

### Update Test Data
```bash
  
  # Regenerate reviews
  cd scripts
  python3 generate-french-reviews.py
  
  # Commit changes
  git add test-data/
  git commit -m "Update test reviews"
  git push
  
```

### Monitor Costs
  
  - Set up AWS Budget alert at $50/month threshold
  - Review Cost Explorer weekly
  - Tag all resources: Project=hpi-pipeline, Environment=dev
  
## Support & Handoff
  
  Repository: https://git-codecommit.us-east-1.amazonaws.com/v1/repos/hpi-review-pipeline
  Region: us-east-1
  Account: 248062189474
  
  Key Contacts:
  - Project Lead: Chezsal Robinson (chezsal@amazon.com)
  - Customer: HPI (simulated)
  
## Next Steps
  
  1. Complete CDK infrastructure (Day 3)
  2. Deploy and test end-to-end pipeline (Days 3-4)
  3. Run full 100-review batch test (Week 2)
  4. Security scan and Holmes evaluation (Week 3)
  5. Final documentation and handoff (Week 3)
