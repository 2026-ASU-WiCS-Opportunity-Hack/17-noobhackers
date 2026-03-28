import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DataStack } from '../lib/data-stack';

describe('DataStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new DataStack(app, 'TestDataStack');
    template = Template.fromStack(stack);
  });

  // ─── DynamoDB Tables ──────────────────────────────────────────────

  it('creates 6 DynamoDB tables', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 6);
  });

  it('creates Chapters table with correct key schema and GSI on slug', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'wial-chapters',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [{ AttributeName: 'slug', KeyType: 'HASH' }],
        }),
      ]),
    });
  });

  it('creates Coaches table with GSI1 on cognitoUserId and GSI2 on chapterId+certificationLevel', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'wial-coaches',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [{ AttributeName: 'cognitoUserId', KeyType: 'HASH' }],
        }),
        Match.objectLike({
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'chapterId', KeyType: 'HASH' },
            { AttributeName: 'certificationLevel', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  it('creates Payments table with GSI1 on chapterId+createdAt and GSI2 on status+dueDate', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'wial-payments',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'chapterId', KeyType: 'HASH' },
            { AttributeName: 'createdAt', KeyType: 'RANGE' },
          ],
        }),
        Match.objectLike({
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'dueDate', KeyType: 'RANGE' },
          ],
        }),
      ]),
    });
  });

  it('creates Pages table with PK/SK and no GSIs', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'wial-pages',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  it('creates Templates table with PK/SK and no GSIs', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'wial-templates',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  it('creates Users table with GSI1 on email', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'wial-users',
      GlobalSecondaryIndexes: Match.arrayWith([
        Match.objectLike({
          IndexName: 'GSI1',
          KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        }),
      ]),
    });
  });

  it('enables encryption at rest on all tables', () => {
    // All 6 tables should have SSESpecification enabled
    const tables = template.findResources('AWS::DynamoDB::Table');
    const tableNames = Object.keys(tables);
    expect(tableNames.length).toBe(6);

    for (const logicalId of tableNames) {
      const props = tables[logicalId].Properties;
      expect(props.SSESpecification).toBeDefined();
      expect(props.SSESpecification.SSEEnabled).toBe(true);
    }
  });

  it('sets PAY_PER_REQUEST billing on all tables', () => {
    const tables = template.findResources('AWS::DynamoDB::Table');
    for (const logicalId of Object.keys(tables)) {
      expect(tables[logicalId].Properties.BillingMode).toBe('PAY_PER_REQUEST');
    }
  });

  it('sets RETAIN deletion policy on all tables', () => {
    const tables = template.findResources('AWS::DynamoDB::Table');
    for (const logicalId of Object.keys(tables)) {
      expect(tables[logicalId].DeletionPolicy).toBe('Retain');
    }
  });

  // ─── S3 Bucket ────────────────────────────────────────────────────

  it('creates the assets S3 bucket with correct name', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'wial-platform-assets',
    });
  });

  it('enables versioning on the assets bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: { Status: 'Enabled' },
    });
  });

  it('blocks all public access on the assets bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it('enables encryption on the assets bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms',
            },
          }),
        ]),
      },
    });
  });

  it('sets RETAIN deletion policy on the assets bucket', () => {
    const buckets = template.findResources('AWS::S3::Bucket');
    const bucketIds = Object.keys(buckets);
    expect(bucketIds.length).toBeGreaterThanOrEqual(1);
    for (const logicalId of bucketIds) {
      expect(buckets[logicalId].DeletionPolicy).toBe('Retain');
    }
  });
});
