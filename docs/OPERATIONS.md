  # HPI Review Pipeline - Operations Runbook

  **Version:** 1.0
  **Last Updated:** 2026-08-28
  **Owner:** Chezsal Robinson

  ---

  ## Overview

  This runbook covers operational procedures for monitoring, troubleshooting, and maintaining the HPI Review Pipeline in production.

  **Pipeline Components:**
  - 4 Lambda functions (Translate, Summarize, Localize, QualityGate)
  - Step Functions state machine (hpi-review-pipeline)
  - 2 S3 buckets (data, access logs)
  - CloudWatch dashboard and alarms

  **Account:** 248062189474
  **Region:** us-east-1

  ---
  
  ## Monitoring

  ### CloudWatch Dashboard

  **Location:** CloudWatch Console → Dashboards → `hpi-review-pipeline`

  **Widgets:**
  1. **Pipeline Executions** - Shows started/succeeded/failed executions over time
  2. **Average Execution Time** - Tracks pipeline latency
  3. **Lambda Errors by Function** - Error count per Lambda
  4. **Lambda Duration by Function** - Performance per Lambda

  **Normal Behavior:**
  - Execution success rate: 100%
  - Quality gate pass rate: ~89%
  - Average execution time: 5-10 seconds per review
  - Lambda errors: 0 per period

  ### CloudWatch Alarms

  | Alarm Name | Threshold | Action |
  |------------|-----------|--------|
  | `hpi-pipeline-execution-failures` | ≥1 failure in 5 min | Investigate Step Functions execution |
  | `hpi-pipeline-lambda-errors` | ≥5 errors in 5 min | Check Lambda logs for error patterns |
  | `hpi-pipeline-slow-execution` | >15 seconds avg for 10 min | Check service quotas and latency |

  **Alarm States:**
  - **OK** - System operating normally
  - **ALARM** - Threshold breached, requires investigation
  - **INSUFFICIENT_DATA** - No executions in period (normal if no traffic)

  ---

  ## Troubleshooting

  ### Scenario 1: Pipeline Execution Failures

  **Symptoms:**
  - Step Functions execution status: FAILED
  - Alarm: `hpi-pipeline-execution-failures` triggered

  **Investigation Steps:**

  1. **Find the failed execution:**
     ```bash
     aws stepfunctions list-executions \
       --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline \
       --status-filter FAILED \
       --max-results 10

  2. Get execution details:
  aws stepfunctions describe-execution \
    --execution-arn <EXECUTION_ARN>
  3. Check execution history:
  aws stepfunctions get-execution-history \
    --execution-arn <EXECUTION_ARN> \
    --reverse-order

  Common Causes:

  ┌─────────────────────────┬───────────────────────────────────┬──────────────────────────────────────────────┐
  │          Error          │               Cause               │                  Resolution                  │
  ├─────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
  │ Lambda.ServiceException │ AWS service issue                 │ Retry execution (handled automatically)      │
  ├─────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
  │ States.TaskFailed       │ Lambda function error             │ Check Lambda logs (see Scenario 2)           │
  ├─────────────────────────┼───────────────────────────────────┼──────────────────────────────────────────────┤
  │ States.Timeout          │ Execution exceeded 5-minute limit │ Check for stuck Lambda or service throttling │
  └─────────────────────────┴───────────────────────────────────┴──────────────────────────────────────────────┘

  Scenario 2: Lambda Function Errors

  Symptoms:
  - Alarm: hpi-pipeline-lambda-errors triggered
  - Dashboard shows errors on specific Lambda

  Investigation Steps:

  1. Find the failing function:
    - Check dashboard widget "Lambda Errors by Function"
    - Identify which function (Translate/Summarize/Localize/QualityGate) has errors
  2. Check CloudWatch Logs:
  # Replace FUNCTION_NAME with actual name from stack-resources.json
  aws logs tail /aws/lambda/<FUNCTION_NAME> --follow
  3. Search for error patterns:
  aws logs filter-log-events \
    --log-group-name /aws/lambda/<FUNCTION_NAME> \
    --filter-pattern "ERROR" \
    --start-time $(date -u -d '1 hour ago' +%s)000

  Common Lambda Errors:

  ┌───────────────┬──────────────────────────────────┬──────────────────────────────┬──────────────────────────────────┐
  │   Function    │              Error               │            Cause             │            Resolution            │
  ├───────────────┼──────────────────────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ TranslateFn   │ TranslateTextException           │ Invalid language code        │ Validate input language field    │
  ├───────────────┼──────────────────────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ SummarizeFn   │ ValidationException              │ Invalid Bedrock model params │ Check temperature/token limits   │
  ├───────────────┼──────────────────────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ LocalizeFn    │ UnsupportedLanguagePairException │ Language not supported       │ Add language validation in input │
  ├───────────────┼──────────────────────────────────┼──────────────────────────────┼──────────────────────────────────┤
  │ QualityGateFn │ KeyError                         │ Missing field in payload     │ Check upstream function output   │
  └───────────────┴──────────────────────────────────┴──────────────────────────────┴──────────────────────────────────┘

  Scenario 3: Quality Gate Low Pass Rate

  Symptoms:
  - Quality gate pass rate drops below 80%
  - Many executions succeed but summaries rejected

  Investigation Steps:

  1. Run batch test to analyze patterns:
  cd ~/hpi-review-pipeline
  python3 scripts/batch_test_runner.py --reviews test-data/reviews.json --count 20
  2. Check quality scores distribution:
  aws s3 cp s3://hpi-review-pipeline-data-248062189474/ . --recursive --exclude "*" --include "*quality*"
  # Analyze quality_score field distribution
  3. Review summary examples:
    - Look at summaries with scores 4-6 (borderline)
    - Check if legitimate quality issues or threshold problem

  Potential Causes:
  - Input reviews have poor quality (typos, incomplete)
  - Bedrock model prompt needs tuning
  - Quality gate threshold too strict (current: ≥5/10)

  Resolution:
  - If scores 4-5 are acceptable quality: Lower threshold to 4
  - If summaries genuinely poor: Adjust summarization prompt 
  - If input quality issue: Add upstream validation

  Scenario 4: Slow Execution Times

  Symptoms:
  - Alarm: hpi-pipeline-slow-execution triggered
  - Dashboard shows execution time >15 seconds

  Investigation Steps:

  1. Check individual Lambda durations:
    - Review dashboard "Lambda Duration by Function"
    - Identify which function is slow
  2. Check service quotas:
  # Amazon Translate
  aws service-quotas get-service-quota \
    --service-code translate \
    --quota-code L-1BCFB049

  # Amazon Bedrock
  aws service-quotas get-service-quota \
    --service-code bedrock \
    --quota-code L-B1226337
  3. Check for throttling:
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Throttles \
    --dimensions Name=FunctionName,Value=<FUNCTION_NAME> \
    --start-time $(date -u -d '1 hour ago' --iso-8601) \
    --end-time $(date -u --iso-8601) \
    --period 300 \
    --statistics Sum

  Common Causes:
  - Amazon Translate/Bedrock throttling (rate limits)
  - Lambda cold start (first execution after idle)
  - Large review text (>1000 words)

  Resolution:
  - If throttling: Request quota increase or add exponential backoff
  - If cold start: Provision Lambda with reserved concurrency
  - If large text: Add input validation to reject oversized reviews

  ---
  Maintenance Procedures

  Updating Lambda Functions

  Prerequisites:
  - Code changes tested locally with pytest
  - Holmes scan passed (0 HIGH findings)

  Deployment Steps:

  1. Package Lambda function:
  cd ~/hpi-review-pipeline/lambda/<function-name>
  zip -r ../../<function-name>.zip .
  2. Update Lambda:
  aws lambda update-function-code \
    --function-name <FUNCTION_NAME> \
    --zip-file fileb://<function-name>.zip
  3. Verify deployment:
  aws lambda get-function --function-name <FUNCTION_NAME> \
    --query 'Configuration.[LastModified,CodeSize,Runtime]'
  4. Test with sample execution:
  aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline \
    --input file://test-input.json

  Adjusting Quality Gate Threshold

  Current threshold: 5/10 (semantic retention score)

  To adjust:

  1. Edit Lambda function code:
  # Edit lambda/quality-gate/quality_gate_service.py
  # Change: SEMANTIC_THRESHOLD = 5
  2. Redeploy QualityGate function (see above)
  3. Run validation test:
  python3 scripts/batch_test_runner.py --reviews test-data/reviews.json --count 50
  # Target: 80-90% pass rate

  Cost Monitoring

  Expected Costs (per review):
  - Amazon Translate: $0.0153 (78%)
  - Amazon Bedrock: $0.0003 (2%)
  - AWS Lambda: $0.0010 (5%)
  - Step Functions: $0.0030 (15%)
  - Total: $0.0196

  Monthly Cost Tracking:

  1. Get current month costs:
  aws ce get-cost-and-usage \
    --time-period Start=$(date -u -d '1 month ago' +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --filter file://cost-filter.json
  2. Service-level breakdown:
  aws ce get-cost-and-usage \
    --time-period Start=$(date -u -d '1 month ago' +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
    --granularity MONTHLY \
    --metrics BlendedCost \
    --group-by Type=DIMENSION,Key=SERVICE

  Cost Alerts:
  - If >10% variance from expected: Investigate execution volume
  - If Translate cost spikes: Check for duplicate translations (caching opportunity)
  - If Bedrock cost spikes: Verify prompt token counts haven't increased

  ---
  Testing Procedures

  Local Testing

  Run pytest suite:
  cd ~/hpi-review-pipeline
  pytest -v

  Test individual function:
  cd lambda/<function-name>
  python3 -m pytest ../../conftest.py -v

  Integration Testing

  Single execution test:
  aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline \
    --input file://test-input.json \
    --name test-$(date +%s)

  Batch test (10 reviews):
  python3 scripts/batch_test_runner.py \
    --reviews test-data/reviews.json \ 
    --count 10

  Scale test (100 reviews):
  python3 scripts/batch_test_runner.py \
    --reviews test-data/reviews.json \ 
    --count 100 \
    --report test-results/scale-test-$(date +%Y%m%d).json

  ---
  Security & Compliance

  S3 Bucket Security

  Current configuration:
  - Encryption: S3-managed (SSE-S3)
  - Versioning: Enabled
  - Public access: Blocked
  - HTTPS: Enforced
  - Access logging: Enabled

  Audit bucket security:
  aws s3api get-bucket-encryption --bucket hpi-review-pipeline-data-248062189474
  aws s3api get-bucket-versioning --bucket hpi-review-pipeline-data-248062189474
  aws s3api get-public-access-block --bucket hpi-review-pipeline-data-248062189474

  IAM Permissions

  Lambda execution roles:
  - TranslateFn: translate:TranslateText
  - SummarizeFn: bedrock:InvokeModel
  - LocalizeFn: translate:TranslateText
  - QualityGateFn: bedrock:InvokeModel

  Audit IAM policies:
  aws iam list-attached-role-policies --role-name <ROLE_NAME>
  aws iam get-role-policy --role-name <ROLE_NAME> --policy-name <POLICY_NAME>

  Holmes CDE Compliance

  Last scan: Day 8 (2026-08-23)
  Status: ✅ 0 HIGH findings - CDE Certified

  Re-scan procedure:
  cd ~/hpi-review-pipeline
  # Install Holmes if needed: instructions at internal wiki
  holmes scan --project hpi-review-pipeline

  ---
  Disaster Recovery

  Backup Strategy

  Code repository: AWS CodeCommit (automatic versioning)

  S3 data bucket: Versioned (can restore previous versions)

  Infrastructure: CDK stack in version control

  Recovery Procedures

  Restore previous Lambda version:
  aws lambda list-versions-by-function --function-name <FUNCTION_NAME>
  aws lambda update-alias \
    --function-name <FUNCTION_NAME> \
    --name production \
    --function-version <VERSION_NUMBER>

  Restore S3 object:
  aws s3api list-object-versions --bucket hpi-review-pipeline-data-248062189474 --prefix <KEY>
  aws s3api get-object \
    --bucket hpi-review-pipeline-data-248062189474 \
    --key <KEY> \
    --version-id <VERSION_ID> \
    <OUTPUT_FILE>

  Redeploy entire stack:
  cd ~/hpi-review-pipeline
  cdk deploy HpiReviewPipelineStack

  ---
  Contacts & Escalation

  Primary Contact: Chezsal Robinson
  AWS Account: 248062189474 (HPI sandbox)
  Region: us-east-1

  Service Support:
  - Amazon Translate: AWS Support ticket (category: Amazon Translate)
  - Amazon Bedrock: AWS Support ticket (category: Amazon Bedrock)
  - CloudWatch: AWS Support ticket (category: CloudWatch)

  Escalation Path:
  1. Check this runbook for resolution
  2. Review CloudWatch logs and dashboard
  3. Test with isolated execution
  4. If unresolved: Open AWS Support ticket

  ---
  Appendix

  Useful Commands Quick Reference

  # List recent executions
  aws stepfunctions list-executions \
    --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline \
    --max-results 10

  # Tail Lambda logs
  aws logs tail /aws/lambda/<FUNCTION_NAME> --follow

  # Get alarm state
  aws cloudwatch describe-alarms --alarm-names hpi-pipeline-execution-failures

  # Manual execution
  aws stepfunctions start-execution \
    --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline \
    --input '{"review_text":"Test review","language":"fr","review_id":"test-001"}'

  # Check Lambda metrics
  aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Errors \
    --dimensions Name=FunctionName,Value=<FUNCTION_NAME> \
    --start-time $(date -u -d '1 hour ago' --iso-8601) \
    --end-time $(date -u --iso-8601) \
    --period 300 \
    --statistics Sum

  Resource ARNs

  - State Machine: arn:aws:states:us-east-1:248062189474:stateMachine:hpi-review-pipeline
  - Data Bucket: hpi-review-pipeline-data-248062189474
  - Access Logs Bucket: hpi-review-pipeline-access-logs-248062189474
  - Lambda Functions: See stack-resources.json for current PhysicalResourceIds

  Related Documentation

  - Architecture (ARCHITECTURE.md) - Technical design with cost analysis
  - Deployment Guide (DEPLOYMENT.md) - Step-by-step deployment instructions
  - Cost Analysis (COST_ANALYSIS.md) - Detailed cost breakdown and projections
  - Daily Log (DAILY_LOG.md) - Day-by-day progress tracking
  - Batch Test Results (BATCH_TEST_RESULTS.md) - Scale testing analysis
