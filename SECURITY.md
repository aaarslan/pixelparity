# Security Policy

## Supported versions

Security fixes are provided for the current 2.x release line. Version 1.x is retained
only as a Chrome Web Store rollback package and is not under active development.

## Report a vulnerability

Please do not post a suspected vulnerability in a public issue. Email
**arslan.abdallah@gmail.com** with:

- A concise description and impact
- Reproduction steps or a minimal proof of concept
- Affected PixelParity and Chrome versions
- Any suggested mitigation

You should receive an acknowledgement within five business days. Please allow time to
confirm and correct the issue before public disclosure. This project does not
currently operate a paid bug-bounty program.

## Security design

PixelParity uses Manifest V3, temporary `activeTab` access, no host permissions, no
remote code, no network connections, trusted-context-only storage, an isolated
dynamically injected bridge, discriminated messages, whitelisted metric fields, and a
strict extension Content Security Policy. Page-derived strings are rendered as Preact
text nodes; the project forbids `dangerouslySetInnerHTML`.
