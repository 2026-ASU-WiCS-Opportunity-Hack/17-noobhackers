import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DataStackProps extends cdk.StackProps {
  /** Optional environment prefix for resource naming */
  readonly envPrefix?: string;
}

export class DataStack extends cdk.Stack {
  /** Chapters table — PK: CHAPTER#{chapterId}, SK: METADATA */
  public readonly chaptersTable: dynamodb.Table;

  /** Coaches table — PK: COACH#{coachId}, SK: PROFILE */
  public readonly coachesTable: dynamodb.Table;

  /** Payments table — PK: PAYMENT#{paymentId}, SK: RECORD */
  public readonly paymentsTable: dynamodb.Table;

  /** Pages table — PK: CHAPTER#{chapterId}, SK: PAGE#{pageSlug} */
  public readonly pagesTable: dynamodb.Table;

  /** Templates table — PK: TEMPLATE#global, SK: VERSION#{version} */
  public readonly templatesTable: dynamodb.Table;

  /** Users table — PK: USER#{cognitoUserId}, SK: PROFILE */
  public readonly usersTable: dynamodb.Table;

  /** S3 bucket for platform assets (templates, chapter assets, coach photos) */
  public readonly assetsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: DataStackProps) {
    super(scope, id, props);

    // ─── Chapters Table ───────────────────────────────────────────────
    this.chaptersTable = new dynamodb.Table(this, 'ChaptersTable', {
      tableName: 'wial-chapters',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    this.chaptersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'slug', type: dynamodb.AttributeType.STRING },
    });

    // ─── Coaches Table ────────────────────────────────────────────────
    this.coachesTable = new dynamodb.Table(this, 'CoachesTable', {
      tableName: 'wial-coaches',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    this.coachesTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'cognitoUserId', type: dynamodb.AttributeType.STRING },
    });

    this.coachesTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'chapterId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'certificationLevel', type: dynamodb.AttributeType.STRING },
    });

    // ─── Payments Table ───────────────────────────────────────────────
    this.paymentsTable = new dynamodb.Table(this, 'PaymentsTable', {
      tableName: 'wial-payments',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

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

    // ─── Pages Table ──────────────────────────────────────────────────
    this.pagesTable = new dynamodb.Table(this, 'PagesTable', {
      tableName: 'wial-pages',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // ─── Templates Table ──────────────────────────────────────────────
    this.templatesTable = new dynamodb.Table(this, 'TemplatesTable', {
      tableName: 'wial-templates',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // ─── Users Table ──────────────────────────────────────────────────
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'wial-users',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    this.usersTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
    });

    // ─── S3 Assets Bucket ─────────────────────────────────────────────
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
