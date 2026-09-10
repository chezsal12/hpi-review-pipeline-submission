# ProtoShield Security Analysis Report

**Analysis Timestamp:** 2026-09-08 23:59:45 UTC<br>
**Project:** hpi-review-pipeline<br>
**Scan ID:** 1788911657266687000<br>
**ProtoShield Version:** v0.15.0-rc16

# Security Analysis Report - Executive Summary

## Overview

The hpi-review-pipeline project is a Python-based AWS infrastructure implementation that orchestrates document processing workflows using Lambda functions and Step Functions. This comprehensive security scan analyzed the codebase for vulnerabilities, misconfigurations, secrets, dependency issues, and IAM policy compliance across eight security analysis tools.

## Key Findings

### Critical Issues: 0
### High Severity Issues: 0
### Medium Severity Issues: 0
### Low Severity Issues: 36

## Summary by Tool


| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| [License Headers](#license-headers) | 0 | 0 | 0 | 0 | 0 | 0 |
| [Semgrep](#semgrep) | 0 | 0 | 0 | 0 | 0 | 0 |
| [Bandit](#bandit) | 0 | 0 | 0 | 36 | 0 | 0 |
| [CDK NAG](#cdk-nag) | 0 | 0 | 0 | 0 | 0 | 0 |
| [CVE Scan](#cve-scan) | 0 | 0 | 0 | 0 | 0 | 0 |
| [Checkov](#checkov) | 0 | 0 | 0 | 0 | 0 | 0 |
| [Secrets](#secrets) | 0 | 0 | 0 | 0 | 0 | 0 |
| [IAM Least Privilege](#iam-least-privilege) | 0 | 0 | 0 | 0 | 0 | 0 |
## Recommendations by Priority

### Immediate Actions (Critical/High)

No critical or high-severity issues were identified. The project demonstrates strong security practices across all analysis dimensions.

### Short-term Actions (Medium)

No medium-severity issues were identified.

### Long-term Improvements (Low)

The 36 low-severity findings from Bandit are all related to the use of `assert` statements in test files (`test_local.py`). These are informational in nature and represent standard Python testing practices. No remediation is required unless stricter code standards are enforced. If desired, these can be suppressed using `# nosec` comments or Bandit configuration files.

## Positive Findings

The following scanners found zero issues, indicating strong security posture in their respective domains:

- **License Headers**: 100% compliance with Apache 2.0 licensing requirements across all 35 source files
- **Semgrep**: No security vulnerabilities or code quality issues detected
- **CDK NAG**: All AWS CDK infrastructure code passed security and compliance checks
- **CVE Scan**: No vulnerable dependencies identified across 2 dependency manifests
- **Checkov**: All infrastructure-as-code configurations passed security checks
- **Secrets**: No hardcoded secrets, API keys, or credentials detected
- **IAM Least Privilege**: All IAM policies follow least-privilege principles with appropriate scoping and compensating controls

## Conclusion

The hpi-review-pipeline project demonstrates excellent security practices with zero critical or high-severity findings. The codebase is free of vulnerabilities, secrets, misconfigurations, and dependency issues. The 36 low-severity findings are limited to assert statements in test files, which are appropriate for unit testing and do not represent security risks. The project is well-positioned from a security perspective and maintains strong compliance with licensing and infrastructure security standards.

---
---


## License Headers

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| license_headers | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Compliance Summary

**Excellent compliance achieved:** All source files in the project carry the required Apache 2.0 license header.

- **Files Scanned:** 35
- **Files with Header:** 35
- **Files Missing Header:** 0
- **Compliance Rate:** 100%
- **Project LICENSE File:** Present ✓

### Findings

No compliance issues detected. All 35 source files have been verified to contain the required Apache 2.0 license header in the correct format for their file type.

### Recommendations

1. **Maintain Compliance:** Continue to include the Apache 2.0 license header in all new source files added to the project
2. **Header Format:** Ensure correct comment syntax is used:
   - `/* */` for C/Go/Java files
   - `#` for Python/Shell scripts
   - `//` for JavaScript/TypeScript files
3. **Copyright Year:** Keep copyright years current in headers rather than copying older years from existing files
4. **Verification:** Periodically re-run license header compliance checks as part of your CI/CD pipeline to maintain this excellent compliance rate

### Conclusion

The project demonstrates full compliance with Apache 2.0 licensing requirements. All source files properly declare their license status, and the project-level LICENSE file is present. No action is required at this time.

</details>

---


## Semgrep

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| semgrep | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Scan Summary

The Semgrep security analysis completed successfully with **no findings** detected.

**Scan Results:**
- Total Issues: 0
- Critical: 0
- High: 0
- Medium: 0
- Low: 0
- Info: 0
- Suppressed: 0
- Scan Errors: 0

### Analysis

The codebase passed all Semgrep security checks. No security vulnerabilities, code quality issues, or policy violations were identified during this scan.

### Recommendations

- Continue maintaining current security practices
- Keep Semgrep rules and patterns updated regularly
- Consider running scans as part of your CI/CD pipeline to catch issues early
- Review and update Semgrep configuration periodically to ensure coverage of new threat patterns

</details>

### Suppression Analysis

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| semgrep_suppressions | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Finding Summary

After a comprehensive search of the project at `/project`, **NO Semgrep-specific suppressions were found** in the codebase.

### Search Methodology

The following deterministic searches were performed:

1. **Semgrep Suppression Markers:**
   - Pattern: `nosemgrep` — No matches
   - Pattern: `# nosemgrep:` — No matches
   - Pattern: `semgrep-disable` — No matches

2. **Semgrep Configuration Files:**
   - `.semgrep.yml` — Not found
   - `.semgrep.yaml` — Not found
   - `semgrep.yml` — Not found

3. **General Semgrep References:**
   - Pattern: `semgrep` — No matches in source code

### Non-Semgrep Suppressions Found

The project contains 5 instances of **flake8 suppressions** (`# noqa: E402`), which are outside the scope of Semgrep analysis:

- `lambda/localize/localize_service.py:21` — Suppresses E402 for import after sys.path manipulation
- `lambda/quality-gate/quality_gate_service.py:24` — Suppresses E402 for import after sys.path manipulation
- `lambda/summarize/summarize_service.py:23` — Suppresses E402 for import after sys.path manipulation
- `lambda/translate/translate_service.py:21` — Suppresses E402 for import after sys.path manipulation
- `scripts/script_utils.py:25` — Suppresses E402 for import after sys.path manipulation

These are legitimate flake8 suppressions used to allow dynamic sys.path manipulation for Lambda packaging patterns and are not Semgrep suppressions.

### Conclusion

This project does not use Semgrep suppressions. No Semgrep-specific suppression directives or configuration files were detected. All suppressions in the codebase are flake8-specific and fall outside the scope of Semgrep suppression analysis.

</details>

---


## Bandit

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| bandit | 0 | 0 | 0 | 36 | 0 | 0 |

<details>
<summary>View Details</summary>

### Low Severity Issues

**Issue: Use of assert detected (B101)**

All 36 findings are related to the use of `assert` statements in test files. The Bandit B101 rule flags assert usage because assert statements are removed when Python code is compiled to optimized bytecode (with the `-O` flag), which could cause validation logic to be silently skipped in production environments.

**Affected Files/Locations:**

- `lambda/localize/test_local.py` (7 assertions)
  - Lines: 52, 53, 62, 63, 64, 67, 69

- `lambda/quality-gate/test_local.py` (9 assertions)
  - Lines: 47, 48, 49, 50, 51, 63, 64, 72, 73, 101, 114

- `lambda/summarize/test_local.py` (9 assertions)
  - Lines: 51, 53, 54, 58, 62, 95, 96, 104, 105, 109

- `lambda/translate/test_local.py` (11 assertions)
  - Lines: 50, 51, 60, 61, 62, 66, 105, 106

### Context and Assessment

All flagged assertions are located in test files (files named `test_local.py`), which is an appropriate and standard use case for assert statements. These assertions are used for unit testing and validation during development, not for production code logic. The B101 warning is primarily relevant for production code where assert statements should not be relied upon for critical validation.

### Recommendations

1. **No immediate action required** - The use of assert statements in test files is acceptable and follows Python testing best practices. These are not security vulnerabilities but rather informational findings about code patterns.

2. **If stricter compliance is needed** - Consider suppressing these warnings in test files by:
   - Adding `# nosec` comments to individual assert statements
   - Configuring Bandit to exclude test files from B101 checks
   - Using a `.bandit` configuration file to exclude test directories

3. **Best practice** - Ensure that production code (non-test files) does not rely on assert statements for critical validation logic. Use explicit error handling and exceptions instead.

### Summary

The Bandit scan identified 36 low-severity findings, all related to assert usage in test files. These findings do not represent security vulnerabilities and are consistent with standard Python testing practices. No remediation is required unless stricter code standards are enforced.

</details>

### Suppression Analysis

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| bandit_suppressions | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Finding Summary

**No Bandit suppressions were found in this project.**

After conducting a comprehensive search of the entire project codebase at `/project`, including:
- All Python files (28 files scanned)
- Bandit configuration files (`.bandit`, `bandit.yaml`, `bandit.yml`, `.bandit.toml`, `pyproject.toml`)
- Inline suppression markers (`# nosec`, `# bandit: skip`)

**Result:** Zero Bandit suppressions detected.

### Analysis Details

The project contains only flake8 suppressions (`# noqa: E402`) in the following files:
- `lambda/localize/localize_service.py:21`
- `lambda/quality-gate/quality_gate_service.py:24`
- `lambda/summarize/summarize_service.py:23`
- `lambda/translate/translate_service.py:21`
- `scripts/script_utils.py:25`

These are legitimate flake8 suppressions for PEP 8 style warnings (E402: module level import not at top of file) and are not Bandit-related.

### Methodology

1. **Source Search**: Searched all Python files for Bandit suppression markers:
   - `# nosec` (standard Bandit suppression)
   - `# bandit: skip` (alternative syntax)
   - `nosec` (inline marker)

2. **Configuration Files**: Checked for Bandit configuration in:
   - `.bandit`
   - `bandit.yaml`
   - `bandit.yml`
   - `.bandit.toml`
   - `pyproject.toml`

3. **Files Examined**: 
   - Lambda handlers and service layers (8 files)
   - Shared utilities (3 files)
   - Test files (5 files)
   - Utility scripts (12 files)

### Conclusion

Since no Bandit suppressions exist in the project, there are no suppression quality issues to evaluate. The codebase does not use Bandit suppression mechanisms. All code is subject to Bandit analysis without any intentional suppressions.

</details>

---


## CDK NAG

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| cdknag | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Analysis Summary

The CDK NAG scan completed successfully with **no findings** reported. The findings document contains:
- **0 Non-Compliant Rules**: No CDK NAG rule violations detected
- **0 Coverage Gaps**: All CDK projects were successfully synthesized and analyzed
- **0 Suppressed Findings**: No rules were suppressed

### Scan Status

✅ **Complete Coverage**: The CDK infrastructure code has been fully analyzed with no security or compliance violations detected by CDK NAG rules.

### Recommendations

Since no issues were found:
1. **Maintain Current Standards**: Continue following the security practices that resulted in this clean scan
2. **Regular Scanning**: Integrate CDK NAG into your CI/CD pipeline to catch any future violations early
3. **Stay Updated**: Keep CDK NAG rules updated to benefit from new security checks as they are released
4. **Code Review**: While CDK NAG found no issues, continue performing manual security reviews as part of your development process

</details>

### CDK NAG Suppressions Analysis

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| cdknag_suppressions | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Executive Summary

A comprehensive analysis of the project at `/project` was conducted to identify and evaluate CDK NAG suppressions. **No CDK NAG suppressions were found in the codebase.**

### Search Methodology

The analysis employed deterministic search patterns to locate all known CDK NAG suppression markers:

1. **Direct API calls:**
   - `NagSuppressions.addResourceSuppressions`
   - `NagSuppressions.addStackSuppressions`
   - `addResourceSuppressionsByPath`
   - `add_resource_suppressions`
   - `add_stack_suppressions`

2. **Generic patterns:**
   - `suppress`, `Suppress`, `SUPPRESS`
   - `nag`, `NAG`, `cdk-nag`

3. **File scope:** All TypeScript (`.ts`), JavaScript (`.js`), and Python (`.py`) files in the project

### Project Overview

The project is an AWS CDK application implementing an international review translation and summarization pipeline. Key components include:

**Infrastructure:**
- S3 buckets (access logs and data storage) with security controls
- Lambda functions (translate, summarize, localize, quality-gate)
- Step Functions state machine for workflow orchestration
- IAM policies with documented compensating controls

**Security Posture:**
- S3 buckets enforce HTTPS-only access (`enforceSSL: true`)
- Public access blocking enabled (`blockPublicAccess: BLOCK_ALL`)
- Server-side encryption configured (`S3_MANAGED`)
- Versioning enabled on all buckets
- Access logging configured for data bucket
- IAM policies scoped to specific actions and resources where possible

### Key Findings

**No suppressions detected** in:
- `lib/hpi-review-pipeline-stack.ts` (main CDK stack)
- `bin/hpi-review-pipeline.ts` (CDK app entry point)
- Any other TypeScript, JavaScript, or Python files

### Code Quality Observations

The codebase demonstrates good security practices:

1. **Documented Design Decisions:** The IAM policy for Amazon Translate includes a detailed SECURITY NOTE explaining:
   - AWS service limitation (no resource-level permissions for Translate)
   - Compensating controls implemented (language pairs, region scope, source ARN restriction)
   - Risk assessment and acceptance rationale

2. **Least Privilege Implementation:**
   - Bedrock access scoped to specific model ARN
   - Translate access restricted by language pairs and region
   - Step Functions source ARN conditions applied

3. **Infrastructure Security:**
   - Encryption at rest (S3-managed)
   - Encryption in transit (HTTPS enforcement)
   - Access logging and audit trails
   - Automatic object deletion on stack removal

### Conclusion

The absence of CDK NAG suppressions indicates one of two scenarios:

1. **CDK NAG is not integrated** into this project's build/validation pipeline
2. **The project passes all CDK NAG checks** without requiring suppressions

Either way, the codebase demonstrates a security-conscious approach with well-documented design decisions and compensating controls for unavoidable AWS service limitations.

### Recommendations

1. **Consider integrating CDK NAG** into the CI/CD pipeline if not already present
2. **Document any CDK NAG exceptions** if they arise, following the pattern established in the codebase (detailed SECURITY NOTE comments)
3. **Continue the current practice** of inline documentation for security-related design decisions

</details>

---


## CVE Scan

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| cve | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Scan Summary

No CVE vulnerabilities detected.

The osv-scanner CVE dependency scan completed successfully with the following results:
- **Dependency Files Scanned:** 2
- **Unique CVEs Found:** 0
- **Manifests Without Lockfile:** 0

### Scan Coverage

The scan achieved complete coverage of all dependency manifests in the project. All 2 dependency files were successfully scanned and resolved, providing full visibility into the project's dependency tree.

### Affected Packages

No vulnerable packages were identified.

### Recommendations

1. **Maintain Current Security Posture:** Continue monitoring dependencies for new vulnerabilities as they are disclosed.

2. **Regular Scanning:** Implement automated CVE scanning as part of your CI/CD pipeline to catch vulnerabilities early.

3. **Dependency Updates:** Keep dependencies up-to-date with the latest security patches by regularly reviewing and applying updates.

4. **Lock File Management:** Ensure all dependency manifests have corresponding lock files (go.mod/go.sum, package-lock.json, pom.xml with dependency resolution, requirements.txt with pinned versions, etc.) to enable reliable and reproducible vulnerability scanning.

5. **Security Monitoring:** Subscribe to security advisories for your project's key dependencies to stay informed of emerging vulnerabilities.

</details>

---


## Checkov

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| checkov | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Scan Summary

The Checkov infrastructure security scan completed successfully with no findings or errors detected.

**Scan Results:**
- Total Findings: 0
- Critical Issues: 0
- High Severity Issues: 0
- Medium Severity Issues: 0
- Low Severity Issues: 0
- Informational Issues: 0
- Suppressed Issues: 0
- Scan Errors: 0

### Analysis

The Checkov scan of the infrastructure code found no security issues. This indicates that:

1. **Infrastructure Configuration**: All infrastructure-as-code files (Terraform, CloudFormation, CDK, etc.) passed security checks
2. **No Coverage Gaps**: The scanner completed without errors, indicating full coverage of infrastructure files
3. **Security Posture**: The current infrastructure configuration meets Checkov's security policy requirements

### Recommendations

- **Maintain Current Standards**: Continue following infrastructure-as-code best practices
- **Regular Scanning**: Integrate Checkov into your CI/CD pipeline to catch issues early
- **Policy Updates**: Periodically review and update Checkov policies to align with evolving security standards
- **Code Review**: Maintain code review processes to ensure security practices are consistently applied

</details>

### Suppression Analysis

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| checkov_suppressions | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Finding Summary

After a comprehensive search of the project at `/project`, **no Checkov suppressions were found**.

### Search Methodology

The analysis employed deterministic search patterns to locate all Checkov suppressions:

1. **Suppression Markers**: Searched for `checkov:skip=` and `checkov.io/skip` patterns in all source files
2. **Configuration Files**: Searched for Checkov configuration files (`.checkov.yaml`, `.checkov.yml`, `checkov.yaml`, `checkov.yml`)
3. **CDK NAG Suppressions**: Searched for `cdk.Aspects` and `NagSuppressions` patterns in TypeScript/JavaScript files
4. **General Suppression Patterns**: Searched for `skip=`, `suppress`, `nosec`, and `CKV_` patterns
5. **Manual Code Review**: Inspected all infrastructure and application code files

### Project Structure

The project is an AWS CDK-based application for international review translation and summarization:

**Infrastructure Code:**
- `lib/hpi-review-pipeline-stack.ts`: CDK stack defining S3 buckets, Lambda functions, Step Functions state machine, and IAM policies
- `bin/hpi-review-pipeline.ts`: CDK app entry point

**Application Code:**
- `lambda/translate/`: Translation Lambda function
- `lambda/summarize/`: Summarization Lambda function using Bedrock
- `lambda/localize/`: Localization Lambda function
- `lambda/quality-gate/`: Quality gate Lambda function using Bedrock
- `lambda/shared/`: Shared utilities for Bedrock and Translate service calls

**Configuration:**
- `cdk.json`: CDK context configuration
- `pytest.ini`: pytest configuration
- `package.json`: Node.js dependencies

### Search Results

**No matches found for:**
- `checkov:skip=` pattern
- `checkov.io/skip` pattern
- `.checkov.yaml`, `.checkov.yml`, `checkov.yaml`, `checkov.yml` configuration files
- `cdk.Aspects` or `NagSuppressions` patterns
- `CKV_` check identifiers
- `skip=`, `suppress`, or `nosec` suppression markers

### Conclusion

The project contains **zero Checkov suppressions**. All security configurations are implemented without suppressing any Checkov findings. This indicates the project either:
1. Has not been scanned with Checkov yet, or
2. All Checkov findings have been remediated rather than suppressed

The infrastructure code demonstrates security best practices including:
- S3 bucket encryption and versioning
- Public access blocking
- Server access logging
- Least-privilege IAM policies with resource and condition restrictions
- Proper error handling in Lambda functions
- Documented security trade-offs (e.g., Amazon Translate wildcard resource requirement with compensating controls)

### Severity Assessment

No suppressions were found, therefore no severity assessment is applicable.

</details>

---


## Secrets

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| secrets | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Scan Summary

The Gitleaks secret scan completed successfully with **no secrets detected** in the project.

**Scan Results:**
- Total Findings: 0
- Scan Errors: 0
- Coverage: Complete

### Analysis

The scan found no hardcoded secrets, API keys, credentials, or other sensitive information that would require remediation. The project appears to follow secure practices regarding secret management.

### Recommendations

1. **Maintain Current Practices**: Continue following secure coding practices that prevent secrets from being committed to the repository.

2. **Pre-commit Hooks**: Consider implementing pre-commit hooks with Gitleaks to automatically prevent secret commits in the future.

3. **Secret Management**: Ensure all sensitive credentials are managed through:
   - Environment variables
   - Secure secret management systems (e.g., AWS Secrets Manager, HashiCorp Vault)
   - Configuration files excluded from version control (.gitignore)

4. **Regular Scanning**: Continue running Gitleaks scans as part of your CI/CD pipeline to maintain this clean state.

</details>

### Suppression Analysis

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| secrets_suppressions | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

**Finding:** No Secrets suppressions detected in the project.

After a comprehensive search of the entire project at `/project`, including:
- All source files (Python, TypeScript, JavaScript)
- Configuration files (cdk.json, pytest.ini, .gitignore, .holmesignore)
- Inline comments and docstrings
- Gitleaks configuration files (.gitleaksignore, .gitleaks.toml, gitleaks.toml)
- Suppression markers (gitleaks:allow, #nosec, #noqa for secrets)

**Result:** No Secrets suppressions were found. The project does not contain any `gitleaks:allow` markers, Gitleaks configuration files, or other Secrets scanner suppressions.

**Security Posture:** The project demonstrates good security practices:
- No hardcoded credentials in source code
- Dummy credentials used only in test configuration (conftest.py)
- AWS credentials managed via IAM roles and environment variables
- Proper .gitignore and .holmesignore configuration
- Documentation explicitly states "No secrets or credentials are hardcoded anywhere in the repository"

**Severity Assessment:** Since no suppressions exist, there are no questionable, acceptable, or problematic suppressions to evaluate.

### Search Methodology

The following deterministic searches were performed:

1. **Gitleaks inline markers**: `gitleaks:allow` - No matches found
2. **Gitleaks configuration files**: `.gitleaksignore`, `.gitleaks.toml`, `gitleaks.toml` - None present
3. **Suppression patterns**: `suppress|allow|ignore.*secret` - No matches
4. **Inline comment suppressions**: `#.*gitleaks|#.*secret.*allow|#.*secret.*suppress` - No matches
5. **Configuration file inspection**: cdk.json, pytest.ini, .gitignore, .holmesignore - No suppressions found

### Conclusion

The project contains zero Secrets suppressions. This is a positive finding indicating either:
1. The project has no secrets-related issues that require suppression, or
2. The project follows strict practices to avoid hardcoding secrets in the first place

No further analysis is required.

</details>

---


## IAM Least Privilege

| Tool | Critical | High | Medium | Low | Info | Suppressed |
|------|----------|------|--------|-----|------|------------|
| iam_least_privilege | 0 | 0 | 0 | 0 | 0 | 0 |

<details>
<summary>View Details</summary>

### Executive Summary

The HPI Review Pipeline implements IAM policies in AWS CDK with appropriate least-privilege scoping. All discovered policies follow security best practices with specific actions and properly scoped resources. One policy uses a wildcard resource due to AWS service limitations, but includes strong compensating controls.

### Detailed Findings

#### Policy 1: SummarizeFn Bedrock Access
**File**: `lib/hpi-review-pipeline-stack.ts` (Lines 67-70)
**Type**: CDK PolicyStatement
**Status**: ✅ LEAST PRIVILEGE

```typescript
summarizeFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/us.anthropic.claude-sonnet-5`
    ],
}));
```

**Analysis**: 
- Action is specific: `bedrock:InvokeModel` (not `bedrock:*` or `*`)
- Resource is scoped to a specific model ARN
- No conditions needed as the resource ARN itself provides sufficient scoping
- Correctly implements least privilege

---

#### Policy 2: QualityGateFn Bedrock Access
**File**: `lib/hpi-review-pipeline-stack.ts` (Lines 92-95)
**Type**: CDK PolicyStatement
**Status**: ✅ LEAST PRIVILEGE

```typescript
qualityGateFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['bedrock:InvokeModel'],
    resources: [
        `arn:aws:bedrock:${this.region}::foundation-model/us.anthropic.claude-sonnet-5`
    ],
}));
```

**Analysis**: 
- Identical to Policy 1
- Specific action and scoped resource
- Correctly implements least privilege

---

#### Policy 3: TranslateFn Translate Access
**File**: `lib/hpi-review-pipeline-stack.ts` (Lines 211-223)
**Type**: CDK PolicyStatement with Conditions
**Status**: ⚠️ ACCEPTABLE (Service Limitation with Compensating Controls)

```typescript
translateFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['translate:TranslateText'],
    resources: ['*'],  // Required by AWS Translate service - no resource-level permissions supported
    conditions: {
        'StringEquals': {
            'translate:SourceLanguageCode': ['fr', 'de'],
            'translate:TargetLanguageCode': ['en'],
            'aws:RequestedRegion': [this.region]
        },
        'ArnLike': {
            'aws:SourceArn': stateMachine.stateMachineArn
        }
    }
}));
```

**Analysis**:
- **Resource Wildcard**: Uses `"Resource": "*"` which would normally be a high-severity finding
- **AWS Service Limitation**: Amazon Translate does not support resource-level permissions per AWS documentation. This is a documented service limitation, not a policy design flaw.
- **Compensating Controls** (defense-in-depth):
  1. **Language Pair Restriction**: Only allows translation from French/German to English (not all language pairs)
  2. **Region Scoping**: Restricted to the deployment region via `aws:RequestedRegion`
  3. **Source ARN Restriction**: Only callable from the specific Step Functions state machine via `aws:SourceArn`
  4. **Specific Action**: Uses `translate:TranslateText` (not `translate:*`)
- **Code Documentation**: The policy includes clear inline comments explaining the service limitation and compensating controls
- **Runtime Validation**: Lambda code validates language codes at runtime (additional application-level control)
- **Assessment**: This is an acceptable trade-off for a prototype. The combination of conditions provides effective blast-radius limitation despite the wildcard resource.

---

#### Policy 4: LocalizeFn Translate Access
**File**: `lib/hpi-review-pipeline-stack.ts` (Lines 228-240)
**Type**: CDK PolicyStatement with Conditions
**Status**: ⚠️ ACCEPTABLE (Service Limitation with Compensating Controls)

```typescript
localizeFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['translate:TranslateText'],
    resources: ['*'],  // Required by AWS Translate service - no resource-level permissions supported
    conditions: {
        'StringEquals': {
            'translate:SourceLanguageCode': ['en'],
            'translate:TargetLanguageCode': ['fr', 'de'],
            'aws:RequestedRegion': [this.region]
        },
        'ArnLike': {
            'aws:SourceArn': stateMachine.stateMachineArn
        }
    }
}));
```

**Analysis**:
- Identical structure to Policy 3 with reversed language pairs (English to French/German)
- Same AWS service limitation and compensating controls apply
- Assessment: Acceptable for prototype

---

### Severity Classification

**Critical (0)**: No policies grant full administrative access (action "*" with resource "*")

**High (0)**: 
- No wildcard actions (`*` or `service:*`) found
- Translate policies use wildcard resources but on a non-sensitive service with strong conditions
- No Allow statements with NotAction/NotResource

**Medium (0)**: 
- Translate policies use `Resource: "*"` but this is mitigated by:
  - AWS service limitation (documented)
  - Multiple compensating conditions
  - Specific action (not wildcard)
  - Source ARN restriction to state machine

**Low (0)**: No narrow over-grants detected

**Info (0)**: No informational observations requiring action

**Suppressed (0)**: No suppressed findings

### Recommendations

1. **Translate Service Monitoring** (Production Hardening):
   - Enable CloudTrail logging for translate:TranslateText calls
   - Set up CloudWatch alarms for unexpected language pairs or regions
   - Implement AWS Config rules to detect policy changes

2. **Future AWS Updates**:
   - Monitor AWS Translate service updates for resource-level permission support
   - If resource-level permissions become available, update policies to scope resources to specific translation jobs

3. **Documentation Maintenance**:
   - Continue documenting service limitations and compensating controls inline
   - Maintain this standard for all future IAM policies

4. **Lambda Execution Roles**:
   - The auto-generated Lambda execution roles (created by CDK) are not manually configured and follow AWS best practices
   - No changes needed to default execution role policies

### Conclusion

The IAM policies in this project follow least-privilege principles. The Bedrock policies are correctly scoped to specific model ARNs. The Translate policies use wildcard resources due to AWS service limitations but implement strong compensating controls (language pair restrictions, region scoping, source ARN restriction) that effectively limit the blast radius. This is an acceptable trade-off for a prototype implementation.

</details>

---

## Scanners Not Run

The following scanners were not run because they were not relevant to this project. This is an intentional selection decision, not a failure. Scanner failures, when they occur, are reported in each scanner's own detail section.

| Scanner | Reason |
|---------|--------|
| cfnnag | no project files matched trigger patterns [*.template **/*.template template.json template.yaml] |
