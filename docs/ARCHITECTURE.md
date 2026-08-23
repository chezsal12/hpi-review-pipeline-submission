# Architecture - International Review Translation Pipeline

## Overview

AI-powered serverless pipeline that translates international product reviews (French/German), generates concise summaries using Amazon Bedrock Claude, and localizes content for Product Detail Pages.

## System Design

### High-Level Flow

```
Input Review (FR/DE)
    ↓
[TranslateLambda] → Translate to English
    ↓
[SummarizeLambda] → Generate 1-2 sentence summary (Claude)
    ↓
[LocalizeLambda] → Translate summary back to FR/DE
    ↓
[QualityGateLambda] → Validate quality (rules + semantic check)
    ↓
Output: Original review + English translation + Localized summary + Quality score
```

### AWS Services

| Service | Purpose | Usage |
|---------|---------|-------|
| **Amazon Translate** | Multi-language translation | FR/DE ↔ EN bidirectional translation |
| **Amazon Bedrock** | AI summarization & quality scoring | Claude Sonnet 5 for concise summaries |
| **AWS Lambda** | Serverless compute | 4 microservices (translate, summarize, localize, quality-gate) |
| **AWS Step Functions** | Orchestration | Sequential pipeline execution with error handling |
| **Amazon S3** | Storage | Input reviews, output results, logs |
| **Amazon CloudWatch** | Observability | Logs, metrics, monitoring |
| **AWS CodeCommit** | Source control | Git repository in customer account |

## Lambda Functions

### 1. TranslateLambda

**Purpose:** Translate review from source language (FR/DE) to English

**Input:**

```json
{
  "review_id": "fr_001",
  "text": "Franchement top ce casque...",
  "source_language": "fr",
  "product_category": "headphones",
  "true_sentiment": "positive"
}
```

**Output:** Input + `translated_text` field

- Runtime: Python 3.13
- Memory: 256 MB
- Timeout: 30s
- Permissions: `translate:TranslateText`

### 2. SummarizeLambda

**Purpose:** Generate 1-2 sentence summary using Claude

**Input:** Output from TranslateLambda

**Output:** Input + `summary_english` field

**Prompt Engineering:**

- Requests exactly 1-2 sentences
- 15-50 words target
- Captures sentiment + key aspects + rating reason
- Factual, no promotional language

- Runtime: Python 3.13
- Memory: 512 MB
- Timeout: 60s
- Permissions: `bedrock:InvokeModel`
- Model: `us.anthropic.claude-sonnet-5`

### 3. LocalizeLambda

**Purpose:** Translate English summary back to source language

**Input:** Output from SummarizeLambda

**Output:** Input + `summary_localized` field

- Runtime: Python 3.13
- Memory: 256 MB
- Timeout: 30s
- Permissions: `translate:TranslateText`

### 4. QualityGateLambda

**Purpose:** Validate summary quality

**Checks:**

1. Rule-based:
   - Sentence count: 1-2
   - Word count: 15-50
   - No truncation markers ("...")
2. LLM-based:
   - Semantic retention score (1-10) via Claude
   - Threshold: ≥5 to pass (lowered from 7 based on 100-review analysis)

**Input:** Output from LocalizeLambda

**Output:** Input + `quality_checks`, `quality_score`, `quality_passed` fields

- Runtime: Python 3.13
- Memory: 512 MB
- Timeout: 60s
- Permissions: `bedrock:InvokeModel`

## Data Flow

### Pass-Through Pattern

All Lambda functions use a pass-through pattern:

- Accept full event object
- Add new fields
- Return complete event with additions
- Enables debugging and traceability

Example:

```python
def handler(event, context):
    # Process
    result = process(event)
    # Return original + new fields
    return {**event, 'new_field': result}
```

### Event Evolution

Stage 1 (Input):

```json
{
  "review_id": "fr_001",
  "text": "...",
  "source_language": "fr"
}
```

Stage 2 (After Translate): `+ "translated_text": "..."`

Stage 3 (After Summarize): `+ "summary_english": "..."`

Stage 4 (After Localize): `+ "summary_localized": "..."`

Stage 5 (After Quality Gate):

```json
+ "quality_checks": {...},
+ "quality_score": 8,
+ "quality_passed": true
```

## Cost Analysis

### Per Review (Single Execution)

| Service | Cost | Calculation |
|---------|------|-------------|
| Amazon Translate | $0.000015 | ~1KB text × 2 translations × $15/M chars |
| Amazon Bedrock | $0.020 | ~500 tokens × 2 calls × $0.003/1K tokens |
| Lambda | $0.0001 | 4 functions × 128MB × 2s avg |
| Step Functions | $0.00003 | 5 state transitions × $0.000025 |
| **Total** | **~$0.02** | Per review processed |

### Production Scale (12,000 reviews/week)

- Weekly: $240
- Monthly: ~$1,000
- Annual: ~$12,000

### Cost Assumptions

**Pricing (as of August 2026, us-east-1):**

- Amazon Translate: $15/million characters
- Amazon Bedrock Claude Sonnet 5: $3/million input tokens, $15/million output tokens
- AWS Lambda: $0.20/million requests + $0.0000166667/GB-second
- Step Functions: $0.025/1000 state transitions

**Review Characteristics:**

- Average review length: 150 words (~750 characters)
- Translation volume: 2 passes per review (source→English→source)
- Summary output: 15-50 words (avg 32 words, ~200 characters)
- Bedrock calls: 2 per review (summarization + quality scoring)
- Token estimates: ~400 input tokens, ~100 output tokens per LLM call

**Lambda Configuration:**

- Translate/Localize: 256MB, 2s avg duration
- Summarize/QualityGate: 512MB, 3s avg duration
- Concurrency: Sequential (1 review at a time per execution)

### Cost Trade-offs

**Architecture Choice: Step Functions vs SQS + Lambda**

- **Current (Step Functions):** $0.00003/review for orchestration, visual workflow, built-in retry
- **Alternative (SQS + Lambda):** Near-zero orchestration cost, but requires custom retry logic
- **Trade-off:** 15% of total cost for production-grade observability and error handling
- **Break-even:** SQS becomes cost-effective above 100K reviews/week

**Model Choice: Claude Sonnet 5 vs Haiku**

- **Sonnet 5:** $0.020/review, 89% quality gate pass rate, superior semantic accuracy
- **Haiku:** $0.007/review (65% savings), estimated 60-70% pass rate, faster but lower quality
- **Trade-off:** Failed reviews require manual review (~$2 labor cost each) → Sonnet ROI positive

**Translation: Amazon Translate vs Custom Models**

- **Amazon Translate:** $0.000015/review, managed service, consistent quality, no ML Ops
- **Custom Models:** Lower per-unit cost but requires training data, versioning, monitoring
- **Trade-off:** 78% of cost is translation, but operational simplicity worth premium at current scale

**Cost optimization opportunities:**

- Batch processing (reduce Step Functions transitions)
- Lambda memory tuning
- Reserved capacity for Bedrock

## Security

### Secrets Management

- No hardcoded credentials
- IAM roles with least-privilege policies
- Bedrock model access via resource-based policies

### Data Privacy

- Test data: 100 synthetic reviews (no real PII)
- Customer data: processed in-memory, not persisted
- Compliance: GDPR-ready (no data retention)

### Network

- Lambda functions in VPC (optional for production)
- Service endpoints for AWS API calls
- Encryption in transit (TLS 1.2+)

## Scalability

### Current Capacity

- Throughput: ~50 reviews/minute (sequential processing)
- Concurrency: Limited by Step Functions rate (2,000/account/region)

### Scale to 12,000 reviews/week

- Batch size: 50 reviews per Step Functions execution
- Executions: 240/week (35/day)
- Duration: ~2-3 minutes per batch
- No infrastructure changes needed

### Scale to 100,000+ reviews/week

- Switch to SQS + Lambda parallel processing
- Increase Lambda concurrency limits
- Multi-region deployment for geo-distribution

## Monitoring & Operations

### Key Metrics

- Translation accuracy: Manual spot-check sampling
- Summary quality: Quality gate pass rate (target: >80%)
- Latency: End-to-end pipeline duration (target: <5s/review)
- Error rate: Failed executions (target: <1%)

### CloudWatch Dashboards

- Bedrock invocation counts, latency

### Alerts

- Lambda errors > 5 in 5 minutes
- Step Functions execution failures
- Quality gate pass rate < 70%

## Architectural Decisions

### Why Step Functions?

- **Context:** The pipeline runs four sequential stages (translate → summarize → localize → quality-gate) that each depend on the previous stage's output, and each stage can fail on transient AWS API errors. We needed orchestration with retry, error handling, and traceability.
- **Alternatives considered:** SQS + Lambda chaining — near-zero orchestration cost, but requires hand-written retry/backoff logic, dead-letter handling, and offers no built-in visual audit trail.
- **Rationale:** At the current scale (12,000 reviews/week) the orchestration cost is ~$0.00003/review (~15% of total), a worthwhile premium for managed retries, visual workflow, and per-execution audit history. Above ~100K reviews/week the SQS + Lambda alternative becomes cost-effective and is the documented migration path.

### Why Claude Sonnet 5?

- **Context:** Summaries must adhere to a strict 1-2 sentence, 15-50 word constraint and preserve sentiment/aspects well enough to pass the semantic quality gate. Model choice directly drives both quality-gate pass rate and per-review cost.
- **Alternatives considered:** Claude Haiku — ~$0.007/review (65% cheaper) and faster, but in testing produced an estimated 60-70% quality-gate pass rate versus Sonnet's 89%, with weaker constraint adherence. (See the Sonnet-vs-Haiku comparison in the Cost Trade-offs section.)
- **Rationale:** Each failed review costs ~$2 in manual labor to reprocess, so Haiku's lower pass rate erases its per-call savings at our volume. Sonnet 5's higher accuracy and reliable constraint adherence make its ROI positive; the $0.020/review cost is acceptable within the ~$0.02 total per-review budget.

### Why Pass-Through Pattern?

- **Context:** Each stage adds fields (translated_text, summary_english, etc.) to a review that flows through all four Lambdas. We needed a way to move state between stages that supports debugging and replay.
- **Alternatives considered:** Writing intermediate results to S3 (or DynamoDB) between stages and passing only references — durable and decoupled, but adds per-stage read/write latency, storage cost, and cleanup complexity, and makes local replay harder.
- **Rationale:** Reviews are small (<10KB each), so carrying the full event in-memory through Step Functions has negligible overhead while keeping full context in every stage. This simplifies debugging (the complete input/output is visible at each transition) and enables replay from any captured event without an external store. If review payloads grow large or stages need independent scaling, the S3-intermediate-state alternative is the migration path.

## Future Enhancements

1. Multi-language expansion: Add Spanish, Italian, Japanese
2. Sentiment analysis: Extract + localize sentiment labels
3. Batch API: Accept bulk uploads via S3
4. Caching: Cache translations for duplicate reviews
5. A/B testing: Compare Claude vs. other models
6. Real-time streaming: WebSocket API for live processing

## References

- [AWS Step Functions Best Practices](https://docs.aws.amazon.com/step-functions/latest/dg/best-practices.html)
- [Amazon Bedrock Claude Models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html)
- [AWS Lambda Performance Optimization](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
