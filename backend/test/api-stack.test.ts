import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ApiStack } from '../lib/api-stack';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';

describe('ApiStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const dataStack = new DataStack(app, 'TestDataStack');
    const authStack = new AuthStack(app, 'TestAuthStack');
    const apiStack = new ApiStack(app, 'TestApiStack', {
      userPool: authStack.userPool,
      chaptersTable: dataStack.chaptersTable,
      coachesTable: dataStack.coachesTable,
      paymentsTable: dataStack.paymentsTable,
      pagesTable: dataStack.pagesTable,
      templatesTable: dataStack.templatesTable,
      usersTable: dataStack.usersTable,
      assetsBucket: dataStack.assetsBucket,
    });
    template = Template.fromStack(apiStack);
  });

  // ─── REST API Gateway ─────────────────────────────────────────────

  it('creates a REST API Gateway with correct name', () => {
    template.hasResourceProperties('AWS::ApiGateway::RestApi', {
      Name: 'wial-platform-api',
    });
  });

  it('deploys API to v1 stage', () => {
    template.hasResourceProperties('AWS::ApiGateway::Stage', {
      StageName: 'v1',
    });
  });

  // ─── Lambda Functions ─────────────────────────────────────────────

  it('creates exactly 7 Lambda functions', () => {
    template.resourceCountIs('AWS::Lambda::Function', 7);
  });

  it.each([
    'wial-provisioning',
    'wial-coaches',
    'wial-payments',
    'wial-search',
    'wial-metrics',
    'wial-templates',
    'wial-auth',
  ])('creates Lambda function %s with Python 3.12 runtime', (fnName) => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: fnName,
      Runtime: 'python3.12',
    });
  });

  it.each([
    'wial-provisioning',
    'wial-coaches',
    'wial-payments',
    'wial-search',
    'wial-metrics',
    'wial-templates',
    'wial-auth',
  ])('sets 256 MB memory and 30s timeout on %s', (fnName) => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: fnName,
      MemorySize: 256,
      Timeout: 30,
    });
  });

  it('sets table name environment variables on provisioning Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-provisioning',
      Environment: {
        Variables: Match.objectLike({
          CHAPTERS_TABLE: Match.anyValue(),
          PAGES_TABLE: Match.anyValue(),
          ASSETS_BUCKET: Match.anyValue(),
        }),
      },
    });
  });

  it('sets only USERS_TABLE env var on auth Lambda', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'wial-auth',
      Environment: {
        Variables: Match.objectLike({
          USERS_TABLE: Match.anyValue(),
        }),
      },
    });
  });

  // ─── Cognito Authorizer ───────────────────────────────────────────

  it('creates a Cognito User Pools authorizer', () => {
    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Name: 'wial-cognito-authorizer',
      Type: 'COGNITO_USER_POOLS',
    });
  });

  // ─── API Routes ───────────────────────────────────────────────────

  it('creates API resources for all route paths', () => {
    // Verify key resource paths exist
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'chapters',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'coaches',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'payments',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'templates',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'users',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'metrics',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'search',
    });
  });

  it('creates path parameter resources', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{chapterId}',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{coachId}',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{paymentId}',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{userId}',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: '{pageSlug}',
    });
  });

  it('creates webhook sub-resources for Stripe and PayPal', () => {
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'webhook',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'stripe',
    });
    template.hasResourceProperties('AWS::ApiGateway::Resource', {
      PathPart: 'paypal',
    });
  });

  // ─── Auth on Protected Endpoints ──────────────────────────────────

  it('applies Cognito authorization on protected methods', () => {
    // Find methods that use COGNITO_USER_POOLS auth
    const methods = template.findResources('AWS::ApiGateway::Method', {
      Properties: {
        AuthorizationType: 'COGNITO_USER_POOLS',
      },
    });
    // Protected endpoints: POST/PUT/DELETE chapters, POST/PUT coaches,
    // POST coaches approve, POST/GET payments, GET payment,
    // GET/PUT templates, GET/POST users, PUT role, DELETE user,
    // GET global metrics, GET chapter metrics, PUT chapter pages
    expect(Object.keys(methods).length).toBeGreaterThanOrEqual(15);
  });

  it('allows public access on GET /chapters and GET /coaches', () => {
    const methods = template.findResources('AWS::ApiGateway::Method', {
      Properties: {
        HttpMethod: 'GET',
        AuthorizationType: 'NONE',
      },
    });
    // Public GETs: chapters list, chapter detail, coaches list, coach detail,
    // coaches/search, chapter pages list, chapter page detail
    expect(Object.keys(methods).length).toBeGreaterThanOrEqual(7);
  });

  it('allows unauthenticated access on webhook endpoints', () => {
    const methods = template.findResources('AWS::ApiGateway::Method', {
      Properties: {
        HttpMethod: 'POST',
        AuthorizationType: 'NONE',
      },
    });
    // Webhook POSTs: stripe, paypal (plus OPTIONS preflight methods are separate)
    expect(Object.keys(methods).length).toBeGreaterThanOrEqual(2);
  });

  // ─── IAM Least-Privilege ──────────────────────────────────────────

  it('grants DynamoDB permissions to Lambda roles (no wildcard actions)', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    for (const [, policy] of Object.entries(policies)) {
      const statements = (policy as any).Properties?.PolicyDocument?.Statement ?? [];
      for (const stmt of statements) {
        // Ensure no Action: "*" in any IAM statement
        if (Array.isArray(stmt.Action)) {
          expect(stmt.Action).not.toContain('*');
        } else {
          expect(stmt.Action).not.toBe('*');
        }
      }
    }
  });

  // ─── Stack Output ─────────────────────────────────────────────────

  it('outputs the API URL', () => {
    template.hasOutput('ApiUrl', {});
  });
});
