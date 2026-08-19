#!/bin/bash
# Package Lambda functions with shared dependencies
set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LAMBDA_DIR="$PROJECT_ROOT/lambda"

echo "Packaging Lambda functions with shared dependencies..."

for func_dir in "$LAMBDA_DIR"/*/; do
    func_name=$(basename "$func_dir")

    # Skip the shared directory itself
    if [ "$func_name" = "shared" ]; then
        continue
    fi

    # Copy shared directory into each Lambda function directory
    if [ -d "$LAMBDA_DIR/shared" ]; then
        echo "  Copying shared/ to $func_name/"
        cp -r "$LAMBDA_DIR/shared" "$func_dir/"
    fi
done

echo "✅ Lambda packaging complete"
