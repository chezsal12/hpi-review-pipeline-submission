#!/usr/bin/env python3
"""
Add Apache 2.0 license headers to all source files.
"""
import os
from pathlib import Path

# License header templates
PYTHON_HEADER = """# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""

JS_TS_HEADER = """/*
 * Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

"""

SHELL_HEADER = """# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""

def has_license_header(content):
    """Check if file already has a license header."""
    return 'Apache-2.0' in content or 'Copyright' in content[:500]

def add_header_to_file(filepath, header):
    """Add license header to a file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if has_license_header(content):
        print(f"  ✓ Already has header: {filepath}")
        return False

    # Preserve shebang if present
    if content.startswith('#!'):
        lines = content.split('\n', 1)
        new_content = lines[0] + '\n' + header + (lines[1] if len(lines) > 1 else '')
    else:
        new_content = header + content

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"  ✅ Added header: {filepath}")
    return True

def main():
    repo_root = Path(__file__).parent.parent
    files_updated = 0

    # Python files
    print("\n📝 Processing Python files...")
    for pattern in ['**/*.py']:
        for filepath in repo_root.glob(pattern):
            # Skip __pycache__, .venv, node_modules
            if any(p in str(filepath) for p in ['__pycache__', '.venv', 'node_modules', 'cdk.out']):
                continue
            if add_header_to_file(filepath, PYTHON_HEADER):
                files_updated += 1

    # TypeScript/JavaScript files
    print("\n📝 Processing TypeScript/JavaScript files...")
    for pattern in ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx']:
        for filepath in repo_root.glob(pattern):
            if any(p in str(filepath) for p in ['node_modules', 'cdk.out', '.venv']):
                continue
            if add_header_to_file(filepath, JS_TS_HEADER):
                files_updated += 1

    # Shell scripts
    print("\n📝 Processing shell scripts...")
    for pattern in ['**/*.sh']:
        for filepath in repo_root.glob(pattern):
            if any(p in str(filepath) for p in ['.venv', 'node_modules']):
                continue
            if add_header_to_file(filepath, SHELL_HEADER):
                files_updated += 1

    print(f"\n✅ Done! Updated {files_updated} files with license headers.")

if __name__ == '__main__':
    main()
