with open('src/components/DatabaseTable.tsx', 'r') as f:
    content = f.read()

content = content.replace("price: number | null;", "price?: number | null;")
content = content.replace("original_price?: number | null;", "original_price?: number | null;")
content = content.replace("review_count?: number | null;", "review_count?: number | null;")
content = content.replace("rating?: number | null;", "rating?: number | null;")

with open('src/components/DatabaseTable.tsx', 'w') as f:
    f.write(content)

with open('src/App.tsx', 'r') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set());" in line:
        continue
    if "setSelectedSkus(new Set());" in line:
        continue
    new_lines.append(line)

with open('src/App.tsx', 'w') as f:
    f.writelines(new_lines)

