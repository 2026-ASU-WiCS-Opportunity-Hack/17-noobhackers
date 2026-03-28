import * as cdk from 'aws-cdk-lib/core';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as opensearchserverless from 'aws-cdk-lib/aws-opensearchserverless';
import { Construct } from 'constructs';

export interface SearchStackProps extends cdk.StackProps {
  /** Optional environment prefix for resource naming */
  readonly envPrefix?: string;
}

export class SearchStack extends cdk.Stack {
  /** OpenSearch Serverless collection for coach profile vector search */
  public readonly collection: opensearchserverless.CfnCollection;

  /** IAM role for Bedrock model access (embeddings + LLM) */
  public readonly bedrockAccessRole: iam.Role;

  constructor(scope: Construct, id: string, props?: SearchStackProps) {
    super(scope, id, props);

    const collectionName = 'wial-coach-profiles';

    // ─── OpenSearch Serverless: Encryption Policy ─────────────────────
    const encryptionPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'EncryptionPolicy', {
      name: 'wial-coach-profiles-enc',
      type: 'encryption',
      description: 'Encryption policy for WIAL coach profiles collection',
      policy: JSON.stringify({
        Rules: [
          {
            ResourceType: 'collection',
            Resource: [`collection/${collectionName}`],
          },
        ],
        AWSOwnedKey: true,
      }),
    });

    // ─── OpenSearch Serverless: Network Policy ────────────────────────
    const networkPolicy = new opensearchserverless.CfnSecurityPolicy(this, 'NetworkPolicy', {
      name: 'wial-coach-profiles-net',
      type: 'network',
      description: 'Network policy for WIAL coach profiles collection',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
            },
            {
              ResourceType: 'dashboard',
              Resource: [`collection/${collectionName}`],
            },
          ],
          AllowFromPublic: true,
        },
      ]),
    });

    // ─── OpenSearch Serverless: Collection ────────────────────────────
    this.collection = new opensearchserverless.CfnCollection(this, 'CoachProfilesCollection', {
      name: collectionName,
      type: 'VECTORSEARCH',
      description: 'Vector search collection for AI-powered coach profile semantic search',
    });

    this.collection.addDependency(encryptionPolicy);
    this.collection.addDependency(networkPolicy);

    // ─── Bedrock Model Access Role ────────────────────────────────────
    this.bedrockAccessRole = new iam.Role(this, 'BedrockAccessRole', {
      roleName: 'wial-bedrock-access',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'IAM role for Lambda functions to access Bedrock models (embeddings + LLM)',
    });

    this.bedrockAccessRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'],
    }));

    // ─── OpenSearch Serverless: Data Access Policy ────────────────────
    new opensearchserverless.CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: 'wial-coach-profiles-access',
      type: 'data',
      description: 'Data access policy for WIAL coach profiles collection',
      policy: JSON.stringify([
        {
          Rules: [
            {
              ResourceType: 'collection',
              Resource: [`collection/${collectionName}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
            },
            {
              ResourceType: 'index',
              Resource: [`index/${collectionName}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
            },
          ],
          Principal: [this.bedrockAccessRole.roleArn],
        },
      ]),
    });

    // ─── Stack Outputs ────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'CollectionEndpoint', {
      value: this.collection.attrCollectionEndpoint,
      description: 'OpenSearch Serverless collection endpoint',
    });

    new cdk.CfnOutput(this, 'CollectionArn', {
      value: this.collection.attrArn,
      description: 'OpenSearch Serverless collection ARN',
    });

    new cdk.CfnOutput(this, 'BedrockAccessRoleArn', {
      value: this.bedrockAccessRole.roleArn,
      description: 'ARN of the Bedrock access IAM role',
    });
  }
}
