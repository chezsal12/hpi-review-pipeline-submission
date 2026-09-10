# HPI Review Pipeline - Demo Script (Code-First)

**Duration:** 15 minutes  
**Format:** Interactive code walkthrough  
**Audience:** Fictitious customer (e-commerce platform with international reviews)  
**CDE Builder Project Evaluation**

---

## Rehearsal Checklist (Do This BEFORE Recording Day)

### Rehearsal 1: Content & Flow (2-3 days before recording)

**Goal:** Get comfortable with the narrative, identify stumbles, test transitions

- [ ] Read through entire script out loud once
- [ ] Open all files/screens mentioned in script, verify they exist and look good
- [ ] Do a full dry-run recording (don't worry about perfection)
- [ ] Watch the dry-run and note:
  - Which sections feel awkward or unclear
  - Where you stumbled or lost your place
  - Which code sections need better setup/explanation
  - Actual time per section (does it fit 15 minutes?)
- [ ] Adjust script based on notes
- [ ] Practice explaining design rationale without reading (internalize the WHY)

### Rehearsal 2: Timing & Polish (1 day before recording)

**Goal:** Dial in timing, smooth transitions, build confidence

- [ ] Record a second full dry-run with timer visible
- [ ] Time each section:
  - Part 1 (Design Rationale): Target ~5 min, acceptable range 4-6 min
  - Part 2 (Live Walkthrough): Target ~10 min, acceptable range 9-11 min
- [ ] If over time, identify sections to trim (NOT design rationale - that's the gold)
- [ ] If under time, identify places to go deeper (show more code, explain more WHY)
- [ ] Practice the Spanish code change live (type it out, don't copy-paste in recording)
- [ ] Watch dry-run 2 and note:
  - Are you speaking too fast? Too slow?
  - Do you sound confident or apologetic?
  - Are transitions smooth or jarring?
- [ ] Practice answering likely questions (see below)

### Technical Validation (Day of recording, before you hit record)

**Goal:** Ensure everything works, no surprises during recording

- [ ] Test Step Functions execution (run it once, verify it succeeds)
- [ ] Verify CloudWatch dashboard loads and shows data
- [ ] Run `pytest` and confirm all 19 tests pass
- [ ] Test the Spanish code change in a scratch branch (make sure it compiles)
- [ ] Check AWS Console region is set to **us-east-1**
- [ ] Verify you have the correct input JSON ready to paste:
  ```json
  {
    "text": "Ce produit est incroyable! La qualité est exceptionnelle et le service client était parfait. Je recommande vivement.",
    "source_language": "fr",
    "review_id": "demo-001"
  }
  ```
- [ ] Close unnecessary browser tabs, apps, notifications
- [ ] Test microphone (AirPods or external mic, NOT laptop mic)
- [ ] Record 30-second test video, watch it back (audio clear? screen readable?)

### Likely Questions & Your Answers

Practice answering these out loud so you're ready if they come up in evaluation Q&A:

**Q: "Why not use Lambda layers for shared code?"**
A: "Simpler deployment model. The shared code is minimal—just translation utilities—and packaging it with each function avoids layer versioning complexity. For a prototype, simplicity wins. At scale, layers would make sense."

**Q: "Why not batch reviews together?"**
A: "Event-driven design. The architecture assumes reviews arrive individually in real-time—like a user submitting feedback. If the requirement changed to bulk processing, I'd switch to S3-triggered batch Lambda or Step Functions Map state. The current design optimizes for low latency."

**Q: "What happens when the quality gate fails?"**
A: "The review is still processed and stored, but flagged as failed quality gate. The OPERATIONS.md runbook documents the manual review queue process. In production, you'd route failed reviews to a human reviewer dashboard."

**Q: "Why didn't you implement caching for duplicate reviews?"**
A: "Cost-benefit analysis. Duplicate reviews are rare in this use case—each is unique customer feedback. Caching adds complexity (DynamoDB, cache invalidation logic) for minimal cost savings. I document this in COST_ANALYSIS.md as a future optimization if duplication becomes significant."

**Q: "How would this scale to 1 million reviews per day?"**
A: "Three changes: First, migrate from Step Functions to SQS + Lambda for cost—Step Functions becomes expensive at that scale. Second, implement batching—process 10-100 reviews per Lambda invocation to reduce overhead. Third, consider reserved capacity or Savings Plans for Translate since volume is predictable. The architecture is horizontally scalable—no changes to Lambda code needed."

**Q: "Why Claude Sonnet 5 instead of fine-tuning a smaller model?"**
A: "Time to value. Fine-tuning requires training data, experimentation, and ongoing maintenance. Sonnet 5 worked out-of-the-box with a simple prompt. The cost difference is negligible—$0.0003 per review. For a prototype, pre-trained models are the right choice. If this scaled to millions of reviews, fine-tuning could make sense."

**Q: "Did you consider using Amazon Comprehend for summarization?"**
A: "Yes. Comprehend has extractive summarization, but it doesn't support the concise 1-2 sentence format we need. Claude's generative summarization gives much better results—it captures sentiment and key points in natural language. I tested both during development."

### Anti-Patterns to Avoid During Recording

- ❌ **Apologizing for code:** "This isn't perfect but..." → Just explain your choices confidently
- ❌ **Reading docs verbatim:** Show docs, highlight key points, but don't read paragraphs
- ❌ **Rushing through design rationale:** This is the most valuable part—don't skimp
- ❌ **Ignoring errors:** If something fails live, explain calmly and troubleshoot or move on
- ❌ **Being defensive:** "I know this isn't ideal but..." → Own your trade-offs
- ❌ **Going off-script on tangents:** Stay focused, 15 minutes goes fast

---

## Setup Before Recording

### Pre-Recording Checklist (Final 10 minutes before hitting record)
- [ ] Open VS Code with repository root
- [ ] Open terminal tabs: one for local testing, one for AWS CLI
- [ ] Open browser tabs: AWS Console (Step Functions, CloudWatch, Lambda)
- [ ] Test Step Functions execution (verify it works)
- [ ] Have sample review ready to paste (save in a text file for easy copy)
- [ ] Zoom editor to 150-175% for readability
- [ ] Close all unnecessary apps and notifications
- [ ] Put phone on silent / Do Not Disturb
- [ ] Have water nearby
- [ ] Take a deep breath, you've got this

### Screen Layout
- **Primary:** VS Code (left) + Terminal (right/bottom)
- **Secondary:** Browser (AWS Console)
- **Tertiary:** File explorer for repo structure

---

## Part 1: Scope & Design Rationale (~5 minutes)

### Opening (30 seconds)

**[Screen: README.md open in VS Code]**

**Script:**
> "Hi, I'm Chezsal Kamaray. Thanks for the opportunity to walk you through this AI-powered review pipeline. I built this for a fictitious e-commerce platform that collects product reviews in French and German but needs concise English summaries for their analytics dashboard, plus localized summaries for customers browsing in their native language. Let me show you what I built and more importantly, why I made the design decisions I did."

---

### Design Rationale: Architecture (90 seconds)

**[Screen: Open ARCHITECTURE.md, scroll to architecture diagram]**

**Script:**
> "The core problem: translate international reviews, summarize them using AI, and localize the summaries back. I chose a serverless pipeline architecture with Step Functions orchestrating four Lambda functions. Let me walk you through the flow."

**[Screen: Show the architecture diagram - trace the flow with your cursor]**

> "A review comes in—French or German—with the text, language code, and review ID. Step Functions orchestrates four stages: Stage 1, Translate Lambda calls Amazon Translate to convert the review to English. Stage 2, Summarize Lambda uses Bedrock Claude Sonnet 5 to generate a 1-2 sentence summary. Stage 3, Localize Lambda translates that summary back to the original language. Stage 4, Quality Gate Lambda validates the summary with rule-based checks and LLM semantic scoring—89% pass rate. All data flows to S3, logs go to CloudWatch."

> "The key pattern: pass-through. Each Lambda receives the full event from the previous stage and adds its own fields. This means every stage has complete context, which simplifies debugging."

**[Screen: Continue scrolling through ARCHITECTURE.md]**

> "First, why serverless? This workload is event-driven and bursty—you might process 100 reviews one day and 10,000 the next. Lambda scales automatically and you only pay for execution time. No servers to manage, no capacity planning."

> "Second, why Step Functions instead of SQS? Step Functions costs more—15% of the total per-review cost—but it gives you built-in retry logic, error handling, and visual workflow monitoring. For a prototype, this is the right trade-off. If you scale to 100,000+ reviews per week, you'd migrate to SQS to cut costs, but you'd need to build custom retry and monitoring. I document this trade-off—let me show you."

**[Screen: Scroll down in ARCHITECTURE.md to "Architecture Choice: Step Functions vs SQS + Lambda" section, around line 209]**

> "Here's the break-even analysis. Step Functions makes sense up to about 100K reviews per week. Beyond that, SQS becomes cost-effective despite the engineering overhead. This gives you a clear migration path."

---

### Design Rationale: Service Selection (90 seconds)

**[Screen: Open ARCHITECTURE.md, scroll to the table around line 29 showing AWS Services]**

**Script:**
> "Three key service decisions: Amazon Translate for translation, Bedrock Claude Sonnet 5 for summarization, and S3 for storage."

**[Screen: Scroll down to line 222 - "Translation: Amazon Translate vs Custom Models" section]**

> "Why Amazon Translate? It's fully managed, supports 75+ languages, and costs $15 per million characters. For this use case—short product reviews—it's cost-effective and accurate. I validated translation quality during development and it was production-grade for French and German. The alternative would be custom models, which have lower per-unit cost but require training data, versioning, and ML Ops overhead. Translation is 78% of the total cost, but operational simplicity is worth the premium at current scale."

**[Screen: Scroll up to line 215 - "Model Selection: Claude Sonnet 5 vs Haiku" section]**

> "Why Claude Sonnet 5 instead of a smaller model like Haiku? I tested both. Haiku costs 65% less but the quality gate pass rate dropped from 89% to an estimated 60-70%. Failed reviews cost about $2 in manual review time, so the ROI is negative. Sonnet 5 is the right choice here. And here's the cost breakdown: Claude Sonnet 5 adds only $0.0003 per review—three hundredths of a cent—because the prompts are tiny. Translation dominates at 78% of cost. This means you can use the best model without breaking the budget."

---

### Design Rationale: Quality & Reliability (90 seconds)

**[Screen: Open lib/hpi-review-pipeline-stack.ts, scroll to around line 100-115 (TranslateTask retry configuration)]**

**Script:**
> "Reliability was non-negotiable. Every Lambda task has exponential backoff retry logic. Let me show you the code."

**[Screen: Highlight the .addRetry() blocks starting at line 104]**

> "Service exceptions like throttling: 3 retries, 2-second initial interval, 2x backoff. Task failures: 2 retries, 1-second interval, 1.5x backoff. This pattern repeats for all four Lambda functions. This achieved 100% execution success rate in testing with 100 reviews."

> "For quality validation, I built a two-tier quality gate: rule-based checks plus LLM semantic scoring. The rule-based checks are fast and cheap—sentence count, word length, no truncation. The LLM scoring uses Claude to rate whether the summary accurately captures the original meaning on a 1-10 scale."

**[Screen: Open lambda/quality-gate/quality_gate_service.py, scroll to check_quality function]**

> "Here's the quality gate logic. It runs both checks, and I tuned the semantic threshold based on data. Initially it was 7, but analysis of 100 reviews showed that was too strict—67% pass rate. Lowering to 5 improved it to 89% without sacrificing quality. This is documented in the batch test results."

**[Screen: Open docs/BATCH_TEST_RESULTS.md, show threshold tuning section]**

> "Data-driven tuning. This is why you test at scale before production."

---

## Part 2: Live Walkthrough (~10 minutes)

### Repository Structure (90 seconds)

**[Screen: VS Code file explorer, collapse/expand folders to show structure]**

**Script:**
> "Let me show you how the repository is organized. Everything is structured for discoverability and maintainability."

**[Screen: Expand folders while explaining]**

```
hpi-review-pipeline/
├── lambda/              # 4 Lambda functions
│   ├── translate/       # Stage 1: FR/DE → EN
│   ├── summarize/       # Stage 2: AI summarization
│   ├── localize/        # Stage 3: EN → FR/DE
│   ├── quality-gate/    # Stage 4: Validation
│   └── shared/          # Shared utilities (no duplication)
├── lib/                 # CDK infrastructure (TypeScript)
├── tests/               # 19 pytest unit tests
├── scripts/             # Batch testing, dashboard generation
├── docs/                # All documentation
└── data/                # 100 synthetic test reviews
```

> "Key principle: service layer pattern. Every Lambda has a thin handler and a separate service module for business logic. This makes testing easy—you test the service layer independently without mocking Lambda context."

**[Screen: Open lambda/translate/handler.py and translate_service.py side by side]**

> "Handler: thin adapter, just parses the event. Service: business logic, fully testable. This pattern is consistent across all four functions."

---

### Code Quality: Holmes CDE Certification (60 seconds)

**[Screen: Open holmes-scan-results.md]**

**Script:**
> "This project achieved Holmes CDE certification with zero HIGH findings. Holmes is AWS's AI-powered code quality scanner. It took 10+ iterations to get here, but the result is production-grade code."

**[Screen: Scroll through the issues resolved section]**

> "Key fixes: service layer extraction for testability, comprehensive error handling at all AWS boundaries, eliminating code duplication—shared utilities live in lambda/shared—and consistent documentation. The scan validated 19 pytest tests, S3 security configuration, IAM least privilege policies, and operational readiness."

---

### Security: ProtoShield Compliance (45 seconds)

**[Screen: Open protoshield-scan-results.md]**

**Script:**
> "Security was validated with ProtoShield: zero critical, zero high findings. Two key areas: licensing and IAM policies."

**[Screen: Open LICENSE file]**

> "Every source file has an Apache 2.0 license header. This is a CDE requirement."

**[Screen: Open lib/hpi-review-pipeline-stack.ts, scroll to IAM policy section with security notes]**

> "IAM least privilege: Bedrock policies are scoped to the specific Claude Sonnet 5 model ARN. Translate policies have compensating controls—language pairs restricted to FR/DE and EN, region locked to us-east-1, and callable only from the Step Functions state machine. Amazon Translate doesn't support resource-level permissions, so I documented the service limitation and the defense-in-depth controls. This satisfied the security scanner."

---

### Live Execution: Run the Pipeline (2 minutes)

**[Screen: Browser → AWS Console → Step Functions]**

**Script:**
> "Let me run the pipeline live. I'm in the Step Functions console looking at the state machine."

**[Actions: Click "Start execution"]**

> "I'll execute a French product review."

**[Screen: Paste input JSON]**

```json
{
  "text": "Ce produit est incroyable! La qualité est exceptionnelle et le service client était parfait. Je recommande vivement.",
  "source_language": "fr",
  "review_id": "demo-001"
}
```

**[Actions: Click "Start execution", show graph]**

> "Watch the workflow execute. Four stages: Translate, Summarize, Localize, QualityGate. Each stage passes state through—full event plus new fields. This is the pass-through pattern, which simplifies debugging because every stage has full context."

**[Wait ~8 seconds for completion]**

> "Done. All four stages succeeded in 8 seconds. Let me show you the output."

**[Actions: Click on QualityGate step, show final output]**

> "Here's the result: original French text, English translation—'This product is amazing, the quality is exceptional'—the English summary generated by Claude, the summary translated back to French, and a quality score of 8 out of 10. The quality gate passed all checks: correct sentence count, appropriate word length, strong semantic retention."

---

### Monitoring: CloudWatch Dashboard & Alarms (90 seconds)

**[Screen: Browser → CloudWatch → Dashboards → hpi-review-pipeline]**

**Script:**
> "Production monitoring. I built a CloudWatch dashboard with four widgets tracking key metrics."

**[Actions: Show each widget while explaining]**

> "Widget 1: Pipeline executions—started, succeeded, failed. At-a-glance health. Widget 2: Average execution time in milliseconds—consistently 5-10 seconds. Widget 3: Lambda errors by function—isolates which stage is failing. Widget 4: Lambda duration by function—spots performance degradation."

**[Screen: Navigate to CloudWatch → Alarms]**

> "Three production alarms: ExecutionsFailed triggers on any failed execution—highest priority. LambdaErrors triggers on elevated error rates. SlowExecution triggers if runtime exceeds 15 seconds, indicating throttling or network issues. All three are in OK state—system is healthy."

**[Screen: Back to VS Code, open docs/OPERATIONS.md]**

> "Everything is documented in the operational runbook. Troubleshooting procedures for four scenarios: pipeline failures, Lambda errors, quality gate issues, performance degradation. Step-by-step investigation, common root causes, remediation actions. This ensures maintainability."

---

### Local Development: Run Tests Locally (30 seconds)

**[Screen: Terminal in repository root]**

**Script:**
> "Let me prove you can run this locally. The repository is on GitHub, and I have a test script that handles setup and execution."

**[Screen: Show you're in the repo]**

```bash
pwd  # Shows /Users/chezsal/projects/hpi-review-pipeline
git remote -v  # Shows GitHub URL
```

> "This is the repository, available on GitHub at github.com/chezsal12/hpi-review-pipeline-submission. You can see the remote URL here. Anyone can clone it. Now let me run the tests."

**[Actions: Run the test script]**

```bash
./run-tests.sh
```

**[Wait ~10-15 seconds while script runs - it installs dependencies and runs tests]**

**[Screen: Show output - pip installing, then pytest running]**

> "The script handles dependency installation and runs all tests. Tests cover all four Lambda functions: translation service, summarization with mocked Bedrock, localization, and quality gate validation. All passing. The service layer pattern makes this testable—no AWS credentials needed for tests."

**[Screen: Show final output - "✅ All tests passed!"]**

> "Anyone can clone this repo from GitHub and run this same script. It's reproducible and ready to extend."

---

### Demonstrate a Change: Add Spanish Support (2.5 minutes)

**[Screen: VS Code, open lambda/translate/translate_service.py]**

**Script:**
> "Let me demonstrate continuation. I'll add Spanish support to show how you'd extend this pipeline."

**[Actions: Edit the code live]**

**Step 1: Update IAM policies (the actual change needed)**

**[Screen: Open lambda/translate/translate_service.py first to show there's no validation]**

```python
def translate_review(text, source_language, target_language='en'):
    """
    Translate review text into the target language (English by default).
    """
    return translate_text(text, source_language, target_language)
```

> "First, notice the translation service has no language validation—it delegates directly to Amazon Translate. So the only change needed is the IAM policy."

**Step 2: Update IAM policy in CDK stack**

**[Screen: Open lib/hpi-review-pipeline-stack.ts, scroll to line 211-224 where the Translate IAM policy is]**

```typescript
translateFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['translate:TranslateText'],
    resources: ['*'],
    conditions: {
        'StringEquals': {
            'translate:SourceLanguageCode': ['fr', 'de', 'es'],  // Add 'es'
            'translate:TargetLanguageCode': ['en'],
            'aws:RequestedRegion': [this.region]
        },
        'ArnLike': {
            'aws:SourceArn': stateMachine.stateMachineArn
        }
    }
}));
```

> "Just add 'es' to the SourceLanguageCode array here. Then scroll down to the localize function's policy around line 228 and add 'es' to its TargetLanguageCode array. That's it - Spanish is now supported. The code doesn't need changes because there's no validation layer."

**Step 3: Add a test (optional but good practice)**

**[Screen: Open lambda/translate/test_local.py]**

> "You'd add a test case for Spanish translation here to validate it works. The test would mock the Translate API response for Spanish-to-English translation. But for the demo, I'll skip writing it and move to deployment."

**Step 4: Deploy**

```bash
cdk deploy
```

> "One command deploys the IAM policy changes. No Lambda code changes needed - the translation functions already support any language Amazon Translate supports. Infrastructure as code makes this reproducible and auditable. After deployment, Spanish reviews would work immediately."

---

### Cost Analysis & Scale (60 seconds)

**[Screen: Open COST_ANALYSIS.md]**

**Script:**
> "Let's talk cost. Actual cost per review: $0.0196—less than 2 cents. This came in 22% under budget."

**[Screen: Scroll to cost breakdown table]**

> "Translation dominates at 78% of cost. Bedrock is only 2%—Claude is incredibly efficient. Step Functions is 15%. At scale: 12,000 reviews per week costs $940 per month. 100,000 reviews per week: $7,840 per month. This is predictable and linear."

**[Screen: Scroll to trade-offs section]**

> "I documented the trade-offs: when to switch from Step Functions to SQS for cost savings, when to consider Haiku instead of Sonnet 5, and how to optimize if translation costs become prohibitive—caching duplicate reviews or batching API calls. This gives you a roadmap for scale."

---

### Documentation & Deliverables (45 seconds)

**[Screen: File explorer, show docs/ folder]**

**Script:**
> "Everything is documented. Architecture with design rationale. Deployment guide with step-by-step instructions. Cost analysis with trade-offs and projections. Daily log tracking 9 days of development. Batch test results analyzing 100-review scale testing. Operations runbook for production support. Executive summary for stakeholders."

**[Screen: Open README.md]**

> "README provides quick start: prerequisites, deployment steps, testing, monitoring. Goal: anyone can clone this repo and be productive in 10 minutes."

---

## Closing (30 seconds)

**[Screen: Show CloudWatch dashboard one more time, or AWS Console showing healthy system]**

**Script:**
> "In summary, this pipeline is production-ready. It's deployed and operational. It's monitored with dashboards and alarms. It's tested at scale with 100 reviews—100% execution success, 89% quality pass rate. It's CDE-certified by Holmes with zero HIGH findings. It's security-compliant per ProtoShield. It's documented for deployment, operations, and continuation. It's cost-efficient at under 2 cents per review. And I just demonstrated you can extend it with minimal effort. This is how you'd build an AI pipeline on AWS that's ready for production and ready for growth. Thank you for watching."

---

## Recording Tips

### Technical Setup
- **Screen Resolution:** 1080p (1920x1080)
- **Recording Tool:** QuickTime, OBS, or Loom
- **Audio:** Clear microphone, quiet room
- **Editor Zoom:** 150-175% in VS Code for readability
- **Terminal Font:** Large enough to read (16-18pt)

### During Recording
- **Pace:** Speak clearly, not rushed. 15 minutes is generous.
- **Mouse:** Move smoothly, highlight key lines of code
- **Transitions:** Use natural language: "Let me show you...", "Here's why..."
- **Code Focus:** Spend time in the code, not just reading docs
- **Live Execution:** Show real commands, real output, real errors if they happen

### What to Avoid
- ❌ Slide decks (1-2 context slides max, rest is code)
- ❌ Reading documentation verbatim
- ❌ Long pauses or dead air
- ❌ Apologizing for code or decisions (be confident)
- ❌ Ignoring the customer framing (deliver TO the customer, not ABOUT the project)

### Post-Recording
- **Edit:** Trim dead air, fix major stumbles (minor ones are fine)
- **Export:** MP4, H.264, 1080p, aim for <500MB
- **Upload:** Directly to SIM ticket or YouTube (unlisted)

---

## Alternative Flow Options

If 15 minutes feels too tight, you can adjust:

### Option A: Skip Spanish Demo
- Replace live Spanish coding with "Here's how you'd add Spanish" walk-through (just talk through it, don't type)
- Saves 2 minutes

### Option B: Shorter AWS Console Time
- Show one Step Functions execution, skip CloudWatch deep-dive
- Reference monitoring in passing, focus more on code

### Option C: Pre-recorded Execution
- Record the Step Functions execution ahead of time
- Play back the video during demo to avoid waiting 8 seconds live
- Only do this if you're tight on time

---

## Checklist Before Submission

- [ ] Video is 12-15 minutes
- [ ] Shows live working code in IDE
- [ ] Runs the pipeline end-to-end in AWS Console
- [ ] Explains design rationale (WHY, not just WHAT)
- [ ] Shows repository structure and organization
- [ ] Demonstrates local testing (pytest)
- [ ] Shows a live code change (Spanish support or alternative)
- [ ] References cost analysis and trade-offs
- [ ] Shows monitoring dashboard and alarms
- [ ] References documentation (README, ARCHITECTURE, OPERATIONS)
- [ ] Audio is clear
- [ ] Code is readable (zoomed in)
- [ ] File format: MP4 or MOV
- [ ] File size: <500MB
- [ ] Ready to upload to SIM ticket

---

Good luck! Remember: show the code, run the code, explain your choices. 🚀
