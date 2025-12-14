#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re

# Read the old file
with open('../salon-management-system-2/src/pages/04_BranchManager/Deposits.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace imports
content = content.replace(
    "import DashboardLayout from '../shared/DashboardLayout';",
    ""
)
content = content.replace(
    "import { Card } from '../ui/card';",
    "import { Card } from '../../components/ui/Card';"
)
content = content.replace(
    "import { Button } from '../ui/button';",
    "import Button from '../../components/ui/Button';"
)
content = content.replace(
    "import { Input } from '../ui/input';",
    "import { Input } from '../../components/ui/Input';"
)
content = content.replace(
    "import { branchManagerMenuItems } from './menuItems';",
    ""
)

# Remove DashboardLayout wrapper
content = re.sub(
    r'<DashboardLayout menuItems=\{branchManagerMenuItems\} pageTitle="Bank Deposits">',
    '',
    content
)
content = content.replace('</DashboardLayout>', '')

# Fix indentation - remove one level of indentation from the main content
# This is a simple approach - we'll need to adjust manually if needed
lines = content.split('\n')
in_main_content = False
fixed_lines = []
for line in lines:
    # Detect when we're in the main return statement
    if 'return (' in line or 'return(' in line:
        in_main_content = True
    # Remove one level of indentation (2 spaces) from main content
    if in_main_content and line.strip() and not line.strip().startswith('//'):
        if line.startswith('      '):  # 6 spaces (3 levels)
            line = line[2:]  # Remove 2 spaces (1 level)
    fixed_lines.append(line)

content = '\n'.join(fixed_lines)

# Write the new file
with open('src/pages/branch-manager/Deposits.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Migration completed!")

