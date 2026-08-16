# Architecture - International Review Translation Pipeline
  
  ## Overview
  
  AI-powered serverless pipeline that translates international product reviews (French/German), generates concise summaries using Amazon Bedrock Claude, and localizes content for Product Detail Pages.
  
  ## System Design
  
  ### High-Level Flow
  
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
  
  Output: Input + translated_text field
  
  Runtime: Python 3.13
  Memory: 256 MB
  Timeout: 30s
  Permissions: translate:TranslateText
  
  2. SummarizeLambda
  
  Purpose: Generate 1-2 sentence summary using Claude
  
  Input: Output from TranslateLambda
  
  Output: Input + summary_english field
  
  Prompt Engineering:
  - Requests exactly 1-2 sentences
  - 15-50 words target
  - Captures sentiment + key aspects + rating reason
  - Factual, no promotional language 
  
  Runtime: Python 3.13
  Memory: 512 MB
  Timeout: 60s
  Permissions: bedrock:InvokeModel
  Model: us.anthropic.claude-sonnet-5
  
  3. LocalizeLambda
  
  Purpose: Translate English summary back to source language
  
  Input: Output from SummarizeLambda
  
  Output: Input + summary_localized field
  
  Runtime: Python 3.13
  Memory: 256 MB
  Timeout: 30s
  Permissions: translate:TranslateText
  
  4. QualityGateLambda
  
  Purpose: Validate summary quality
  
  Checks:
  1. Rule-based:
    - Sentence count: 1-2
    - Word count: 15-50
    - No truncation markers ("...")
  2. LLM-based:
    - Semantic retention score (1-10) via Claude
    - Threshold: ≥7 to pass
  
  Input: Output from LocalizeLambda
  
  Output: Input + quality_checks, quality_score, quality_passed fields
  
  Runtime: Python 3.13
  Memory: 512 MB
  Timeout: 60s
  Permissions: bedrock:InvokeModel
  
  Data Flow
  
  Pass-Through Pattern
  
  All Lambda functions use a pass-through pattern:
  - Accept full event object
  - Add new fields
  - Return complete event with additions
  - Enables debugging and traceability
  
  Example:
  def handler(event, context):
      # Process
      result = process(event)
      # Return original + new fields
      return {**event, 'new_field': result}
  
  Event Evolution
  
  Stage 1 (Input):
  {
    "review_id": "fr_001", 
    "text": "...",
    "source_language": "fr"
  }
  
  Stage 2 (After Translate):
  + "translated_text": "..."
  
  Stage 3 (After Summarize):
  + "summary_english": "..."
  
  Stage 4 (After Localize):
  + "summary_localized": "..."
  
  Stage 5 (After Quality Gate):
  + "quality_checks": {...},
  + "quality_score": 8,
  + "quality_passed": true
  
  Cost Analysis
  
  Per Review (Single Execution)
  
  ┌──────────────────┬───────────┬──────────────────────────────────────────┐
  │     Service      │   Cost    │               Calculation                │
  ├──────────────────┼───────────┼──────────────────────────────────────────┤
  │ Amazon Translate │ $0.000015 │ ~1KB text × 2 translations × $15/M chars │
  ├──────────────────┼───────────┼──────────────────────────────────────────┤
  │ Amazon Bedrock   │ $0.020    │ ~500 tokens × 2 calls × $0.003/1K tokens │
  ├──────────────────┼───────────┼──────────────────────────────────────────┤
  │ Lambda           │ $0.0001   │ 4 functions × 128MB × 2s avg             │
  ├──────────────────┼───────────┼──────────────────────────────────────────┤
  │ Step Functions   │ $0.00003  │ 5 state transitions × $0.000025          │
  ├──────────────────┼───────────┼──────────────────────────────────────────┤
  │ Total            │ ~$0.02    │ Per review processed                     │
  └──────────────────┴───────────┴──────────────────────────────────────────┘
  
  Production Scale (12,000 reviews/week)
  
  - Weekly: $240
  - Monthly: ~$1,000
  - Annual: ~$12,000
  
  Cost optimization opportunities:
  - Batch processing (reduce Step Functions transitions)
  - Lambda memory tuning
  - Reserved capacity for Bedrock
  
  Security
  
  Secrets Management
  
  - No hardcoded credentials
  - IAM roles with least-privilege policies
  - Bedrock model access via resource-based policies
  
  Data Privacy
  
  - Test data: 100 synthetic reviews (no real PII)
  - Customer data: processed in-memory, not persisted
  - Compliance: GDPR-ready (no data retention)
  
  Network
  
  - Lambda functions in VPC (optional for production)
  - Service endpoints for AWS API calls
  - Encryption in transit (TLS 1.2+)
  
  Scalability
  
  Current Capacity
  
  - Throughput: ~50 reviews/minute (sequential processing)
  - Concurrency: Limited by Step Functions rate (2,000/account/region)
  
  Scale to 12,000 reviews/week
  
  - Batch size: 50 reviews per Step Functions execution
  - Executions: 240/week (35/day)
  - Duration: ~2-3 minutes per batch
  - No infrastructure changes needed
  
  Scale to 100,000+ reviews/week
  
  - Switch to SQS + Lambda parallel processing
  - Increase Lambda concurrency limits
  - Multi-region deployment for geo-distribution
  
  Monitoring & Operations
  
  Key Metrics
  
  - Translation accuracy: Manual spot-check sampling
  - Summary quality: Quality gate pass rate (target: >80%)
  - Latency: End-to-end pipeline duration (target: <5s/review)
  - Error rate: Failed executions (target: <1%)
  
  CloudWatch Dashboards
  - Bedrock invocation counts, latency

  Alerts

  - Lambda errors > 5 in 5 minutes
  - Step Functions execution failures
  - Quality gate pass rate < 70%

  Architectural Decisions

  Why Step Functions?

  - Pro: Visual workflow, built-in retry/error handling, audit trail
  - Con: Cost at high scale
  - Alternative: SQS + Lambda for >100K reviews/week

  Why Claude Sonnet 5?

  - Superior summarization quality vs. other models
  - Reliable 1-2 sentence constraint adherence
  - Fast inference (<2s typical)
  - Cost-effective at $0.003/1K tokens

  Why Pass-Through Pattern?

  - Simplifies debugging (full context in every stage)
  - Enables quality auditing (can replay with full input)
  - Minimal memory overhead (reviews <10KB each)

  Future Enhancements

  1. Multi-language expansion: Add Spanish, Italian, Japanese
  2. Sentiment analysis: Extract + localize sentiment labels
  3. Batch API: Accept bulk uploads via S3
  4. Caching: Cache translations for duplicate reviews
  5. A/B testing: Compare Claude vs. other models
  6. Real-time streaming: WebSocket API for live processing

  References

  - AWS Step Functions Best Practices (https://docs.aws.amazon.com/step-functions/latest/dg/best-practices.html)
  - Amazon Bedrock Claude Models (https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-claude.html)
  - AWS Lambda Performance Optimization (https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
