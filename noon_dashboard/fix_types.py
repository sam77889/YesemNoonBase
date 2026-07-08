import re

# Fix DatabaseTable.tsx
with open('src/components/DatabaseTable.tsx', 'r') as f:
    content = f.read()

# Fix import
content = content.replace(
    """import {
  useReactTable,""",
    """import type { ColumnDef, SortingState } from '@tanstack/react-table';
import {
  useReactTable,"""
)
content = content.replace("  ColumnDef,\n  SortingState\n", "")

# Fix types
content = content.replace("brand?: string;", "brand?: string | null;")
content = content.replace("currency?: string;", "currency?: string | null;")
content = content.replace("image_url?: string;", "image_url?: string | null;")
content = content.replace("url?: string;", "url?: string | null;")
content = content.replace("category?: string;", "category?: string | null;")
content = content.replace("status?: string;", "status?: string | null;")
content = content.replace("created_at?: string;", "created_at?: string | null;")
content = content.replace("updated_at?: string;", "updated_at?: string | null;")

with open('src/components/DatabaseTable.tsx', 'w') as f:
    f.write(content)


# Fix App.tsx
with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
skip_handle_delete = False
for line in lines:
    if "const [sortConfig, setSortConfig] = useState" in line:
        new_lines.append("  const sortConfig = {key: 'review_count', direction: 'desc'};\n")
    elif "const handleBatchDelete = async () => {" in line:
        skip_handle_delete = True
    elif skip_handle_delete and "};" in line and len(line.strip()) == 2:
        skip_handle_delete = False
    elif not skip_handle_delete:
        new_lines.append(line)

with open('src/App.tsx', 'w') as f:
    f.writelines(new_lines)

