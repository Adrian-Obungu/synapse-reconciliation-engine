interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 6 }: SkeletonTableProps) {
  const rowArray = Array.from({ length: rows });
  const colArray = Array.from({ length: cols });

  // Pre-generate some random-looking widths for the skeleton bars
  const widths = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-full', 'w-4/5'];

  return (
    <div className="bg-surface rounded-xl border border-slate-700/50 overflow-hidden w-full">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-700/50 bg-slate-800/30">
            {colArray.map((_, i) => (
              <th key={i} className="px-6 py-4">
                <div className="h-3 w-16 bg-slate-700/50 rounded-full shimmer" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {rowArray.map((_, rIdx) => (
            <tr key={rIdx}>
              {colArray.map((_, cIdx) => (
                <td key={cIdx} className="px-6 py-4">
                  <div
                    className={`h-3 bg-slate-700/40 rounded-full shimmer ${
                      widths[(rIdx + cIdx) % widths.length]
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
