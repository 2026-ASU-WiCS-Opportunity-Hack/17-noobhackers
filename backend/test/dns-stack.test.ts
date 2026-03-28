import * as cdk from 'aws-cdk-lib/core';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { DnsStack } from '../lib/dns-stack';

describe('DnsStack', () => {
  let template: Template;

  beforeAll(() => {
    const app = new cdk.App();
    const stack = new DnsStack(app, 'TestDnsStack');
    template = Template.fromStack(stack);
  });

  // ─── Route 53 Hosted Zone ─────────────────────────────────────────

  it('creates a Route 53 hosted zone for wial.org', () => {
    template.hasResourceProperties('AWS::Route53::HostedZone', {
      Name: 'wial.org.',
    });
  });

  // ─── Wildcard A Record ────────────────────────────────────────────

  it('creates a wildcard A record for *.wial.org', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: '*.wial.org.',
      Type: 'A',
    });
  });

  it('sets TTL of 5 minutes on the wildcard record', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: '*.wial.org.',
      TTL: '300',
    });
  });

  it('points wildcard record to placeholder IP', () => {
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: '*.wial.org.',
      ResourceRecords: ['127.0.0.1'],
    });
  });

  // ─── Stack Outputs ────────────────────────────────────────────────

  it('exports hosted zone ID', () => {
    template.hasOutput('HostedZoneId', {
      Description: Match.stringLikeRegexp('hosted zone ID'),
    });
  });

  it('exports hosted zone name', () => {
    template.hasOutput('HostedZoneName', {
      Description: Match.stringLikeRegexp('hosted zone name'),
    });
  });
});
