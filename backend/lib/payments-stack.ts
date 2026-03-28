import * as cdk from 'aws-cdk-lib/core';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ses from 'aws-cdk-lib/aws-ses';
import { Construct } from 'constructs';

export interface PaymentsStackProps extends cdk.StackProps {
  /** Optional environment prefix for resource naming */
  readonly envPrefix?: string;
}

export class PaymentsStack extends cdk.Stack {
  /** Secrets Manager secret for Stripe API key */
  public readonly stripeApiKeySecret: secretsmanager.Secret;

  /** Secrets Manager secret for PayPal client credentials */
  public readonly paypalClientSecret: secretsmanager.Secret;

  /** SES email identity for the platform domain */
  public readonly sesEmailIdentity: ses.EmailIdentity;

  constructor(scope: Construct, id: string, props?: PaymentsStackProps) {
    super(scope, id, props);

    // ─── Secrets Manager: Stripe API Key ──────────────────────────────
    this.stripeApiKeySecret = new secretsmanager.Secret(this, 'StripeApiKeySecret', {
      secretName: 'wial/stripe-api-key',
      description: 'Stripe API key for WIAL payment processing',
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        apiKey: 'PLACEHOLDER_STRIPE_API_KEY',
        webhookSecret: 'PLACEHOLDER_STRIPE_WEBHOOK_SECRET',
      })),
    });

    // ─── Secrets Manager: PayPal Client Credentials ───────────────────
    this.paypalClientSecret = new secretsmanager.Secret(this, 'PaypalClientSecret', {
      secretName: 'wial/paypal-client-secret',
      description: 'PayPal client credentials for WIAL payment processing',
      secretStringValue: cdk.SecretValue.unsafePlainText(JSON.stringify({
        clientId: 'PLACEHOLDER_PAYPAL_CLIENT_ID',
        clientSecret: 'PLACEHOLDER_PAYPAL_CLIENT_SECRET',
      })),
    });

    // ─── Amazon SES: Email Identity ───────────────────────────────────
    this.sesEmailIdentity = new ses.EmailIdentity(this, 'WialEmailIdentity', {
      identity: ses.Identity.domain('wial.org'),
    });

    // ─── Stack Outputs ────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'StripeSecretArn', {
      value: this.stripeApiKeySecret.secretArn,
      description: 'ARN of the Stripe API key secret',
    });

    new cdk.CfnOutput(this, 'PaypalSecretArn', {
      value: this.paypalClientSecret.secretArn,
      description: 'ARN of the PayPal client secret',
    });

    new cdk.CfnOutput(this, 'SesEmailIdentityName', {
      value: 'wial.org',
      description: 'SES email identity domain',
    });
  }
}
