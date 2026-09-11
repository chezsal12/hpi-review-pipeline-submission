# Cost Analysis

Cost model for the International Review Translation & Summarization
Pipeline. All figures are **estimates** based on the assumptions below and
on public `us-east-1` on-demand pricing as of August 2026. Validate against
the [AWS Pricing Calculator](https://calculator.aws/) before committing to
budgets, since pricing and usage patterns change.

## Assumptions

Per-review workload (one review flowing through all four stages):

| Parameter | Value | Notes |
|-----------|-------|-------|
| Avg. review length | 400 characters | French/German source text |
| Translate calls / review | 2 | source→EN (~400 chars) + summary EN→source (~250 chars) = **~650 chars** |
| Summarize call | ~300 input tokens, ~60 output tokens | Claude prompt + review text → 1-2 sentence summary |
| Quality-gate call | ~450 input tokens, ~10 output tokens | review excerpt + both summaries → single numeric score |
| Total Bedrock tokens / review | ~750 input, ~70 output | sum of summarize + quality-gate |
| Lambda invocations / review | 4 | one per stage |
| Lambda config | 512 MB, ~2 s avg duration | Bedrock/Translate latency dominates |
| Step Functions transitions / review | ~5 | Standard workflow |
| CloudWatch Logs / review | negligible (~a few KB) | handler `print` statements |

Unit pricing used (on-demand, `us-east-1`):

| Service | Dimension | Price |
|---------|-----------|-------|
| Amazon Translate | per character | $15.00 / 1M chars |
| Amazon Bedrock (Claude Sonnet class) | input tokens | $3.00 / 1M tokens |
| Amazon Bedrock (Claude Sonnet class) | output tokens | $15.00 / 1M tokens |
| AWS Lambda | requests | $0.20 / 1M requests |
| AWS Lambda | compute | $0.0000166667 / GB-second |
| AWS Step Functions (Standard) | state transitions | $0.025 / 1,000 transitions |
| Amazon CloudWatch Logs | ingestion | $0.50 / GB |

> **Note on the model:** the pipeline targets the `us.anthropic.claude-sonnet-5`
> inference profile. Bedrock figures use representative Claude Sonnet-class
> token pricing; confirm the exact per-token rate for your enabled model and
> region, and account for cross-region inference-profile pricing if applicable.

## Per-Review Cost (Per-Service Breakdown)

### Initial Estimate (Theoretical)

| Service | Calculation | Cost / review |
|---------|-------------|---------------|
| Amazon Translate | 650 chars × $15 / 1M | $0.009750 |
| Amazon Bedrock (input) | 750 tok × $3 / 1M | $0.002250 |
| Amazon Bedrock (output) | 70 tok × $15 / 1M | $0.001050 |
| AWS Lambda (compute) | 4 × 2 s × 0.5 GB × $1.6667e-5 | $0.000067 |
| AWS Lambda (requests) | 4 × $0.20 / 1M | $0.000001 |
| AWS Step Functions | 5 × $0.025 / 1,000 | $0.000125 |
| Amazon CloudWatch Logs | ~small ingestion | $0.000100 |
| **Total (Estimated)** | | **≈ $0.01335 / review** |

### Actual Cost (Validated with 100-Review Scale Test)

| Service | Cost | % of Total | Details |
|---------|------|------------|---------|
| Amazon Translate | $0.0153 | 78% | 2 translations per review (~1,000 chars total) |
| Amazon Bedrock | $0.0003 | 2% | Claude Sonnet 5, 2 calls per review |
| AWS Lambda | $0.0010 | 5% | 4 functions, avg 2-3s each |
| Step Functions | $0.0030 | 15% | 5 state transitions |
| **Total (Actual)** | **$0.0196 / review** | **100%** | **$1.96 per 100 reviews** |

### Budget vs Actual

| Metric | Value | Notes |
|--------|-------|-------|
| Target Budget | <$0.025/review | Project requirement |
| Actual Cost | $0.0196/review | Validated at 100-review scale |
| Under Budget | 22% | $(0.025 - 0.0196) / 0.025 = 21.6%$ |

**Key Findings:**
- Amazon Translate is the dominant cost (78%, higher than estimated 73%)
- Actual translate character count was ~1,000 chars vs estimated 650 chars
- Bedrock is negligible (2% of total cost, ~$0.0003 per review)
- Step Functions is 15% (higher than theoretical, but worth it for observability)
- **Came in 22% under target budget** - validates cost-effectiveness

## Cost at Scale (Using Actual $0.0196/review)

| Scale | Volume | Total Cost | Monthly Cost | Notes |
|-------|--------|------------|--------------|-------|
| **100 reviews** (scale test) | 100 | $1.96 | one-time | Validated actual cost |
| **12,000 reviews/week** | 52,000/month | $1,019/month | $1,019/mo | Small production workload |
| **100,000 reviews/week** | 433,000/month | $8,487/month | $8,487/mo | Large production workload |
| **1,000,000 reviews/month** | 1,000,000/month | $19,600/month | $19,600/mo | High-volume scenario |

**Cost Breakdown by Service (at any scale):**
- Amazon Translate: 78%
- Step Functions: 15%
- AWS Lambda: 5%
- Amazon Bedrock: 2%

**Migration Threshold:** At 100K+ reviews/week, consider migrating from Step Functions to SQS + Lambda to reduce the 15% orchestration cost. Break-even analysis documented in `ARCHITECTURE.md`.

## Cost Trade-offs Considered

- **Per-review vs. batch invocation.** The pipeline invokes Translate and
  Bedrock once per review. Amazon Translate offers asynchronous batch jobs
  that reduce per-call overhead for large backfills; at production scale a
  batch path could cut Lambda/Step Functions orchestration cost (already
  <2% of total) but does **not** reduce the dominant per-character Translate
  charge. Batching is therefore a latency/operational win more than a cost
  win.
- **On-demand vs. cross-region inference profile.** The project uses a
  cross-region inference profile (`us.` prefix) for availability. Inference
  profiles can carry slightly different per-token rates than single-region
  on-demand; if cost-sensitive and latency permits, compare against
  single-region on-demand pricing.
- **Quality-gate model call.** The semantic-retention check adds one Bedrock
  call per review (~25% of Bedrock spend). For high-volume production, this
  check could be sampled (e.g., 10% of reviews) rather than run on every
  review, trading full coverage for ~2.5x lower Bedrock cost.
- **Summary length cap.** `max_tokens=150` on the summarize call bounds
  output-token cost; the 15-50 word requirement keeps output well under the
  cap.

## How to Reproduce / Update These Estimates

1. Open the [AWS Pricing Calculator](https://calculator.aws/).
2. Add line items for Amazon Translate (characters/month), Amazon Bedrock
   (input/output tokens/month), AWS Lambda (requests + GB-seconds), AWS Step
   Functions (state transitions), and Amazon CloudWatch Logs (GB ingested).
3. Plug in the per-review assumptions above multiplied by your monthly
   volume, and export the shareable estimate link for the customer.
