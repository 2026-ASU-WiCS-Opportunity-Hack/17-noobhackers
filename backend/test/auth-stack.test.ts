import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { AuthStack } from '../lib/auth-stack';

describe('AuthStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new AuthStack(app, 'TestAuthStack');
    template = Template.fromStack(stack);
  });

  // ─── User Pool ────────────────────────────────────────────────────

  it('creates a Cognito User Pool with correct name', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'wial-user-pool',
    });
  });

  it('disables self-signup', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
      },
    });
  });

  it('enables email as sign-in alias with auto-verification', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
      AutoVerifiedAttributes: ['email'],
    });
  });

  it('enforces password policy with min 12 chars, uppercase, lowercase, digits, symbols', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      Policies: {
        PasswordPolicy: {
          MinimumLength: 12,
          RequireUppercase: true,
          RequireLowercase: true,
          RequireNumbers: true,
          RequireSymbols: true,
        },
      },
    });
  });

  it('sets MFA to OPTIONAL with TOTP enabled', () => {
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
    });
  });

  it('sets RETAIN deletion policy on the user pool', () => {
    const pools = template.findResources('AWS::Cognito::UserPool');
    const poolIds = Object.keys(pools);
    expect(poolIds.length).toBe(1);
    expect(pools[poolIds[0]].DeletionPolicy).toBe('Retain');
  });

  // ─── User Pool Client ─────────────────────────────────────────────

  it('creates a User Pool Client with correct name', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'wial-app-client',
    });
  });

  it('enables SRP auth flow on the client', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ExplicitAuthFlows: Match.arrayWith([
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
      ]),
    });
  });

  it('sets access token validity to 1 hour', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      AccessTokenValidity: 60,
      TokenValidityUnits: Match.objectLike({
        AccessToken: 'minutes',
      }),
    });
  });

  it('sets ID token validity to 1 hour', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      IdTokenValidity: 60,
      TokenValidityUnits: Match.objectLike({
        IdToken: 'minutes',
      }),
    });
  });

  it('sets refresh token validity to 30 days', () => {
    // CDK synthesizes Duration.days(30) as 43200 minutes
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      RefreshTokenValidity: 43200,
      TokenValidityUnits: Match.objectLike({
        RefreshToken: 'minutes',
      }),
    });
  });

  it('prevents user existence errors', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      PreventUserExistenceErrors: 'ENABLED',
    });
  });

  // ─── User Pool Groups ─────────────────────────────────────────────

  it('creates exactly 4 user pool groups', () => {
    template.resourceCountIs('AWS::Cognito::UserPoolGroup', 4);
  });

  it('creates SuperAdmins group with precedence 0', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
      GroupName: 'SuperAdmins',
      Precedence: 0,
    });
  });

  it('creates ChapterLeads group with precedence 1', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
      GroupName: 'ChapterLeads',
      Precedence: 1,
    });
  });

  it('creates ContentCreators group with precedence 2', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
      GroupName: 'ContentCreators',
      Precedence: 2,
    });
  });

  it('creates Coaches group with precedence 3', () => {
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', {
      GroupName: 'Coaches',
      Precedence: 3,
    });
  });
});
