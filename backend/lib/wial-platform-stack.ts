import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import * as path from 'path';
import { Construct } from 'constructs';

export interface WialPlatformStackProps extends cdk.StackProps {
  /** Optional environment prefix for resource naming */
  readonly envPrefix?: string;
  /** Set to false to skip OpenSearch Serverless (requires account subscription). Default: true */
  readonly enableOpenSearch?: boolean;
}

/**
 * Main CDK stack for the WIAL Chapter Platform.
 *
 * Composes all infrastructure as constructs within a single CloudFormation
 * stack, avoiding cross-stack dependency cycles that arise when Cognito
 * triggers reference Lambdas that themselves depend on the Cognito User Pool.
 *
 * Sub-stack classes (DataStack, AuthStack, etc.) remain available for
 * independent unit testing; this stack wires everything together for
 * deployment.
 */
export class WialPlatformStack extends cdk.Stack {
  // ─── Data Layer ─────────────────────────────────────────────────────
  public readonly chaptersTable: dynamodb.Table;
  public readonly coachesTable: dynamodb.Table;
  public readonly paymentsTable: dynamodb.Table;
  public readonly pagesTable: dynamodb.Table;
  public readonly templatesTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly assetsBucket: s3.Bucket;

  // ─── Auth Layer ─────────────────────────────────────────────────────
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  // ─── API Layer ──────────────────────────────────────────────────────
  public readonly api: apigateway.RestApi;
  public readonly provisioningFn: lambda.Function;
  public readonly coachesFn: lambda.Function;
  public readonly paymentsFn: lambda.Function;
  public readonly searchFn: lambda.Function;
  public readonly metricsFn: lambda.Function;
  public readonly templatesFn: lambda.Function;
  public readonly authFn: lambda.Function;

  // ─── Payments Layer ─────────────────────────────────────────────────
  public readonly stripeApiKeySecret: secretsmanager.Secret;
  public readonly paypalClientSecret: secretsmanager.Secret;
  public readonly sesEmailIdentity: ses.EmailIdentity;

  // ─── DNS Layer ──────────────────────────────────────────────────────
  public readonly hostedZone: route53.HostedZone;

  // ─── Search Layer ───────────────────────────────────────────────────
  public readonly collection: opensearchserverless.CfnCollection;
  public readonly bedrockAccessRole: iam.Role;

  constructor(scope: Construct, id: string, props?: WialPlatformStackProps) {
    super(scope, id, props);

    // ─── 1. Data Layer (DynamoDB + S3) ────────────────────────────────
    const data = new DataConstruct(this, 'Data');
    this.chaptersTable = data.chaptersTable;
    this.coachesTable = data.coachesTable;
    this.paymentsTable = data.paymentsTable;
    this.pagesTable = data.pagesTable;
    this.templatesTable = data.templatesTable;
    this.usersTable = data.usersTable;
    this.assetsBucket = data.assetsBucket;

    // ─── 2. Auth Layer (Cognito) ──────────────────────────────────────
    const auth = new AuthConstruct(this, 'Auth');
    this.userPool = auth.userPool;
    this.userPoolClient = auth.userPoolClient;

    // ─── 3. Auth Lambda (created here to break circular dependency) ──
    // The authFn is created outside ApiConstruct because it serves as
    // both a Cognito trigger (User Pool → Lambda) and an API Gateway
    // integration (Lambda → Authorizer → User Pool). Placing it in the
    // same construct as the authorizer creates a CFN circular dependency.
    const lambdaDir = path.join(__dirname, '..', 'lambda');
    this.authFn = new lambda.Function(this, 'AuthFn', {
      runtime: lambda.Runtime.PYTHON_3_12,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      handler: 'auth.handler.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: {
        USERS_TABLE: this.usersTable.tableName,
      },
      description: 'Cognito pre/post auth triggers and RBAC',
    });
    this.usersTable.grantReadWriteData(this.authFn);

    // ─── 4. API Layer (API Gateway + Lambdas) ─────────────────────────
    const apiConstruct = new ApiConstruct(this, 'Api', {
      userPool: this.userPool,
      authFn: this.authFn,
      chaptersTable: this.chaptersTable,
      coachesTable: this.coachesTable,
      paymentsTable: this.paymentsTable,
      pagesTable: this.pagesTable,
      templatesTable: this.templatesTable,
      usersTable: this.usersTable,
      assetsBucket: this.assetsBucket,
    });
    this.api = apiConstruct.api;
    this.provisioningFn = apiConstruct.provisioningFn;
    this.coachesFn = apiConstruct.coachesFn;
    this.paymentsFn = apiConstruct.paymentsFn;
    this.searchFn = apiConstruct.searchFn;
    this.metricsFn = apiConstruct.metricsFn;
    this.templatesFn = apiConstruct.templatesFn;

    // ─── 4. Payments Layer (Secrets Manager + SES) ────────────────────
    const payments = new PaymentsConstruct(this, 'Payments');
    this.stripeApiKeySecret = payments.stripeApiKeySecret;
    this.paypalClientSecret = payments.paypalClientSecret;
    this.sesEmailIdentity = payments.sesEmailIdentity;

    // ─── 5. DNS Layer (Route 53) ──────────────────────────────────────
    const dns = new DnsConstruct(this, 'Dns');
    this.hostedZone = dns.hostedZone;

    // ─── 6. Search Layer (OpenSearch + Bedrock) ───────────────────────
    // OpenSearch Serverless requires account-level subscription.
    // If not available, search Lambda falls back to DynamoDB keyword search.
    const enableSearch = props?.enableOpenSearch !== false;
    if (enableSearch) {
      try {
        const search = new SearchConstruct(this, 'Search');
        this.collection = search.collection;
        this.bedrockAccessRole = search.bedrockAccessRole;
      } catch {
        // SearchConstruct creation failed — skip
      }
    }

    // ─── Cross-Construct Wiring ───────────────────────────────────────
    this.wirePaymentsLambda();
    if (this.collection && this.bedrockAccessRole) {
      this.wireSearchLambda();
    }
    this.wireProvisioningLambda();
    this.wireCognitoTriggers();

    // ─── Search Lambda: Cohere API key access ─────────────────────────
    const cohereSecret = secretsmanager.Secret.fromSecretNameV2(this, 'CohereSecret', 'wial/cohere-api-key');
    cohereSecret.grantRead(this.searchFn);
    this.searchFn.addEnvironment('COHERE_SECRET_NAME', 'wial/cohere-api-key');
  }

  /** Payments Lambda: Secrets Manager read + SES send email */
  private wirePaymentsLambda(): void {
    this.stripeApiKeySecret.grantRead(this.paymentsFn);
    this.paypalClientSecret.grantRead(this.paymentsFn);
    this.paymentsFn.addEnvironment('STRIPE_SECRET_ARN', this.stripeApiKeySecret.secretArn);
    this.paymentsFn.addEnvironment('PAYPAL_SECRET_ARN', this.paypalClientSecret.secretArn);
    this.paymentsFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));
  }

  /** Search Lambda: OpenSearch endpoint + Bedrock invoke + AOSS access */
  private wireSearchLambda(): void {
    this.searchFn.addEnvironment('OPENSEARCH_ENDPOINT', this.collection.attrCollectionEndpoint);
    this.searchFn.addEnvironment('BEDROCK_ROLE_ARN', this.bedrockAccessRole.roleArn);
    this.searchFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));
    this.searchFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['aoss:APIAccessAll'],
      resources: [this.collection.attrArn],
    }));
  }

  /** Provisioning Lambda: Route 53 subdomain record creation */
  private wireProvisioningLambda(): void {
    this.provisioningFn.addEnvironment('HOSTED_ZONE_ID', this.hostedZone.hostedZoneId);
    this.provisioningFn.addEnvironment('HOSTED_ZONE_NAME', this.hostedZone.zoneName);
    this.hostedZone.grantDelegation(this.provisioningFn.role!);
    this.provisioningFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['route53:ChangeResourceRecordSets', 'route53:GetHostedZone'],
      resources: [this.hostedZone.hostedZoneArn],
    }));
  }

  /**
   * Auth Lambda: Cognito admin permissions + post-deploy trigger setup.
   *
   * Cognito triggers (PreAuthentication, PostAuthentication) are NOT
   * configured in CDK because they create an unbreakable circular
   * dependency: User Pool → authFn (trigger) → API Gateway (integration)
   * → Cognito Authorizer → User Pool. Every CDK token reference
   * (userPoolId, functionArn, userPoolArn) creates a CFN Ref/GetAtt
   * that CFN interprets as a hard dependency edge.
   *
   * Instead, triggers are configured post-deploy via the AWS CLI
   * commands output by this stack. The auth Lambda still works for
   * API routes without triggers — triggers only affect login-time
   * user sync and pre-auth checks.
   */
  private wireCognitoTriggers(): void {
    // Grant broad Cognito admin permissions using a wildcard resource
    // to avoid any Ref to the User Pool from the Lambda IAM policy.
    this.authFn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminGetUser',
      ],
      resources: ['*'],
    }));

    // Output values needed for post-deploy trigger configuration
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    });
    new cdk.CfnOutput(this, 'AuthFnArn', {
      value: this.authFn.functionArn,
      description: 'Auth Lambda ARN for Cognito trigger setup',
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Internal Constructs — mirror the standalone sub-stack resources
// ═══════════════════════════════════════════════════════════════════════

/** DynamoDB tables + S3 bucket (mirrors DataStack) */
class DataConstruct extends Construct {
  public readonly chaptersTable: dynamodb.Table;
  public readonly coachesTable: dynamodb.Table;
  public readonly paymentsTable: dynamodb.Table;
  public readonly pagesTable: dynamodb.Table;
  public readonly templatesTable: dynamodb.Table;
  public readonly usersTable: dynamodb.Table;
  public readonly assetsBucket: s3.Bucket;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    const defaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    };

    this.chaptersTable = new dynamodb.Table(this, 'ChaptersTable', {
      ...defaults, tableName: 'wial-chapters',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    } as dynamodb.TableProps);
    this.chaptersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'slug', type: dynamodb.AttributeType.STRING },
    });

    this.coachesTable = new dynamodb.Table(this, 'CoachesTable', {
      ...defaults, tableName: 'wial-coaches',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    } as dynamodb.TableProps);
    this.coachesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'cognitoUserId', type: dynamodb.AttributeType.STRING },
    });
    this.coachesTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'chapterId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'certificationLevel', type: dynamodb.AttributeType.STRING },
    });

    this.paymentsTable = new dynamodb.Table(this, 'PaymentsTable', {
      ...defaults, tableName: 'wial-payments',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    } as dynamodb.TableProps);
    this.paymentsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'chapterId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });
    this.paymentsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'dueDate', type: dynamodb.AttributeType.STRING },
    });

    this.pagesTable = new dynamodb.Table(this, 'PagesTable', {
      ...defaults, tableName: 'wial-pages',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    } as dynamodb.TableProps);

    this.templatesTable = new dynamodb.Table(this, 'TemplatesTable', {
      ...defaults, tableName: 'wial-templates',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    } as dynamodb.TableProps);

    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      ...defaults, tableName: 'wial-users',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
    } as dynamodb.TableProps);
    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: 'wial-platform-assets',
      encryption: s3.BucketEncryption.KMS_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      enforceSSL: true,
    });
  }
}

/** Cognito User Pool + groups (mirrors AuthStack) */
class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'WialUserPool', {
      userPoolName: 'wial-user-pool',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: true, mutable: true },
        familyName: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 12, requireUppercase: true, requireLowercase: true,
        requireDigits: true, requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { sms: false, otp: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.userPoolClient = this.userPool.addClient('WialAppClient', {
      userPoolClientName: 'wial-app-client',
      authFlows: { userSrp: true, userPassword: true },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    const groups: Array<{ name: string; desc: string; precedence: number }> = [
      { name: 'SuperAdmins', desc: 'WIAL Global Administrators — full access', precedence: 0 },
      { name: 'ChapterLeads', desc: 'Regional affiliate directors', precedence: 1 },
      { name: 'ContentCreators', desc: 'Content editors', precedence: 2 },
      { name: 'Coaches', desc: 'Certified coaches — read directory, edit own profile', precedence: 3 },
    ];
    for (const g of groups) {
      new cognito.CfnUserPoolGroup(this, `${g.name}Group`, {
        userPoolId: this.userPool.userPoolId,
        groupName: g.name,
        description: g.desc,
        precedence: g.precedence,
      });
    }
  }
}

/** Props for ApiConstruct */
interface ApiConstructProps {
  readonly userPool: cognito.UserPool;
  readonly authFn: lambda.Function;
  readonly chaptersTable: dynamodb.Table;
  readonly coachesTable: dynamodb.Table;
  readonly paymentsTable: dynamodb.Table;
  readonly pagesTable: dynamodb.Table;
  readonly templatesTable: dynamodb.Table;
  readonly usersTable: dynamodb.Table;
  readonly assetsBucket: s3.Bucket;
}

/** API Gateway + Lambda functions (mirrors ApiStack) */
class ApiConstruct extends Construct {
  public readonly api: apigateway.RestApi;
  public readonly provisioningFn: lambda.Function;
  public readonly coachesFn: lambda.Function;
  public readonly paymentsFn: lambda.Function;
  public readonly searchFn: lambda.Function;
  public readonly metricsFn: lambda.Function;
  public readonly templatesFn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    const lambdaDir = path.join(__dirname, '..', 'lambda');
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
    // All Lambdas use the entire lambda/ directory as code asset so the
    // shared/ module is available for imports.
    this.provisioningFn = new lambda.Function(this, 'ProvisioningFn', {
      runtime, memorySize, timeout, functionName: 'wial-provisioning',
      handler: 'provisioning.handler.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: sharedEnv,
      description: 'Chapter site provisioning',
    });

    this.coachesFn = new lambda.Function(this, 'CoachesFn', {
      runtime, memorySize, timeout, functionName: 'wial-coaches',
      handler: 'coaches.handler.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: sharedEnv,
      description: 'Coach CRUD and directory operations',
    });

    this.paymentsFn = new lambda.Function(this, 'PaymentsFn', {
      runtime, memorySize, timeout, functionName: 'wial-payments',
      handler: 'payments.handler.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: sharedEnv,
      description: 'Payment processing and dues management',
    });

    this.searchFn = new lambda.Function(this, 'SearchFn', {
      runtime, memorySize, timeout, functionName: 'wial-search',
      handler: 'search.handler.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: sharedEnv,
      description: 'AI-powered semantic coach search',
    });

    this.metricsFn = new lambda.Function(this, 'MetricsFn', {
      runtime, memorySize, timeout, functionName: 'wial-metrics',
      handler: 'metrics.handler.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: sharedEnv,
      description: 'Revenue and chapter metrics aggregation',
    });

    this.templatesFn = new lambda.Function(this, 'TemplatesFn', {
      runtime, memorySize, timeout, functionName: 'wial-templates',
      handler: 'templates.handler.handler',
      code: lambda.Code.fromAsset(lambdaDir),
      environment: sharedEnv,
      description: 'Template management and sync',
    });

    // authFn is created in the main stack and passed via props to break
    // the circular dependency with Cognito triggers + authorizer.

    // ─── IAM: Least-Privilege Policies ────────────────────────────────
    props.chaptersTable.grantReadWriteData(this.provisioningFn);
    props.pagesTable.grantReadWriteData(this.provisioningFn);
    props.assetsBucket.grantReadWrite(this.provisioningFn, 'templates/*');
    props.assetsBucket.grantReadWrite(this.provisioningFn, 'chapters/*');
    props.coachesTable.grantReadWriteData(this.coachesFn);
    props.paymentsTable.grantReadWriteData(this.paymentsFn);
    props.coachesTable.grantReadWriteData(this.searchFn);
    props.chaptersTable.grantReadData(this.metricsFn);
    props.coachesTable.grantReadData(this.metricsFn);
    props.paymentsTable.grantReadData(this.metricsFn);
    props.templatesTable.grantReadWriteData(this.templatesFn);
    props.chaptersTable.grantReadData(this.templatesFn);
    props.pagesTable.grantReadWriteData(this.templatesFn);
    props.assetsBucket.grantReadWrite(this.templatesFn, 'templates/*');
    props.assetsBucket.grantReadWrite(this.templatesFn, 'chapters/*');

    // ─── API Gateway ──────────────────────────────────────────────────
    this.api = new apigateway.RestApi(this, 'WialApi', {
      restApiName: 'wial-platform-api',
      description: 'WIAL Chapter Platform REST API',
      deployOptions: { stageName: 'v1', throttlingRateLimit: 100, throttlingBurstLimit: 200 },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const cognitoAuth = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: 'wial-cognito-authorizer',
    });
    const authOpts: apigateway.MethodOptions = {
      authorizer: cognitoAuth,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    };

    // ─── Lambda Integrations ──────────────────────────────────────────
    const provInt = new apigateway.LambdaIntegration(this.provisioningFn);
    const coachInt = new apigateway.LambdaIntegration(this.coachesFn);
    const payInt = new apigateway.LambdaIntegration(this.paymentsFn);
    const searchInt = new apigateway.LambdaIntegration(this.searchFn);
    const metInt = new apigateway.LambdaIntegration(this.metricsFn);
    const tmplInt = new apigateway.LambdaIntegration(this.templatesFn);
    const authInt = new apigateway.LambdaIntegration(props.authFn);

    // ─── Routes ───────────────────────────────────────────────────────
    const chapters = this.api.root.addResource('chapters');
    chapters.addMethod('POST', provInt, authOpts);
    chapters.addMethod('GET', provInt);
    const chapter = chapters.addResource('{chapterId}');
    chapter.addMethod('GET', provInt);
    chapter.addMethod('PUT', provInt, authOpts);
    chapter.addMethod('DELETE', provInt, authOpts);

    const chapterPages = chapter.addResource('pages');
    chapterPages.addMethod('GET', tmplInt);
    const chapterPage = chapterPages.addResource('{pageSlug}');
    chapterPage.addMethod('GET', tmplInt);
    chapterPage.addMethod('PUT', tmplInt, authOpts);

    const coaches = this.api.root.addResource('coaches');
    coaches.addMethod('GET', coachInt);
    coaches.addMethod('POST', coachInt, authOpts);
    const coachSearch = coaches.addResource('search');
    coachSearch.addMethod('GET', searchInt);
    const coach = coaches.addResource('{coachId}');
    coach.addMethod('GET', coachInt);
    coach.addMethod('PUT', coachInt, authOpts);
    const coachApprove = coach.addResource('approve');
    coachApprove.addMethod('POST', coachInt, authOpts);

    const coachEmbed = coach.addResource('embed');
    coachEmbed.addMethod('POST', searchInt, authOpts);

    const coachReembed = coach.addResource('re-embed');
    coachReembed.addMethod('POST', searchInt, authOpts);

    const payments = this.api.root.addResource('payments');
    payments.addMethod('POST', payInt, authOpts);
    payments.addMethod('GET', payInt, authOpts);
    const payment = payments.addResource('{paymentId}');
    payment.addMethod('GET', payInt, authOpts);
    payment.addMethod('PUT', payInt, authOpts);
    const webhook = payments.addResource('webhook');
    webhook.addResource('stripe').addMethod('POST', payInt);
    webhook.addResource('paypal').addMethod('POST', payInt);

    const templates = this.api.root.addResource('templates');
    templates.addMethod('GET', tmplInt, authOpts);
    templates.addMethod('PUT', tmplInt, authOpts);

    // User management routes use NONE auth at the API Gateway level.
    // The auth Lambda validates JWT tokens internally. This avoids a
    // circular dependency: Cognito Authorizer → User Pool → authFn
    // trigger → API deployment → Cognito Authorizer.
    const users = this.api.root.addResource('users');
    users.addMethod('GET', authInt);
    users.addMethod('POST', authInt);
    const user = users.addResource('{userId}');
    user.addResource('role').addMethod('PUT', authInt);
    user.addMethod('DELETE', authInt);

    const metrics = this.api.root.addResource('metrics');
    metrics.addResource('global').addMethod('GET', metInt, authOpts);
    metrics.addResource('chapters').addResource('{chapterId}').addMethod('GET', metInt, authOpts);

    new cdk.CfnOutput(cdk.Stack.of(this), 'ApiUrl', {
      value: this.api.url,
      description: 'WIAL Platform API base URL',
    });
  }
}

/** Secrets Manager + SES (mirrors PaymentsStack) */
class PaymentsConstruct extends Construct {
  public readonly stripeApiKeySecret: secretsmanager.Secret;
  public readonly paypalClientSecret: secretsmanager.Secret;
  public readonly sesEmailIdentity: ses.EmailIdentity;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.stripeApiKeySecret = new secretsmanager.Secret(this, 'StripeApiKeySecret', {
      secretName: 'wial/stripe-api-key',
      description: 'Stripe API key for WIAL payment processing',
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        apiKey: 'PLACEHOLDER_STRIPE_API_KEY',
        webhookSecret: 'PLACEHOLDER_STRIPE_WEBHOOK_SECRET',
      })),
    });

    this.paypalClientSecret = new secretsmanager.Secret(this, 'PaypalClientSecret', {
      secretName: 'wial/paypal-client-secret',
      description: 'PayPal client credentials for WIAL payment processing',
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        clientId: 'PLACEHOLDER_PAYPAL_CLIENT_ID',
        clientSecret: 'PLACEHOLDER_PAYPAL_CLIENT_SECRET',
      })),
    });

    this.sesEmailIdentity = new ses.EmailIdentity(this, 'WialEmailIdentity', {
      identity: ses.Identity.domain('wial.org'),
    });
  }
}

/** Route 53 hosted zone (mirrors DnsStack) */
class DnsConstruct extends Construct {
  public readonly hostedZone: route53.HostedZone;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.hostedZone = new route53.HostedZone(this, 'WialHostedZone', {
      zoneName: 'wial.org',
      comment: 'WIAL Chapter Platform hosted zone',
    });

    new route53.ARecord(this, 'WildcardRecord', {
      zone: this.hostedZone,
      recordName: '*.wial.org',
      target: route53.RecordTarget.fromIpAddresses('127.0.0.1'),
      ttl: cdk.Duration.minutes(5),
      comment: 'Wildcard record for chapter subdomains',
    });
  }
}

/** OpenSearch Serverless + Bedrock access role (mirrors SearchStack) */
class SearchConstruct extends Construct {
  public readonly collection: opensearchserverless.CfnCollection;
  public readonly bedrockAccessRole: iam.Role;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const collectionName = 'wial-coach-profiles';

    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: 'wial-coach-profiles-enc',
      type: 'encryption',
      description: 'Encryption policy for WIAL coach profiles collection',
      policy: JSON.stringify({
        Rules: [{ ResourceType: 'collection', Resource: [`collection/${collectionName}`] }],
        AWSOwnedKey: true,
      }),
    });

    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: 'wial-coach-profiles-net',
      type: 'network',
      description: 'Network policy for WIAL coach profiles collection',
      policy: JSON.stringify([{
        Rules: [
          { ResourceType: 'collection', Resource: [`collection/${collectionName}`] },
          { ResourceType: 'dashboard', Resource: [`collection/${collectionName}`] },
        ],
        AllowFromPublic: true,
      }]),
    });

    this.collection = new opensearchserverless.CfnCollection(this, 'CoachProfilesCollection', {
      name: collectionName,
      type: 'VECTORSEARCH',
      description: 'Vector search collection for AI-powered coach profile semantic search',
    });
    this.collection.addDependency(encryptionPolicy);
    this.collection.addDependency(networkPolicy);

    this.bedrockAccessRole = new iam.Role(this, 'BedrockAccessRole', {
      roleName: 'wial-bedrock-access',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for Lambda functions to access Bedrock models',
    });
    this.bedrockAccessRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));

    new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: 'wial-coach-profiles-access',
      type: 'data',
      description: 'Data access policy for WIAL coach profiles collection',
      policy: JSON.stringify([{
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${collectionName}`],
            Permission: ['aoss:CreateCollectionItems', 'aoss:UpdateCollectionItems', 'aoss:DescribeCollectionItems'],
          },
          {
            ResourceType: 'index',
            Resource: [`index/${collectionName}/*`],
            Permission: ['aoss:CreateIndex', 'aoss:UpdateIndex', 'aoss:DescribeIndex', 'aoss:ReadDocument', 'aoss:WriteDocument'],
          },
        ],
        Principal: [this.bedrockAccessRole.roleArn],
      }]),
    });
  }
}
