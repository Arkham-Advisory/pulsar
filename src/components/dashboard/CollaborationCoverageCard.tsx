import type { CollaborationCoverage } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { UsersRound } from 'lucide-react';

interface Props {
  coverage: CollaborationCoverage;
  loading?: boolean;
}

export function CollaborationCoverageCard({ coverage, loading }: Props) {
  return (
    <Card>
      <CardHeader
        title="Collaboration Coverage"
        subtitle="Signals for reciprocity and review participation"
        icon={<UsersRound className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, index) => (
            <div key={index} className="h-12 skeleton rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="text-xs text-slate-400">Authors active</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{coverage.authorParticipants}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
              <p className="text-xs text-slate-400">Reviewers active</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{coverage.reviewParticipants}</p>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Low reciprocity authors</p>
            <div className="space-y-2">
              {coverage.lowReciprocityAuthors.length === 0 ? (
                <p className="text-sm text-slate-400">No reciprocity concerns in this window.</p>
              ) : (
                coverage.lowReciprocityAuthors.map((author) => (
                  <div key={author.login} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-slate-800">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{author.login}</span>
                    <span className="text-xs text-slate-400">{author.reviewsGiven} reviews for {author.prsOpened} PRs</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
