import React from 'react';
import type { CompareTarget } from '../hooks/useWeather';

interface RowDef {
  key: string;
  label: string;
}

interface MonthsTableProps {
  rowsDef: RowDef[];
  targets: CompareTarget[];
  stats: Record<string, any>;
  getYearColor: (index: number, baseColor: string) => string;
  getLocationName: (id: string) => string;
}

export function MonthsTable({ rowsDef, targets, stats, getYearColor, getLocationName }: MonthsTableProps) {
  return (
    <div className="table-container">
      <table className="glass-table">
        <thead>
          <tr>
            <th>指標</th>
            <th>対象</th>
            {Array.from({ length: 12 }, (_, i) => <th key={i + 1}>{i + 1}月</th>)}
          </tr>
        </thead>
        <tbody>
          {rowsDef.map((rowDef) => (
            <React.Fragment key={rowDef.key}>
              {targets.map((target, idx) => (
                <tr key={`${rowDef.key}-${target.id}`}>
                  {idx === 0 && (
                    <td rowSpan={targets.length} style={{ fontWeight: 'bold', background: 'var(--grid-color)', verticalAlign: 'middle' }}>
                      {rowDef.label}
                    </td>
                  )}
                  <td style={{ color: getYearColor(idx, 'var(--text-primary)'), fontWeight: 500, textAlign: 'center', lineHeight: '1.4' }}>
                    {getLocationName(target.locationId)} <br/><span style={{fontSize: '0.85em', opacity: 0.8}}>{target.year}年</span>
                  </td>
                  {Array.from({ length: 12 }, (_, m) => {
                    const val = stats[target.id]?.[m + 1]?.[rowDef.key];
                    return (
                      <td key={m + 1} className="text-right">
                        {val != null && !isNaN(val) ? val.toFixed(1) : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
