import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { PaymentsStack } from '../lib/payments-stack';

describe('PaymentsStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new PaymentsStack(app, 'TestPaymentsStack');
    template = Template.fromStack(stack);
  });

  // ─── Secrets Manager ──────────────────────────────────────────────

  it('creates exactly 2 Secrets Manager secrets', () => {
    template.resourceCountIs('AWS::SecretsManager::Secret', 2);
  });

  it('creates Stripe API key secret with correct name', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'wial/stripe-api-key',
      Description: Match.stringLikeRegexp('Stripe'),
    });
  });

  it('creates PayPal client secret with correct name', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'wial/paypal-client-secret',
      Description: Match.stringLikeRegexp('PayPal'),
    });
  });

  it('stores placeholder values in Stripe secret (never real keys)', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'wial/stripe-api-key',
      SecretString: Match.stringLikeRegexp('PLACEHOLDER'),
    });
  });

  it('stores placeholder values in PayPal secret (never real keys)', () => {
    template.hasResourceProperties('AWS::SecretsManager::Secret', {
      Name: 'wial/paypal-client-secret',
      SecretString: Match.stringLikeRegexp('PLACEHOLDER'),
    });
  });

  // ─── Amazon SES ───────────────────────────────────────────────────

  it('creates an SES email identity for wial.org domain', () => {
    template.hasResourceProperties('AWS::SES::EmailIdentity', {
      EmailIdentity: 'wial.org',
    });
  });

  // ─── Stack Outputs ────────────────────────────────────────────────

  it('exports Stripe secret ARN', () => {
    template.hasOutput('StripeSecretArn', {
      Description: Match.stringLikeRegexp('Stripe'),
    });
  });

  it('exports PayPal secret ARN', () => {
    template.hasOutput('PaypalSecretArn', {
      Description: Match.stringLikeRegexp('PayPal'),
    });
  });

  it('exports SES email identity name', () => {
    template.hasOutput('SesEmailIdentityName', {
      Value: 'wial.org',
    });
  });
});
