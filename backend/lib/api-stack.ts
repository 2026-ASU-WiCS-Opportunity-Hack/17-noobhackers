import * as cdk from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as path from 'path';
import { Construct } from 'constructs';

export interface ApiStackProps extends cdk.StackProps {
  /** Cognito User Pool for JWT authorization */
  readonly userPool: cognito.UserPool;
  /** DynamoDB Chapters table */
  readonly chaptersTable: dynamodb.Table;
  /** DynamoDB Coaches table */
  readonly coachesTable: dynamodb.Table;
  /** DynamoDB Payments table */
  readonly paymentsTable: dynamodb.Table;
  /** DynamoDB Pages table */
  readonly pagesTable: dynamodb.Table;
  /** DynamoDB Templates table */
  readonly templatesTable: dynamodb.Table;
  /** DynamoDB Users table */
  readonly usersTable: dynamodb.Table;
  /** S3 assets bucket */
  readonly assetsBucket: s3.Bucket;
}

export class ApiStack extends cdk.Stack {
  /** The REST API Gateway */
  public readonly api: apigateway.RestApi;

  /** Lambda function references (exposed for cross-stack wiring) */
  public readonly provisioningFn: lambda.Function;
  public readonly coachesFn: lambda.Function;
  public readonly paymentsFn: lambda.Function;
  public readonly searchFn: lambda.Function;
  public readonly metricsFn: lambda.Function;
  public readonly templatesFn: lambda.Function;
  public readonly authFn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const lambdaDir = path.join(__dirname, '..', 'lambda');

    // Shared environment variables for all Lambdas
    const sharedEnv: Record<string, string> = {
      CHAPTERS_TABLE: props.chaptersTable.tableName,
      COACHES_TABLE: props.coachesTable.tableName,
      PAYMENTS_TABLE: props.paymentsTable.tableName,
      PAGES_TABLE: props.pagesTable.tableName,
      TEMPLATES_TABLE: props.templatesTable.tableName,
      USERS_TABLE: props.usersTable.tableName,
      ASSETS_BUCKET: props.assetsBucket.bucketName,
    };

    const runtime = lambda.Runtime.PYTHON_3_12;
    const memorySize = 256;
    const timeout = cdk.Duration.seconds(30);

    // ─── Lambda Functions ─────────────────────────────────────────────

    this.provisioningFn = new lambda.Function(this, 'ProvisioningFn', {
      runtime, memorySize, timeout,
      functionName: 'wial-provisioning',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'provisioning')),
      environment: sharedEnv,
      description: 'Chapter site provisioning — create, list, get, update, deactivate chapters',
    });

    this.coachesFn = new lambda.Function(this, 'CoachesFn', {
      runtime, memorySize, timeout,
      functionName: 'wial-coaches',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'coaches')),
      environment: sharedEnv,
      description: 'Coach CRUD, profile approval, and directory operations',
    });

    this.paymentsFn = new lambda.Function(this, 'PaymentsFn', {
      runtime, memorySize, timeout,
      functionName: 'wial-payments',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'payments')),
      environment: sharedEnv,
      description: 'Payment processing, webhooks, and dues management',
    });

    this.searchFn = new lambda.Function(this, 'SearchFn', {
      runtime, memorySize, timeout,
      functionName: 'wial-search',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'search')),
      environment: sharedEnv,
      description: 'AI-powered cross-lingual semantic coach search',
    });

    this.metricsFn = new lambda.Function(this, 'MetricsFn', {
      runtime, memorySize, timeout,
      functionName: 'wial-metrics',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'metrics')),
      environment: sharedEnv,
      description: 'Revenue and chapter metrics aggregation',
    });

    this.templatesFn = new lambda.Function(this, 'TemplatesFn', {
      runtime, memorySize, timeout,
      functionName: 'wial-templates',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'templates')),
      environment: sharedEnv,
      description: 'Template management and sync across chapters',
    });

    this.authFn = new lambda.Function(this, 'AuthFn', {
      runtime, memorySize, timeout,
      functionName: 'wial-auth',
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(lambdaDir, 'auth')),
      environment: {
        USERS_TABLE: props.usersTable.tableName,
      },
      description: 'Cognito pre/post auth triggers and RBAC middleware',
    });

    // ─── IAM: Least-Privilege Policies ────────────────────────────────

    // Provisioning: DynamoDB (chapters, pages), S3 (template assets)
    props.chaptersTable.grantReadWriteData(this.provisioningFn);
    props.pagesTable.grantReadWriteData(this.provisioningFn);
    props.assetsBucket.grantReadWrite(this.provisioningFn, 'templates/*');
    props.assetsBucket.grantReadWrite(this.provisioningFn, 'chapters/*');

    // Coaches: DynamoDB (coaches table)
    props.coachesTable.grantReadWriteData(this.coachesFn);

    // Payments: DynamoDB (payments table), Secrets Manager (runtime access added in payments-stack)
    props.paymentsTable.grantReadWriteData(this.paymentsFn);

    // Search: DynamoDB (coaches table — fallback keyword search)
    props.coachesTable.grantReadData(this.searchFn);

    // Metrics: DynamoDB read on chapters, coaches, payments
    props.chaptersTable.grantReadData(this.metricsFn);
    props.coachesTable.grantReadData(this.metricsFn);
    props.paymentsTable.grantReadData(this.metricsFn);

    // Templates: DynamoDB (templates, chapters, pages), S3 (template assets)
    props.templatesTable.grantReadWriteData(this.templatesFn);
    props.chaptersTable.grantReadData(this.templatesFn);
    props.pagesTable.grantReadWriteData(this.templatesFn);
    props.assetsBucket.grantReadWrite(this.templatesFn, 'templates/*');

    // Auth: DynamoDB (users table)
    props.usersTable.grantReadWriteData(this.authFn);

    // ─── API Gateway ──────────────────────────────────────────────────

    this.api = new apigateway.RestApi(this, 'WialApi', {
      restApiName: 'wial-platform-api',
      description: 'WIAL Chapter Platform REST API',
      deployOptions: {
        stageName: 'v1',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // Cognito authorizer for JWT-protected endpoints
    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'wial-cognito-authorizer',
    });

    const authMethodOptions: apigateway.MethodOptions = {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // ─── Lambda Integrations ──────────────────────────────────────────

    const provisioningIntegration = new apigateway.LambdaIntegration(this.provisioningFn);
    const coachesIntegration = new apigateway.LambdaIntegration(this.coachesFn);
    const paymentsIntegration = new apigateway.LambdaIntegration(this.paymentsFn);
    const searchIntegration = new apigateway.LambdaIntegration(this.searchFn);
    const metricsIntegration = new apigateway.LambdaIntegration(this.metricsFn);
    const templatesIntegration = new apigateway.LambdaIntegration(this.templatesFn);
    const authIntegration = new apigateway.LambdaIntegration(this.authFn);

    // ─── Chapter Provisioning Routes ──────────────────────────────────

    const chapters = this.api.root.addResource('chapters');
    chapters.addMethod('POST', provisioningIntegration, authMethodOptions);  // Create chapter (JWT)
    chapters.addMethod('GET', provisioningIntegration);                      // List chapters (Public)

    const chapter = chapters.addResource('{chapterId}');
    chapter.addMethod('GET', provisioningIntegration);                       // Get chapter (Public)
    chapter.addMethod('PUT', provisioningIntegration, authMethodOptions);    // Update chapter (JWT)
    chapter.addMethod('DELETE', provisioningIntegration, authMethodOptions); // Deactivate chapter (JWT)

    // ─── Chapter Pages Routes (under /chapters/{chapterId}/pages) ─────

    const chapterPages = chapter.addResource('pages');
    chapterPages.addMethod('GET', templatesIntegration);                     // List chapter pages (Public)

    const chapterPage = chapterPages.addResource('{pageSlug}');
    chapterPage.addMethod('GET', templatesIntegration);                      // Get page content (Public)
    chapterPage.addMethod('PUT', templatesIntegration, authMethodOptions);   // Update page content (JWT)

    // ─── Coach Directory Routes ───────────────────────────────────────

    const coaches = this.api.root.addResource('coaches');
    coaches.addMethod('GET', coachesIntegration);                            // List coaches (Public)
    coaches.addMethod('POST', coachesIntegration, authMethodOptions);        // Add coach (JWT)

    // /coaches/search must be defined before /coaches/{coachId} to avoid
    // API Gateway treating "search" as a path parameter value
    const coachSearch = coaches.addResource('search');
    coachSearch.addMethod('GET', searchIntegration);                         // AI semantic search (Public)

    const coach = coaches.addResource('{coachId}');
    coach.addMethod('GET', coachesIntegration);                              // Get coach profile (Public)
    coach.addMethod('PUT', coachesIntegration, authMethodOptions);           // Update coach profile (JWT)

    const coachApprove = coach.addResource('approve');
    coachApprove.addMethod('POST', coachesIntegration, authMethodOptions);   // Approve pending update (JWT)

    // ─── Payment Routes ───────────────────────────────────────────────

    const payments = this.api.root.addResource('payments');
    payments.addMethod('POST', paymentsIntegration, authMethodOptions);      // Create payment (JWT)
    payments.addMethod('GET', paymentsIntegration, authMethodOptions);       // List payments (JWT)

    const payment = payments.addResource('{paymentId}');
    payment.addMethod('GET', paymentsIntegration, authMethodOptions);        // Get payment details (JWT)

    // Webhook endpoints — no Cognito auth (provider signature verification)
    const webhook = payments.addResource('webhook');
    const stripeWebhook = webhook.addResource('stripe');
    stripeWebhook.addMethod('POST', paymentsIntegration);                    // Stripe webhook (no auth)

    const paypalWebhook = webhook.addResource('paypal');
    paypalWebhook.addMethod('POST', paymentsIntegration);                    // PayPal webhook (no auth)

    // ─── Template Routes ──────────────────────────────────────────────

    const templates = this.api.root.addResource('templates');
    templates.addMethod('GET', templatesIntegration, authMethodOptions);     // Get parent template (JWT)
    templates.addMethod('PUT', templatesIntegration, authMethodOptions);     // Update parent template (JWT)

    // ─── User & Role Routes ───────────────────────────────────────────

    const users = this.api.root.addResource('users');
    users.addMethod('GET', authIntegration, authMethodOptions);              // List users (JWT)
    users.addMethod('POST', authIntegration, authMethodOptions);             // Create user (JWT)

    const user = users.addResource('{userId}');
    const userRole = user.addResource('role');
    userRole.addMethod('PUT', authIntegration, authMethodOptions);           // Change user role (JWT)
    user.addMethod('DELETE', authIntegration, authMethodOptions);            // Deactivate user (JWT)

    // ─── Metrics Routes ───────────────────────────────────────────────

    const metrics = this.api.root.addResource('metrics');

    const globalMetrics = metrics.addResource('global');
    globalMetrics.addMethod('GET', metricsIntegration, authMethodOptions);   // Global metrics (JWT)

    const metricsChapters = metrics.addResource('chapters');
    const metricsChapter = metricsChapters.addResource('{chapterId}');
    metricsChapter.addMethod('GET', metricsIntegration, authMethodOptions);  // Chapter metrics (JWT)

    // ─── EventBridge: Daily Dues Reminder Schedule (Req 5.8) ─────────

    new events.Rule(this, 'DuesReminderRule', {
      ruleName: 'wial-dues-reminder-daily',
      description: 'Triggers daily dues reminder check for overdue payments',
      schedule: events.Schedule.cron({ minute: '0', hour: '8' }), // 8 AM UTC daily
      targets: [new targets.LambdaFunction(this.paymentsFn)],
    });

    // ─── CloudWatch Alarms (per design monitoring requirements) ───────

    // Provisioning failure rate > 5%
    new cloudwatch.Alarm(this, 'ProvisioningFailureAlarm', {
      alarmName: 'wial-provisioning-failure-rate',
      metric: this.provisioningFn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 5,
      evaluationPeriods: 1,
      alarmDescription: 'Provisioning Lambda error rate exceeds threshold',
    });

    // Payment failure rate > 10%
    new cloudwatch.Alarm(this, 'PaymentFailureAlarm', {
      alarmName: 'wial-payment-failure-rate',
      metric: this.paymentsFn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 10,
      evaluationPeriods: 1,
      alarmDescription: 'Payment Lambda error rate exceeds threshold',
    });

    // Search fallback rate > 20%
    new cloudwatch.Alarm(this, 'SearchFailureAlarm', {
      alarmName: 'wial-search-fallback-rate',
      metric: this.searchFn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 20,
      evaluationPeriods: 1,
      alarmDescription: 'Search Lambda error/fallback rate exceeds threshold',
    });

    // General Lambda error rate > 1%
    new cloudwatch.Alarm(this, 'GeneralLambdaErrorAlarm', {
      alarmName: 'wial-lambda-error-rate',
      metric: this.authFn.metricErrors({
        period: cdk.Duration.minutes(5),
        statistic: 'Sum',
      }),
      threshold: 1,
      evaluationPeriods: 3,
      alarmDescription: 'General Lambda error rate exceeds threshold',
    });

    // ─── Stack Outputs ────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.url,
      description: 'WIAL Platform API base URL',
    });
  }
}
