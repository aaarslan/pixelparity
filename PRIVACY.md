# Privacy Policy for PixelParity

**Last Updated: August 19, 2025**\
**Extension Version: 1.0.0**

## Introduction

PixelParity is a developer-focused Chrome extension that provides instant access
to display metrics for web development and quality assurance. This privacy
policy explains how we handle (or more accurately, how we **don't** handle) your
data when you use our extension.

**TL;DR**: PixelParity collects zero personal data, makes zero external
requests, and operates entirely within your browser for maximum privacy.

## Our Privacy Philosophy

PixelParity was built from the ground up with **privacy by design**. We believe
that developer tools should enhance your workflow without compromising your
privacy. Every design decision prioritizes your data protection and user
autonomy.

## What We DON'T Collect

We are committed to transparency about what we **do not** do:

### ❌ **Zero Personal Data Collection**

- No names, email addresses, or contact information
- No user accounts, profiles, or identification systems
- No demographic information or user characteristics
- No device fingerprinting or unique identifiers

### ❌ **Zero Browsing Activity Tracking**

- No browsing history or website visit logs
- No URL tracking or page content analysis
- No cross-site tracking or behavioral profiling
- No time spent on websites or usage patterns

### ❌ **Zero External Data Transmission**

- No data sent to our servers (we don't have any)
- No third-party analytics (Google Analytics, etc.)
- No crash reporting or telemetry services
- No external API calls or network requests

### ❌ **Zero Third-Party Integration**

- No advertising networks or tracking pixels
- No social media plugins or sharing tools
- No external content delivery networks (CDNs)
- No integration with cloud services

## What the Extension Actually Does

PixelParity performs a single, focused function with complete transparency:

### **Display Metrics Collection (Local Only)**

When you click the extension icon, PixelParity:

1. **Executes a measurement script** in your current browser tab
2. **Reads standard browser properties** including:
   - Viewport dimensions (window.innerWidth, window.innerHeight)
   - Screen resolution (screen.width, screen.height)
   - Device pixel ratio (window.devicePixelRatio)
   - Browser zoom level (calculated from viewport vs. screen)
   - Document dimensions (document.body.scrollWidth/Height)
   - Root font size (computed CSS properties)
3. **Displays results immediately** in the extension popup
4. **Discards all data** when you close the popup

**Important**: This measurement script only reads safe, read-only browser
properties. It cannot access page content, forms, user input, or sensitive
information.

### **Local Settings Storage**

PixelParity stores only two user preferences on your device:

- **Theme selection** (light mode vs. dark mode)
- **Display mode** (normal vs. compact layout)

These settings are stored using Chrome's built-in storage APIs and remain on
your device.

## Required Permissions Explained

Chrome extensions must declare all permissions upfront. PixelParity requests the
absolute minimum necessary:

### **`activeTab`** - Access Current Tab Only

- **Purpose**: Allows script injection into the currently active tab
- **Limitation**: Only works when you click the extension icon
- **No Access To**: Browsing history, other tabs, or background activity

### **`scripting`** - Inject Measurement Code

- **Purpose**: Injects a small script to read display properties
- **Limitation**: Script only reads browser dimensions, nothing else
- **No Access To**: Page content, user data, or persistent storage

### **`tabs`** - Identify Active Tab

- **Purpose**: Determines which tab to measure and ensures compatibility
- **Limitation**: Only accesses basic tab metadata (ID, URL)
- **No Access To**: Tab content, history, or cross-tab information

### **`storage`** - Save User Preferences

- **Purpose**: Remembers your theme and layout preferences
- **Limitation**: Only stores settings, no user data
- **Storage Type**: Chrome's secure local storage (chrome.storage.sync/local)

### **`clipboardWrite`** - Export Functionality

- **Purpose**: Enables copying metrics in JSON, CSS, or table formats
- **Limitation**: Can only write to clipboard, cannot read clipboard content
- **No Access To**: Existing clipboard data or other applications

## Data Storage and Retention

### **User Preferences (Persistent)**

- **What**: Theme selection, compact mode preference
- **Where**: Chrome's local storage on your device
- **Duration**: Until you uninstall the extension or clear browser data
- **Access**: Only PixelParity, not shared with other extensions or websites

### **Metrics Cache (Temporary)**

- **What**: Display measurements for export functionality
- **Where**: Browser memory only
- **Duration**: Cleared when popup closes or extension restarts
- **Access**: Never leaves your browser

### **No Server Storage**

PixelParity operates entirely offline. We maintain no servers, databases, or
cloud storage systems.

## Your Privacy Rights

### **Data Access**

Since we collect no personal data, there is no profile or account to access.

### **Data Deletion**

- **Settings**: Clear through Chrome settings → Privacy → Site Data
- **Complete Removal**: Uninstall extension to remove all traces

### **Data Portability**

Your settings are stored in standard Chrome storage and can be backed up through
Chrome's sync system.

### **Opt-Out**

Simply don't use the extension or uninstall it at any time.

## Open Source Transparency

PixelParity is fully open source under the MIT License:

- **Source Code**:
  [https://github.com/aaarslan/pixelparity](https://github.com/aaarslan/pixelparity)
- **Issue Tracking**:
  [https://github.com/aaarslan/pixelparity/issues](https://github.com/aaarslan/pixelparity/issues)
- **Independent Verification**: Anyone can audit our code to verify these
  privacy claims

We encourage security researchers and privacy advocates to review our code.

## Compliance and Legal

### **Regulatory Compliance**

This extension is designed to comply with:

- **GDPR (General Data Protection Regulation)**: No personal data processing
- **CCPA (California Consumer Privacy Act)**: No personal information sale or
  sharing
- **COPPA (Children's Online Privacy Protection Act)**: Safe for all ages
- **Chrome Web Store Developer Program Policies**: Manifest V3 compliance

### **Age Restrictions**

PixelParity is suitable for users of all ages as it collects no personal
information.

### **International Users**

Since no data leaves your device, international data transfer regulations do not
apply.

## Security Measures

### **Code Security**

- No eval() or dangerous JavaScript patterns
- No external script loading or remote code execution
- Content Security Policy compliance
- Regular security updates

### **Permission Security**

- Minimal permission model
- No overprivileged access requests
- Runtime permission validation

## Changes to This Policy

### **Notification of Changes**

- Major changes will be noted in extension updates
- Policy version will be incremented
- GitHub repository will track all changes

### **No Retroactive Changes**

We will not retroactively change our data handling practices for existing users.

## Contact and Support

### **Privacy Questions**

For privacy-related concerns or questions:

- **GitHub Issues**:
  [https://github.com/aaarslan/pixelparity/issues](https://github.com/aaarslan/pixelparity/issues)
- **Email**: [Provide your contact email here]
- **Response Time**: We aim to respond within 48 hours

### **Security Issues**

For security vulnerabilities:

- **Private Disclosure**: Contact via GitHub or email
- **Responsible Disclosure**: We appreciate advance notice before public
  disclosure

## Technical Implementation Notes

### **Manifest V3 Compliance**

PixelParity uses Chrome's latest extension platform (Manifest V3) which
provides:

- Enhanced security sandboxing
- Improved permission controls
- Service worker architecture for better performance

### **No Remote Code**

All JavaScript, CSS, and HTML files are included in the extension package. No
code is loaded from external sources.

### **Content Security Policy**

Strict CSP prevents unauthorized script execution and external resource loading.

## Conclusion

PixelParity demonstrates that powerful developer tools can be built without
sacrificing user privacy. By processing everything locally and collecting zero
personal data, we provide the functionality developers need while respecting
their privacy completely.

**Questions?** We're committed to transparency. If anything in this policy is
unclear, please don't hesitate to reach out.
