import sys

def modify_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()

    # 1. Add import
    import_line = "import { DatabaseTable } from './components/DatabaseTable';\n"
    if import_line not in lines:
        for i, line in enumerate(lines):
            if line.startswith("import { Activity"):
                lines.insert(i + 1, import_line)
                break

    # 2. Update limit
    for i, line in enumerate(lines):
        if "'/products/?limit=1000'" in line:
            lines[i] = line.replace("1000", "10000")

    # 3. Add handleBatchDeleteWithSkus
    for i, line in enumerate(lines):
        if "const handleBatchDelete = async () => {" in line:
            new_func = """
  const handleBatchDeleteWithSkus = async (skus: string[]) => {
    if (skus.length === 0) return;
    if (!confirm(`确定要将选中的 ${skus.length} 个商品移出监控池吗？(大盘将不再统计其数据)`)) return;
    
    try {
      await Promise.all(
        skus.map(sku => api.delete(`/products/${encodeURIComponent(sku)}`))
      );
      const skuSet = new Set(skus);
      setProducts(prev => prev.filter(p => !skuSet.has(p.sku)));
      setSelectedSkus(new Set());
    } catch (e) {
      console.error('Batch delete failed', e);
      alert('部分删除失败，请检查控制台。');
    }
  };

"""
            lines.insert(i, new_func)
            break

    # 4. Replace the table block
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if "{selectedSkus.size > 0 && (" in line and start_idx == -1:
            # Check if this is the database tab one
            if "移出监控 ({selectedSkus.size})" in "".join(lines[i:i+10]):
                start_idx = i
                break

    if start_idx != -1:
        for i in range(start_idx, len(lines)):
            if "</div>" in lines[i] and "</div>" in lines[i-1] and "</table>" in lines[i-2]:
                end_idx = i
                break
                
    if start_idx != -1 and end_idx != -1:
        replacement = [
            "              </div>\n",
            "              \n",
            "              <DatabaseTable \n",
            "                data={filteredProducts} \n",
            "                onRowClick={openPriceTrend} \n",
            "                onBatchDelete={handleBatchDeleteWithSkus} \n",
            "              />\n"
        ]
        lines = lines[:start_idx] + replacement + lines[end_idx+1:]

    with open(filepath, 'w') as f:
        f.writelines(lines)

modify_file('src/App.tsx')
