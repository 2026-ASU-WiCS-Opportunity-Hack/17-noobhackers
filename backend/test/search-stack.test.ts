import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SearchStack } from '../lib/search-stack';

describe('SearchStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new SearchStack(app, 'TestSearchStack');
    template = Template.fromStack(stack);
  });

  // ─── OpenSearch Serverless Collection ─────────────────────────────

  it('creates an OpenSearch Serverless collection with VECTORSEARCH type', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::Collection', {
      Name: 'wial-coach-profiles',
      Type: 'VECTORSEARCH',
    });
  });

  it('creates an encryption security policy for the collection', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::SecurityPolicy', {
      Name: 'wial-coach-profiles-enc',
      Type: 'encryption',
    });
  });

  it('creates a network security policy for the collection', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::SecurityPolicy', {
      Name: 'wial-coach-profiles-net',
      Type: 'network',
    });
  });

  it('creates a data access policy for the collection', () => {
    template.hasResourceProperties('AWS::OpenSearchServerless::AccessPolicy', {
      Name: 'wial-coach-profiles-access',
      Type: 'data',
    });
  });

  // ─── Bedrock Access Role ──────────────────────────────────────────

  it('creates an IAM role for Bedrock model access', () => {
    template.hasResourceProperties('AWS::IAM::Role', {
      RoleName: 'wial-bedrock-access',
      AssumeRolePolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Principal: { Service: 'lambda.amazonaws.com' },
          }),
        ]),
      }),
    });
  });

  it('grants bedrock:InvokeModel permission to the Bedrock role', () => {
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Action: Match.arrayWith([
              'bedrock:InvokeModel',
              'bedrock:InvokeModelWithResponseStream',
            ]),
          }),
        ]),
      }),
    });
  });

  // ─── Stack Outputs ────────────────────────────────────────────────

  it('exports collection endpoint', () => {
    template.hasOutput('CollectionEndpoint', {
      Description: Match.stringLikeRegexp('collection endpoint'),
    });
  });

  it('exports collection ARN', () => {
    template.hasOutput('CollectionArn', {
      Description: Match.stringLikeRegexp('collection ARN'),
    });
  });

  it('exports Bedrock access role ARN', () => {
    template.hasOutput('BedrockAccessRoleArn', {
      Description: Match.stringLikeRegexp('Bedrock access'),
    });
  });
});
