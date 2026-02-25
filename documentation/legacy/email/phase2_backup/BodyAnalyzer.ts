export interface BodyAnalysisResult {
    urls: { url: string; label: string; suspicious: boolean }[];
    indicators: { type: 'urgency' | 'credential_prompt' | 'html_form' | 'unicode' | 'suspicious_link'; value: string; description: string }[];
    textContent: string | null;
    htmlContent: string | null;
}

export class BodyAnalyzer {
    static analyze(text: string | null, html: string | null): BodyAnalysisResult {
        const result: BodyAnalysisResult = {
            urls: [],
            indicators: [],
            textContent: text,
            htmlContent: html
        };

        const content = (text || "") + " " + (html || "");

        // 1. URL Extraction & Analysis
        const urlRegex = /https?:\/\/[^\s"']+/g;
        const foundUrls = new Set<string>();
        let match;
        while ((match = urlRegex.exec(content)) !== null) {
            foundUrls.add(match[0]);
        }

        foundUrls.forEach(url => {
            const isSuspicious = this.isSuspiciousUrl(url);
            result.urls.push({
                url,
                label: isSuspicious ? 'Suspicious URL' : 'Link',
                suspicious: isSuspicious
            });

            if (isSuspicious) {
                result.indicators.push({
                    type: 'suspicious_link',
                    value: url,
                    description: "URL contains IP address or suspicious TLD"
                });
            }
        });

        // 2. Urgency & Tone Analysis
        const urgencyKeywords = ['urgent', 'immediately', 'verify account', 'suspend', 'restricted', 'unauthorized access', '24 hours', 'action required'];
        urgencyKeywords.forEach(kw => {
            if (content.toLowerCase().includes(kw)) {
                result.indicators.push({
                    type: 'urgency',
                    value: kw,
                    description: "Language implies artificial urgency to provoke action"
                });
            }
        });

        // 3. Credential Harvesting Triggers
        const credentialKeywords = ['password', 'login', 'sign in', 'verify your identity', 'security update', 'click here to login'];
        const matches = credentialKeywords.filter(kw => content.toLowerCase().includes(kw));
        if (matches.length >= 2) {
            result.indicators.push({
                type: 'credential_prompt',
                value: matches.join(', '),
                description: "Multiple requests for credentials or login actions found"
            });
        }

        // 4. HTML Specifics
        if (html) {
            if (html.includes('<form') || html.includes('<input type="password"')) {
                result.indicators.push({
                    type: 'html_form',
                    value: 'HTML Form',
                    description: "Embedded HTML form detected (uncommon in legtimate emails)"
                });
            }
        }

        return result;
    }

    private static isSuspiciousUrl(url: string): boolean {
        // IP Address
        if (/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/.test(url)) return true;
        // Suspicious TLDs
        if (/\.(xyz|top|work|loan|gq|cf|ml)$/i.test(url)) return true;
        // Excessive Subdomains
        const domain = url.split('/')[2];
        if (domain && domain.split('.').length > 4) return true;

        return false;
    }
}
