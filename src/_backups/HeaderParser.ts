import PostalMime from 'postal-mime';

export interface EmailHop {
    from: string;
    by: string;
    with?: string;
    time: string; // ISO string
    timestamp: number;
    delay: number; // Seconds since previous hop
    ip?: string;
}

export interface AuthStatus {
    status: 'pass' | 'fail' | 'neutral' | 'none' | 'softfail' | 'policy';
    details: string;
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
        // PostalMime processes full messages best. If the user pastes JUST headers (no body separator), 
        // it might fail or put everything in preamble. We typically want to trust manual parsing for 
        // the standard "Key: Value" structure if we are just analyzing headers.

        const lines = rawInput.split(/\r?\n/);
        let currentKey = "";

        lines.forEach(line => {
            // Standard header line: "Key: Value"
            const match = line.match(/^([a-zA-Z0-9-]+):\s*(.*)$/);
            if (match) {
                currentKey = match[1]; // Case-sensitive store
                let val = match[2];
                val = this.decodeHeaderValue(val); // Decode RFC 2047

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
                // We don't decode continuation lines immediately because they might be split in the middle of an encoded word
                // Ideally we accumulate then decode, but for simple triage, decoding each chunk if it looks isolated is safer
                // effectively we just append raw and decode the result later? 
                // Postal-mime handles this complexity. For manual fallback, let's just append raw and try to decode extracting artifacts later?
                // Or better: Append raw to map, then run a pass to decode all string values in map.

                if (Array.isArray(headerMap[currentKey])) {
                    const arr = headerMap[currentKey];
                    arr[arr.length - 1] += " " + val;
                } else {
                    headerMap[currentKey] += " " + val;
                }
            }
        });

        // Post-process map to decode all values (handles folded encoded words)
        Object.keys(headerMap).forEach(key => {
            const val = headerMap[key];
            if (typeof val === 'string') {
                headerMap[key] = this.decodeHeaderValue(val);
            } else if (Array.isArray(val)) {
                headerMap[key] = val.map((v: any) => typeof v === 'string' ? this.decodeHeaderValue(v) : v);
            }
        });

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

        return {
            verdict,
            score,
            headers: headerMap,
            rawHeaders: rawInput,
            auth,
            hops,
            artifacts,
            anomalies
        };
    }

    private static decodeHeaderValue(text: string): string {
        if (!text) return text;
        // Regex for RFC 2047 encoded words: =?charset?encoding?encoded_text?=
        return text.replace(/=\?([\w-]+)\?([BbQq])\?([+/a-zA-Z0-9=]+)\?=/g, (match, charset, encoding, data) => {
            try {
                if (encoding.toUpperCase() === 'B') {
                    // Base64
                    // Node/Browser usually has atob. 
                    if (typeof atob === 'function') {
                        // Decode UTF-8 properly: escape -> decode -> unescape (deprecated but works) or TextDecoder
                        const binary = atob(data);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) {
                            bytes[i] = binary.charCodeAt(i);
                        }
                        const decoder = new TextDecoder(charset || 'utf-8');
                        return decoder.decode(bytes);
                    }
                    return match;
                } else if (encoding.toUpperCase() === 'Q') {
                    // Quoted-Printable (simplified)
                    return data.replace(/=([0-9A-F]{2})/g, (_: any, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/_/g, ' ');
                }
            } catch (e) {
                return match; // Return raw if decode fails
            }
            return match;
        });
    }


    private static analyzeAuth(authHeader: string | string[]): AnalysisResult['auth'] {
        // Default state
        const result: AnalysisResult['auth'] = {
            spf: { status: 'none', details: 'No SPF check found' },
            dkim: { status: 'none', details: 'No DKIM check found' },
            dmarc: { status: 'none', details: 'No DMARC check found' }
        };

        if (!authHeader) return result;

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

        // DKIM
        const dkimMatch = mainHeader.match(/dkim=(\w+)/i);
        if (dkimMatch) {
            result.dkim.status = dkimMatch[1].toLowerCase() as any;
            result.dkim.details = mainHeader.match(/dkim=[^;]+/)?.[0] || 'Found in headers';
        }

        // DMARC
        const dmarcMatch = mainHeader.match(/dmarc=(\w+)/i);
        if (dmarcMatch) {
            result.dmarc.status = dmarcMatch[1].toLowerCase() as any;
            result.dmarc.details = mainHeader.match(/dmarc=[^;]+/)?.[0] || 'Found in headers';
        }

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
            const ipMatch = header.match(/\[(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\]/);

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

        // Calculate delays
        for (let i = 1; i < hops.length; i++) {
            const diff = (hops[i].timestamp - hops[i - 1].timestamp) / 1000;
            hops[i].delay = diff > 0 ? diff : 0;
        }

        return hops;
    }

    private static calculateVerdict(headers: any, auth: AnalysisResult['auth'], hops: EmailHop[]) {
        let score = 50; // Neutral start
        const anomalies: string[] = [];

        // 1. Auth Checks
        if (auth.dmarc.status === 'fail') {
            score -= 30;
            anomalies.push('DMARC Validation Failed');
        } else if (auth.dmarc.status === 'pass') {
            score += 20;
        }

        if (auth.spf.status === 'fail' || auth.spf.status === 'softfail') {
            score -= 10;
            anomalies.push('SPF Validation Failed');
        }

        if (auth.dkim.status === 'fail') {
            score -= 10;
            anomalies.push('DKIM Validation Failed');
        }

        // 2. Mismatch Checks (Basic)
        // If From and Return-Path are completely different domains (ignoring subdomains for now)
        const from = headers['From'];
        const returnPath = headers['Return-Path'];

        if (typeof from === 'string' && typeof returnPath === 'string') {
            const fromDomain = from.match(/@([\w.-]+)/)?.[1];
            const rpDomain = returnPath.match(/@([\w.-]+)/)?.[1];
            if (fromDomain && rpDomain && !rpDomain.includes(fromDomain) && !fromDomain.includes(rpDomain)) {
                // Common in mailing lists, but worth noting if no other auth
                if (auth.dmarc.status !== 'pass') {
                    score -= 5;
                    anomalies.push('From/Return-Path Domain Mismatch');
                }
            }
        }



        // 3. Verdict
        let verdict: AnalysisResult['verdict'] = 'neutral';
        if (score >= 70) verdict = 'likely_legit';
        else if (score <= 30) verdict = 'high_risk';
        else verdict = 'suspicious';

        // Add anomaly if hops are empty
        if (hops.length === 0) {
            anomalies.push('No Receive headers found (missing hops)');
        }

        return { verdict, score, anomalies };
    }

    private static extractArtifacts(headers: any, hops: EmailHop[]): AnalysisResult['artifacts'] {
        const artifacts: AnalysisResult['artifacts'] = [];
        const seen = new Set();

        const add = (type: string, value: string, label?: string) => {
            if (value && !seen.has(value)) {
                artifacts.push({ type, value, label });
                seen.add(value);
            }
        };

        // Extract IPs from hops
        hops.forEach(hop => {
            if (hop.ip) add('ip', hop.ip, `Hop: ${hop.from}`);
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
