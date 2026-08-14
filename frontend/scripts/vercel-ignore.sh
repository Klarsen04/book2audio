#!/usr/bin/env bash
# Vercel "Ignored Build Step" gate.
#
# Convention Vercel follows: exit 1 = BUILD, exit 0 = SKIP.
#
#   - Production deploy (push to the production branch / a merge) -> always BUILD
#   - Commit with no associated pull request                      -> SKIP
#   - PR that does NOT have the "deploy-preview" label            -> SKIP
#   - PR that HAS the "deploy-preview" label                      -> BUILD a preview
#
# This project's Vercel Root Directory is "frontend", so point the Ignored
# Build Step at:  bash scripts/vercel-ignore.sh
#
# The label lookup uses the public GitHub API (these repos are public). If a
# GITHUB_TOKEN env var is set on the Vercel project it is used automatically to
# raise the API rate limit; it is not required.

LABEL="deploy-preview"

# 1. Always build Production deployments (a merge into the production branch).
if [ "$VERCEL_ENV" = "production" ]; then
  echo "Production deployment — building."
  exit 1
fi

# 2. No pull request attached to this commit -> skip the preview.
if [ -z "$VERCEL_GIT_PULL_REQUEST_ID" ]; then
  echo "No pull request associated with this commit — skipping preview."
  exit 0
fi

# 3. A PR exists: build only when it carries the "$LABEL" label.
API="https://api.github.com/repos/$VERCEL_GIT_REPO_OWNER/$VERCEL_GIT_REPO_SLUG/issues/$VERCEL_GIT_PULL_REQUEST_ID/labels"

if [ -n "$GITHUB_TOKEN" ]; then
  LABELS=$(curl -s -H "Accept: application/vnd.github+json" -H "Authorization: Bearer $GITHUB_TOKEN" "$API")
else
  LABELS=$(curl -s -H "Accept: application/vnd.github+json" "$API")
fi

if echo "$LABELS" | grep -q "\"name\": *\"$LABEL\""; then
  echo "PR #$VERCEL_GIT_PULL_REQUEST_ID has the '$LABEL' label — building preview."
  exit 1
else
  echo "PR #$VERCEL_GIT_PULL_REQUEST_ID is missing the '$LABEL' label — skipping preview."
  exit 0
fi
