#!/bin/bash
# Post-deploy script: configure Cognito triggers and Lambda env var.
#
# Run after `cdk deploy` to wire the auth Lambda as a Cognito
# pre/post-authentication trigger. This is done outside CDK to avoid
# a circular dependency between the User Pool, Cognito Authorizer,
# and the auth Lambda.
#
# Usage: ./scripts/setup-cognito-triggers.sh

set -euo pipefail

STACK_NAME="WialPlatformStack"
REGION="${AWS_REGION:-us-east-2}"

echo "Fetching stack outputs..."
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

AUTH_FN_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='AuthFnArn'].OutputValue" \
  --output text)

# Extract function name from ARN
AUTH_FN_NAME=$(echo "$AUTH_FN_ARN" | awk -F: '{print $NF}')

echo "User Pool ID: $USER_POOL_ID"
echo "Auth Lambda:  $AUTH_FN_ARN"
echo "Function Name: $AUTH_FN_NAME"

if [ -z "$USER_POOL_ID" ] || [ -z "$AUTH_FN_ARN" ]; then
  echo "ERROR: Could not fetch stack outputs. Is the stack deployed?"
  exit 1
fi

# 1. Get current env vars and merge with USER_POOL_ID
echo "Setting USER_POOL_ID env var on $AUTH_FN_NAME..."
CURRENT_ENV=$(aws lambda get-function-configuration \
  --function-name "$AUTH_FN_NAME" --region "$REGION" \
  --query "Environment.Variables" --output json 2>/dev/null || echo "{}")

# Merge USER_POOL_ID into existing env vars
UPDATED_ENV=$(echo "$CURRENT_ENV" | python3 -c "
import sys, json
env = json.load(sys.stdin)
env['USER_POOL_ID'] = '$USER_POOL_ID'
print(json.dumps({'Variables': env}))
")

aws lambda update-function-configuration \
  --function-name "$AUTH_FN_NAME" --region "$REGION" \
  --environment "$UPDATED_ENV" \
  --no-cli-pager

echo "Waiting for Lambda update to complete..."
aws lambda wait function-updated --function-name "$AUTH_FN_NAME" --region "$REGION"

# 2. Grant Cognito permission to invoke the auth Lambda
echo "Adding Cognito invoke permission..."
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws lambda add-permission \
  --function-name "$AUTH_FN_NAME" --region "$REGION" \
  --statement-id "CognitoTriggerInvoke" \
  --action "lambda:InvokeFunction" \
  --principal "cognito-idp.amazonaws.com" \
  --source-arn "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}" \
  --no-cli-pager 2>/dev/null || echo "  Permission already exists, skipping."

# 3. Configure Cognito triggers
echo "Configuring Cognito pre/post-authentication triggers..."
aws cognito-idp update-user-pool \
  --user-pool-id "$USER_POOL_ID" --region "$REGION" \
  --lambda-config "PreAuthentication=$AUTH_FN_ARN,PostAuthentication=$AUTH_FN_ARN" \
  --no-cli-pager

echo ""
echo "Done. Cognito triggers configured successfully."
echo "User Pool ID: $USER_POOL_ID"
echo "Auth Lambda:  $AUTH_FN_NAME"
