## 2025-02-27 - [SSRF bypass via IPv6-mapped IPv4]
**Vulnerability:** The SSRF protection in `src/app/api/audit/full/route.ts` only checked standard IPv4/IPv6 addresses and simple hostnames.
**Learning:** It missed checking for IPv6-mapped IPv4 addresses (e.g., `[::ffff:127.0.0.1]`) and cloud metadata domains like `metadata.google.internal`. Furthermore, the original check did not strip brackets `[ ]` from IPv6 addresses before comparing with the blocked list.
**Prevention:** Always strip brackets and use robust regular expressions to detect IPv6-mapped IPv4 addresses, and maintain a comprehensive list of cloud metadata endpoints. Ensure consistency across different endpoints (e.g., `v1/audit/route.ts` vs `audit/full/route.ts`).
