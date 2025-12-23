export default function DataTable({ columns, rows, rowKey = 'id', onRowClick }) {
  return (
    <div style={{ overflow: 'auto', border: '1px solid #e7e7e7', borderRadius: 12, background: '#fff' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: 'left', padding: '12px 12px', borderBottom: '1px solid #eee', fontSize: 12, color: '#666' }}>
                {c.title}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((r) => (
            <tr
              key={r[rowKey]}
              onClick={() => onRowClick?.(r)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ padding: '12px 12px', borderBottom: '1px solid #f1f1f1', fontSize: 14 }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}

          {!rows.length && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 16, color: '#666' }}>
                Нет данных
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
