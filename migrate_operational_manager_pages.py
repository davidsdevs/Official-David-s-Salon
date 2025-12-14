#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import re
import os

def migrate_file(old_path, new_path, page_name):
    """Migrate a single file"""
    print(f"Migrating {page_name}...")
    
    with open(old_path, 'r', encoding='utf-8') as f:
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
        "import { SearchInput } from '../ui/search-input';",
        "import { SearchInput } from '../../components/ui/SearchInput';"
    )
    content = content.replace(
        "import Modal from '../ui/modal';",
        "import Modal from '../../components/ui/Modal';"
    )
    content = content.replace(
        "import { branchService } from '../../services/branchService';",
        "import { getBranchById, getBranches } from '../../services/branchService';"
    )
    content = content.replace(
        "import { db } from '../../lib/firebase';",
        "import { db } from '../../config/firebase';"
    )

    # Remove menuItems and DashboardLayout wrapper
    content = re.sub(
        r'const menuItems = \[[\s\S]*?\];',
        '',
        content
    )
    content = re.sub(
        r'<DashboardLayout menuItems=\{menuItems\} pageTitle="[^"]*">',
        '',
        content
    )
    content = re.sub(
        r'<DashboardLayout menuItems=\{.*?\} pageTitle="[^"]*">',
        '',
        content
    )
    content = content.replace('</DashboardLayout>', '')

    # Update branchService calls
    content = re.sub(
        r'branchService\.getBranch\(',
        'getBranchById(',
        content
    )
    content = re.sub(
        r'branchService\.getBranches\(',
        'getBranches(',
        content
    )

    # Fix indentation - remove one level of indentation from the main content
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

    # Ensure directory exists
    os.makedirs(os.path.dirname(new_path), exist_ok=True)

    # Write the new file
    with open(new_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✓ {page_name} migration completed!")

# Migrate Operational Manager pages
base_path = '../salon-management-system-2/src/pages/02_OperationalManager'
target_path = 'src/pages/operational-manager'

pages = [
    ('Inventory.jsx', 'Inventory.jsx', 'Operational Manager Inventory'),
    ('PurchaseOrders.jsx', 'PurchaseOrders.jsx', 'Operational Manager PurchaseOrders'),
    ('Deposits.jsx', 'Deposits.jsx', 'Operational Manager Deposits'),
]

for old_file, new_file, name in pages:
    old_path = os.path.join(base_path, old_file)
    new_path = os.path.join(target_path, new_file)
    migrate_file(old_path, new_path, name)

print("\nAll Operational Manager pages migration completed!")

