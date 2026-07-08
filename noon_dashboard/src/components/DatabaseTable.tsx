import React, { useState, useMemo } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export interface Product {
  sku: string;
  title: string;
  brand?: string | null;
  price?: number | null;
  original_price?: number | null;
  currency?: string | null;
  image_url?: string | null;
  url?: string | null;
  is_express?: boolean;
  category?: string | null;
  review_count?: number | null;
  rating?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface DatabaseTableProps {
  data: Product[];
  onRowClick: (sku: string) => void;
  onBatchDelete: (skus: string[]) => void;
}

export const DatabaseTable: React.FC<DatabaseTableProps> = ({ data, onRowClick, onBatchDelete }) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'review_count', desc: true }
  ]);
  const [rowSelection, setRowSelection] = useState({});

  const columns = useMemo<ColumnDef<Product>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
          checked={table.getIsAllPageRowsSelected()}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        </div>
      ),
      enableSorting: false,
      size: 50,
    },
    {
      accessorKey: 'title',
      header: '商品信息',
      size: 400,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-4">
            {p.image_url ? (
              <img src={p.image_url} alt="" style={{ width: '56px', height: '56px', objectFit: 'contain', background: 'white', borderRadius: '8px' }} />
            ) : (
              <div style={{ width: '56px', height: '56px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }} />
            )}
            <div>
              <div style={{ fontWeight: 500, maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.is_express && <span style={{ padding: '0.15rem 0.3rem', background: '#fbbf24', color: '#000', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, marginRight: '0.5rem', verticalAlign: 'middle' }}>EXPRESS</span>}
                {p.title}
              </div>
              <div className="flex items-center gap-3" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                <span>SKU: {p.sku}</span>
                {p.brand && p.brand !== 'UNKNOWN' && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>{p.brand}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      }
    },
    {
      accessorKey: 'price',
      header: ({ column }) => {
        return (
          <div 
            className="flex items-center gap-1"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={column.getToggleSortingHandler()}
          >
            最新价格
            {{
              asc: <ArrowUp size={14} />,
              desc: <ArrowDown size={14} />,
            }[column.getIsSorted() as string] ?? <ArrowUpDown size={14} opacity={0.3} />}
          </div>
        )
      },
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>
            {p.price ? (
              <>
                <span>{p.price} {p.currency || 'AED'}</span>
                {p.original_price && p.original_price > p.price && (
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem', fontWeight: 400 }}>
                    {p.original_price}
                  </span>
                )}
              </>
            ) : '-'}
          </div>
        );
      }
    },
    {
      accessorKey: 'review_count',
      header: ({ column }) => {
        return (
          <div 
            className="flex items-center gap-1"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={column.getToggleSortingHandler()}
          >
            累计评论 (销量)
            {{
              asc: <ArrowUp size={14} />,
              desc: <ArrowDown size={14} />,
            }[column.getIsSorted() as string] ?? <ArrowUpDown size={14} opacity={0.3} />}
          </div>
        )
      },
      cell: ({ getValue }) => {
        const val = getValue<number | null>();
        return (
          <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1.1rem' }}>
            {val != null ? val.toLocaleString() : '0'}
          </div>
        );
      }
    },
    {
      accessorKey: 'rating',
      header: ({ column }) => {
        return (
          <div 
            className="flex items-center gap-1"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={column.getToggleSortingHandler()}
          >
            评分
            {{
              asc: <ArrowUp size={14} />,
              desc: <ArrowDown size={14} />,
            }[column.getIsSorted() as string] ?? <ArrowUpDown size={14} opacity={0.3} />}
          </div>
        )
      },
      cell: ({ getValue }) => {
        const val = getValue<number | null>();
        return (
          <div style={{ color: '#fbbf24', fontWeight: 600 }}>
            {val ? `${val} ⭐` : '-'}
          </div>
        );
      }
    },
    {
      accessorKey: 'updated_at',
      header: ({ column }) => {
        return (
          <div 
            className="flex items-center gap-1"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={column.getToggleSortingHandler()}
          >
            更新时间
            {{
              asc: <ArrowUp size={14} />,
              desc: <ArrowDown size={14} />,
            }[column.getIsSorted() as string] ?? <ArrowUpDown size={14} opacity={0.3} />}
          </div>
        )
      },
      cell: ({ getValue }) => {
        const val = getValue<string>();
        if (!val) return '-';
        const dateStr = val.endsWith('Z') ? val : val + 'Z';
        const date = new Date(dateStr);
        const yyyy = date.getFullYear();
        const MM = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const HH = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');
        return <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{`${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`}</div>;
      }
    }
  ], []);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleDelete = () => {
    const selectedRows = table.getSelectedRowModel().flatRows;
    const skus = selectedRows.map(row => row.original.sku);
    if (skus.length > 0) {
      onBatchDelete(skus);
      setRowSelection({});
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      
      {/* Table Action Bar (Batch delete etc) */}
      {Object.keys(rowSelection).length > 0 && (
        <div style={{ 
          padding: '1rem', 
          background: 'rgba(139, 92, 246, 0.15)', 
          borderBottom: '1px solid var(--panel-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontWeight: 500, color: '#a78bfa' }}>已选择 {Object.keys(rowSelection).length} 项</span>
          <button 
            className="flex items-center gap-2"
            onClick={handleDelete}
            style={{ 
              background: 'rgba(239, 68, 68, 0.2)', 
              color: '#ef4444', 
              border: '1px solid rgba(239, 68, 68, 0.5)', 
              padding: '0.5rem 1rem', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
          >
            <Trash2 size={16} />
            批量移出监控
          </button>
        </div>
      )}

      {/* Table Wrapper */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: 'rgba(25, 28, 41, 0.9)', backdropFilter: 'blur(12px)' }}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th key={header.id} style={{ padding: '1rem', borderBottom: '1px solid var(--panel-border)', color: 'var(--text-muted)', fontWeight: 600, width: header.getSize() === 150 ? 'auto' : header.getSize() }}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map(row => (
                <tr 
                  key={row.id} 
                  onClick={() => onRowClick(row.original.sku)}
                  style={{ 
                    cursor: 'pointer', 
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: row.getIsSelected() ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (!row.getIsSelected()) e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  }}
                  onMouseOut={(e) => {
                    if (!row.getIsSelected()) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={{ padding: '1rem' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  没有找到匹配的商品
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ 
        padding: '1rem', 
        borderTop: '1px solid var(--panel-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 17, 26, 0.5)'
      }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          共 {table.getFilteredRowModel().rows.length} 条数据
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={table.getState().pagination.pageSize}
            onChange={e => {
              table.setPageSize(Number(e.target.value))
            }}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--panel-border)',
              color: 'white',
              padding: '0.4rem',
              borderRadius: '6px',
              marginRight: '1rem'
            }}
          >
            {[10, 20, 50, 100, 500].map(pageSize => (
              <option key={pageSize} value={pageSize} style={{ background: '#191c29' }}>
                {pageSize} 条/页
              </option>
            ))}
          </select>

          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', cursor: table.getCanPreviousPage() ? 'pointer' : 'not-allowed', opacity: table.getCanPreviousPage() ? 1 : 0.5 }}
          >
            <ChevronsLeft size={16} />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', cursor: table.getCanPreviousPage() ? 'pointer' : 'not-allowed', opacity: table.getCanPreviousPage() ? 1 : 0.5 }}
          >
            <ChevronLeft size={16} />
          </button>
          
          <span style={{ fontSize: '0.85rem', margin: '0 0.5rem' }}>
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
          </span>

          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', cursor: table.getCanNextPage() ? 'pointer' : 'not-allowed', opacity: table.getCanNextPage() ? 1 : 0.5 }}
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            style={{ padding: '0.4rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', cursor: table.getCanNextPage() ? 'pointer' : 'not-allowed', opacity: table.getCanNextPage() ? 1 : 0.5 }}
          >
            <ChevronsRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
