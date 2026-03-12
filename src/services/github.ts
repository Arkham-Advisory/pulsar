import { Octokit } from '@octokit/rest';
import type { PullRequest, PRReview, GitHubRepo } from '../types/github';
import type { RepoFilterEntry } from '../types/settings';

let octokitInstance: Octokit | null = null;

export function getOctokit(pat: string): Octokit {
  if (!octokitInstance || (octokitInstance as any)._auth !== pat) {
    octokitInstance = new Octokit({ auth: pat });
    (octokitInstance as any)._auth = pat;
  }
  return octokitInstance;
}

export function clearOctokitCache() {
  octokitInstance = null;
}

// Validate PAT by calling /user
export async function validatePAT(pat: string): Promise<{ valid: boolean; login?: string; error?: string }> {
  try {
    const octokit = new Octokit({ auth: pat });
    const { data } = await octokit.users.getAuthenticated();
    return { valid: true, login: data.login };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

// Return the total repo count for an org or user (public + private).
// Uses the metadata endpoint — no pagination needed.
export async function fetchOwnerRepoCount(pat: string, owner: string): Promise<number> {
  const octokit = getOctokit(pat);
  try {
    const { data } = await octokit.orgs.get({ org: owner });
    return (data.public_repos ?? 0) + (data.total_private_repos ?? 0);
  } catch {
    try {
      const { data } = await octokit.users.getByUsername({ username: owner });
      return (data.public_repos ?? 0) + ((data as any).total_private_repos ?? 0);
    } catch {
      return 0;
    }
  }
}

// Fetch all repos for an owner (org or user)
export async function fetchReposForOwner(
  octokit: Octokit,
  owner: string
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  // Try org first, fall back to user
  try {
    while (true) {
      const { data } = await octokit.repos.listForOrg({
        org: owner,
        type: 'all',
        per_page: 100,
        page,
      });
      repos.push(...data.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        name: r.name,
        owner,
        private: r.private,
        html_url: r.html_url,
        description: r.description,
        default_branch: r.default_branch || 'main',
      })));
      if (data.length < 100) break;
      page++;
    }
  } catch {
    page = 1;
    while (true) {
      const { data } = await octokit.repos.listForUser({
        username: owner,
        type: 'all',
        per_page: 100,
        page,
      });
      repos.push(...data.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        name: r.name,
        owner,
        private: r.private,
        html_url: r.html_url,
        description: r.description,
        default_branch: r.default_branch || 'main',
      })));
      if (data.length < 100) break;
      page++;
    }
  }

  return repos;
}

// Fetch only repos whose name starts with `prefix`.
// Uses the GitHub search API (indexed, returns only repos whose name *contains*
// the prefix) then filters client-side for exact startsWith — so we never page
// through the full repo list regardless of org size.
async function fetchReposWithPrefix(
  octokit: Octokit,
  owner: string,
  prefix: string
): Promise<GitHubRepo[]> {
  const prefixLower = prefix.toLowerCase();
  const results: GitHubRepo[] = [];

  // Try org: qualifier first; fall back to user: for personal accounts.
  for (const qualifier of [`org:${owner}`, `user:${owner}`]) {
    const q = `${qualifier} ${prefix} in:name`;
    let page = 1;

    while (true) {
      let data: Awaited<ReturnType<typeof octokit.search.repos>>['data'];
      try {
        ({ data } = await octokit.search.repos({ q, per_page: 100, page }));
      } catch {
        break;
      }

      data.items
        .filter((r) => r.name.toLowerCase().startsWith(prefixLower))
        .forEach((r) => {
          results.push({
            id: r.id,
            full_name: r.full_name,
            name: r.name,
            owner: r.owner?.login ?? owner,
            private: r.private,
            html_url: r.html_url,
            description: r.description,
            default_branch: r.default_branch || 'main',
          });
        });

      // Stop paging when we've received a partial page or exhausted total_count
      if (data.items.length < 100 || results.length >= data.total_count) break;
      page++;
    }

    // If the org: qualifier yielded results (or even 0 items from a valid
    // response), don't also try user: — they'd be the same repos.
    if (results.length > 0) break;
  }

  return results;
}

// Fetch PRs for a specific repo since a given date
export async function fetchPRsForRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
  since: Date,
  signal?: AbortSignal
): Promise<PullRequest[]> {
  const prs: PullRequest[] = [];
  let page = 1;

  // Fetch closed PRs
  const states: Array<'open' | 'closed'> = ['open', 'closed'];

  for (const state of states) {
    page = 1;
    while (true) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const { data } = await octokit.pulls.list({
        owner,
        repo,
        state,
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        page,
      });

      const filtered = data.filter((pr) => new Date(pr.updated_at) >= since);

      const mapped: PullRequest[] = filtered.map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        html_url: pr.html_url,
        state: pr.state as 'open' | 'closed',
        merged: !!(pr as any).merged_at,
        merged_at: (pr as any).merged_at || null,
        closed_at: pr.closed_at || null,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        user: {
          login: pr.user?.login || 'unknown',
          avatar_url: pr.user?.avatar_url || '',
          html_url: pr.user?.html_url || '',
        },
        labels: pr.labels?.map((l) => ({ name: l.name || '', color: l.color || 'ccc' })) || [],
        repo: `${owner}/${repo}`,
        additions: (pr as any).additions || 0,
        deletions: (pr as any).deletions || 0,
        changed_files: (pr as any).changed_files || 0,
        review_comments: (pr as any).review_comments || 0,
        comments: (pr as any).comments || 0,
        commits: (pr as any).commits || 0,
        draft: pr.draft || false,
        requested_reviewers: [
          ...(pr.requested_reviewers || []).filter(Boolean).map((r: any) => ({
            login: r.login || '',
            avatar_url: r.avatar_url || '',
            html_url: r.html_url || '',
          })),
          ...(pr.requested_teams || []).filter(Boolean).map((t: any) => ({
            login: t.name || t.slug || '',
            avatar_url: '',
            html_url: t.html_url || '',
          })),
        ],
        assignees: (pr.assignees || []).map((a: any) => ({
          login: a.login,
          avatar_url: a.avatar_url,
          html_url: a.html_url,
        })),
        base: { ref: pr.base.ref },
        head: { ref: pr.head.ref, sha: pr.head.sha },
        ciStatus: 'unknown' as const,
      }));

      prs.push(...mapped);

      // If all items are older than `since`, stop
      if (data.length < 100 || (data[data.length - 1] && new Date(data[data.length - 1].updated_at) < since)) {
        break;
      }
      page++;
    }
  }

  // Deduplicate by id
  const seen = new Set<number>();
  return prs.filter((pr) => {
    if (seen.has(pr.id)) return false;
    seen.add(pr.id);
    return true;
  });
}

// Fetch reviews for a PR
export async function fetchPRReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRReview[]> {
  try {
    const { data } = await octokit.pulls.listReviews({
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return data
      .filter((r) => r.submitted_at)
      .map((r) => ({
        id: r.id,
        user: {
          login: r.user?.login || 'unknown',
          avatar_url: r.user?.avatar_url || '',
          html_url: r.user?.html_url || '',
        },
        state: r.state as PRReview['state'],
        submitted_at: r.submitted_at!,
        pr_number: prNumber,
        repo: `${owner}/${repo}`,
      }));
  } catch {
    return [];
  }
}

// Enrich PRs with additions/deletions/changed_files by calling pulls.get in
// parallel batches. The list endpoint doesn't return these fields.
async function enrichPRsWithSizeData(
  octokit: Octokit,
  prs: PullRequest[],
  signal?: AbortSignal,
  onProgress?: (msg: string) => void
): Promise<void> {
  const BATCH = 10;
  const MAX = 300; // cap to stay within rate limits
  const toEnrich = prs.slice(0, MAX);

  for (let i = 0; i < toEnrich.length; i += BATCH) {
    if (signal?.aborted) break;
    const batch = toEnrich.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (pr) => {
        const [owner, repo] = pr.repo.split('/');
        try {
          const { data } = await octokit.pulls.get({ owner, repo, pull_number: pr.number });
          pr.additions = data.additions;
          pr.deletions = data.deletions;
          pr.changed_files = data.changed_files;
        } catch {
          // leave as 0 if individual fetch fails
        }
      })
    );
    if (i + BATCH < toEnrich.length) {
      onProgress?.(`Fetching PR details ${Math.min(i + BATCH, toEnrich.length)}/${toEnrich.length}...`);
    }
  }
}

// Fetch all repos for configured filters (shared helper)
async function buildRepoList(
  octokit: Octokit,
  repoFilters: RepoFilterEntry[],
  onProgress?: (msg: string) => void
): Promise<Array<{ owner: string; repo: string }>> {
  const list: Array<{ owner: string; repo: string }> = [];
  for (const filter of repoFilters) {
    if (filter.type === 'repo') {
      list.push({ owner: filter.owner, repo: filter.repo });
    } else if (filter.type === 'org') {
      onProgress?.(`Fetching repo list for ${filter.owner}...`);
      const repos = await fetchReposForOwner(octokit, filter.owner);
      repos.forEach((r) => list.push({ owner: filter.owner, repo: r.name }));
    } else if (filter.type === 'prefix') {
      onProgress?.(`Fetching repos matching "${filter.prefix}*" in ${filter.owner}...`);
      const repos = await fetchReposWithPrefix(octokit, filter.owner, filter.prefix);
      repos.forEach((r) => list.push({ owner: filter.owner, repo: r.name }));
      onProgress?.(`Found ${repos.length} repos matching "${filter.prefix}*"`);
    }
  }
  return list;
}

// Fetch basic PR list only (no per-PR calls) — fast, used for the PR list page
export async function fetchBasicPRData(
  pat: string,
  repoFilters: RepoFilterEntry[],
  since: Date,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<PullRequest[]> {
  const octokit = getOctokit(pat);
  const repoList = await buildRepoList(octokit, repoFilters, onProgress);
  const allPRs: PullRequest[] = [];
  for (const { owner, repo } of repoList) {
    if (signal?.aborted) break;
    onProgress?.(`Fetching PRs for ${owner}/${repo}...`);
    const prs = await fetchPRsForRepo(octokit, owner, repo, since, signal);
    allPRs.push(...prs);
  }
  return allPRs;
}

// Fetch CI check-run status for a batch of open PRs (returns a map PR id → status)
export async function fetchCIStatuses(
  pat: string,
  prs: PullRequest[],
  signal?: AbortSignal
): Promise<Map<number, PullRequest['ciStatus']>> {
  const octokit = getOctokit(pat);
  const result = new Map<number, PullRequest['ciStatus']>();
  const openPRs = prs.filter((p) => p.state === 'open' && !p.draft).slice(0, 100);
  const BATCH = 8;
  for (let i = 0; i < openPRs.length; i += BATCH) {
    if (signal?.aborted) break;
    await Promise.all(
      openPRs.slice(i, i + BATCH).map(async (pr) => {
        const [owner, repo] = pr.repo.split('/');
        try {
          const { data } = await octokit.checks.listForRef({
            owner, repo,
            ref: pr.head.sha,
            per_page: 50,
          });
          const runs = data.check_runs;
          if (runs.length === 0) { result.set(pr.id, 'neutral'); return; }
          const statuses = runs.map((r) => r.conclusion);
          if (statuses.some((s) => s === 'failure' || s === 'cancelled' || s === 'timed_out')) {
            result.set(pr.id, 'failure');
          } else if (runs.some((r) => r.status !== 'completed')) {
            result.set(pr.id, 'pending');
          } else {
            result.set(pr.id, 'success');
          }
        } catch {
          result.set(pr.id, 'unknown');
        }
      })
    );
  }
  return result;
}

export type ApprovalStatus = 'approved' | 'changes_requested' | 'none';

// Fetch review approval state for open PRs in batches of 8
export async function fetchApprovalStatuses(
  pat: string,
  prs: PullRequest[],
  signal?: AbortSignal
): Promise<Map<number, ApprovalStatus>> {
  const octokit = getOctokit(pat);
  const result = new Map<number, ApprovalStatus>();
  const openPRs = prs.filter((p) => p.state === 'open' && !p.draft).slice(0, 100);
  const BATCH = 8;
  for (let i = 0; i < openPRs.length; i += BATCH) {
    if (signal?.aborted) break;
    await Promise.all(
      openPRs.slice(i, i + BATCH).map(async (pr) => {
        const [owner, repo] = pr.repo.split('/');
        try {
          const { data } = await octokit.pulls.listReviews({
            owner, repo, pull_number: pr.number, per_page: 100,
          });
          // Take the latest review per reviewer
          const latest = new Map<string, string>();
          for (const r of data) {
            if (r.state === 'COMMENTED') continue; // comments don\'t count
            if (r.user?.login) latest.set(r.user.login, r.state);
          }
          const states = Array.from(latest.values());
          if (states.some((s) => s === 'CHANGES_REQUESTED')) {
            result.set(pr.id, 'changes_requested');
          } else if (states.some((s) => s === 'APPROVED')) {
            result.set(pr.id, 'approved');
          } else {
            result.set(pr.id, 'none');
          }
        } catch {
          result.set(pr.id, 'none');
        }
      })
    );
  }
  return result;
}

// Fetch the GitHub-computed mergeable status for each open non-draft PR.
// Batch result for open PRs: mergeable status + size totals in one set of pulls.get calls.
export interface PRBatchDetails {
  conflicts: Map<number, boolean>;
  sizeTotals: Map<number, number>; // additions + deletions per PR id
}

// Fetch per-PR details (mergeable status + size) for open non-draft PRs in one batch.
// Uses pulls.get — returns both sets of data with no extra API calls vs doing them separately.
export async function fetchPRBatchDetails(
  pat: string,
  prs: PullRequest[],
  signal?: AbortSignal
): Promise<PRBatchDetails> {
  const octokit = getOctokit(pat);
  const conflicts = new Map<number, boolean>();
  const sizeTotals = new Map<number, number>();
  const openPRs = prs.filter((p) => p.state === 'open' && !p.draft).slice(0, 100);
  const BATCH = 8;
  for (let i = 0; i < openPRs.length; i += BATCH) {
    if (signal?.aborted) break;
    await Promise.all(
      openPRs.slice(i, i + BATCH).map(async (pr) => {
        const [owner, repo] = pr.repo.split('/');
        try {
          const { data } = await octokit.pulls.get({ owner, repo, pull_number: pr.number });
          if (data.mergeable === false) conflicts.set(pr.id, true);
          sizeTotals.set(pr.id, (data.additions ?? 0) + (data.deletions ?? 0));
        } catch {
          // Leave out of maps — no badge / no size shown
        }
      })
    );
  }
  return { conflicts, sizeTotals };
}

/** @deprecated Use fetchPRBatchDetails instead */
export async function fetchMergeableStatuses(
  pat: string,
  prs: PullRequest[],
  signal?: AbortSignal
): Promise<Map<number, boolean>> {
  const { conflicts } = await fetchPRBatchDetails(pat, prs, signal);
  return conflicts;
}

export interface RateLimitBucket {
  limit: number;
  used: number;
  remaining: number;
  reset: Date;
}

export interface RateLimitData {
  core: RateLimitBucket;
  search: RateLimitBucket;
  graphql: RateLimitBucket;
  codeSearch?: RateLimitBucket;
  login: string;
  scopes: string[];
}

export async function fetchRateLimit(pat: string): Promise<RateLimitData> {
  const octokit = getOctokit(pat);

  // Fetch rate limits + user login + scopes in parallel
  const [rateLimitResp, userResp] = await Promise.all([
    octokit.rateLimit.get(),
    octokit.users.getAuthenticated(),
  ]);

  const toBucket = (r: { limit: number; used: number; remaining: number; reset: number }): RateLimitBucket => ({
    limit: r.limit,
    used: r.used,
    remaining: r.remaining,
    reset: new Date(r.reset * 1000),
  });

  const resources = rateLimitResp.data.resources;
  const scopes = ((userResp.headers as Record<string, string>)['x-oauth-scopes'] ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  return {
    core: toBucket(resources.core),
    search: toBucket(resources.search),
    graphql: toBucket(resources.graphql!),
    codeSearch: resources.code_search ? toBucket(resources.code_search as any) : undefined,
    login: userResp.data.login,
    scopes,
  };
}

// Master fetch function: fetch all PRs + reviews for all configured repo filters
export async function fetchAllData(
  pat: string,
  repoFilters: RepoFilterEntry[],
  since: Date,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<{ prs: PullRequest[]; reviews: PRReview[] }> {
  const octokit = getOctokit(pat);
  const allPRs: PullRequest[] = [];
  const allReviews: PRReview[] = [];

  const repoList = await buildRepoList(octokit, repoFilters, onProgress);
  for (const { owner, repo } of repoList) {
    if (signal?.aborted) break;
    onProgress?.(`Fetching PRs for ${owner}/${repo}...`);
    const prs = await fetchPRsForRepo(octokit, owner, repo, since, signal);
    allPRs.push(...prs);
  }

  // Enrich PRs with size data (additions/deletions not in list response)
  if (allPRs.length > 0) {
    onProgress?.(`Fetching PR size details for ${Math.min(allPRs.length, 300)} PRs...`);
    await enrichPRsWithSizeData(octokit, allPRs, signal, onProgress);
  }

  // Fetch reviews for a subset (to avoid rate limiting, fetch reviews for recently updated PRs)
  const prsForReviews = allPRs.slice(0, 500); // limit to avoid rate limit
  let reviewsFetched = 0;
  for (const pr of prsForReviews) {
    if (signal?.aborted) break;
    const [owner, repo] = pr.repo.split('/');
    const reviews = await fetchPRReviews(octokit, owner, repo, pr.number);
    allReviews.push(...reviews);
    reviewsFetched++;
    if (reviewsFetched % 20 === 0) {
      onProgress?.(`Fetched reviews for ${reviewsFetched}/${prsForReviews.length} PRs...`);
    }
  }

  return { prs: allPRs, reviews: allReviews };
}

// Fetch the description body and size stats of a single PR (lazy — only called when the detail panel opens)
export interface PRDetails {
  body: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  comments: number;
  review_comments: number;
}

export async function fetchPRDetails(pat: string, repo: string, prNumber: number): Promise<PRDetails> {
  const [owner, repoName] = repo.split('/');
  const octokit = getOctokit(pat);
  try {
    const { data } = await octokit.pulls.get({ owner, repo: repoName, pull_number: prNumber });
    return {
      body: data.body ?? null,
      additions: data.additions,
      deletions: data.deletions,
      changed_files: data.changed_files,
      commits: data.commits,
      comments: data.comments,
      review_comments: data.review_comments,
    };
  } catch {
    return { body: null, additions: 0, deletions: 0, changed_files: 0, commits: 0, comments: 0, review_comments: 0 };
  }
}
