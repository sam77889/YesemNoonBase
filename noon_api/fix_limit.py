with open('/home/san/noon_base/noon_api/app/api/products.py', 'r') as f:
    content = f.read()

content = content.replace("le=1000", "le=50000")

with open('/home/san/noon_base/noon_api/app/api/products.py', 'w') as f:
    f.write(content)
