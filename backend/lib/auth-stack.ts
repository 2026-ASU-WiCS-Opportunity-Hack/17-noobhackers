import * as cdk from 'aws-cdk-lib/core';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AuthStackProps extends cdk.StackProps {
  /** Optional environment prefix for resource naming */
  readonly envPrefix?: string;
}

export class AuthStack extends cdk.Stack {
  /** Cognito User Pool for platform authentication */
  public readonly userPool: cognito.UserPool;

  /** User Pool Client for the frontend application */
  public readonly userPoolClient: cognito.UserPoolClient;

  /** Cognito User Pool group for WIAL Global Administrators */
  public readonly superAdminsGroup: cognito.CfnUserPoolGroup;

  /** Cognito User Pool group for regional affiliate directors */
  public readonly chapterLeadsGroup: cognito.CfnUserPoolGroup;

  /** Cognito User Pool group for content editors */
  public readonly contentCreatorsGroup: cognito.CfnUserPoolGroup;

  /** Cognito User Pool group for certified coaches */
  public readonly coachesGroup: cognito.CfnUserPoolGroup;

  constructor(scope: Construct, id: string, props?: AuthStackProps) {
    super(scope, id, props);

    // ─── Cognito User Pool ────────────────────────────────────────────
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
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── User Pool Client ─────────────────────────────────────────────
    this.userPoolClient = this.userPool.addClient('WialAppClient', {
      userPoolClientName: 'wial-app-client',
      authFlows: {
        userSrp: true,
      },
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      preventUserExistenceErrors: true,
    });

    // ─── Cognito User Pool Groups ─────────────────────────────────────
    // SuperAdmins: WIAL Global Administrators — full access to all resources
    // MFA is set to OPTIONAL at the pool level; SuperAdmin users must have
    // MFA enabled, enforced via a pre-authentication Lambda trigger (task 5.1)
    this.superAdminsGroup = new cognito.CfnUserPoolGroup(this, 'SuperAdminsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'SuperAdmins',
      description: 'WIAL Global Administrators — full access to all resources',
      precedence: 0,
    });

    // ChapterLeads: Regional affiliate directors — manage assigned chapter(s)
    this.chapterLeadsGroup = new cognito.CfnUserPoolGroup(this, 'ChapterLeadsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'ChapterLeads',
      description: 'Regional affiliate directors — manage assigned chapter(s)',
      precedence: 1,
    });

    // ContentCreators: Content editors — edit content on assigned chapter(s)
    this.contentCreatorsGroup = new cognito.CfnUserPoolGroup(this, 'ContentCreatorsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'ContentCreators',
      description: 'Content editors — edit content on assigned chapter(s)',
      precedence: 2,
    });

    // Coaches: Certified coaches — read directory, edit own profile
    this.coachesGroup = new cognito.CfnUserPoolGroup(this, 'CoachesGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Coaches',
      description: 'Certified coaches — read directory, edit own profile',
      precedence: 3,
    });
  }
}
