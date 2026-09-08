/*
 * Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';

export class HpiReviewPipelineStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // Dedicated bucket for S3 server access logs (kept separate from the
        // data bucket per AWS best practice to avoid logging recursion).
        const accessLogsBucket = new s3.Bucket(this, 'AccessLogsBucket', {
            bucketName: `hpi-review-pipeline-access-logs-${this.account}`,
            // Enforce HTTPS-only access (denies aws:SecureTransport = false).
            enforceSSL: true,
            // Block all public access.
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // S3 bucket for pipeline data
        const dataBucket = new s3.Bucket(this, 'DataBucket', {
            bucketName: `hpi-review-pipeline-data-${this.account}`,
            // Enforce HTTPS-only access (denies aws:SecureTransport = false).
            enforceSSL: true,
            // Block all public access.
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            encryption: s3.BucketEncryption.S3_MANAGED,
            versioned: true,
            // Enable S3 server access logging to the dedicated logs bucket.
            serverAccessLogsBucket: accessLogsBucket,
            serverAccessLogsPrefix: 'data-bucket/',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        // Lambda: Translate
        const translateFn = new lambda.Function(this, 'TranslateFn', {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/translate')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
        });

        // Lambda: Summarize (shared/ directory copied into function dir for deployment)
        const summarizeFn = new lambda.Function(this, 'SummarizeFn', {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/summarize')),
            timeout: cdk.Duration.seconds(60),
            memorySize: 512,
        });
        // Scope Bedrock access to specific model ARN
        summarizeFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/us.anthropic.claude-sonnet-5`
            ],
        }));

        // Lambda: Localize
        const localizeFn = new lambda.Function(this, 'LocalizeFn', {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/localize')),
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
        });

        // Lambda: Quality Gate (shared/ directory copied into function dir for deployment)
        const qualityGateFn = new lambda.Function(this, 'QualityGateFn', {
            runtime: lambda.Runtime.PYTHON_3_13,
            handler: 'handler.handler',
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/quality-gate')),
            timeout: cdk.Duration.seconds(60),
            memorySize: 512,
        });
        // Scope Bedrock access to specific model ARN
        qualityGateFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['bedrock:InvokeModel'],
            resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/us.anthropic.claude-sonnet-5`
            ],
        }));

        // Step Functions tasks with error handling
        const translateTask = new tasks.LambdaInvoke(this, 'Translate', {
            lambdaFunction: translateFn,
            outputPath: '$.Payload',
            retryOnServiceExceptions: true,
        }).addRetry({
            errors: ['Lambda.ServiceException', 'Lambda.TooManyRequestsException'],
            interval: cdk.Duration.seconds(2),
            maxAttempts: 3,
            backoffRate: 2,
        }).addRetry({
            errors: ['States.TaskFailed'],
            interval: cdk.Duration.seconds(1),
            maxAttempts: 2,
            backoffRate: 1.5,
        });

        const summarizeTask = new tasks.LambdaInvoke(this, 'Summarize', {
            lambdaFunction: summarizeFn,
            outputPath: '$.Payload',
            retryOnServiceExceptions: true,
        }).addRetry({
            errors: ['Lambda.ServiceException', 'Lambda.TooManyRequestsException'],
            interval: cdk.Duration.seconds(2),
            maxAttempts: 3,
            backoffRate: 2,
        }).addRetry({
            errors: ['States.TaskFailed'],
            interval: cdk.Duration.seconds(1),
            maxAttempts: 2,
            backoffRate: 1.5,
        });

        const localizeTask = new tasks.LambdaInvoke(this, 'Localize', {
            lambdaFunction: localizeFn,
            outputPath: '$.Payload',
            retryOnServiceExceptions: true,
        }).addRetry({
            errors: ['Lambda.ServiceException', 'Lambda.TooManyRequestsException'],
            interval: cdk.Duration.seconds(2),
            maxAttempts: 3,
            backoffRate: 2,
        }).addRetry({
            errors: ['States.TaskFailed'],
            interval: cdk.Duration.seconds(1),
            maxAttempts: 2,
            backoffRate: 1.5,
        });

        const qualityGateTask = new tasks.LambdaInvoke(this, 'QualityGate', {
            lambdaFunction: qualityGateFn,
            outputPath: '$.Payload',
            retryOnServiceExceptions: true,
        }).addRetry({
            errors: ['Lambda.ServiceException', 'Lambda.TooManyRequestsException'],
            interval: cdk.Duration.seconds(2),
            maxAttempts: 3,
            backoffRate: 2,
        }).addRetry({
            errors: ['States.TaskFailed'],
            interval: cdk.Duration.seconds(1),
            maxAttempts: 2,
            backoffRate: 1.5,
        });

        // Failure state for error handling
        const failState = new sfn.Fail(this, 'ProcessingFailed', {
            cause: 'Review processing failed',
            error: 'PipelineExecutionError',
        });

        // Add catch blocks to each task
        translateTask.addCatch(failState, {
            resultPath: '$.error',
        });
        summarizeTask.addCatch(failState, {
            resultPath: '$.error',
        });
        localizeTask.addCatch(failState, {
            resultPath: '$.error',
        });
        qualityGateTask.addCatch(failState, {
            resultPath: '$.error',
        });

        const definition = translateTask
            .next(summarizeTask)
            .next(localizeTask)
            .next(qualityGateTask);

        // State Machine
        const stateMachine = new sfn.StateMachine(this, 'ReviewPipeline', {
            stateMachineName: 'hpi-review-pipeline',
            definition,
            timeout: cdk.Duration.minutes(5),
        });

        // IAM policies for Translate functions - added after state machine creation to reference ARN
        //
        // SECURITY NOTE: Amazon Translate Wildcard Resource
        // Amazon Translate does not support resource-level permissions (AWS service limitation).
        // All translate:TranslateText actions require "Resource: *" per AWS documentation.
        //
        // COMPENSATING CONTROLS (maximum restrictions possible):
        // 1. Language pairs: Only fr/de→en translation allowed (SourceLanguageCode, TargetLanguageCode)
        // 2. Region scope: Only us-east-1 requests allowed (aws:RequestedRegion)
        // 3. Source restriction: Only callable from Step Functions state machine (aws:SourceArn)
        // 4. Least privilege action: Only translate:TranslateText granted (not translate:*)
        //
        // RISK ASSESSMENT: Accepted risk for prototype. The combination of language-pair, region,
        // and source ARN restrictions provides defense-in-depth against misuse. Runtime validation
        // in Lambda code provides additional application-level controls.
        translateFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['translate:TranslateText'],
            resources: ['*'],  // Required by AWS Translate service - no resource-level permissions supported
            conditions: {
                'StringEquals': {
                    'translate:SourceLanguageCode': ['fr', 'de'],
                    'translate:TargetLanguageCode': ['en'],
                    'aws:RequestedRegion': [this.region]
                },
                'ArnLike': {
                    'aws:SourceArn': stateMachine.stateMachineArn
                }
            }
        }));

        // Amazon Translate Localize function - same service limitation and compensating controls as above
        // Language pairs reversed: en→fr/de for localization
        localizeFn.addToRolePolicy(new iam.PolicyStatement({
            actions: ['translate:TranslateText'],
            resources: ['*'],  // Required by AWS Translate service - no resource-level permissions supported
            conditions: {
                'StringEquals': {
                    'translate:SourceLanguageCode': ['en'],
                    'translate:TargetLanguageCode': ['fr', 'de'],
                    'aws:RequestedRegion': [this.region]
                },
                'ArnLike': {
                    'aws:SourceArn': stateMachine.stateMachineArn
                }
            }
        }));

        // Outputs
        new cdk.CfnOutput(this, 'StateMachineArn', {
            value: stateMachine.stateMachineArn,
            description: 'Step Functions State Machine ARN',
        });

        new cdk.CfnOutput(this, 'DataBucketName', {
            value: dataBucket.bucketName,
            description: 'S3 Data Bucket',
        });
    }
}
