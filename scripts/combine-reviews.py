# Copyright 2026 Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Combine the French and German review datasets into a single
test-data/all-reviews.json file. Run from the scripts/ directory.
"""
from script_utils import read_json_file, write_json_file

FRENCH_PATH = '../test-data/reviews-french.json'
GERMAN_PATH = '../test-data/reviews-german.json'
COMBINED_PATH = '../test-data/all-reviews.json'


def main():
    french = read_json_file(FRENCH_PATH, required=True)
    german = read_json_file(GERMAN_PATH, required=True)

    combined = french + german
    write_json_file(COMBINED_PATH, combined)

    print(f"Combined: {len(combined)} reviews")
    print(f"   French: {len(french)}")
    print(f"   German: {len(german)}")


if __name__ == '__main__':
    main()
