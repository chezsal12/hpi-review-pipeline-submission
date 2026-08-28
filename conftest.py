"""
Shared pytest configuration for the review pipeline test suite.

Sets a default AWS region and dummy credentials so that boto3 clients can
be constructed at import time without real AWS configuration. Tests mock
all AWS calls, so no network access or real credentials are used.

Also provides load_handler_module(), a shared helper for loading a Lambda
function's handler.py under a unique module name, so each stage's test
file does not duplicate the importlib boilerplate.
"""
import importlib.util
import os

os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")


def load_handler_module(module_name, dir_path):
    """
    Load the handler.py in dir_path under a unique module name.

    Parameterised so each Lambda stage's test file can load its own handler
    without duplicating the importlib boilerplate.
    """
    spec = importlib.util.spec_from_file_location(
        module_name, os.path.join(dir_path, "handler.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
