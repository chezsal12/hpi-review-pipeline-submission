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
    translateFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*'],
    }));
  
    // Lambda: Summarize (shared/ directory copied into function dir for deployment)
    const summarizeFn = new lambda.Function(this, 'SummarizeFn', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/summarize')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });
    summarizeFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));
  
    // Lambda: Localize
    const localizeFn = new lambda.Function(this, 'LocalizeFn', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/localize')),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });
    localizeFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['translate:TranslateText'],
      resources: ['*'],
    }));
  
    // Lambda: Quality Gate (shared/ directory copied into function dir for deployment)
    const qualityGateFn = new lambda.Function(this, 'QualityGateFn', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/quality-gate')),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });
    qualityGateFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['*'],
    }));
  
    // Step Functions tasks
    const translateTask = new tasks.LambdaInvoke(this, 'Translate', {
      lambdaFunction: translateFn,
      outputPath: '$.Payload',
    });
  
    const summarizeTask = new tasks.LambdaInvoke(this, 'Summarize', {
      lambdaFunction: summarizeFn,
      outputPath: '$.Payload',
    });
  
    const localizeTask = new tasks.LambdaInvoke(this, 'Localize', {
      lambdaFunction: localizeFn,
      outputPath: '$.Payload',
    });
  
    const qualityGateTask = new tasks.LambdaInvoke(this, 'QualityGate', {
      lambdaFunction: qualityGateFn,
      outputPath: '$.Payload',
    });
  
    // Define workflow
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

