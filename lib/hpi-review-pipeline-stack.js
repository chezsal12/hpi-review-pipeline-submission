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
        // Lambda: Summarize
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
        // Lambda: Quality Gate
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
exports.HpiReviewPipelineStack = HpiReviewPipelineStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHBpLXJldmlldy1waXBlbGluZS1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImhwaS1yZXZpZXctcGlwZWxpbmUtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUNBQW1DO0FBQ25DLGlEQUFpRDtBQUNqRCwyQ0FBMkM7QUFDM0MscURBQXFEO0FBQ3JELDZEQUE2RDtBQUM3RCx5Q0FBeUM7QUFFekMsNkJBQTZCO0FBRTVCLE1BQWEsc0JBQXVCLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFzQjtRQUMvRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixxRUFBcUU7UUFDckUsaUVBQWlFO1FBQ2pFLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRTtZQUMvRCxVQUFVLEVBQUUsbUNBQW1DLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDN0Qsa0VBQWtFO1lBQ2xFLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLDJCQUEyQjtZQUMzQixpQkFBaUIsRUFBRSxFQUFFLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUNqRCxVQUFVLEVBQUUsRUFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUN4QyxpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQUMsQ0FBQztRQUVILDhCQUE4QjtRQUM5QixNQUFNLFVBQVUsR0FBRyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLFlBQVksRUFBRTtZQUNuRCxVQUFVLEVBQUUsNEJBQTRCLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDdEQsa0VBQWtFO1lBQ2xFLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLDJCQUEyQjtZQUMzQixpQkFBaUIsRUFBRSxFQUFFLENB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LE1BQU0sWUFBWSxHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDaEUsZ0JBQWdCLEVBQUUscUJBQXFCO1lBQ3ZDLFVBQVU7WUFDVixPQUFPLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1NBQ2pDLENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQ3pDLEtBQUssRUFBRSxZQUFZLENBQUMsZUFBZTtZQUNuQyxXQUFXLEVBQUUsa0NBQWtDO1NBQ2hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxVQUFVO1lBQzVCLFdBQVcsRUFBRSxnQkFBZ0I7U0FDOUIsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBaklBLHdEQWlJQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBsYW1iZGEgZnJvbSAnYXdzLWNkay1saWIvYXdzLWxhbWJkYSc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBzZm4gZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMnO1xuaW1wb3J0ICogYXMgdGFza3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLXN0ZXBmdW5jdGlvbnMtdGFza3MnO1xuaW1wb3J0ICogYXMgczMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXMzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcbiAgXG4gZXhwb3J0IGNsYXNzIEhwaVJldmlld1BpcGVsaW5lU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM/OiBjZGsuU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuICBcbiAgICAvLyBEZWRpY2F0ZWQgYnVja2V0IGZvciBTMyBzZXJ2ZXIgYWNjZXNzIGxvZ3MgKGtlcHQgc2VwYXJhdGUgZnJvbSB0aGVcbiAgICAvLyBkYXRhIGJ1Y2tldCBwZXIgQVdTIGJlc3QgcHJhY3RpY2UgdG8gYXZvaWQgbG9nZ2luZyByZWN1cnNpb24pLlxuICAgIGNvbnN0IGFjY2Vzc0xvZ3NCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBY2Nlc3NMb2dzQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGhwaS1yZXZpZXctcGlwZWxpbmUtYWNjZXNzLWxvZ3MtJHt0aGlzLmFjY291bnR9YCxcbiAgICAgIC8vIEVuZm9yY2UgSFRUUFMtb25seSBhY2Nlc3MgKGRlbmllcyBhd3M6U2VjdXJlVHJhbnNwb3J0ID0gZmFsc2UpLlxuICAgICAgZW5mb3JjZVNTTDogdHJ1ZSxcbiAgICAgIC8vIEJsb2NrIGFsbCBwdWJsaWMgYWNjZXNzLlxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFMzIGJ1Y2tldCBmb3IgcGlwZWxpbmUgZGF0YVxuICAgIGNvbnN0IGRhdGFCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdEYXRhQnVja2V0Jywge1xuICAgICAgYnVja2V0TmFtZTogYGhwaS1yZXZpZXctcGlwZWxpbmUtZGF0YS0ke3RoaXMuYWNjb3VudH1gLFxuICAgICAgLy8gRW5mb3JjZSBIVFRQUy1vbmx5IGFjY2VzcyAoZGVuaWVzIGF3czpTZWN1cmVUcmFuc3BvcnQgPSBmYWxzZSkuXG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgICAgLy8gQmxvY2sgYWxsIHB1YmxpYyBhY2Nlc3MuXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgLy8gRW5hYmxlIFMzIHNlcnZlciBhY2Nlc3MgbG9nZ2luZyB0byB0aGUgZGVkaWNhdGVkIGxvZ3MgYnVja2V0LlxuICAgICAgc2VydmVyQWNjZXNzTG9nc0J1Y2tldDogYWNjZXNzTG9nc0J1Y2tldCxcbiAgICAgIHNlcnZlckFjY2Vzc0xvZ3NQcmVmaXg6ICdkYXRhLWJ1Y2tldC8nLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuICBcbiAgICAvLyBMYW1iZGE6IFRyYW5zbGF0ZVxuICAgIGNvbnN0IHRyYW5zbGF0ZUZuID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnVHJhbnNsYXRlRm4nLCB7XG4gICAgICBydW50aW1lOiBsYW1iZGEuUnVudGltZS5QWVRIT05fM18xMyxcbiAgICAgIGhhbmRsZXI6ICdoYW5kbGVyLmhhbmRsZXInLFxuICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KHBhdGguam9pbihfX2Rpcm5hbWUsICcuLi9sYW1iZGEvdHJhbnNsYXRlJykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgIH0pO1xuICAgIHRyYW5zbGF0ZUZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ3RyYW5zbGF0ZTpUcmFuc2xhdGVUZXh0J10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcbiAgXG4gICAgLy8gTGFtYmRhOiBTdW1tYXJpemVcbiAgICBjb25zdCBzdW1tYXJpemVGbiA9IG5ldyBsYW1iZGEuRnVuY3Rpb24odGhpcywgJ1N1bW1hcml6ZUZuJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTMsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3N1bW1hcml6ZScpKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcbiAgICBzdW1tYXJpemVGbi5hZGRUb1JvbGVQb2xpY3kobmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgYWN0aW9uczogWydiZWRyb2NrOkludm9rZU1vZGVsJ10sXG4gICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgIH0pKTtcbiAgXG4gICAgLy8gTGFtYmRhOiBMb2NhbGl6ZVxuICAgIGNvbnN0IGxvY2FsaXplRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdMb2NhbGl6ZUZuJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTMsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL2xvY2FsaXplJykpLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogMjU2LFxuICAgIH0pO1xuICAgIGxvY2FsaXplRm4uYWRkVG9Sb2xlUG9saWN5KG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgIGFjdGlvbnM6IFsndHJhbnNsYXRlOlRyYW5zbGF0ZVRleHQnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuICBcbiAgICAvLyBMYW1iZGE6IFF1YWxpdHkgR2F0ZVxuICAgIGNvbnN0IHF1YWxpdHlHYXRlRm4gPSBuZXcgbGFtYmRhLkZ1bmN0aW9uKHRoaXMsICdRdWFsaXR5R2F0ZUZuJywge1xuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuUFlUSE9OXzNfMTMsXG4gICAgICBoYW5kbGVyOiAnaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldChwYXRoLmpvaW4oX19kaXJuYW1lLCAnLi4vbGFtYmRhL3F1YWxpdHktZ2F0ZScpKSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIG1lbW9yeVNpemU6IDUxMixcbiAgICB9KTtcbiAgICBxdWFsaXR5R2F0ZUZuLmFkZFRvUm9sZVBvbGljeShuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICBhY3Rpb25zOiBbJ2JlZHJvY2s6SW52b2tlTW9kZWwnXSxcbiAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgfSkpO1xuICBcbiAgICAvLyBTdGVwIEZ1bmN0aW9ucyB0YXNrc1xuICAgIGNvbnN0IHRyYW5zbGF0ZVRhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdUcmFuc2xhdGUnLCB7XG4gICAgICBsYW1iZGFGdW5jdGlvbjogdHJhbnNsYXRlRm4sXG4gICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJyxcbiAgICB9KTtcbiAgXG4gICAgY29uc3Qgc3VtbWFyaXplVGFzayA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ1N1bW1hcml6ZScsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBzdW1tYXJpemVGbixcbiAgICAgIG91dHB1dFBhdGg6ICckLlBheWxvYWQnLFxuICAgIH0pO1xuICBcbiAgICBjb25zdCBsb2NhbGl6ZVRhc2sgPSBuZXcgdGFza3MuTGFtYmRhSW52b2tlKHRoaXMsICdMb2NhbGl6ZScsIHtcbiAgICAgIGxhbWJkYUZ1bmN0aW9uOiBsb2NhbGl6ZUZuLFxuICAgICAgb3V0cHV0UGF0aDogJyQuUGF5bG9hZCcsXG4gICAgfSk7XG4gIFxuICAgIGNvbnN0IHF1YWxpdHlHYXRlVGFzayA9IG5ldyB0YXNrcy5MYW1iZGFJbnZva2UodGhpcywgJ1F1YWxpdHlHYXRlJywge1xuICAgICAgbGFtYmRhRnVuY3Rpb246IHF1YWxpdHlHYXRlRm4sXG4gICAgICBvdXRwdXRQYXRoOiAnJC5QYXlsb2FkJyxcbiAgICB9KTtcbiAgXG4gICAgLy8gRGVmaW5lIHdvcmtmbG93XG4gICAgY29uc3QgZGVmaW5pdGlvbiA9IHRyYW5zbGF0ZVRhc2tcbiAgICAgIC5uZXh0KHN1bW1hcml6ZVRhc2spXG4gICAgICAubmV4dChsb2NhbGl6ZVRhc2spXG4gICAgICAubmV4dChxdWFsaXR5R2F0ZVRhc2spO1xuICBcbiAgICAvLyBTdGF0ZSBNYWNoaW5lXG4gICAgY29uc3Qgc3RhdGVNYWNoaW5lID0gbmV3IHNmbi5TdGF0ZU1hY2hpbmUodGhpcywgJ1Jldmlld1BpcGVsaW5lJywge1xuICAgICAgc3RhdGVNYWNoaW5lTmFtZTogJ2hwaS1yZXZpZXctcGlwZWxpbmUnLFxuICAgICAgZGVmaW5pdGlvbixcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuICBcbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0YXRlTWFjaGluZUFybicsIHtcbiAgICAgIHZhbHVlOiBzdGF0ZU1hY2hpbmUuc3RhdGVNYWNoaW5lQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdTdGVwIEZ1bmN0aW9ucyBTdGF0ZSBNYWNoaW5lIEFSTicsXG4gICAgfSk7XG4gIFxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXRhQnVja2V0TmFtZScsIHtcbiAgICAgIHZhbHVlOiBkYXRhQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIERhdGEgQnVja2V0JyxcbiAgICB9KTtcbiAgfVxufSBcblxuIl19