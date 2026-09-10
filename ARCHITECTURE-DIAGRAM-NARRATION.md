# Architecture Diagram Narration Guide

**Use this when showing the architecture diagram in your demo video**

---

## The Flow (60 seconds)

### Visual: Show the diagram from DIAGRAMS.md or draw.io

**Script:**

> "Let me walk you through the architecture. This is a serverless pipeline that processes international product reviews end-to-end."

**[Point to the input]**

> "A review comes in—let's say in French or German—with the review text, the source language code, and a review ID."

**[Point to Step Functions]**

> "Step Functions orchestrates the entire workflow. It's the conductor that sequences four Lambda functions in order, handles retries on failures, and provides visual workflow monitoring."

**[Point to Stage 1: Translate Lambda]**

> "Stage 1: The Translate Lambda calls Amazon Translate to convert the review from French or German into English. This gives us a common language for summarization."

**[Point to Stage 2: Summarize Lambda]**

> "Stage 2: The Summarize Lambda takes the English review and calls Bedrock Claude Sonnet 5 to generate a concise 1-2 sentence summary. Claude extracts the key points—what's the reviewer's main opinion?"

**[Point to Stage 3: Localize Lambda]**

> "Stage 3: The Localize Lambda translates that English summary back to the original language—French or German—so the customer sees the summary in their own language."

**[Point to Stage 4: Quality Gate Lambda]**

> "Stage 4: The Quality Gate Lambda validates the summary. It runs rule-based checks—sentence count, word length, no truncation—and then uses Claude again to score semantic retention. Does the summary accurately capture the original review's meaning? If the score is 5 or above out of 10, it passes. 89% of reviews pass this gate."

**[Point to S3]**

> "All data is stored in S3—inputs, outputs, processing results—with versioning enabled for compliance and encryption at rest."

**[Point to CloudWatch]**

> "CloudWatch captures all logs from every Lambda function and provides the monitoring dashboard and alarms we saw earlier."

**[Wrap up]**

> "The key architectural principle: pass-through pattern. Each Lambda receives the full event from the previous stage plus adds its own fields—translated text, summary, localized summary, quality score. This means every stage has complete context, which simplifies debugging."

---

## Key Points to Emphasize

### Serverless Architecture
- **No servers to manage** - Lambda auto-scales
- **Pay per execution** - Cost efficient for bursty workloads
- **Event-driven** - Each stage triggers the next

### Step Functions Orchestration
- **Visual workflow** - See exactly where execution is
- **Built-in retry logic** - Exponential backoff on failures
- **Error handling** - Graceful failure routing

### Service Choices
- **Amazon Translate** - Managed, 75+ languages, no ML Ops
- **Bedrock Claude Sonnet 5** - High-quality summarization, cost-effective
- **S3** - Durable storage with versioning and encryption
- **CloudWatch** - Centralized logging and monitoring

### Pass-Through Pattern
- Each Lambda returns: `{...event, new_field: value}`
- Full context at every stage
- Simplifies debugging and observability

---

## Architecture Principles

**1. Service Layer Pattern**
- Handler = thin adapter (parse event, return result)
- Service = business logic (testable, no AWS dependencies)
- Result: 100% test coverage without mocking AWS

**2. IAM Least Privilege**
- Bedrock: Scoped to specific model ARN
- Translate: Restricted by language pairs, region, source ARN
- S3: Specific bucket permissions only

**3. Defense in Depth**
- Retry logic at Step Functions level
- Error handling in Lambda code
- Quality gate validation before output
- CloudWatch alarms on failures

**4. Cost Optimization**
- Translation: 78% of cost (dominant factor)
- Claude: 2% of cost (negligible, quality justified)
- Step Functions: 15% of cost (worth it for observability)
- Total: $0.0196/review (22% under budget)

---

## Common Questions & Answers

**Q: Why Step Functions instead of direct Lambda chaining?**
A: Visual workflow, built-in retry logic, state management. Worth the 15% cost for production observability.

**Q: Why not batch processing?**
A: Event-driven design for real-time processing. Batching would be added at 100K+ reviews/week scale.

**Q: Why Sonnet 5 instead of Haiku?**
A: 89% quality pass rate vs estimated 60-70% with Haiku. Failed reviews cost $2 in manual review, making Sonnet ROI positive.

**Q: What happens when quality gate fails?**
A: Review is flagged but still stored. In production, it would route to manual review queue.

**Q: How does this scale?**
A: Architecture is horizontally scalable. At 100K+ reviews/week, migrate to SQS for cost savings and batch processing.

---

## Visual Cues

When showing the diagram:

✅ **Use your cursor/pointer** to trace the flow from left to right  
✅ **Pause at each stage** for 2-3 seconds while explaining  
✅ **Highlight retry arrows** when mentioning error handling  
✅ **Point to CloudWatch/S3** when mentioning observability  
✅ **Circle the Step Functions box** when emphasizing orchestration  

---

## Timing

- Full narration: **60-90 seconds**
- Quick version: **30 seconds** (just the flow, skip details)
- Deep dive: **2 minutes** (include all architectural principles)

Use the **60-second version** for your demo unless asked for more detail.

---

**Practice this 2-3 times before recording so it flows naturally!**
