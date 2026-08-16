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

| Service | Calculation | Cost / review |
|---------|-------------|---------------|
| Amazon Translate | 650 chars × $15 / 1M | $0.009750 |
| Amazon Bedrock (input) | 750 tok × $3 / 1M | $0.002250 |
| Amazon Bedrock (output) | 70 tok × $15 / 1M | $0.001050 |
| AWS Lambda (compute) | 4 × 2 s × 0.5 GB × $1.6667e-5 | $0.000067 |
| AWS Lambda (requests) | 4 × $0.20 / 1M | $0.000001 |
| AWS Step Functions | 5 × $0.025 / 1,000 | $0.000125 |
| Amazon CloudWatch Logs | ~small ingestion | $0.000100 |
| **Total** | | **≈ $0.01335 / review** |

Amazon Translate is the dominant cost (~73%), followed by Amazon Bedrock
(~25%). Lambda, Step Functions, and CloudWatch together are <2%.

## Cost at Scale

| Scale | Volume | Translate | Bedrock | Lambda | Step Functions | CloudWatch | **Total** |
|-------|--------|-----------|---------|--------|----------------|------------|-----------|
| **Demo** | 100 reviews (one-time) | $0.98 | $0.33 | $0.01 | $0.01 | $0.01 | **≈ $1.34** |
| **Pilot** | 10,000 reviews / month | $97.50 | $33.00 | $0.68 | $1.25 | $1.00 | **≈ $133.43 / mo** |
| **Production** | 1,000,000 reviews / month | $9,750 | $3,300 | $68 | $125 | $100 | **≈ $13,343 / mo** |

The demo figure (~$1.34 for 100 reviews) is consistent with the ~$1.20
observed during Day 2 testing (`docs/DAILY_LOG.md`); the small difference
reflects the Bedrock quality-gate call and Step Functions transitions that
the rough field estimate omitted.

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
