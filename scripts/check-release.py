"""Audit only this personal-edition source tree; never inspect external folders."""
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {'.git', 'node_modules', '.next', '.next-build', 'dist', 'data', 'test-results', 'playwright-report'}
TEXT = {'.ts', '.tsx', '.js', '.mjs', '.json', '.css', '.html', '.md', '.yml', '.yaml', '.prisma', '.sql', '.py', '.txt', '.svg'}
errors: list[str] = []
files = 0
for path in sorted(ROOT.rglob('*')):
    relative = path.relative_to(ROOT)
    if any(part in SKIP for part in relative.parts):
        continue
    if path.is_symlink():
        errors.append(f'symlink is not allowed in release: {relative}')
        continue
    if not path.is_file():
        continue
    if path.name.startswith('.env') and path.name != '.env.example':
        # Local configuration is excluded from source archives by the packager.
        continue
    files += 1
    if path.suffix not in TEXT and path.name not in {'LICENSE', '.gitignore'}:
        continue
    content = path.read_text(encoding='utf-8')
    if path.suffix in {'.ts', '.tsx', '.js', '.mjs', '.css', '.py', '.prisma'} and len(content.splitlines()) > 900:
        errors.append(f'source exceeds 900 lines: {relative}')
    if re.search(r'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----', content):
        errors.append(f'private key marker: {relative}')
    if re.search(r'(?i)bearer\s+[a-z0-9_\-]{32,}', content):
        errors.append(f'literal bearer credential: {relative}')
    if re.search(r'(?:/[h]ome/[a-z_][a-z0-9_-]+/|[A-Z]:\\Users\\[^\\\s]+\\)', content):
        errors.append(f'private workstation reference: {relative}')

for required in ['LICENSE', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'THIRD_PARTY_NOTICES.md', '.env.example', 'pnpm-lock.yaml']:
    if not (ROOT / required).is_file():
        errors.append(f'missing required file: {required}')
license_path = ROOT / 'LICENSE'
if license_path.exists():
    license_text = license_path.read_text(encoding='utf-8')
    if 'Copyright (c) 2026 元探长' not in license_text or 'Permission is hereby granted, free of charge' not in license_text:
        errors.append('MIT license or copyright notice is incomplete')
result = {'ok': not errors, 'sourceFiles': files, 'errors': errors}
print(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(0 if result['ok'] else 1)
