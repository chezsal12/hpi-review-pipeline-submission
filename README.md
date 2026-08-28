# International Review Translation & Summarization Pipeline

AI-powered pipeline to translate international product reviews, generate concise summaries, and localize content for Product Detail Pages (PDPs).

## Architecture

- **Amazon Translate**: Multi-language translation (French/German ↔ English)
- **Amazon Bedrock (Claude)**: Review summarization and quality evaluation
- **AWS Step Functions**: Pipeline orchestration
- **AWS Lambda**: Microservices for each stage
- **Amazon S3**: Data storage

Pipeline stages (Step Functions state machine):

1. **TranslateLambda** — source language → English (`lambda/translate/handler.py`)
2. **SummarizeLambda** — English review → 1-2 sentence summary via Claude (`lambda/summarize/handler.py`, business logic in `summarize_service.py`)
3. **LocalizeLambda** — English summary → source language (`lambda/localize/handler.py`)
4. **QualityGateLambda** — rule-based + semantic quality checks (`lambda/quality-gate/handler.py`)

Each stage uses a pass-through pattern: it adds fields to the event and returns the full event.

## Prerequisites

- **Python 3.12+** (matches the Lambda runtime target)
- **AWS CLI v2**, configured with credentials for account/region below
- **boto3 / botocore** — installed via `lambda/requirements.txt` (`boto3>=1.34.0`)
- **AWS account access** with IAM permissions for:
  - `translate:TranslateText`
  - `bedrock:InvokeModel` (Amazon Bedrock runtime)
  - `lambda:InvokeFunction`, Lambda execution role
  - `states:StartExecution` (AWS Step Functions)
  - `s3:GetObject` / `s3:PutObject` (data storage)
  - `logs:CreateLogGroup` / `logs:CreateLogStream` / `logs:PutLogEvents` (CloudWatch)
- **Amazon Bedrock model access** enabled for the Claude Sonnet inference profile
  (`us.anthropic.claude-sonnet-5`) in your region. Enable it under
  *Bedrock console → Model access* before running the summarize/quality stages.

## Quick Start

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd hpi-review-pipeline

# 2. Create a virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r lambda/requirements.txt
pip install -r requirements-dev.txt   # test dependencies (pytest)

# 3. Configure AWS credentials and region
aws configure          # or export AWS_PROFILE / AWS_DEFAULT_REGION=us-east-1

# 4. Verify Bedrock model access (should list the Claude inference profile)
aws bedrock list-inference-profiles --region us-east-1

# 5. Run the unit tests (fully mocked, no AWS calls)
pytest
```

## Deployment

The pipeline is four Lambda functions orchestrated by a Step Functions
state machine, reading/writing an S3 data bucket. You can deploy with AWS
CDK (recommended) or directly with the AWS CLI. `docs/DEPLOYMENT.md` has
the full procedure plus rollback and troubleshooting; the self-contained
steps below let a new engineer deploy end to end without any other file.

### Configuration Reference

Set the following before deploying. None are hardcoded in the CDK app —
account and region come from your AWS environment, and the model profile
is referenced by ID in the stack.

| Parameter | Description | Default | Where to set |
|-----------|-------------|---------|--------------|
| `CDK_DEFAULT_ACCOUNT` | Target AWS account ID for the deployment | (from AWS credentials) | Environment variable / AWS profile |
| `CDK_DEFAULT_REGION` | Target AWS region | `us-east-1` | Environment variable / `AWS_DEFAULT_REGION` |
| `AWS_PROFILE` | Named credentials profile to deploy with | (none) | Environment variable / `aws configure` |
| Bedrock inference profile ID | Claude model the summarize/quality stages invoke | `us.anthropic.claude-sonnet-5` | `lib/hpi-review-pipeline-stack.ts` (and per-stage `*_service.py` `MODEL_ID`) |
| `STATE_MACHINE_ARN` | State machine ARN used by `scripts/batch-test-pipeline.py` | (none — required) | Environment variable, resolved at runtime (see Usage) |

CDK resolves account and region from `CDK_DEFAULT_ACCOUNT` /
`CDK_DEFAULT_REGION` (or your active profile) at synth time — see the
[AWS CDK context documentation](https://docs.aws.amazon.com/cdk/v2/guide/context.html).
Enable Bedrock model access for the Claude inference profile in the target
region before deploying the summarize and quality-gate stages.

### Option A — AWS CDK (recommended)

```bash
# One-time per account/region
aws-vault exec hpi -- cdk bootstrap aws://248062189474/us-east-1

# Review the synthesized template, then deploy
aws-vault exec hpi -- cdk synth
aws-vault exec hpi -- cdk deploy   # creates Lambdas, Step Functions, S3, IAM, logs
```

### Option B — AWS CLI (self-contained)

```bash
REGION=us-east-1
ACCOUNT=248062189474

# 1. Create the Lambda execution role with a trust policy
cat > trust.json <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow",
 "Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
aws iam create-role --role-name ReviewPipelineLambdaRole \
  --assume-role-policy-document file://trust.json --region "$REGION"

# Attach permissions: Translate, Bedrock, S3, and CloudWatch Logs
aws iam attach-role-policy --role-name ReviewPipelineLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/TranslateReadOnly
aws iam attach-role-policy --role-name ReviewPipelineLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
aws iam attach-role-policy --role-name ReviewPipelineLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
ROLE_ARN=$(aws iam get-role --role-name ReviewPipelineLambdaRole \
  --query Role.Arn --output text)

# 2. Package and create each Lambda (bundling the shared/ helpers)
for stage in translate summarize localize quality-gate; do
  fn="Review$(echo "$stage" | sed -E 's/(^|-)([a-z])/\U\2/g')"   # e.g. ReviewQualityGate
  rm -rf build && mkdir -p build
  cp lambda/$stage/*.py build/
  cp -r lambda/shared/* build/ 2>/dev/null || true
  (cd build && zip -qr ../$stage.zip .)
  aws lambda create-function --function-name "$fn" \
    --runtime python3.12 --handler handler.handler \
    --role "$ROLE_ARN" --timeout 60 --memory-size 512 \
    --zip-file "fileb://$stage.zip" --region "$REGION"
done

# 3. Create the Step Functions state machine chaining the four functions
#    (see docs/DEPLOYMENT.md for the full ASL definition and its IAM role)
aws stepfunctions create-state-machine --name ReviewPipeline \
  --role-arn arn:aws:iam::$ACCOUNT:role/ReviewPipelineStepFnRole \
  --definition file://statemachine.asl.json --region "$REGION"
```

## Usage

### Run the local unit tests

The Lambda handlers ship with mocked pytest suites (`lambda/*/test_local.py`)
that require no AWS access:

```bash
pytest                              # run the whole suite
pytest lambda/translate/test_local.py -v   # run a single stage's tests
```

### Invoke a single stage locally

Each handler accepts a plain `event` dict. Example for the translate stage
(requires AWS credentials, since it calls Amazon Translate):

```python
from lambda.translate.handler import handler

event = {
    "review_id": "fr_001",
    "text": "Franchement top ce casque !",
    "source_language": "fr",
    "product_category": "headphones",
    "true_sentiment": "positive",
}
print(handler(event, None))
# -> {..., "translated_text": "Honestly, great headphones!"}
```

### Trigger the full pipeline (Step Functions)

Once the Lambda functions and state machine are deployed (see
`docs/DEPLOYMENT.md`), start an execution with a sample review payload:

```bash
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:248062189474:stateMachine:ReviewPipeline \
  --input '{
    "review_id": "fr_001",
    "text": "Franchement top ce casque !",
    "source_language": "fr",
    "product_category": "headphones"
  }' \
  --region us-east-1
```

The execution output contains the enriched event: `translated_text`,
`summary_english`, `summary_localized`, and the `quality_checks` /
`quality_passed` fields from the quality gate.

### Post-Deploy Verification (smoke test)

After deploying (see `docs/DEPLOYMENT.md`), confirm the pipeline works
end to end before handing it off:

```bash
# 1. Resolve the deployed state machine ARN
STATE_MACHINE_ARN=$(aws stepfunctions list-state-machines \
  --query "stateMachines[?contains(name, 'ReviewPipeline')].stateMachineArn" \
  --output text --region us-east-1)

# 2. Start an execution with a known sample review
EXEC_ARN=$(aws stepfunctions start-execution \
  --state-machine-arn "$STATE_MACHINE_ARN" \
  --input '{"review_id":"fr_001","text":"Franchement top ce casque !","source_language":"fr","product_category":"headphones"}' \
  --query executionArn --output text --region us-east-1)

# 3. Wait for completion and inspect the output
aws stepfunctions describe-execution --execution-arn "$EXEC_ARN" \
  --query '{status:status, output:output}' --output json --region us-east-1
```

A successful run reports `"status": "SUCCEEDED"` and an `output` event that
contains all four enriched fields, for example:

```json
{
  "review_id": "fr_001",
  "translated_text": "Honestly, great headphones!",
  "summary_english": "Positive review praising the headphones for clear sound and battery life.",
  "summary_localized": "Avis positif saluant le son clair et l'autonomie du casque.",
  "quality_passed": true
}
```

If `status` is `FAILED`, inspect the failing stage in the Step Functions
console or with `aws stepfunctions get-execution-history --execution-arn "$EXEC_ARN"`,
and check the corresponding Lambda's CloudWatch logs
(`aws logs tail /aws/lambda/<function-name> --since 10m`).

### Cleanup / Teardown

To decommission the deployment and avoid ongoing charges, remove the
resources in this order. If the stack was deployed with AWS CDK, a single
`cdk destroy` removes everything it created:

```bash
aws-vault exec hpi -- cdk destroy   # removes Lambda, Step Functions, S3, IAM, logs
```

If resources were created outside CDK, delete them explicitly (order
matters — detach IAM policies before deleting roles):

```bash
# 1. Delete the Step Functions state machine
aws stepfunctions delete-state-machine --state-machine-arn "$STATE_MACHINE_ARN" --region us-east-1

# 2. Delete the four Lambda functions
for fn in ReviewTranslate ReviewSummarize ReviewLocalize ReviewQualityGate; do
  aws lambda delete-function --function-name "$fn" --region us-east-1
done

# 3. Empty and delete the S3 data bucket
aws s3 rm s3://<data-bucket> --recursive --region us-east-1
aws s3api delete-bucket --bucket <data-bucket> --region us-east-1

# 4. Delete CloudWatch log groups
for lg in /aws/lambda/ReviewTranslate /aws/lambda/ReviewSummarize \
          /aws/lambda/ReviewLocalize /aws/lambda/ReviewQualityGate; do
  aws logs delete-log-group --log-group-name "$lg" --region us-east-1
done

# 5. Detach policies, then delete the Lambda execution role
aws iam list-attached-role-policies --role-name <lambda-exec-role> --region us-east-1
aws iam detach-role-policy --role-name <lambda-exec-role> --policy-arn <arn>   # repeat per policy
aws iam delete-role --role-name <lambda-exec-role> --region us-east-1
```

See `docs/DEPLOYMENT.md` for the full deployment, rollback, and
troubleshooting procedures.

## Test Data

100 synthetic product reviews (50 French, 50 German) in `test-data/` covering:

- Varying sentiments and lengths
- Edge cases (slang, emojis, typos)
- Multiple product categories

## Cost

See [docs/COST_ANALYSIS.md](docs/COST_ANALYSIS.md) for a per-service cost
breakdown, the assumptions behind each estimate, and projections at demo,
pilot, and production scale.

## Known Limitations

- **Language support**: Only French and German ↔ English are exercised.
  Other languages require Amazon Translate support and additional test data.
- **Throughput**: The pipeline processes reviews one at a time (no batch
  API). Expect roughly 50 reviews/minute end-to-end; large backfills should
  be parallelized across multiple Step Functions executions.
- **Quality gate thresholds** are heuristic: 1-2 sentences, 15-50 words, and
  a semantic-retention score ≥ 7 (1-10 scale from Claude). Summaries outside
  these bounds are flagged as not passing but are not automatically retried.
- **Semantic scoring fallback**: If the model response cannot be parsed into
  a numeric score, the quality gate defaults to a middle score of 5 rather
  than failing the pipeline.
- **Model dependency**: Requires the `us.anthropic.claude-sonnet-5` inference
  profile to be enabled in the target region.

## Project Type

**Evaluated Builder Project** — Simulated customer engagement for CDE certification.

## Contact

- **Simulated Customer**: HPI
- **AWS Account**: 248062189474
- **Region**: us-east-1
- **Duration**: 3 weeks (Aug 2026)
