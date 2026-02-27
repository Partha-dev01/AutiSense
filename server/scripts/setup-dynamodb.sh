REGION="${AWS_REGION:-ap-south-1}"

echo "Creating DynamoDB tables in region: $REGION"
echo ""

# ── autisense-sessions ────────────────────────────────────────────────────────
# Partition key: id (String)  — UUID, one row per screening session
echo "Creating autisense-sessions..."
aws dynamodb create-table \
  --table-name autisense-sessions \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=userId,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "userId-createdAt-index",
      "KeySchema": [
        {"AttributeName":"userId","KeyType":"HASH"},
        {"AttributeName":"createdAt","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  2>&1

echo ""

# ── autisense-biomarkers ──────────────────────────────────────────────────────
# Partition key: sessionId (String)
# Sort key:      createdAt (Number)  — enables time-series queries
echo "Creating autisense-biomarkers..."
aws dynamodb create-table \
  --table-name autisense-biomarkers \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=createdAt,AttributeType=N \
    AttributeName=userId,AttributeType=S \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
    AttributeName=createdAt,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "userId-createdAt-index",
      "KeySchema": [
        {"AttributeName":"userId","KeyType":"HASH"},
        {"AttributeName":"createdAt","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"}
    }
  ]' \
  --billing-mode PAY_PER_REQUEST \
  --region "$REGION" \
  2>&1

echo ""

# Enable TTL on both tables (fields expire after 1 year — see GDPR retention)
echo "Enabling TTL on autisense-sessions..."
aws dynamodb update-time-to-live \
  --table-name autisense-sessions \
  --time-to-live-specification "Enabled=true, AttributeName=ttl" \
  --region "$REGION" \
  2>&1

echo "Enabling TTL on autisense-biomarkers..."
aws dynamodb update-time-to-live \
  --table-name autisense-biomarkers \
  --time-to-live-specification "Enabled=true, AttributeName=ttl" \
  --region "$REGION" \
  2>&1

echo ""
echo "Done. Both tables created with PAY_PER_REQUEST billing and 1-year TTL."
echo "Verify in the AWS console: https://console.aws.amazon.com/dynamodb/home?region=$REGION"