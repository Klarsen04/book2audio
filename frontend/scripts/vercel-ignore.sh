#!/usr/bin/env bash
# Vercel "Ignored Build Step" gate.
#
# Convention Vercel follows: exit 1 = BUILD, exit 0 = SKIP.
#
#   - Production deploy (push to the production branch / a merge) -> always BUILD
#   - Commit/branch with no open pull request                     -> SKIP
#   - PR that does NOT have the "deploy-preview" label            -> SKIP
#   - PR that HAS the "deploy-preview" label                      -> BUILD a preview
#
# Point the Vercel project's Ignored Build Step at:  bash scripts/vercel-ignore.sh
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

OWNER="$VERCEL_GIT_REPO_OWNER"
REPO="$VERCEL_GIT_REPO_SLUG"
REF="$VERCEL_GIT_COMMIT_REF"
PR="$VERCEL_GIT_PULL_REQUEST_ID"

# curl helper — adds an auth header only when a token is present.
gh_api() {
  if [ -n "$GITHUB_TOKEN" ]; then
    curl -s -H "Accept: application/vnd.github+json" -H "Authorization: Bearer $GITHUB_TOKEN" "$1"
  else
    curl -s -H "Accept: application/vnd.github+json" "$1"
  fi
}

# 2. Vercel doesn't always hand us a PR id (e.g. an API-triggered redeploy).
#    Fall back to looking up the open PR for this branch.
if [ -z "$PR" ] && [ -n "$REF" ] && [ -n "$OWNER" ] && [ -n "$REPO" ]; then
  PR=$(gh_api "https://api.github.com/repos/$OWNER/$REPO/pulls?head=$OWNER:$REF&state=open&per_page=1" \
    | grep -o '"number"[[:space:]]*:[[:space:]]*[0-9]\+' | head -1 | grep -o '[0-9]\+')
fi

# 3. No pull request associated with this commit/branch -> skip the preview.
if [ -z "$PR" ]; then
  echo "No open pull request for this commit/branch — skipping preview."
  exit 0
fi

# 4. A PR exists: build only when it carries the "$LABEL" label.
LABELS=$(gh_api "https://api.github.com/repos/$OWNER/$REPO/issues/$PR/labels")

if echo "$LABELS" | grep -q "\"name\"[[:space:]]*:[[:space:]]*\"$LABEL\""; then
  echo "PR #$PR has the '$LABEL' label — building preview."
  exit 1
else
  echo "PR #$PR is missing the '$LABEL' label — skipping preview."
  exit 0
fi
