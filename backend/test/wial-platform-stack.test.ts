import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { WialPlatformStack } from '../lib/wial-platform-stack';

describe('WialPlatformStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new WialPlatformStack(app, 'TestWialPlatformStack');
    template = Template.fromStack(stack);
  });

  // ─── Resource Composition ─────────────────────────────────────────

  it('creates 6 DynamoDB tables', () => {
    template.resourceCountIs('AWS::DynamoDB::Table', 6);
  });

  it('creates the S3 assets bucket', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'wial-platform-assets',
    });
  });

  it('creates a Cognito User Pool', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'wial-user-pool',
    });
  });

  it('creates 7 Lambda functions', () => {
    template.resourceCountIs('AWS::Lambda::Function', 7);
  });

  it('creates a REST API Gateway', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'wial-platform-api',
    });
  });

  it('creates 2 Secrets Manager secrets', () => {
    template.resourceCountIs('AWS::SecretsManager::Secret', 2);
  });

  it('creates a Route 53 hosted zone', () => {
    template.hasResourceProperties('AWS::Route53::HostedZone', {
      Name: 'wial.org.',
    });
  });

  it('creates an OpenSearch Serverless collection', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::Collection', {
      Name: 'wial-coach-profiles',
      Type: 'VECTORSEARCH',
    });
  });

  // ─── Payments Lambda → Secrets Manager Wiring ─────────────────────

  it('adds STRIPE_SECRET_ARN env var to payments Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-payments',
      Environment: {
        Variables: Match.objectLike({
          STRIPE_SECRET_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it('adds PAYPAL_SECRET_ARN env var to payments Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-payments',
      Environment: {
        Variables: Match.objectLike({
          PAYPAL_SECRET_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it('grants Secrets Manager read access to payments Lambda', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const secretReadActions = ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'];
    let found = false;
    for (const [, policy] of Object.entries(policies)) {
      const statements = (policy as any).Properties?.PolicyDocument?.Statement ?? [];
      for (const stmt of statements) {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        if (secretReadActions.every((a: string) => actions.includes(a))) {
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  // ─── Payments Lambda → SES Permissions ────────────────────────────

  it('grants SES send email permissions to payments Lambda', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    let found = false;
    for (const [, policy] of Object.entries(policies)) {
      const statements = (policy as any).Properties?.PolicyDocument?.Statement ?? [];
      for (const stmt of statements) {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        if (actions.includes('ses:SendEmail') && actions.includes('ses:SendRawEmail')) {
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  // ─── Search Lambda → OpenSearch + Bedrock Wiring ──────────────────

  it('adds OPENSEARCH_ENDPOINT env var to search Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-search',
      Environment: {
        Variables: Match.objectLike({
          OPENSEARCH_ENDPOINT: Match.anyValue(),
        }),
      },
    });
  });

  it('adds BEDROCK_ROLE_ARN env var to search Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-search',
      Environment: {
        Variables: Match.objectLike({
          BEDROCK_ROLE_ARN: Match.anyValue(),
        }),
      },
    });
  });

  it('grants Bedrock invoke permissions to search Lambda', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    let found = false;
    for (const [, policy] of Object.entries(policies)) {
      const statements = (policy as any).Properties?.PolicyDocument?.Statement ?? [];
      for (const stmt of statements) {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        if (actions.includes('bedrock:InvokeModel')) {
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it('grants OpenSearch Serverless API access to search Lambda', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    let found = false;
    for (const [, policy] of Object.entries(policies)) {
      const statements = (policy as any).Properties?.PolicyDocument?.Statement ?? [];
      for (const stmt of statements) {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        if (actions.includes('aoss:APIAccessAll')) {
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  // ─── Provisioning Lambda → Route 53 Wiring ───────────────────────

  it('adds HOSTED_ZONE_ID env var to provisioning Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-provisioning',
      Environment: {
        Variables: Match.objectLike({
          HOSTED_ZONE_ID: Match.anyValue(),
        }),
      },
    });
  });

  it('adds HOSTED_ZONE_NAME env var to provisioning Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-provisioning',
      Environment: {
        Variables: Match.objectLike({
          HOSTED_ZONE_NAME: Match.anyValue(),
        }),
      },
    });
  });

  it('grants Route 53 permissions to provisioning Lambda', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    let found = false;
    for (const [, policy] of Object.entries(policies)) {
      const statements = (policy as any).Properties?.PolicyDocument?.Statement ?? [];
      for (const stmt of statements) {
        const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
        if (actions.includes('route53:ChangeResourceRecordSets')) {
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  // ─── Auth Lambda → Cognito Triggers ───────────────────────────────

  it('wires auth Lambda as Cognito pre-authentication trigger', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: Match.objectLike({
        PreAuthentication: Match.anyValue(),
      }),
    });
  });

  it('wires auth Lambda as Cognito post-authentication trigger', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      LambdaConfig: Match.objectLike({
        PostAuthentication: Match.anyValue(),
      }),
    });
  });

  // ─── No Wildcard IAM Actions ──────────────────────────────────────

  it('does not use Action: "*" in any IAM policy', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    for (const [, policy] of Object.entries(policies)) {
      const statements = (policy as any).Properties?.PolicyDocument?.Statement ?? [];
      for (const stmt of statements) {
        if (Array.isArray(stmt.Action)) {
          expect(stmt.Action).not.toContain('*');
        } else {
          expect(stmt.Action).not.toBe('*');
        }
      }
    }
  });
});
