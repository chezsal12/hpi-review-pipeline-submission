"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HpiReviewPipelineStack = void 0;
const cdk = require("aws-cdk-lib");
const lambda = require("aws-cdk-lib/aws-lambda");
const iam = require("aws-cdk-lib/aws-iam");
const sfn = require("aws-cdk-lib/aws-stepfunctions");
const tasks = require("aws-cdk-lib/aws-stepfunctions-tasks");
const s3 = require("aws-cdk-lib/aws-s3");
const path = require("path");
class HpiReviewPipelineStack extends cdk.Stack {
    constructor(scope, id, props) {
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
exports.HpiReviewPipelineStack = HpiReviewPipelineStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHBpLXJldmlldy1waXBlbGluZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImhwaS1yZXZpZXctcGlwZWxpbmUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCwyQ0FBMkM7QUFDM0MscURBQXFEO0FBQ3JELDZEQUE2RDtBQUM3RCx5Q0FBeUM7QUFFekMsNkJBQTZCO0FBRTVCLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixxRUFBcUU7UUFDckUsaUVBQWlFO1FBQ2pFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMvRCxVQUFVLEVBQUUsbUNBQW1DLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDN0Qsa0VBQWtFO1lBQ2xFLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLDJCQUEyQjtZQUMzQixpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsU0FBUyxFQUFFLElBQUk7WUFDZixhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7U0FDeEIsQ0FBQyxDQUFDO1FBRUgsOEJBQThCO1FBQzlCLE1BQU0sVUFBVSxHQUFHLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ25ELFVBQVUsRUFBRSw0QkFBNEIsSUFBSSxDQUFDLE9BQU8sRUFBRTtZQUN0RCxrRUFBa0U7WUFDbEUsVUFBVSxFQUFFLElBQUk7WUFDaEIsMkJBQTJCO1lBQzNCLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ2pELFVBQVUsRUFBRSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsVUFBVTtZQUMxQyxTQUFTLEVBQUUsSUFBSTtZQUNmLGdFQUFnRTtZQUNoRSxzQkFBc0IsRUFBRSxnQkFBZ0I7WUFDeEMsc0JBQXNCLEVBQUUsY0FBYztZQUN0QyxhQUFhLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQ3hDLGlCQUFpQixFQUFFLElBQUk7U0FDeEIsQ0FBQyxDQUFDO1FBRUgsb0JBQW9CO1FBQ3BCLE1BQU0sV0FBVyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQzNELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGlCQUFpQjtZQUMxQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUscUJBQXFCLENBQUMsQ0FBQztZQUN4RSxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1NBQ2hCLENBQUMsQ0FBQztRQUNILFdBQVcsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ2xELE9BQU8sRUFBRSxDQUFDLHlCQUF5QixDQUFDO1lBQ3BDLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUVKLGdGQUFnRjtRQUNoRixNQUFNLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMzRCxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSxpQkFBaUI7WUFDMUIsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLHFCQUFxQixDQUFDLENBQUM7WUFDeEUsT0FBTyxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNqQyxVQUFVLEVBQUUsR0FBRztTQUNoQixDQUFDLENBQUM7UUFDSCxXQUFXLENBQUMsZUFBZSxDQUFDLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUNsRCxPQUFPLEVBQUUsQ0FBQyxxQkFBcUIsQ0FBQztZQUNoQyxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUFDLENBQUM7UUFFSixtQkFBbUI7UUFDbkIsTUFBTSxVQUFVLEdBQUcsSUFBSSxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7WUFDekQsT0FBTyxFQUFFLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVztZQUNuQyxPQUFPLEVBQUUsaUJBQWlCO1lBQzFCLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1lBQ3ZFLE9BQU8sRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDakMsVUFBVSxFQUFFLEdBQUc7U0FDaEIsQ0FBQyxDQUFDO1FBQ0gsVUFBVSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUM7WUFDakQsT0FBTyxFQUFFLENBQUMseUJBQXlCLENBQUM7WUFDcEMsU0FBUyxFQUFFLENBQUMsR0FBRyxDQUFDO1NBQ2pCLENBQUMsQ0FBQyxDQUFDO1FBRUosbUZBQW1GO1FBQ25GLE1BQU0sYUFBYSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQy9ELE9BQU8sRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLFdBQVc7WUFDbkMsT0FBTyxFQUFFLGlCQUFpQjtZQUMxQixJQUFJLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsd0JBQXdCLENBQUMsQ0FBQztZQUMzRSxPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQ2pDLFVBQVUsRUFBRSxHQUFHO1NBQ2hCLENBQUMsQ0FBQztRQUNILGFBQWEsQ0FBQyxlQUFlLENBQUMsSUFBSSxHQUFHLENBQUMsZUFBZSxDQUFDO1lBQ3BELE9BQU8sRUFBRSxDQUFDLHFCQUFxQixDQUFDO1lBQ2hDLFNBQVMsRUFBRSxDQUFDLEdBQUcsQ0FBQztTQUNqQixDQUFDLENBQUMsQ0FBQztRQUlKLDJDQUEyQztRQUMzQyxNQUFNLGFBQWEsR0FBRyxJQUFJLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUM5RCxjQUFjLEVBQUUsV0FBVztZQUMzQixVQUFVLEVBQUUsV0FBVztZQUN2Qix3QkFBd0IsRUFBRSxJQUFJO1NBQy9CLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDVixNQUFNLEVBQUUsQ0FBQyx5QkFBeUIsRUFBRSxpQ0FBaUMsQ0FBQztZQUN0RSxRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLFdBQVcsRUFBRSxDQUFDO1lBQ2QsV0FBVyxFQUFFLENBQUM7U0FDZixDQUFDLENBQUMsUUFBUSxDQUFDO1lBQ1YsTUFBTSxFQUFFLENBQUMsbUJBQW1CLENBQUM7WUFDN0IsUUFBUSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNqQyxXQUFXLEVBQUUsQ0FBQztZQUNkLFdBQVcsRUFBRSxHQUFHO1NBQ2pCLENBQUMsQ0FBQztRQUVILE1BQU0sYUFBYSxHQUFHLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQzlELGNBQWMsRUFBRSxXQUFXO1lBQzNCLFVBQVUsRUFBRSxXQUFXO1lBQ3ZCLHdCQUF3QixFQUFFLElBQUk7U0FDL0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUNWLE1BQU0sRUFBRSxDQUFDLHlCQUF5QixFQUFFLGlDQUFpQyxDQUFDO1lBQ3RFLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsV0FBVyxFQUFFLENBQUM7WUFDZCxXQUFXLEVBQUUsQ0FBQztTQUNmLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDVixNQUFNLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztZQUM3QixRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLFdBQVcsRUFBRSxDQUFDO1lBQ2QsV0FBVyxFQUFFLEdBQUc7U0FDakIsQ0FBQyxDQUFDO1FBRUgsTUFBTSxZQUFZLEdBQUcsSUFBSSxLQUFLLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUU7WUFDNUQsY0FBYyxFQUFFLFVBQVU7WUFDMUIsVUFBVSxFQUFFLFdBQVc7WUFDdkIsd0JBQXdCLEVBQUUsSUFBSTtTQUMvQixDQUFDLENBQUMsUUFBUSxDQUFDO1lBQ1YsV0FBVyxFQUFFLENBQUM7U0FDZixDQUFDLENBQUMsUUFBUSxDQUFDO1lBQ1YsTUFBTSxFQUFFLENBQUMsbUJBQW1CLENBQUM7WUFDN0IsUUFBUSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNqQyxXQUFXLEVBQUUsQ0FBQztZQUNkLFdBQVcsRUFBRSxHQUFHO1NBQ2pCLENBQUMsQ0FBQztRQUVILE1BQU0sZUFBZSxHQUFHLElBQUksS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ2xFLGNBQWMsRUFBRSxhQUFhO1lBQzdCLFVBQVUsRUFBRSxXQUFXO1lBQ3ZCLHdCQUF3QixFQUFFLElBQUk7U0FDL0IsQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUNWLE1BQU0sRUFBRSxDQUFDLHlCQUF5QixFQUFFLGlDQUFpQyxDQUFDO1lBQ3RFLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDakMsV0FBVyxFQUFFLENBQUM7WUFDZCxXQUFXLEVBQUUsQ0FBQztTQUNYLENBQUMsQ0FBQyxRQUFRLENBQUM7WUFDZCxNQUFNLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQztZQUM3QixRQUFRLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2pDLFdBQVcsRUFBRSxDQUFDO1lBQ1osV0FBVyxFQUFFLEdBQUc7U0FDbkIsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDdkQsS0FBSyxFQUFFLDBCQUEwQjtZQUNqQyxLQUFLLEVBQUUsd0JBQXdCO1NBQ2hDLENBQUMsQ0FBQztRQUVILGdDQUFnQztRQUNoQyxhQUFhLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRTtZQUNoQyxVQUFVLEVBQUUsU0FBUztTQUN0QixDQUFDLENBQUM7UUFDSCxhQUFhLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRTtZQUNoQyxVQUFVLEVBQUUsU0FBUztTQUN0QixDQUFDLENBQUM7UUFDSCxZQUFZLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRTtZQUMvQixVQUFVLEVBQUUsU0FBUztTQUN0QixDQUFDLENBQUM7UUFDSCxlQUFlLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRTtZQUNsQyxVQUFVLEVBQUUsU0FBUztTQUN0QixDQUFDLENBQUM7UUFFSCxNQUFNLFVBQVUsR0FBRyxhQUFhO2FBQzdCLElBQUksQ0FBQyxhQUFhLENBQUM7YUFDbkIsSUFBSSxDQUFDLFlBQVksQ0FBQzthQUNsQixJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFekIsZ0JBQWdCO1FBQ2hCLE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDaEUsZ0JBQWdCLEVBQUUscUJBQXFCO1lBQ3ZDLFVBQVU7WUFDVixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ2pDLENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxZQUFZLENBQUMsZUFBZTtZQUNuQyxXQUFXLEVBQUUsa0NBQWtDO1NBQ2hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxVQUFVO1lBQzVCLFdBQVcsRUFBRSxnQkFBZ0I7U0FDOUIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBak1BLHdEQWlNQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcblxuIGV4cG9ydCBjbGFzcyBIcGlSZXZpZXdQaXBlbGluZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogY2RrLlN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIERlZGljYXRlZCBidWNrZXQgZm9yIFMzIHNlcnZlciBhY2Nlc3MgbG9ncyAoa2VwdCBzZXBhcmF0ZSBmcm9tIHRoZVxuICAgIC8vIGRhdGEgYnVja2V0IHBlciBBV1MgYmVzdCBwcmFjdGljZSB0byBhdm9pZCBsb2dnaW5nIHJlY3Vyc2lvbikuXG4gICAgY29uc3QgYWNjZXNzTG9nc0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0FjY2Vzc0xvZ3NCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgaHBpLXJldmlldy1waXBlbGluZS1hY2Nlc3MtbG9ncy0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgLy8gRW5mb3JjZSBIVFRQUy1vbmx5IGFjY2VzcyAoZGVuaWVzIGF3czpTZWN1cmVUcmFuc3BvcnQgPSBmYWxzZSkuXG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgICAgLy8gQmxvY2sgYWxsIHB1YmxpYyBhY2Nlc3MuXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gUzMgYnVja2V0IGZvciBwaXBlbGluZSBkYXRhXG4gICAgY29uc3QgZGF0YUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0RhdGFCdWNrZXQnLCB7XG4gICAgICBidWNrZXROYW1lOiBgaHBpLXJldmlldy1waXBlbGluZS1kYXRhLSR7dGhpcy5hY2NvdW50fWAsXG4gICAgICAvLyBFbmZvcmNlIEhUVFBTLW9ubHkgYWNjZXNzIChkZW5pZXMgYXdzOlNlY3VyZVRyYW5zcG9ydCA9IGZhbHNlKS5cbiAgICAgIGVuZm9yY2VTU0w6IHRydWUsXG4gICAgICAvLyBCbG9jayBhbGwgcHVibGljIGFjY2Vzcy5cbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICAvLyBFbmFibGUgUzMgc2VydmVyIGFjY2VzcyBsb2dnaW5nIHRvIHRoZSBkZWRpY2F0ZWQgbG9ncyBidWNrZXQuXG4gICAgICBzZXJ2ZXJBY2Nlc3NMb2dzQnVja2V0OiBhY2Nlc3NMb2dzQnVja2V0LFxuICAgICAgc2VydmVyQWNjZXNzTG9nc1ByZWZpeDogJ2RhdGEtYnVja2V0LycsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBMYW1iZGE6IFRyYW5zbGF0ZVxuICAgIGNvbnN0IHRyYW5zbGF0ZUZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVHJhbnNsYXRlRm4nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMyxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvdHJhbnNsYXRlJykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgIH0pO1xuICAgIHRyYW5zbGF0ZUZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3RyYW5zbGF0ZTpUcmFuc2xhdGVUZXh0J10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcblxuICAgIC8vIExhbWJkYTogU3VtbWFyaXplIChzaGFyZWQvIGRpcmVjdG9yeSBjb3BpZWQgaW50byBmdW5jdGlvbiBkaXIgZm9yIGRlcGxveW1lbnQpXG4gICAgY29uc3Qgc3VtbWFyaXplRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdTdW1tYXJpemVGbicsIHtcbiAgICAgIHJ1bnRpbWU6IGxhbWJkYS5SdW50aW1lLlBZVEhPTl8zXzEzLFxuICAgICAgaGFuZGxlcjogJ2hhbmRsZXIuaGFuZGxlcicsXG4gICAgICBjb2RlOiBsYW1iZGEuQ29kZS5mcm9tQXNzZXQocGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL2xhbWJkYS9zdW1tYXJpemUnKSksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICBtZW1vcnlTaXplOiA1MTIsXG4gICAgfSk7XG4gICAgc3VtbWFyaXplRm4uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsnYmVkcm9jazpJbnZva2VNb2RlbCddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBMYW1iZGE6IExvY2FsaXplXG4gICAgY29uc3QgbG9jYWxpemVGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ0xvY2FsaXplRm4nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMyxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvbG9jYWxpemUnKSksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICBtZW1vcnlTaXplOiAyNTYsXG4gICAgfSk7XG4gICAgbG9jYWxpemVGbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWyd0cmFuc2xhdGU6VHJhbnNsYXRlVGV4dCddLFxuICAgICAgcmVzb3VyY2VzOiBbJyonXSxcbiAgICB9KSk7XG5cbiAgICAvLyBMYW1iZGE6IFF1YWxpdHkgR2F0ZSAoc2hhcmVkLyBkaXJlY3RvcnkgY29waWVkIGludG8gZnVuY3Rpb24gZGlyIGZvciBkZXBsb3ltZW50KVxuICAgIGNvbnN0IHF1YWxpdHlHYXRlRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdRdWFsaXR5R2F0ZUZuJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTMsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3F1YWxpdHktZ2F0ZScpKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcbiAgICBxdWFsaXR5R2F0ZUZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuXG5cblxuICAgIC8vIFN0ZXAgRnVuY3Rpb25zIHRhc2tzIHdpdGggZXJyb3IgaGFuZGxpbmdcbiAgICBjb25zdCB0cmFuc2xhdGVUYXNrID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnVHJhbnNsYXRlJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IHRyYW5zbGF0ZUZuLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgfSkuYWRkUmV0cnkoe1xuICAgICAgZXJyb3JzOiBbJ0xhbWJkYS5TZXJ2aWNlRXhjZXB0aW9uJywgJ0xhbWJkYS5Ub29NYW55UmVxdWVzdHNFeGNlcHRpb24nXSxcbiAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygyKSxcbiAgICAgIG1heEF0dGVtcHRzOiAzLFxuICAgICAgYmFja29mZlJhdGU6IDIsXG4gICAgfSkuYWRkUmV0cnkoe1xuICAgICAgZXJyb3JzOiBbJ1N0YXRlcy5UYXNrRmFpbGVkJ10sXG4gICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMSksXG4gICAgICBtYXhBdHRlbXB0czogMixcbiAgICAgIGJhY2tvZmZSYXRlOiAxLjUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdW1tYXJpemVUYXNrID0gbmV3IHRhc2tzLkxhbWJkYUludm9rZSh0aGlzLCAnU3VtbWFyaXplJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IHN1bW1hcml6ZUZuLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgfSkuYWRkUmV0cnkoe1xuICAgICAgZXJyb3JzOiBbJ0xhbWJkYS5TZXJ2aWNlRXhjZXB0aW9uJywgJ0xhbWJkYS5Ub29NYW55UmVxdWVzdHNFeGNlcHRpb24nXSxcbiAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygyKSxcbiAgICAgIG1heEF0dGVtcHRzOiAzLFxuICAgICAgYmFja29mZlJhdGU6IDIsXG4gICAgfSkuYWRkUmV0cnkoe1xuICAgICAgZXJyb3JzOiBbJ1N0YXRlcy5UYXNrRmFpbGVkJ10sXG4gICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMSksXG4gICAgICBtYXhBdHRlbXB0czogMixcbiAgICAgIGJhY2tvZmZSYXRlOiAxLjUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBsb2NhbGl6ZVRhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdMb2NhbGl6ZScsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBsb2NhbGl6ZUZuLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgfSkuYWRkUmV0cnkoe1xuICAgICAgYmFja29mZlJhdGU6IDIsXG4gICAgfSkuYWRkUmV0cnkoe1xuICAgICAgZXJyb3JzOiBbJ1N0YXRlcy5UYXNrRmFpbGVkJ10sXG4gICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMSksXG4gICAgICBtYXhBdHRlbXB0czogMixcbiAgICAgIGJhY2tvZmZSYXRlOiAxLjUsXG4gICAgfSk7XG5cbiAgICBjb25zdCBxdWFsaXR5R2F0ZVRhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdRdWFsaXR5R2F0ZScsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBxdWFsaXR5R2F0ZUZuLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG4gICAgICByZXRyeU9uU2VydmljZUV4Y2VwdGlvbnM6IHRydWUsXG4gICAgfSkuYWRkUmV0cnkoe1xuICAgICAgZXJyb3JzOiBbJ0xhbWJkYS5TZXJ2aWNlRXhjZXB0aW9uJywgJ0xhbWJkYS5Ub29NYW55UmVxdWVzdHNFeGNlcHRpb24nXSxcbiAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygyKSxcbiAgICAgIG1heEF0dGVtcHRzOiAzLFxuICAgICAgYmFja29mZlJhdGU6IDIsXG4gICAgICAgIH0pLmFkZFJldHJ5KHtcbiAgICAgIGVycm9yczogWydTdGF0ZXMuVGFza0ZhaWxlZCddLFxuICAgICAgaW50ZXJ2YWw6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEpLFxuICAgICAgbWF4QXR0ZW1wdHM6IDIsXG4gICAgICAgIGJhY2tvZmZSYXRlOiAxLjUsXG4gICAgfSk7XG5cbiAgICAvLyBGYWlsdXJlIHN0YXRlIGZvciBlcnJvciBoYW5kbGluZ1xuICAgIGNvbnN0IGZhaWxTdGF0ZSA9IG5ldyBzZm4uRmFpbCh0aGlzLCAnUHJvY2Vzc2luZ0ZhaWxlZCcsIHtcbiAgICAgIGNhdXNlOiAnUmV2aWV3IHByb2Nlc3NpbmcgZmFpbGVkJyxcbiAgICAgIGVycm9yOiAnUGlwZWxpbmVFeGVjdXRpb25FcnJvcicsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgY2F0Y2ggYmxvY2tzIHRvIGVhY2ggdGFza1xuICAgIHRyYW5zbGF0ZVRhc2suYWRkQ2F0Y2goZmFpbFN0YXRlLCB7XG4gICAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgfSk7XG4gICAgc3VtbWFyaXplVGFzay5hZGRDYXRjaChmYWlsU3RhdGUsIHtcbiAgICAgIHJlc3VsdFBhdGg6ICckLmVycm9yJyxcbiAgICB9KTtcbiAgICBsb2NhbGl6ZVRhc2suYWRkQ2F0Y2goZmFpbFN0YXRlLCB7XG4gICAgICByZXN1bHRQYXRoOiAnJC5lcnJvcicsXG4gICAgfSk7XG4gICAgcXVhbGl0eUdhdGVUYXNrLmFkZENhdGNoKGZhaWxTdGF0ZSwge1xuICAgICAgcmVzdWx0UGF0aDogJyQuZXJyb3InLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZGVmaW5pdGlvbiA9IHRyYW5zbGF0ZVRhc2tcbiAgICAgIC5uZXh0KHN1bW1hcml6ZVRhc2spXG4gICAgICAubmV4dChsb2NhbGl6ZVRhc2spXG4gICAgICAubmV4dChxdWFsaXR5R2F0ZVRhc2spO1xuXG4gICAgLy8gU3RhdGUgTWFjaGluZVxuICAgIGNvbnN0IHN0YXRlTWFjaGluZSA9IG5ldyBzZm4uU3RhdGVNYWNoaW5lKHRoaXMsICdSZXZpZXdQaXBlbGluZScsIHtcbiAgICAgIHN0YXRlTWFjaGluZU5hbWU6ICdocGktcmV2aWV3LXBpcGVsaW5lJyxcbiAgICAgIGRlZmluaXRpb24sXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnU3RhdGVNYWNoaW5lQXJuJywge1xuICAgICAgdmFsdWU6IHN0YXRlTWFjaGluZS5zdGF0ZU1hY2hpbmVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1N0ZXAgRnVuY3Rpb25zIFN0YXRlIE1hY2hpbmUgQVJOJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXRhQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBkYXRhQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIERhdGEgQnVja2V0JyxcbiAgICB9KTtcbiAgfVxufVxuIl19