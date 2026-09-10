#!/bin/bash
# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

# Run tests - idempotent, always works

set -e  # Exit on error

echo "🔧 Setting up test environment..."

# Create venv if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate venv
source .venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q boto3 pytest

# Run tests
echo ""
echo "🧪 Running tests..."
pytest -v

echo ""
echo "✅ All tests passed!"
