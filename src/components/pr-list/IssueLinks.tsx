import { useSettingsStore } from '../../store/settings';
import type { IssueTrackerConfig } from '../../types/settings';

// ─── Core extraction ─────────────────────────────────────────────────────────

interface IssueRef {
  match: string;
  url: string;
  index: number;
  length: number;
}

function findRefs(text: string, trackers: IssueTrackerConfig[], repo: string): IssueRef[] {
  const refs: IssueRef[] = [];

  for (const tracker of trackers) {
    if (tracker.type === 'github') {
      const regex = /#(\d+)/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        refs.push({ match: m[0], url: `https://github.com/${repo}/issues/${m[1]}`, index: m.index, length: m[0].length });
      }
    } else if (tracker.type === 'jira' && tracker.projectKey) {
      const escaped = tracker.projectKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escaped}-\\d+)\\b`, 'g');
      const base = tracker.baseUrl.replace(/\/$/, '');
      if (!base.startsWith('http://') && !base.startsWith('https://')) continue;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        refs.push({ match: m[0], url: `${base}/browse/${m[0]}`, index: m.index, length: m[0].length });
      }
    } else if (tracker.type === 'custom' && tracker.pattern && tracker.urlTemplate) {
      try {
        const regex = new RegExp(tracker.pattern, 'g');
        let m: RegExpExecArray | null;
        while ((m = regex.exec(text)) !== null) {
          const url = tracker.urlTemplate.replace('{{key}}', encodeURIComponent(m[0]));
          if (!url.startsWith('http://') && !url.startsWith('https://')) continue;
          refs.push({ match: m[0], url, index: m.index, length: m[0].length });
        }
      } catch { /* ignore invalid regex */ }
    }
  }

  // Sort by position, remove overlaps
  refs.sort((a, b) => a.index - b.index);
  const deduped: IssueRef[] = [];
  let lastEnd = 0;
  for (const ref of refs) {
    if (ref.index >= lastEnd) {
      deduped.push(ref);
      lastEnd = ref.index + ref.length;
    }
  }
  return deduped;
}

// ─── TitleWithIssueLinks ─────────────────────────────────────────────────────
// Renders a plain text string with issue references replaced by inline <a> tags.
// Safe to use anywhere that is NOT already inside an <a> element.

interface TitleProps {
  text: string;
  repo: string;
  className?: string;
}

export function TitleWithIssueLinks({ text, repo, className }: TitleProps) {
  const { issueTrackers } = useSettingsStore();
  const refs = findRefs(text, issueTrackers, repo);

  if (refs.length === 0) return <span className={className}>{text}</span>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  for (const ref of refs) {
    if (ref.index > cursor) nodes.push(text.slice(cursor, ref.index));
    nodes.push(
      <a
        key={`${ref.index}-${ref.match}`}
        href={ref.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-brand-600 dark:text-brand-400 hover:underline"
      >
        {ref.match}
      </a>
    );
    cursor = ref.index + ref.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return <span className={className}>{nodes}</span>;
}

// ─── IssueRefBadges ──────────────────────────────────────────────────────────
// Renders issue refs found in `text` as separate badge chips.
// Use this alongside (not inside) an <a> element to avoid nesting <a> in <a>.

interface BadgesProps {
  text: string;
  repo: string;
}

export function IssueRefBadges({ text, repo }: BadgesProps) {
  const { issueTrackers } = useSettingsStore();
  const refs = findRefs(text, issueTrackers, repo);
  if (refs.length === 0) return null;

  return (
    <>
      {refs.map((ref) => (
        <a
          key={`${ref.index}-${ref.match}`}
          href={ref.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 border border-brand-200 dark:border-brand-800 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
        >
          {ref.match}
        </a>
      ))}
    </>
  );
}
