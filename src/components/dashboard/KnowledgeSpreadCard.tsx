import { useState } from 'react';
import type { RepoKnowledgeGraph } from '../../types/github';
import { Card, CardHeader } from '../ui/Card';
import { LibraryBig } from 'lucide-react';

interface Props {
  data: RepoKnowledgeGraph;
  loading?: boolean;
}

export function KnowledgeSpreadCard({ data, loading }: Props) {
  const [hoveredReviewer, setHoveredReviewer] = useState<string | null>(null);
  const [hoveredRepo, setHoveredRepo] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const maxEdge = Math.max(...data.edges.map((edge) => edge.count), 1);
  const reviewerY = new Map(data.reviewers.map((reviewer, index) => [reviewer.id, 32 + index * 34]));
  const repoY = new Map(data.repos.map((repo, index) => [repo.id, 32 + index * 34]));
  const svgHeight = Math.max(data.reviewers.length, data.repos.length) * 34 + 28;
  const activeEdge =
    data.edges.find((edge) => `${edge.reviewer}-${edge.repo}` === hoveredEdge) ??
    data.edges.find((edge) => edge.reviewer === hoveredReviewer || edge.repo === hoveredRepo) ??
    data.edges[0];

  return (
    <Card>
      <CardHeader
        title="Repo Knowledge Graph"
        subtitle="How reviewer knowledge is distributed across repositories"
        icon={<LibraryBig className="h-4 w-4" />}
      />
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="h-14 skeleton rounded-xl" />
          ))}
        </div>
      ) : data.edges.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
          No reviewer spread data available
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <svg width="100%" height={svgHeight} viewBox={`0 0 700 ${svgHeight}`} className="min-w-[700px]">
              {data.edges.map((edge) => {
                const startY = reviewerY.get(edge.reviewer) ?? 0;
                const endY = repoY.get(edge.repo) ?? 0;
                const strokeWidth = Math.max((edge.count / maxEdge) * 8, 2);
                const key = `${edge.reviewer}-${edge.repo}`;
                const isActive =
                  (!hoveredReviewer && !hoveredRepo && !hoveredEdge) ||
                  hoveredEdge === key ||
                  hoveredReviewer === edge.reviewer ||
                  hoveredRepo === edge.repo;
                return (
                  <path
                    key={key}
                    d={`M 220 ${startY} C 320 ${startY}, 380 ${endY}, 500 ${endY}`}
                    fill="none"
                    stroke={isActive ? 'rgba(16,185,129,0.72)' : 'rgba(16,185,129,0.12)'}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    onMouseEnter={() => setHoveredEdge(key)}
                    onMouseLeave={() => setHoveredEdge(null)}
                  />
                );
              })}

              {data.reviewers.map((reviewer) => (
                <g
                  key={reviewer.id}
                  transform={`translate(0 ${reviewerY.get(reviewer.id) ?? 0})`}
                  onMouseEnter={() => setHoveredReviewer(reviewer.id)}
                  onMouseLeave={() => setHoveredReviewer(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect x="0" y="-14" width="220" height="28" rx="14" fill={hoveredReviewer === reviewer.id ? 'rgba(220,252,231,0.95)' : 'rgba(255,255,255,0.92)'} className="dark:fill-slate-950" />
                  <text x="12" y="5" fontSize="12" fill="currentColor" className="text-slate-700 dark:text-slate-300">
                    {reviewer.label} · {reviewer.total}
                  </text>
                </g>
              ))}

              {data.repos.map((repo) => (
                <g
                  key={repo.id}
                  transform={`translate(500 ${repoY.get(repo.id) ?? 0})`}
                  onMouseEnter={() => setHoveredRepo(repo.id)}
                  onMouseLeave={() => setHoveredRepo(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <a href={repo.url} target="_blank" rel="noopener noreferrer">
                    <rect x="0" y="-14" width="200" height="28" rx="14" fill={hoveredRepo === repo.id ? 'rgba(220,252,231,0.95)' : 'rgba(255,255,255,0.92)'} className="dark:fill-slate-950" />
                    <text x="12" y="5" fontSize="12" fill="currentColor" className="text-slate-700 dark:text-slate-300">
                      {repo.label} · {repo.total}
                    </text>
                  </a>
                </g>
              ))}
            </svg>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{activeEdge.reviewer}</span> completed{' '}
              {activeEdge.count} reviews in{' '}
              <a href={data.repos.find((repo) => repo.id === activeEdge.repo)?.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-2 hover:underline text-slate-900 dark:text-slate-100">
                {activeEdge.repo}
              </a>.
            </p>
            <p className="mt-1 text-xs text-slate-400">Hover a reviewer, repository, or link to highlight the connection.</p>
          </div>
          <div className="space-y-2">
            {data.edges.map((edge) => (
              <div key={`${edge.reviewer}-${edge.repo}`} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">{edge.reviewer}</span>
                  <span className="text-slate-400">→</span>
                  <a href={data.repos.find((repo) => repo.id === edge.repo)?.url} target="_blank" rel="noopener noreferrer" className="font-medium text-slate-800 underline-offset-2 hover:text-brand-600 hover:underline dark:text-slate-200 dark:hover:text-brand-400">
                    {edge.repo}
                  </a>
                </div>
                <p className="mt-1 text-xs text-slate-400">{edge.count} review interactions</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">
            Thicker links mean a reviewer is carrying more review volume in that repository.
          </p>
        </div>
      )}
    </Card>
  );
}
