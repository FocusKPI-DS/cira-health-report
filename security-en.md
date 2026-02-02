# Coding Standards and Security Inspection

## 1. Objectives

### 1.1 Preventing Vulnerabilities at the Source
- Eliminate common vulnerabilities (SQL injection, XSS, command injection, etc.) during the coding phase to prevent security defects from entering production.
- The cost of fixing vulnerabilities during development is significantly lower than in production.

### 1.2 Unifying Security Practices
- Enforce the use of secure functions (parameterized queries, output encoding) and prohibit dangerous operations (eval(), dynamic SQL/command concatenation).
- Provide a clear "Do/Don't" list to reduce cognitive differences.

### 1.3 Meeting Compliance Requirements
- Comply with national and industrial standard security development process requirements.
- Provide code review records as audit evidence.

### 1.4 Improving Development Efficiency
- Discover vulnerabilities early to reduce security rework.
- Compatible with automated SAST tools (e.g., SonarQube).

### 1.5 Establishing a Security Culture
- Internalize security principles such as least privilege, encryption, and input validation.
- Provide actionable examples for new developers.

---

## 2. Input Validation
2.1 All data validation must be performed on a trusted system (server-side).  
2.2 Identify all data sources and validate all untrusted sources (clients, databases, file streams, etc.).  
2.3 Establish a centralized input validation rule library.  
2.4 Define the character set (UTF-8) and validate extended character sets after decoding.  
2.5 Normalize input (e.g., uniform encoding) and discard data that fails validation.  
2.6 Validate that request and response headers contain only ASCII characters.  
2.7 Validate redirect inputs to prevent validation bypass attacks.  
2.8 Strictly enforce validation of data types, ranges, and lengths.  
2.9 Prioritize allow-list (whitelist) validation.  
2.10 Implement additional controls for dangerous characters (e.g., `< > " ' % & + \`) using output encoding or secure APIs.  
2.11 Separately validate null bytes (`%00`), line breaks (`%0d, %0a`), and directory traversal characters (`../` or double-encoded forms).  
2.12 **Time-based Side-channel Protection**: Prohibit short-circuiting in signature comparisons; must use constant-time functions (e.g., Java: `MessageDigest.isEqual`, Python: `hmac.compare_digest`).

## 3. Output Encoding
3.1 All output encoding must be performed on a trusted system.  
3.2 Use standard, tested output encoding rules.  
3.3 Perform context-aware output encoding for untrusted data (HTML entities, SQL, XML, LDAP, etc.).  
3.4 Purge untrusted data from OS command outputs.

## 4. Authentication and Password Management
4.1 All resources, except for public content, must require authentication.  
4.2 Authentication must be performed on a trusted system, prioritizing standard libraries and services.  
4.3 Centralize authentication logic and isolate resource requests.  
4.4 All passwords must be stored using **one-way salted hashes** (recommended: `bcrypt/argon2/scrypt`).  
4.5 Prohibit the use of `MD5/SHA1/SHA256` for standalone password storage.  
4.6 Password comparisons must be constant-time to prevent time-based side-channel attacks.  
4.7 Use generic error messages (e.g., "Invalid username or password").  
4.8 Accounts should be locked after multiple consecutive failed login attempts to prevent brute-force attacks.  
4.9 Password complexity and length policy: Minimum 16 characters or multi-word passphrases.  
4.10 Temporary passwords/reset links must be short-lived and changed immediately after use.  
4.11 Prevent password reuse and frequent change attacks.  
4.12 Require secondary authentication for critical operations; multi-factor authentication (MFA) is recommended for important accounts.  
4.13 Review third-party authentication code to avoid impact from malicious code.  
4.14 Password inputs must be masked on the client side, and browser "remember password" features should be disabled.

## 5. Session Management
5.1 Session management should be controlled by the server or framework.  
5.2 Session identifiers must be generated on a trusted system and be random.  
5.3 Set Domain and Path restrictions; set HTTP Cookies to `Secure` & `HttpOnly`.  
5.4 Logout operations must effectively terminate the session.  
5.5 Control session timeouts within business-acceptable ranges; short sessions are recommended, with periodic re-validation of permissions.  
5.6 Prohibit concurrent logins for the same user; generate a new session identifier when switching from HTTP to HTTPS.  
5.7 Session identifiers must not appear in URLs, logs, or error messages.  
5.8 Use strong random tokens or parameters to prevent CSRF for high-sensitivity operations.

## 6. Access Control
6.1 Use trusted system objects to determine authorization.  
6.2 Implement a unified access control mechanism across the site, including external authorization service calls.  
6.3 Fail securely; deny access if configuration information is missing.  
6.4 Access control should cover all requests, including AJAX, Flash, and other rich-client requests.  
6.5 Isolate privilege logic from general code.  
6.6 Strictly limit resource access; allow only authorized users to access protected URLs, functions, data, and configurations.  
6.7 Encrypt state data stored on the client side and verify integrity on the server side.  
6.8 Implement transaction quantity/time limits to prevent automated attacks.  
6.9 Use the `Referer` header only for supplementary checks, not for authentication.  
6.10 Periodically re-verify user permissions and log out users whose permissions have changed.  
6.11 Account auditing: Timely deactivation of inactive accounts; least privilege for service accounts.

## 7. Encryption Standards
7.1 All encryption operations must be performed on a trusted system.  
7.2 Protect secret information from unauthorized access.  
7.3 Handle encryption module errors securely.  
7.4 Use validated algorithms for generating random numbers, GUIDs, etc.  
7.5 Maintain a comprehensive policy and process for key management.

## 8. Error Handling and Logging
8.1 Do not leak system, session, or account information in error responses.  
8.2 Avoid displaying debugging or stack trace info; use generic error messages and custom pages.  
8.3 Logging must be performed on a trusted system, recording both successful and failed security events.  
8.4 Do not store sensitive information (passwords, session IDs) in logs.  
8.5 Record failed input validations, authentication attempts, access control failures, abnormal state modifications, expired session attempts, system anomalies, administrative actions, security config changes, and encryption errors.  
8.6 Use hashes to verify log integrity.  
8.7 Access logs should be restricted to authorized personnel only.

## 9. Data Protection
9.1 Apply the principle of least privilege for data and functional access.  
9.2 Server-side cache or temporary sensitive data must be protected and cleared timely.  
9.3 Storage of highly confidential information must be encrypted.  
9.4 Prohibit users from downloading server-side source code.  
9.5 Clients must not store passwords or sensitive information in plain text.  
9.6 Prohibit the transmission of sensitive information via HTTP GET requests.  
9.7 Disable form auto-fill or client caching for sensitive web pages.  
9.8 Delete data promptly when it is no longer required.  
9.9 Server-side access to sensitive information requires strict control.  
9.10 Define maximum retention periods for all types of data (especially sensitive/private data); data must be automatically cleared or anonymized after expiration.  
9.11 Support user-specific requests (e.g., GDPR/CCPA requirements) to delete personal information after identity verification ("Right to be Forgotten").

## 10. Communication Security
10.1 All sensitive information must be encrypted during transmission; use TLS to protect all connections.  
10.2 Ensure TLS certificates are valid and correctly installed; prohibit fallback to insecure connections.  
10.3 Filter sensitive information from `HTTP Referer` when connecting to external systems.  
10.4 Explicitly define transmission character encoding.

## 11. System Configuration
11.1 Use the latest versions and apply all patches for servers, frameworks, and components.  
11.2 Disable directory listing, disable unnecessary HTTP methods, and remove test code/unnecessary features.  
11.3 Hide version information for web servers and applications.  
11.4 Isolate development and production environments; access should be limited to explicitly authorized personnel.  
11.5 Use software change management and asset management systems.  
11.6 System accounts should have least privilege.  
11.7 **Credential Management**: Strictly prohibit storing passwords, API keys, certificates, etc., for databases or third-party services in source code repositories; use environment variables or dedicated secret management services (e.g., Secret Manager) during runtime.

## 12. Database Security
12.1 Use strongly-typed parameterized queries.  
12.2 Validate inputs and encode outputs for meta-characters; deny execution if validation fails.  
12.3 Use least privilege database accounts; credential management must follow the general standards in Chapter 11.  
12.4 Use stored procedures and minimize table access permissions.  
12.5 Remove default administrator passwords; disable unnecessary default accounts and features.

## 13. File Management
13.1 Require authentication before uploading files.  
13.2 Limit upload types and verify file headers to validate types.  
13.3 Files should not be stored in the web root directory; disable execution permissions for upload directories.  
13.4 Use allow-lists to control referenced files; prohibit passing absolute paths to the client.  
13.5 Scan user-uploaded files for viruses and malware.

## 14. Memory Management
14.1 Control input/output data and validate buffer sizes to prevent overflows.  
14.2 Use secure functions to avoid known vulnerabilities.  
14.3 Correctly clear memory when releasing resources, do not rely solely on garbage collection.  
14.4 Use non-executable stacks where possible.

## 15. General Coding Standards
15.1 Use validated managed libraries and avoid unmanaged code.  
15.2 Avoid passing user data to dynamic execution functions or OS shells.  
15.3 Check the security of third-party libraries and perform security updates.  
15.4 Initialize all variables and correctly handle privilege escalation.  
15.5 Prevent race conditions and protect shared resources.  
15.6 Restrict users from generating or modifying code.

## 16. Additional (Modern Web/API Security)
16.1 Tokens/API Keys should use high randomness, least privilege, be short-lived, and support revocation.  
16.2 Use constant-time functions for signature and token comparisons to prevent side-channel attacks.  
16.3 Prevent CSRF for web interfaces; set Cookies to `Secure` & `HttpOnly`.  
16.4 Avoid leaking tokens or session IDs in logs, URLs, or error messages.  
16.5 Rich-client requests (AJAX/SPA/WebSocket) must also undergo server-side authorization validation.

## 17. Ops and Infrastructure Security
17.1 The enterprise must designate a clear security officer/lead.  
17.2 Production environment passwords (servers, databases, etc.) are restricted to minimal necessary personnel and must meet high-strength requirements (see Chapter 4).  
17.3 All operations and office terminals must have antivirus software installed and signature databases kept up-to-date.  
17.4 Servers should only open absolutely essential ports for business, denying all other connections by default.  
17.5 Establish a periodic mechanism to check and apply security patches for server OS, middleware, and third-party libraries.  
17.6 Perform an asset inventory every three months to confirm the connectivity and operational health of all assets.  
17.7 Develop emergency recovery plans for service outages and conduct periodic drills to verify plan effectiveness.

## 18. Daily Office and Personnel Security
18.1 All computers and office equipment must have strong, hard-to-guess passwords, and the system must be set to automatically lock the screen after 10 minutes of inactivity.  
18.2 Implement a "Clean Desk" policy when leaving the workstation, ensuring sensitive documents are filed and screens are locked.  
18.3 Do not trust emails, links, or attachments from unknown sources; conduct regular internal phishing drills.  
18.4 Strictly prohibit account sharing; do not write passwords on notes or store them in insecure files.  
18.5 Stay vigilant against unauthorized persons entering the office area and prevent tailgating.

---

### Employee Confirmation and Commitment

I have read and fully understood the contents of the above "Security Standard Document". I commit to strictly abiding by the regulations in this document during daily work and system development/maintenance, reporting security risks promptly, and fulfilling confidentiality obligations for sensitive information.

**Employee Name:** ____________________  
**Department:** ____________________  
**Date of Signature:** 20 __ / __ / __ 
