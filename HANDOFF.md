# Handoff Notes - HPI Review Pipeline

**Date:** September 10, 2026  
**From:** Chezsal Kamaray (Builder)  
**To:** Customer Engineering Team

---

## What You're Inheriting

This is a production-ready AI pipeline that processes international product reviews (French/German) and generates localized summaries using Amazon Bedrock Claude. The system is deployed, tested at scale (100 reviews, 100% success rate), and certified by Holmes CDE with zero HIGH findings.

**Core Value:** Automatically translate customer reviews, generate concise 1-2 sentence summaries, and localize them back to the customer's language—all in 5-10 seconds per review at $0.0196/review.

---

## Quick Orientation (First 30 Minutes)

### 1. Run the Tests Locally (5 minutes)
```bash
git clone https://github.com/chezsal12/hpi-review-pipeline-submission.git
cd hpi-review-pipeline-submission
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest tests/ -v
```

**Expected:** 19 tests pass. This validates your Python environment and confirms the code is testable.

### 2. Review the Architecture (10 minutes)
- Read `docs/ARCHITECTURE.md` (focus on the "Design Rationale" section)
- Open `docs/DIAGRAMS.md` to see the visual workflow
- Key pattern: **Service layer separation** - business logic lives in `*_service.py` files, handlers are thin adapters

### 3. Execute a Review in AWS (10 minutes)
- AWS Console → Step Functions → `hpi-review-pipeline` state machine
- Click "Start execution"
- Paste this input:
  ```json
  {
    "text": "Ce produit est incroyable! La qualité est exceptionnelle.",
    "source_language": "fr",
    "review_id": "test-001"
  }
  ```
- Watch it execute (should complete in ~8 seconds)
- Click "QualityGate" step to see the final output with English summary + French localized summary

### 4. Check the Monitoring Dashboard (5 minutes)
- AWS Console → CloudWatch → Dashboards → `hpi-review-pipeline`
- Verify you see execution metrics, Lambda errors/duration
- CloudWatch → Alarms → Check 3 alarms are in OK state

**At this point, you understand the system end-to-end.**

---

## Repository Structure

```
hpi-review-pipeline/
├── lambda/                       # 4 Lambda functions (Python 3.13)
│   ├── translate/               # Stage 1: FR/DE → EN
│   │   ├── handler.py           # Thin adapter (entry point)
│   │   └── translate_service.py # Business logic (testable)
│   ├── summarize/               # Stage 2: AI summarization
│   │   ├── handler.py
│   │   └── summarize_service.py
│   ├── localize/                # Stage 3: EN → FR/DE
│   │   ├── handler.py
│   │   └── localize_service.py
│   ├── quality-gate/            # Stage 4: Validation
│   │   ├── handler.py
│   │   └── quality_gate_service.py
│   └── shared/                  # Shared utilities (translate_utils.py)
├── lib/                         # CDK infrastructure (TypeScript)
│   └── hpi-review-pipeline-stack.ts  # All AWS resources defined here
├── tests/                       # 19 pytest unit tests
│   ├── test_translate_service.py
│   ├── test_summarize_service.py
│   ├── test_localize_service.py
│   ├── test_quality_gate_service.py
│   └── conftest.py              # Shared fixtures
├── scripts/                     # Utilities
│   ├── batch-test-pipeline.py   # Batch testing tool
│   └── generate-dashboard.py    # CloudWatch dashboard generator
├── docs/                        # Documentation
│   ├── ARCHITECTURE.md          # Design rationale & trade-offs
│   ├── DEPLOYMENT.md            # Step-by-step deployment
│   ├── OPERATIONS.md            # Troubleshooting runbook
│   ├── COST_ANALYSIS.md         # Cost breakdown & projections
│   └── BATCH_TEST_RESULTS.md    # Scale test analysis
├── README.md                    # Quick start guide
├── HANDOFF.md                   # This document
└── SCOPE-ALIGNMENT.md           # What was built vs original scope
```

---

## Day-to-Day Operations

### Monitoring

**Primary Dashboard:** CloudWatch → Dashboards → `hpi-review-pipeline`

**4 Key Widgets:**
1. **Pipeline Executions** - Shows started/succeeded/failed counts over time
2. **Execution Time** - Average latency (target: 5-10s)
3. **Lambda Errors** - Errors by function (helps isolate failures)
4. **Lambda Duration** - Performance by function (spots throttling)

**3 Production Alarms:**
1. `HpiReviewPipeline-ExecutionsFailed` - Triggers on any execution failure (highest priority)
2. `HpiReviewPipeline-LambdaErrors` - Triggers on elevated Lambda error rates
3. `HpiReviewPipeline-SlowExecution` - Triggers on execution time > 15s

### Troubleshooting

**If alarms fire, follow the runbook:** `docs/OPERATIONS.md`

**Common scenarios:**
- Pipeline execution failures → Check Step Functions logs, verify IAM permissions
- Lambda errors → Check CloudWatch logs for specific function
- Quality gate issues → Review quality threshold (currently 5/10), tune if needed
- Slow execution → Check Bedrock throttling, Translate rate limits

**Quick diagnostics:**
```bash
# Check recent executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:us-east-1:<AWS-ACCOUNT-ID>:stateMachine:hpi-review-pipeline \
  --max-results 10

# Get logs for a specific Lambda
aws logs tail /aws/lambda/HpiReviewPipelineStack-TranslateFn --follow
```

### Scaling Considerations

**Current capacity:**
- Successfully tested at 100 reviews (100% success, 89% quality pass)
- No throttling or infrastructure issues observed

**If you scale to 100K+ reviews/week:**
1. **Migrate to SQS** - Step Functions becomes expensive (see `docs/COST_ANALYSIS.md` for break-even analysis)
2. **Implement batching** - Process 10-100 reviews per Lambda invocation
3. **Consider Savings Plans** - Translate costs are predictable, reserved capacity could save 10-20%
4. **Cache duplicate reviews** - Use DynamoDB to avoid re-translating identical reviews

**See `docs/ARCHITECTURE.md` for detailed migration paths.**

---

## How to Make Changes

### Adding a New Language (e.g., Spanish)

**Example workflow documented in `DEMO_SCRIPT.md` - here's the summary:**

1. **Update Lambda validation:**
   - `lambda/translate/translate_service.py` - Add `'es'` to supported languages
   - `lambda/localize/localize_service.py` - Add `'es'` to supported target languages

2. **Update IAM policies:**
   - `lib/hpi-review-pipeline-stack.ts` - Add `'es'` to `translate:SourceLanguageCode` and `translate:TargetLanguageCode` conditions

3. **Add tests:**
   - `tests/test_translate_service.py` - Add Spanish test case
   - `tests/test_localize_service.py` - Add Spanish localization test

4. **Deploy:**
   ```bash
   cdk deploy
   ```

5. **Test in AWS Console:**
   - Execute a Spanish review through the pipeline
   - Verify it completes successfully

### Changing the Claude Model

**To switch from Sonnet 5 to Haiku (for cost savings):**

1. Update model ID in:
   - `lambda/summarize/summarize_service.py` - Change `MODEL_ID`
   - `lambda/quality-gate/quality_gate_service.py` - Change `MODEL_ID`
   - `lib/hpi-review-pipeline-stack.ts` - Update IAM policy resource ARN

2. **WARNING:** Quality pass rate will drop from 89% to ~60-70% (documented in `docs/COST_ANALYSIS.md`)

3. Re-test with batch testing:
   ```bash
   python scripts/batch-test-pipeline.py
   ```

4. Analyze quality impact before deploying to production

### Tuning the Quality Gate Threshold

**Current threshold:** 5/10 (semantic score from Claude)  
**Pass rate:** 89%

**If pass rate is too low:**
- Lower threshold to 4 (more reviews pass, but quality may suffer)
- Edit `lambda/quality-gate/quality_gate_service.py` - Change `QUALITY_THRESHOLD`

**If pass rate is too high (quality concerns):**
- Raise threshold to 6 or 7 (stricter validation)
- Test with batch testing to measure impact

**Process:**
1. Change `QUALITY_THRESHOLD` in `quality_gate_service.py`
2. Run batch test: `python scripts/batch-test-pipeline.py`
3. Analyze pass rate in output
4. Deploy if satisfied: `cdk deploy`

---

## Understanding the Code

### Service Layer Pattern

**Every Lambda follows this structure:**
```
handler.py       → Thin adapter (parses event, returns enriched event)
*_service.py     → Business logic (testable, no Lambda dependencies)
```

**Why this matters:**
- Tests run locally without mocking AWS Lambda context
- Business logic is reusable (could move to ECS, Fargate, etc.)
- Holmes CDE certification required this pattern

**Example:** `lambda/translate/handler.py` vs `translate_service.py`

### Pass-Through Pattern

**Each Lambda returns the full input event + new fields:**
```python
return {
    **event,  # Pass through everything
    'translated_text': translated_text  # Add new field
}
```

**Why this matters:**
- Every stage has full context for debugging
- Quality gate can compare original vs translated vs summary
- Simplifies troubleshooting (click any Step Functions stage to see full state)

### Error Handling

**Two levels of retry logic (configured in CDK stack):**

1. **Service exceptions** (throttling, transient errors):
   - 3 retries, 2s initial interval, 2x backoff

2. **Task failures** (application errors):
   - 2 retries, 1s initial interval, 1.5x backoff

3. **Final fallback:**
   - Routes to `ProcessingFailed` state (graceful failure)

**Result:** 100% execution success rate in testing (no manual intervention needed)

---

## Security & Compliance

### IAM Least Privilege

**All policies are scoped:**
- Bedrock: Specific model ARN (`us.anthropic.claude-sonnet-5`)
- Translate: Language pairs (`fr/de` ↔ `en`), region (`us-east-1`), source ARN (Step Functions state machine)

**Amazon Translate caveat:**
- Service doesn't support resource-level permissions
- Compensating controls: language-pair restrictions, region lock, source ARN condition
- Documented in `lib/hpi-review-pipeline-stack.ts` (lines 198-224)

### S3 Security

**Both buckets (data + access logs) have:**
- Versioning enabled (CDE requirement)
- Encryption at rest (S3-managed)
- HTTPS-only enforcement
- Public access blocked
- Server access logging (data bucket logs to access-logs bucket)

### Secrets Management

**No secrets in code:**
- AWS credentials via IAM roles (Lambda execution role)
- Bedrock/Translate accessed via boto3 with automatic credential chain
- No API keys, passwords, or tokens in repository

**ProtoShield scan:** 0 secrets found ✅

---

## Testing Strategy

### Unit Tests (19 tests)

**Run locally:**
```bash
pytest tests/ -v
```

**Coverage:**
- All 4 Lambda service layers
- Shared utilities (`translate_utils.py`)
- Mocked AWS services (no real API calls)

**Test philosophy:**
- Test business logic, not AWS SDK behavior
- Mock Bedrock/Translate responses
- Focus on edge cases (empty input, invalid language, threshold boundaries)

### Batch Testing (Scale Validation)

**Run against deployed pipeline:**
```bash
export STATE_MACHINE_ARN=arn:aws:states:us-east-1:<AWS-ACCOUNT-ID>:stateMachine:hpi-review-pipeline
python scripts/batch-test-pipeline.py
```

**This tests:**
- End-to-end pipeline execution
- Quality gate pass rate
- Execution time
- Cost per review

**Results documented:** `docs/BATCH_TEST_RESULTS.md` (100 reviews, 100% success, 89% quality pass)

### Manual Testing

**Test a single review:**
1. AWS Console → Step Functions → `hpi-review-pipeline`
2. Start execution with sample input (see README.md for examples)
3. Verify all 4 stages complete
4. Check QualityGate output for quality score

---

## Cost Management

**Current cost:** $0.0196/review (1.96 cents)

**Breakdown:**
- Amazon Translate: 78% ($0.0153)
- Step Functions: 15% ($0.0030)
- AWS Lambda: 5% ($0.0010)
- Amazon Bedrock: 2% ($0.0003)

**At scale:**
- 12,000 reviews/week: $940/month
- 100,000 reviews/week: $7,840/month

**Cost optimization opportunities:**
1. Switch to Haiku model (65% cheaper, but 60-70% quality pass rate)
2. Migrate to SQS at 100K+ reviews/week (eliminates Step Functions 15% cost)
3. Cache duplicate reviews (DynamoDB + check before processing)
4. Batch API calls (reduce per-invocation overhead)

**Full analysis:** `docs/COST_ANALYSIS.md`

---

## Deployment & Rollback

### Deploying Changes

**Standard workflow:**
```bash
# 1. Make code changes
# 2. Run tests locally
pytest tests/ -v

# 3. Synthesize CDK template (review changes)
cdk synth

# 4. Deploy to AWS
cdk deploy

# 5. Verify with manual test execution
aws stepfunctions start-execution \
  --state-machine-arn arn:aws:states:us-east-1:<AWS-ACCOUNT-ID>:stateMachine:hpi-review-pipeline \
  --input '{"text":"Test review","source_language":"fr","review_id":"deploy-test"}'
```

### Rolling Back

**If deployment breaks production:**

**Option 1: Revert code and redeploy**
```bash
git revert <bad-commit-hash>
cdk deploy
```

**Option 2: Restore from CloudFormation snapshot**
```bash
aws cloudformation describe-stack-events \
  --stack-name HpiReviewPipelineStack

# Identify the last known-good version, then:
# (Manual process - CloudFormation doesn't auto-rollback CDK stacks)
```

**Option 3: Hotfix (fastest)**
- Fix the issue directly in the AWS Console (Lambda code editor)
- Then commit the fix to the repo and redeploy properly

**Recommendation:** Test in a separate AWS account/region before deploying to production.

---

## Key Files to Read First

1. **README.md** - Quick start and setup (15 minutes)
2. **docs/ARCHITECTURE.md** - Design rationale (20 minutes)
3. **docs/OPERATIONS.md** - Troubleshooting runbook (10 minutes)
4. **lib/hpi-review-pipeline-stack.ts** - Infrastructure definition (30 minutes)
5. **lambda/*/handler.py** - Understand the service layer pattern (15 minutes each)

**Total onboarding time: ~2-3 hours to understand the system.**

---

## Known Limitations & Future Enhancements

### Current Limitations

1. **Single region deployment** - Only deployed to us-east-1
2. **No caching** - Duplicate reviews are re-processed
3. **No batch processing** - Reviews processed one at a time
4. **No real-time API** - Event-driven only (no WebSocket/REST endpoint)
5. **Limited language support** - Only French and German (easy to extend)

### Recommended Next Steps

**Short-term (1-2 sprints):**
1. Add Spanish, Italian support (follow pattern in DEMO_SCRIPT.md)
2. Implement basic monitoring alerts (already have alarms, add SNS notifications)
3. Create automated batch testing in CI/CD

**Medium-term (2-4 sprints):**
1. Add DynamoDB caching for duplicate reviews
2. Build S3-triggered batch processing (S3 event → Lambda processes 100 reviews)
3. Create operational dashboard for non-technical stakeholders

**Long-term (6+ months):**
1. Migrate to SQS if volume exceeds 100K reviews/week
2. Add real-time API (API Gateway + WebSocket)
3. Multi-region deployment for global customers
4. A/B testing framework for model comparison

**All documented with trade-offs in `docs/ARCHITECTURE.md`**

---

## Support & Escalation

### Where to Find Answers

1. **Check the docs first:**
   - `README.md` for setup/config
   - `docs/OPERATIONS.md` for troubleshooting
   - `docs/ARCHITECTURE.md` for design rationale

2. **Check AWS logs:**
   - CloudWatch → Log groups → `/aws/lambda/HpiReviewPipelineStack-*`
   - Step Functions → Execution history (click failed step for details)

3. **Check the tests:**
   - `tests/` directory has examples of expected behavior
   - Run locally to reproduce issues

### Emergency Contacts

**Builder:** Chezsal Kamaray  
**Handoff Date:** September 10, 2026  
**AWS Account:** `<AWS-ACCOUNT-ID>` (HPI sandbox)  
**Region:** us-east-1  
**GitHub Repo:** https://github.com/chezsal12/hpi-review-pipeline-submission

---

## Final Checklist Before You Start

- [ ] Clone repository and run tests locally (19 tests pass)
- [ ] Execute a review in AWS Console (verify it works end-to-end)
- [ ] Check CloudWatch dashboard (verify monitoring is working)
- [ ] Read `docs/ARCHITECTURE.md` (understand the WHY)
- [ ] Read `docs/OPERATIONS.md` (know how to troubleshoot)
- [ ] Verify IAM permissions (you can access Lambda, Step Functions, CloudWatch)
- [ ] Verify Bedrock model access (Claude Sonnet 5 enabled in us-east-1)
- [ ] Set up AWS CLI with credentials (test with `aws sts get-caller-identity`)

---

## You're Ready!

This pipeline is production-ready, tested at scale, and documented. You have everything you need to operate, extend, and troubleshoot it.

**Key principles to remember:**
1. **Test locally first** - Run pytest before deploying
2. **Read the logs** - CloudWatch has all the answers
3. **Follow the patterns** - Service layer separation, pass-through, retry logic
4. **Document your changes** - Update docs/ when you add features
5. **Monitor proactively** - Check the dashboard regularly, respond to alarms

**Welcome to the team. You've got this.** 🚀

---

**Questions? Check `docs/` or review the test files for examples.**
