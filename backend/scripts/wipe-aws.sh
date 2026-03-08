#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  wipe-aws.sh — Clears all Forge DynamoDB tables & S3 objects
# ──────────────────────────────────────────────────────────────
set -euo pipefail

REGION="us-east-1"

# ── DynamoDB Tables ──
TABLES=(
  "forge-repos"
  "forge-storyboards"
  "forge-chat-history"
  "forge-progress"
)

# ── S3 Bucket (resolve the actual name via CloudFormation) ──
STACK_NAME="sam-app"
BUCKET=$(aws cloudformation describe-stack-resource \
  --stack-name "$STACK_NAME" \
  --logical-resource-id ForgeArtifactsBucket \
  --region "$REGION" \
  --query "StackResourceDetail.PhysicalResourceId" \
  --output text 2>/dev/null || echo "")

# ────────────────────────── Safety Prompt ──────────────────────────
echo ""
echo "⚠️  THIS WILL PERMANENTLY DELETE ALL DATA IN:"
echo ""
for t in "${TABLES[@]}"; do
  echo "   • DynamoDB table: $t"
done
if [[ -n "$BUCKET" ]]; then
  echo "   • S3 bucket:      s3://$BUCKET (all objects)"
else
  echo "   • S3 bucket:      (could not resolve — skipping)"
fi
echo ""
read -rp "Type 'yes' to continue: " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

# ────────────────────── Wipe DynamoDB Tables ──────────────────────
wipe_table() {
  local table=$1
  echo ""
  echo "🗑  Wiping DynamoDB table: $table …"

  # Grab the key schema so we delete with the right keys
  local key_schema
  key_schema=$(aws dynamodb describe-table \
    --table-name "$table" \
    --region "$REGION" \
    --query "Table.KeySchema[].AttributeName" \
    --output json)

  # Build projection + expression-attribute-names to handle reserved keywords
  local scan_args
  scan_args=$(echo "$key_schema" | python3 -c "
import sys, json
attrs = json.load(sys.stdin)
proj = ','.join(f'#a{i}' for i in range(len(attrs)))
names = {f'#a{i}': a for i, a in enumerate(attrs)}
print(proj)
print(json.dumps(names))
")
  local projection
  projection=$(echo "$scan_args" | head -1)
  local expr_names
  expr_names=$(echo "$scan_args" | tail -1)

  local count=0
  local items
  items=$(aws dynamodb scan \
    --table-name "$table" \
    --region "$REGION" \
    --projection-expression "$projection" \
    --expression-attribute-names "$expr_names" \
    --output json)

  local total
  total=$(echo "$items" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['Items']))")

  if [[ "$total" == "0" ]]; then
    echo "   ✓ Already empty."
    return
  fi

  echo "   Found $total items — deleting in batches …"

  # Batch delete 25 at a time (DynamoDB BatchWriteItem limit)
  echo "$items" | python3 -c "
import sys, json

data = json.load(sys.stdin)
items = data.get('Items', [])
table = '$table'
key_attrs = $key_schema

for i in range(0, len(items), 25):
    batch = items[i:i+25]
    requests = []
    for item in batch:
        key = {attr: item[attr] for attr in key_attrs}
        requests.append({'DeleteRequest': {'Key': key}})
    payload = {table: requests}
    # Output <batch_size>|<payload_json> so the shell can track counts accurately
    print(f\"{len(requests)}|{json.dumps(payload)}\")
" | while IFS='|' read -r batch_size batch; do
    # Retry loop for unprocessed items returned by DynamoDB
    retries=0
    max_retries=5
    backoff=1
    request_items="$batch"
    while :; do
      result=$(aws dynamodb batch-write-item \
        --region "$REGION" \
        --request-items "$request_items" \
        --output json)
      unprocessed=$(echo "$result" | python3 -c "import sys, json; data = json.load(sys.stdin); ui = data.get('UnprocessedItems') or {}; print(json.dumps(ui) if ui else '')")
      if [[ -z "$unprocessed" || "$unprocessed" == "{}" ]]; then
        break
      fi
      retries=$((retries + 1))
      if (( retries > max_retries )); then
        echo "   ! Warning: giving up on some unprocessed items after $max_retries retries for table $table" >&2
        break
      fi
      sleep "$backoff"
      backoff=$((backoff * 2))
      request_items="$unprocessed"
    done
    count=$((count + batch_size))
  done

  echo "   ✓ Done."
}

for table in "${TABLES[@]}"; do
  wipe_table "$table"
done

# ──────────────────────── Wipe S3 Bucket ────────────────────────
if [[ -n "$BUCKET" ]]; then
  echo ""
  echo "🗑  Emptying S3 bucket: s3://$BUCKET …"
  aws s3 rm "s3://$BUCKET" --recursive --region "$REGION"
  echo "   ✓ Done."
fi

echo ""
echo "✅  All Forge data has been wiped."
echo ""
