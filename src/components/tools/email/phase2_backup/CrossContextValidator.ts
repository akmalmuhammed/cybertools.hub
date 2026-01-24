import { AnalysisResult } from "./HeaderParser";
import { BodyAnalysisResult } from "./BodyAnalyzer";

export interface CrossContextAnalysis {
    flags: { type: string; description: string; risk: 'low' | 'medium' | 'high' }[];
    scorePenalties: number;
}

export class CrossContextValidator {
    static validate(headers: AnalysisResult, body: BodyAnalysisResult | null): CrossContextAnalysis {
        const result: CrossContextAnalysis = {
            flags: [],
            scorePenalties: 0
        };

        if (!body) return result; // Cannot validate without body

        const from = headers.headers['From'] || '';
        const replyTo = headers.headers['Reply-To'];
        // Subject is unused
        const bodyText = (body.textContent || "") + (body.htmlContent || "");

        // 1. Sender Brand Mismatch
        // Checking if common high-value brands appear in body but NOT in sender domain
        const brands = [
            { name: 'Microsoft', domain: 'microsoft.com' },
            { name: 'Google', domain: 'google.com' },
            { name: 'Apple', domain: 'apple.com' },
            { name: 'PayPal', domain: 'paypal.com' },
            { name: 'Amazon', domain: 'amazon.com' },
            { name: 'Bank of America', domain: 'bankofamerica.com' },
            { name: 'Chase', domain: 'chase.com' }
        ];

        brands.forEach(brand => {
            if (bodyText.includes(brand.name) && !from.toLowerCase().includes(brand.domain)) {
                // Ignore if it's just incidental mentions? Tough to say. 
                // Let's look for "Verify" or "Account" + Brand to reduce false positives
                if (bodyText.includes('Verify') || bodyText.includes('Account') || bodyText.includes('Security')) {
                    result.flags.push({
                        type: 'brand_mismatch',
                        description: `Email content claims to be from ${brand.name}, but sender domain does not match ${brand.domain}.`,
                        risk: 'high'
                    });
                    result.scorePenalties += 20;
                }
            }
        });

        // 2. Reply-To Deception
        if (replyTo && from) {
            const fromDomain = from.match(/@([\w.-]+)/)?.[1];
            const replyDomain = replyTo.match(/@([\w.-]+)/)?.[1];

            // If sender is corporate/generic and reply-to is free email (gmail/yahoo)
            const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com'];
            if (fromDomain && !freeProviders.includes(fromDomain) &&
                replyDomain && freeProviders.includes(replyDomain)) {
                result.flags.push({
                    type: 'reply_to_deception',
                    description: `Professional Sender (${fromDomain}) asks for replies to a personal/free email (${replyDomain}).`,
                    risk: 'high'
                });
                result.scorePenalties += 25;
            }
        }

        // 3. Link Domain Inconsistency
        // If From is "bank.com" but Links go to "random-site.com"
        const fromDomain = from.match(/@([\w.-]+)/)?.[1];
        if (fromDomain) {
            // Check top URLs
            const suspiciousLink = body.urls.find(u => {
                const uDomain = u.url.split('/')[2];
                // Simple check: not inclusive
                return uDomain && !uDomain.includes(fromDomain) && !fromDomain.includes(uDomain) &&
                    // Whitelist some common infrastructure
                    !['linkedin.com', 'facebook.com', 'twitter.com', 'instagram.com'].some(d => uDomain.includes(d));
            });

            if (suspiciousLink) {
                // This is very noisy, so only flag if Urgency is also present
                if (body.indicators.some(i => i.type === 'urgency')) {
                    result.flags.push({
                        type: 'domain_link_mismatch',
                        description: `Sender matches '${fromDomain}' but links point to unrelated domains like '${suspiciousLink.url.split('/')[2]}' with urgent language.`,
                        risk: 'medium'
                    });
                    result.scorePenalties += 15;
                }
            }
        }

        return result;
    }
}
