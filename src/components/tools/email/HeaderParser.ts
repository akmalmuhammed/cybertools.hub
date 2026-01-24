import PostalMime from 'postal-mime';

export interface EmailHop {
    from: string;
    by: string;
    with?: string;
    time: string; // ISO string
    timestamp: number;
    delay: number; // Seconds since previous hop
    ip?: string;
    annotations?: string[]; // Phase 4: Hops Intelligence
}

export interface AuthStatus {
    status: 'pass' | 'fail' | 'neutral' | 'none' | 'softfail' | 'policy' | 'temperror' | 'permerror';
    details: string;
    explanation?: string;
    aligned?: boolean;
}

export interface AnalysisResult {
    verdict: 'likely_legit' | 'suspicious' | 'high_risk' | 'neutral';
    score: number; // 0-100
    headers: Record<string, any>;
    rawHeaders: string;
    auth: {
        spf: AuthStatus;
        dkim: AuthStatus;
        dmarc: AuthStatus;
    };
    hops: EmailHop[];
    artifacts: { type: string; value: string; label?: string }[];
    anomalies: string[];
    scoreFactors: { label: string; score: number }[];
    impersonationAlert?: string; // Phase 3: Impersonation
    recommendedActions?: string[]; // Phase 5: Action Mapping
    arc?: { // Phase 7: Advanced Forensics
        status: 'pass' | 'fail' | 'none';
        details: string[];
    };
    xHeaders?: { key: string; value: string; explanation?: string }[];
    attachments?: { filename: string; mimeType: string; size: number; hash: string }[]; // Phase 9: Workflow
}

export class HeaderParser {
    static async parse(rawInput: string): Promise<AnalysisResult> {
        const parser = new PostalMime();
        // PostalMime expects a full message, but works okay with just headers if we are careful.
        // However, for pure header analysis, we often need to parse Authentication-Results manually
        // because it's complex and PostalMime might just give us the string.

        // 1. Basic Parse
        const email = await parser.parse(rawInput);

        // 2. Extract Headers manually for better fidelity on specific fields
        // PostalMime puts all headers in email.headers array
        const headerMap: Record<string, any> = {};
        email.headers.forEach(h => {
            // specialized handling for array headers like Received
            if (headerMap[h.key]) {
                if (Array.isArray(headerMap[h.key])) {
                    headerMap[h.key].push(h.value);
                } else {
                    headerMap[h.key] = [headerMap[h.key], h.value];
                }
            } else {
                headerMap[h.key] = h.value;
            }
        });

        // 2a. Fallback / Hybrid: Manual Line Parsing
        // PostalMime processes full messages best. If input is just headers, it might put everything in preamble.
        // If PostalMime found headers, TRUST IT and skip manual fallback to avoid duplication.
        if (Object.keys(headerMap).length === 0) {
            const lines = rawInput.split(/\r?\n/);
            let currentKey = "";

            lines.forEach(line => {
                // Standard header line: "Key: Value"
                const match = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
                if (match) {
                    currentKey = match[1]; // Case-sensitive store
                    let val = match[2];
                    // val = this.decodeHeaderValue(val); // Decode RFC 2047 (Not implemented manually, rely on PostalMime mostly)

                    const normKey = currentKey;

                    if (headerMap[normKey]) {
                        if (Array.isArray(headerMap[normKey])) {
                            headerMap[normKey].push(val);
                        } else {
                            headerMap[normKey] = [headerMap[normKey], val];
                        }
                    } else {
                        headerMap[normKey] = val;
                    }
                } else if (/^\s+/.test(line) && currentKey) {
                    // Folded header (continuation)
                    let val = line.trim();
                    if (Array.isArray(headerMap[currentKey])) {
                        const arr = headerMap[currentKey];
                        arr[arr.length - 1] += " " + val;
                    } else {
                        headerMap[currentKey] += " " + val;
                    }
                }
            });
        }

        // Helper to get case-insensitive header
        const getHeader = (key: string) => {
            const k = Object.keys(headerMap).find(k => k.toLowerCase() === key.toLowerCase());
            return k ? headerMap[k] : undefined;
        };

        // 3. Analyze Authentication-Results
        const auth = this.analyzeAuth(getHeader('Authentication-Results'));

        // 4. Analyze Hops (Received headers)
        const hops = this.analyzeHops(getHeader('Received'));

        // 5. Anomalies & Verdict
        const { verdict, score, anomalies } = this.calculateVerdict(headerMap, auth, hops);

        // 6. Artifacts
        const artifacts = this.extractArtifacts(headerMap, hops);

        // 7. Impersonation Check (Phase 3)
        const impersonationAlert = this.detectImpersonation(headerMap, auth);

        // 8. Action Mapping (Phase 5)
        const recommendedActions = this.getRecommendedActions(verdict, auth, impersonationAlert);

        // 9. Advanced Forensics (Phase 7: ARC & X-Headers)
        const arc = this.analyzeARC(headerMap);
        const xHeaders = this.analyzeXHeaders(headerMap);

        // 10. Attachment Analysis (Phase 9)
        const attachments = await this.analyzeAttachments(email.attachments);

        return {
            verdict,
            score,
            headers: headerMap,
            rawHeaders: rawInput,
            auth,
            hops,
            artifacts,
            anomalies,
            scoreFactors: (this.calculateVerdict(headerMap, auth, hops)).scoreFactors,
            impersonationAlert,
            recommendedActions,
            arc,
            xHeaders,
            attachments
        };
    }

    private static async analyzeAttachments(attachments: any[]): Promise<AnalysisResult['attachments']> {
        if (!attachments || attachments.length === 0) return [];

        const results: AnalysisResult['attachments'] = [];

        for (const att of attachments) {
            let hash = "";
            // Calculate SHA-256 if content is present
            if (att.content && (att.content instanceof Uint8Array || att.content instanceof ArrayBuffer)) {
                hash = await this.calculateHash(att.content);
            }

            results.push({
                filename: att.filename || 'unknown',
                mimeType: att.mimeType || 'application/octet-stream',
                size: att.content ? att.content.length : 0,
                hash
            });
        }
        return results;
    }

    private static async calculateHash(content: BufferSource): Promise<string> {
        try {
            const hashBuffer = await crypto.subtle.digest('SHA-256', content);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            console.error("Hashing failed", e);
            return "";
        }
    }

    private static analyzeARC(headers: any): AnalysisResult['arc'] {
        // ARC checks consist of ARC-Authentication-Results, ARC-Seal, ARC-Message-Signature
        const arcResults = headers['ARC-Authentication-Results'];
        const arcSeal = headers['ARC-Seal'];

        if (!arcResults && !arcSeal) return { status: 'none', details: [] };

        const details: string[] = [];
        let status: NonNullable<AnalysisResult['arc']>['status'] = 'none';

        // Check ARC-Authentication-Results (similar format to Auth-Results)
        if (arcResults) {
            const val = Array.isArray(arcResults) ? arcResults[0] : arcResults;
            details.push(`Results: ${val}`);
            if (val.includes('arc=pass')) status = 'pass';
            else if (val.includes('arc=fail')) status = 'fail';
        }

        // Check ARC-Seal (chain validation)
        if (arcSeal) {
            const val = Array.isArray(arcSeal) ? arcSeal[0] : arcSeal;
            // Extract "cv=pass"
            if (val.includes('cv=pass')) {
                if (status !== 'fail') status = 'pass';
                details.push("Chain Validation: Pass");
            } else if (val.includes('cv=fail')) {
                status = 'fail';
                details.push("Chain Validation: Fail");
            }
        }

        return { status, details };
    }

    private static analyzeXHeaders(headers: any): AnalysisResult['xHeaders'] {
        const interesting = [
            { key: 'X-Spam-Status', label: 'Spam Status' },
            { key: 'X-Spam-Score', label: 'Spam Score' },
            { key: 'X-Mailer', label: 'Mailer Client' },
            { key: 'X-Distribution', label: 'Distribution List' },
            { key: 'X-Originating-IP', label: 'Originating IP' },
            { key: 'X-Gophish', label: 'GoPhish Header (Phishing Tool)' }
        ];

        const xHeaders: AnalysisResult['xHeaders'] = [];

        interesting.forEach(item => {
            const val = headers[item.key];
            if (val) {
                let explanation = "";
                const vStr = String(val).toLowerCase();

                if (item.key === 'X-Spam-Status') {
                    if (vStr.startsWith('yes')) explanation = "Upstream server marked this as SPAM.";
                    else if (vStr.startsWith('no')) explanation = "Upstream server marked this as NOT SPAM.";
                }

                if (item.key === 'X-Mailer') {
                    if (vStr.includes('php')) explanation = "Sent via PHP script. Common in automated alerts or spam scripts.";
                }

                if (item.key === 'X-Gophish') {
                    explanation = "**CRITICAL**: Sent via GoPhish framework. Likely a simulation or phishing test.";
                }

                xHeaders.push({
                    key: item.key,
                    value: String(val),
                    explanation: explanation || item.label
                });
            }
        });

        return xHeaders;
    }

    private static getRecommendedActions(
        verdict: string,
        auth: AnalysisResult['auth'],
        impersonationResult?: string
    ): string[] {
        const actions: string[] = [];

        // High Priority based on Verdict
        if (verdict === 'high_risk') {
            actions.push("Block sender domain/IP at gateway.");
            actions.push("Quarantine this email immediately.");
            if (impersonationResult) {
                actions.push("Initiate internal incident response protocol for impersonation.");
            }
        } else if (verdict === 'suspicious') {
            actions.push("Quarantine email for manual review.");
            actions.push("Do not click links or open attachments.");
        } else if (verdict === 'neutral') {
            actions.push("Exercise caution; verification data is insufficient.");
        }

        // Specific Auth Actions
        if (auth.dmarc.status === 'fail' && auth.dmarc.details.includes('reject')) {
            actions.push("Confirm rejection logs in DMARC report (if available).");
        }

        if (auth.spf.status === 'softfail' || auth.spf.status === 'fail') {
            actions.push("Verify if sender IP is authorized (check for forwarding).");
        }

        // Impersonation specific
        if (impersonationResult) {
            actions.push("Verify unexpected communication via out-of-band channel (Slack/Teams).");
        }

        return actions;
    }

    private static detectImpersonation(headers: any, auth: AnalysisResult['auth']): string | undefined {
        const from = headers['From'] || '';
        const highValueKeywords = ['admin', 'subport', 'security', 'hr', 'payroll', 'finance', 'ceo', 'it group', 'microsoft', 'google'];

        // Extract Display Name: "Display Name" <email@domain.com>
        const match = from.match(/^"?([^"<]+)"?\s*<.*>$/);
        if (!match) return undefined;

        const displayName = match[1].toLowerCase();

        // Check if Display Name contains sensitive keywords
        const triggeredKeyword = highValueKeywords.find(kw => displayName.includes(kw));

        if (triggeredKeyword) {
            // If it looks like a high-value sender, but failed Auth or isn't strict, flag it.
            // Strict = DMARC Pass OR SPF Pass. 
            // If completely failing auth, it's definitely high risk.
            if (auth.dmarc.status !== 'pass' && auth.spf.status !== 'pass' && auth.dkim.status !== 'pass') {
                return `Sender is mimicking "${triggeredKeyword.toUpperCase()}" but failed all authentication checks.`;
            }

            // If softfail/neutral/none, still risky for high value targets
            if (auth.dmarc.status === 'none' || auth.dmarc.status === 'fail') {
                return `Sender name "${match[1]}" suggests high privilege, but DMARC is not enforced. Verify origin carefully.`;
            }
        }

        return undefined;
    }






    // ... (inside class)

    private static getAuthExplanation(type: 'spf' | 'dkim' | 'dmarc', status: string, details: string): string {
        const s = status.toLowerCase();

        if (type === 'spf') {
            if (s === 'pass') return "Sender IP is authorized by the domain's SPF record.";
            if (s === 'fail') return "Sender IP is NOT authorized. High confidence spoofing signal (unless forwarding).";
            if (s === 'softfail') return "Sender IP is not authorized, but domain is in 'testing' mode (~all). Suspicious.";
            if (s === 'none') return "No SPF record found for this domain. weak security posture.";
            if (s === 'neutral') return "Domain does not explicitly authorize or deny this IP (?all).";
            if (s === 'temperror') return "Temporary DNS error during check. Try again later.";
            if (s === 'permerror') return "Invalid SPF record syntax. Administrator error.";
        }

        if (type === 'dkim') {
            if (s === 'pass') return "Email cryptographic signature is valid and unaltered.";
            if (s === 'fail') return "Cryptographic signature failed verification. Body or headers may have been modified.";
            if (s === 'none') return "Email was not signed. Common for spam or very old systems.";
            if (s === 'neutral') return "Signature exists but is not valid for this sender.";
        }

        if (type === 'dmarc') {
            if (s === 'pass') return "Email aligns with domain policy (SPF or DKIM passed & aligned). Legitimate.";
            if (s === 'fail') {
                // Check action from details
                if (details.includes('reject')) return "DMARC Failed & Rejected. This email would typically be blocked by gateways.";
                if (details.includes('quarantine')) return "DMARC Failed & Quarantined. This email is likely in Spam/Junk folder.";
                return "DMARC Failed. Domain failed policy checks. Strong spoofing indicator.";
            }
            if (s === 'none') return "No DMARC policy published. Domain is vulnerable to spoofing.";
        }

        return "";
    }

    private static analyzeAuth(authHeader: string | string[]): AnalysisResult['auth'] {
        // Default state
        const result: AnalysisResult['auth'] = {
            spf: { status: 'none', details: 'No SPF check found' },
            dkim: { status: 'none', details: 'No DKIM check found' },
            dmarc: { status: 'none', details: 'No DMARC check found' }
        };

        if (!authHeader) {
            // Populate default explanations
            result.spf.explanation = this.getAuthExplanation('spf', 'none', '');
            result.dkim.explanation = this.getAuthExplanation('dkim', 'none', '');
            result.dmarc.explanation = this.getAuthExplanation('dmarc', 'none', '');
            return result;
        }

        // If multiple Auth-Results, usually the top one (first one) is the most relevant (the receiving server)
        // Check if array
        const mainHeader = Array.isArray(authHeader) ? authHeader[0] : authHeader;

        // Simple Regex parsing for standard Auth-Results
        // Example: Authentication-Results: mx.google.com; dkim=pass (2048-bit key) ...; spf=pass ...

        // SPF
        const spfMatch = mainHeader.match(/spf=(\w+)/i);
        if (spfMatch) {
            result.spf.status = spfMatch[1].toLowerCase() as any;
            result.spf.details = mainHeader.match(/spf=[^;]+/)?.[0] || 'Found in headers';
        }
        result.spf.explanation = this.getAuthExplanation('spf', result.spf.status, result.spf.details);

        // DKIM
        const dkimMatch = mainHeader.match(/dkim=(\w+)/i);
        if (dkimMatch) {
            result.dkim.status = dkimMatch[1].toLowerCase() as any;
            result.dkim.details = mainHeader.match(/dkim=[^;]+/)?.[0] || 'Found in headers';
        }
        result.dkim.explanation = this.getAuthExplanation('dkim', result.dkim.status, result.dkim.details);

        // DMARC
        const dmarcMatch = mainHeader.match(/dmarc=(\w+)/i);
        if (dmarcMatch) {
            result.dmarc.status = dmarcMatch[1].toLowerCase() as any;
            result.dmarc.details = mainHeader.match(/dmarc=[^;]+/)?.[0] || 'Found in headers';
        }
        result.dmarc.explanation = this.getAuthExplanation('dmarc', result.dmarc.status, result.dmarc.details);

        return result;
    }

    private static analyzeHops(receivedHeaders: string | string[]): EmailHop[] {
        if (!receivedHeaders) return [];
        const headers = Array.isArray(receivedHeaders) ? receivedHeaders : [receivedHeaders];
        const hops: EmailHop[] = [];

        // Received headers are typically top-down (newest first). We want chronological (oldest first).
        // Standard format: from [server] (helo [helo]) by [server] with [proto] id [id] for [to]; [date]

        headers.forEach(header => {
            // Simplified parsing strategy
            const fromMatch = header.match(/from\s+([^\s]+)/i);
            const byMatch = header.match(/by\s+([^\s]+)/i);
            // Date is usually after the semicolon
            const datePart = header.split(';').pop()?.trim();

            // Extract IP if present in parens or brackets
            // Extract IP if present in parens or brackets. Supports parens () or brackets []
            const ipMatch = header.match(/(?:\[|\()(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?:\]|\))/);

            if (datePart) {
                const date = new Date(datePart);
                if (!isNaN(date.getTime())) {
                    hops.push({
                        from: fromMatch ? fromMatch[1] : 'unknown',
                        by: byMatch ? byMatch[1] : 'unknown',
                        time: date.toISOString(),
                        timestamp: date.getTime(),
                        delay: 0,
                        ip: ipMatch ? ipMatch[1] : undefined
                    });
                }
            }
        });

        // Sort by time (oldest first)
        hops.sort((a, b) => a.timestamp - b.timestamp);

        // Calculate delays and annotations
        for (let i = 0; i < hops.length; i++) { // Changed loop to start at 0 to annotate all
            const hop = hops[i];
            hop.annotations = [];

            // Delay Check (skip first hop)
            if (i > 0) {
                const diff = (hop.timestamp - hops[i - 1].timestamp) / 1000;
                hop.delay = diff > 0 ? diff : 0;

                if (hop.delay > 600) { // 10 minutes
                    hop.annotations.push("Long Delay (>10m)");
                }
            }

            // IP Check (RFC1918)
            if (hop.ip) {
                // Simple regex for 10.x.x.x, 192.168.x.x, 172.16-31.x.x
                if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hop.ip)) {
                    hop.annotations.push("Internal IP");
                }
            }

            // Rapid Handoff
            if (i > 0 && hop.delay < 1) {
                // Not necessarily bad, but good context
            }
        }

        return hops;
    }

    private static calculateVerdict(headers: any, auth: AnalysisResult['auth'], hops: EmailHop[]) {
        let score = 50; // Neutral start
        const anomalies: string[] = [];
        const factors: { label: string; score: number }[] = [];

        const addFactor = (label: string, points: number) => {
            score += points;
            factors.push({ label, score: points });
        };

        addFactor("Base Score", 50);

        // 1. Auth Checks
        if (auth.dmarc.status === 'pass') {
            addFactor("DMARC Passed", 20);
        } else if (auth.dmarc.status === 'fail') {
            addFactor("DMARC Failed", -30);
            anomalies.push('DMARC Validation Failed');
        }

        if (auth.spf.status === 'pass') {
            addFactor("SPF Passed", 10);
        } else if (auth.spf.status === 'fail' || auth.spf.status === 'softfail') {
            addFactor("SPF Failed/Softfail", -10);
            anomalies.push('SPF Validation Failed');
        }

        if (auth.dkim.status === 'pass') {
            addFactor("DKIM Passed", 10);
        } else if (auth.dkim.status === 'fail') {
            addFactor("DKIM Failed", -10);
            anomalies.push('DKIM Validation Failed');
        }

        // 2. Mismatch Checks
        const from = headers['From'];
        const returnPath = headers['Return-Path'];

        if (typeof from === 'string' && typeof returnPath === 'string') {
            const fromDomain = from.match(/@([\w.-]+)/)?.[1];
            const rpDomain = returnPath.match(/@([\w.-]+)/)?.[1];

            if (fromDomain && rpDomain) {
                if (!rpDomain.includes(fromDomain) && !fromDomain.includes(rpDomain)) {
                    // Common in mailing lists, but worth noting if no other auth
                    if (auth.dmarc.status !== 'pass') {
                        addFactor("From/Return-Path Mismatch", -5);
                        anomalies.push('From/Return-Path Domain Mismatch');
                    }
                } else {
                    addFactor("Domains Aligned", 5);
                }
            }
        }

        // 3. Hop Analysis
        if (hops.length === 0) {
            addFactor("No Receive Headers", -20);
            anomalies.push('No Receive headers found (missing hops)');
        } else {
            // Simple heuristic: if we have hops, it's at least looked at by servers
            addFactor("Delivery Path Traceable", 5);
        }

        // Clamp score
        score = Math.max(0, Math.min(100, score));

        // 4. Verdict Logic
        let verdict: AnalysisResult['verdict'] = 'neutral';
        if (score >= 70) verdict = 'likely_legit';
        else if (score <= 30) verdict = 'high_risk';
        else verdict = 'suspicious';

        return { verdict, score, anomalies, scoreFactors: factors };
    }

    private static extractArtifacts(headers: any, hops: EmailHop[]): AnalysisResult['artifacts'] {
        const artifacts: AnalysisResult['artifacts'] = [];
        const seen = new Set();
        const ipRegex = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})|([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])/g;

        // Helper to add artifact
        const add = (type: string, value: string, label?: string) => {
            if (value && !seen.has(value)) {
                // Filter out obviously invalid IPs (like versions 1.0.0.0 if caught) or loopback
                if (type === 'ip' && (value === '127.0.0.1' || value.startsWith('0.'))) return;
                artifacts.push({ type, value, label });
                seen.add(value);
            }
        };

        // 1. Extract IPs from Hops (already parsed)
        hops.forEach(hop => {
            if (hop.ip) add('ip', hop.ip, `Hop: ${hop.from}`);
        });

        // 2. Extract IPs from Auth Headers & X-Headers
        // We grep specifically for "sender ip", "client-ip", "originating-ip" patterns or just scan specific headers
        const interestKeys = ['Authentication-Results', 'Arc-Authentication-Results', 'Received-SPF', 'X-Originating-IP', 'X-Sender-IP', 'X-Client-IP'];
        interestKeys.forEach(key => {
            const foundKey = Object.keys(headers).find(k => k.toLowerCase() === key.toLowerCase());
            if (foundKey) {
                const val = headers[foundKey];
                const strVal = Array.isArray(val) ? val.join(' ') : val;

                // Find all IPs
                const matches = strVal.match(ipRegex);
                if (matches) {
                    matches.forEach((ip: string) => add('ip', ip, `${key} Artifact`));
                }
            }
        });

        // Extract Message-ID
        if (headers['Message-ID']) {
            add('message-id', headers['Message-ID'].replace(/[<>]/g, ''), 'Message-ID');
        }

        // Extract Return-Path
        if (headers['Return-Path']) {
            add('email', headers['Return-Path'].replace(/[<>]/g, ''), 'Return-Path');
        }

        // Extract From/To/Reply-To
        ['From', 'To', 'Reply-To'].forEach(key => {
            if (headers[key]) {
                const emailMatch = headers[key].match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
                if (emailMatch) add('email', emailMatch[1], key);
            }
        });

        return artifacts;
    }
}
