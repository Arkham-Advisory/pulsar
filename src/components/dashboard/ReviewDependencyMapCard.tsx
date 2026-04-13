import { useState } from 'react';
import type { ReviewDependencyEdge } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { ArrowRight, Network } from 'lucide-react';

interface Props {
  dependencies: ReviewDependencyEdge[];
  loading?: boolean;
}

export function ReviewDependencyMapCard({ dependencies, loading }: Props) {
  const [hoveredAuthor, setHoveredAuthor] = useState<string | null>(null);
  const [hoveredReviewer, setHoveredReviewer] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const maxCount = Math.max(...dependencies.map((dependency) => dependency.count), 1);
  const authors = Array.from(new Set(dependencies.map((dependency) => dependency.author)));
  const reviewers = Array.from(new Set(dependencies.map((dependency) => dependency.reviewer)));
  const authorY = new Map(authors.map((author, index) => [author, 32 + index * 32]));
  const reviewerY = new Map(reviewers.map((reviewer, index) => [reviewer, 32 + index * 32]));
  const svgHeight = Math.max(authors.length, reviewers.length) * 32 + 28;
  const activeEdge =
    dependencies.find((dependency) => `${dependency.author}-${dependency.reviewer}` === hoveredEdge) ??
    dependencies.find((dependency) => dependency.author === hoveredAuthor || dependency.reviewer === hoveredReviewer) ??
    dependencies[0];

  return (
    <Card>
      <CardHeader
        title="Review Dependency Map"
        subtitle="Who is currently depending on whom for reviews"
        icon={<Network className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-14 skeleton rounded-xl" />
          ))}
        </div>
      ) : dependencies.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          No review dependencies detected
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <svg width="100%" height={svgHeight} viewBox={`0 0 640 ${svgHeight}`} className="min-w-[640px]">
              {dependencies.map((dependency) => {
                const startY = authorY.get(dependency.author) ?? 0;
                const endY = reviewerY.get(dependency.reviewer) ?? 0;
                const midX = 320;
                const strokeWidth = Math.max((dependency.count / maxCount) * 8, 2);
                const key = `${dependency.author}-${dependency.reviewer}`;
                const isActive =
                  (!hoveredAuthor && !hoveredReviewer && !hoveredEdge) ||
                  hoveredEdge === key ||
                  hoveredAuthor === dependency.author ||
                  hoveredReviewer === dependency.reviewer;
                return (
                  <path
                    key={key}
                    d={`M 190 ${startY} C ${midX - 50} ${startY}, ${midX + 50} ${endY}, 450 ${endY}`}
                    fill="none"
                    stroke={isActive ? 'rgba(99,102,241,0.72)' : 'rgba(99,102,241,0.12)'}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    onMouseEnter={() => setHoveredEdge(key)}
                    onMouseLeave={() => setHoveredEdge(null)}
                  />
                );
              })}

              {authors.map((author) => (
                <g
                  key={author}
                  transform={`translate(0 ${authorY.get(author) ?? 0})`}
                  onMouseEnter={() => setHoveredAuthor(author)}
                  onMouseLeave={() => setHoveredAuthor(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x="0" y="-14" width="190" height="28" rx="14" fill={hoveredAuthor === author ? 'rgba(224,231,255,0.95)' : 'rgba(255,255,255,0.92)'} className="dark:fill-slate-950" />
                  <text x="12" y="5" fontSize="12" fill="currentColor" className="text-slate-700 dark:text-slate-300">
                    {author}
                  </text>
                </g>
              ))}

              {reviewers.map((reviewer) => (
                <g
                  key={reviewer}
                  transform={`translate(450 ${reviewerY.get(reviewer) ?? 0})`}
                  onMouseEnter={() => setHoveredReviewer(reviewer)}
                  onMouseLeave={() => setHoveredReviewer(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x="0" y="-14" width="190" height="28" rx="14" fill={hoveredReviewer === reviewer ? 'rgba(224,231,255,0.95)' : 'rgba(255,255,255,0.92)'} className="dark:fill-slate-950" />
                  <text x="12" y="5" fontSize="12" fill="currentColor" className="text-slate-700 dark:text-slate-300">
                    {reviewer}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{activeEdge.author}</span> depends on{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{activeEdge.reviewer}</span> for{' '}
              {activeEdge.count} open review {activeEdge.count === 1 ? 'interaction' : 'interactions'}.
            </p>
            <p className="mt-1 text-xs text-slate-400">Hover an author, reviewer, or link to isolate that part of the network.</p>
          </div>

          {dependencies.map((dependency) => (
            <div
              key={`${dependency.author}-${dependency.reviewer}`}
              className="rounded-2xl border border-slate-100 p-3 dark:border-slate-800"
            >
              <div className="grid grid-cols-[minmax(0,1fr),auto,minmax(0,1fr)] items-center gap-3">
                <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                  <p className="truncate text-xs uppercase tracking-wide text-slate-400">Author</p>
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {dependency.author}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
                  <p className="truncate text-xs uppercase tracking-wide text-slate-400">Reviewer</p>
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                    {dependency.reviewer}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-brand-500"
                    style={{ width: `${Math.max((dependency.count / maxCount) * 100, 16)}%` }}
                  />
                </div>
                <span className="min-w-12 text-right text-xs font-semibold text-brand-600 dark:text-brand-400">
                  {dependency.count} PRs
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
