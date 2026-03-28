import * as cdk from 'aws-cdk-lib/core';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

export interface DnsStackProps extends cdk.StackProps {
  /** Optional environment prefix for resource naming */
  readonly envPrefix?: string;
}

export class DnsStack extends cdk.Stack {
  /** Route 53 hosted zone for wial.org */
  public readonly hostedZone: route53.HostedZone;

  /** Wildcard A record for chapter subdomains (*.wial.org) */
  public readonly wildcardRecord: route53.ARecord;

  constructor(scope: Construct, id: string, props?: DnsStackProps) {
    super(scope, id, props);

    // ─── Route 53 Hosted Zone ─────────────────────────────────────────
    this.hostedZone = new route53.HostedZone(this, 'WialHostedZone', {
      zoneName: 'wial.org',
      comment: 'WIAL Chapter Platform hosted zone',
    });

    // ─── Wildcard A Record ────────────────────────────────────────────
    // Points *.wial.org to a placeholder IP. The actual target
    // (CloudFront distribution or ALB) will be wired in the main stack.
    this.wildcardRecord = new route53.ARecord(this, 'WildcardRecord', {
      zone: this.hostedZone,
      recordName: '*.wial.org',
      target: route53.RecordTarget.fromIpAddresses('127.0.0.1'),
      ttl: cdk.Duration.minutes(5),
      comment: 'Wildcard record for chapter subdomains — target updated during main stack wiring',
    });

    // ─── Stack Outputs ────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route 53 hosted zone ID for wial.org',
    });

    new cdk.CfnOutput(this, 'HostedZoneName', {
      value: this.hostedZone.zoneName,
      description: 'Route 53 hosted zone name',
    });
  }
}
