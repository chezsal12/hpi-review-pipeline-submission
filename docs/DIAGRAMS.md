# Architecture Diagrams

  ## System Architecture

  ```mermaid
  graph TB
      subgraph "Input"
          Review[Product Review<br/>FR/DE]
      end

      subgraph "AWS Account <AWS-ACCOUNT-ID>"
          SF[Step Functions<br/>hpi-review-pipeline]

          subgraph "Lambda Functions"
              L1[TranslateLambda<br/>Python 3.13]
              L2[SummarizeLambda<br/>Python 3.13]
              L3[LocalizeLambda<br/>Python 3.13]
              L4[QualityGateLambda<br/>Python 3.13]
          end

          subgraph "AWS Services"
              Translate[Amazon Translate]
              Bedrock[Amazon Bedrock<br/>Claude Sonnet 5]
              S3[S3 Bucket<br/>hpi-review-pipeline-data]
          end

          SF --> L1
          L1 --> Translate
          L1 --> L2
          L2 --> Bedrock
          L2 --> L3
          L3 --> Translate
          L3 --> L4
          L4 --> Bedrock
          L4 --> Output

          S3 -.-> SF
      end

      Review --> SF
      Output[Localized Summary<br/>+ Quality Score]

  Data Flow

  mermaid
  sequenceDiagram
      participant User
      participant SF as Step Functions
      participant T as TranslateLambda
      participant AT as Amazon Translate
      participant S as SummarizeLambda
      participant B as Bedrock Claude
      participant L as LocalizeLambda
      participant Q as QualityGateLambda

      User->>SF: French Review
      SF->>T: Execute Translate
      T->>AT: Translate FR→EN
      AT-->>T: English Text
      T-->>SF: + translated_text

      SF->>S: Execute Summarize
      S->>B: Generate Summary
      B-->>S: English Summary
      S-->>SF: + summary_english

      SF->>L: Execute Localize
      L->>AT: Translate EN→FR
      AT-->>L: French Summary
      L-->>SF: + summary_localized

      SF->>Q: Execute Quality Gate
      Q->>Q: Rule Checks
      Q->>B: Semantic Score
      B-->>Q: Score (1-10)
      Q-->>SF: + quality_passed
      SF-->>User: Complete Result

  Component Interaction

  ┌─────────────────────────────────────────────────────────────┐
  │                    Step Functions                            │
  │                 hpi-review-pipeline                          │
  └───────┬──────────────┬──────────────┬──────────────┬────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐
     │Translate│   │Summarize│   │Localize │   │ Quality  │
     │ Lambda  │   │ Lambda  │   │ Lambda  │   │   Gate   │
     └────┬────┘   └────┬────┘   └────┬────┘   └────┬─────┘
          │             │             │             │
          ▼             ▼             ▼             ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐
     │ Amazon  │   │ Amazon  │   │ Amazon  │   │ Amazon   │
     │Translate│   │ Bedrock │   │Translate│   │ Bedrock  │
     └─────────┘   └─────────┘   └─────────┘   └──────────┘

  Pipeline Stages

  Stage 1: Translation
  - Input: Review in source language (FR/DE)
  - Service: Amazon Translate
  - Output: English text

  Stage 2: Summarization
  - Input: English review
  - Service: Amazon Bedrock (Claude Sonnet 5)
  - Output: 1-2 sentence English summary (15-50 words)

  Stage 3: Localization
  - Input: English summary
  - Service: Amazon Translate
  - Output: Summary in original language

  Stage 4: Quality Gate
  - Input: Localized summary + original review
  - Services: Rule-based checks + Bedrock semantic scoring
  - Output: Pass/fail + quality score (1-10)

  Deployment Architecture

  ┌──────────────────────────────────────────────────────────┐
  │  Developer Machine                                        │
  │  ┌─────────────┐                                         │
  │  │  CDK Stack  │                                         │
  │  │ TypeScript  │                                         │
  │  └──────┬──────┘                                         │
  └─────────┼────────────────────────────────────────────────┘
            │ cdk deploy
            ▼
  ┌──────────────────────────────────────────────────────────┐
  │  AWS Account <AWS-ACCOUNT-ID>                                 │
  │  ┌────────────────────────────────────────────────────┐  │
  │  │  CloudFormation Stack                              │  │
  │  │  HpiReviewPipelineStack                            │  │
  │  └────────────────────────────────────────────────────┘  │
  │         │                                                 │
  │         ├─► 4 Lambda Functions (Python 3.13)             │
  │         ├─► Step Functions State Machine                 │
  │         ├─► S3 Bucket (encrypted, logging)               │
  │         └─► IAM Roles & Policies                         │
  └──────────────────────────────────────────────────────────┘


