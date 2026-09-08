#!/usr/bin/env node
/*
 * Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { HpiReviewPipelineStack } from '../lib/hpi-review-pipeline-stack';
  
const app = new cdk.App();
new HpiReviewPipelineStack(app, 'HpiReviewPipelineStack', {
  env: {
    // Resolve from the deploying principal's credentials at synth time.
    // CDK_DEFAULT_ACCOUNT / CDK_DEFAULT_REGION are populated by the CDK CLI;
    // fall back to standard AWS env vars, defaulting region to us-east-1.
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
  },
  description: 'International Review Translation & Summarization Pipeline'
});

