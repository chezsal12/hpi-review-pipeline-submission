"""
Shared pytest configuration for the review pipeline test suite.

Sets a default AWS region and dummy credentials so that boto3 clients can
be constructed at import time without real AWS configuration. Tests mock
all AWS calls, so no network access or real credentials are used.
"""
import os

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
