#!/usr/bin/env python3
"""
Migration script for MasterProducts.jsx
Updates imports and removes DashboardLayout wrapper
"""

import re

# Read the old file
with open('../salon-management-system-2/src/pages/01_SystemAdmin/MasterProducts.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replacements
replacements = [
    # Update imports
    (r"import DashboardLayout from '../shared/DashboardLayout';", ""),
    (r"import \{ Card \} from '../ui/card';", "import { Card } from '../../components/ui/Card';"),
    (r"import \{ Button \} from '../ui/button';", "import Button from '../../components/ui/Button';"),
    (r"import \{ productService \} from '../../services/productService';", "import { productService } from '../../services/productService';"),
    (r"import \{ cloudinaryService \} from '../../services/cloudinaryService';", "import { cloudinaryService } from '../../services/cloudinaryService';"),
    (r"import \{ db \} from '../../lib/firebase';", "import { db } from '../../config/firebase';"),
    
    # Remove menuItems constant
    (r"  // System Admin menu items \(consistent across all pages\)\s+const menuItems = \[.*?  \];", "", re.DOTALL),
    
    # Remove DashboardLayout wrapper from loading state
    (r"return \(\s+<DashboardLayout>\s+<div className=\"flex items-center justify-center h-64\">", "return (\n      <div className=\"flex items-center justify-center h-64\">"),
    (r"</div>\s+</DashboardLayout>\s+\);", "</div>\n    );"),
    
    # Remove DashboardLayout wrapper from main return
    (r"return \(\s+<DashboardLayout menuItems=\{menuItems\} pageTitle=\"Master Products\">\s+<div className=\"max-w-7xl mx-auto space-y-6\">", "return (\n    <div className=\"max-w-7xl mx-auto space-y-6\">"),
    (r"</div>\s+</DashboardLayout>\s+\);", "</div>\n  );"),
]

# Apply replacements
for pattern, replacement, *flags in replacements:
    flags = flags[0] if flags else 0
    content = re.sub(pattern, replacement, content, flags=flags)

# Write the migrated file
with open('src/pages/system-admin/MasterProducts.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ MasterProducts.jsx migrated successfully!")

