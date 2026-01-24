import { AnalysisResult } from "../HeaderParser";
import { NormalizedSignals, AttachmentSignal } from "./types";

export class SignalNormalizer {
    static normalize(
        headerResult: AnalysisResult,
        emailBody: any | null, // PostalMime object
        options: {
            checkBody: boolean;
            checkAttachments: boolean;
        }
    ): NormalizedSignals {

        // 1. Normalize Auth Signals
        const spf = this.mapAuthStatus(headerResult.auth.spf.status);
        const dkim = this.mapAuthStatus(headerResult.auth.dkim.status);
        const dmarc = this.mapAuthStatus(headerResult.auth.dmarc.status);
        const arc = headerResult.arc ? this.mapAuthStatus(headerResult.arc.status) : "none";

        // Extract DMARC Policy
        let dmarcPolicy: NormalizedSignals['dmarcPolicy'] = "unknown";
        const dmarcDetails = headerResult.auth.dmarc.details.toLowerCase();
        if (dmarcDetails.includes("p=reject")) dmarcPolicy = "reject";
        else if (dmarcDetails.includes("p=quarantine")) dmarcPolicy = "quarantine";
        else if (dmarcDetails.includes("p=none")) dmarcPolicy = "none";

        // 2. Normalize Routing
        let timestampsValid = true;
        for (let i = 0; i < headerResult.hops.length - 1; i++) {
            const newer = headerResult.hops[i].timestamp;
            const older = headerResult.hops[i + 1].timestamp;
            if (newer < older - 2000) {
                timestampsValid = false;
                break;
            }
        }

        // 3. Body Signals (if enabled)
        let bodySignals = {
            hasUrgency: false,
            hasCredentialHarvesting: false,
            hasHtmlForm: false,
            suspiciousLinks: false,
            rawIpLinks: false,
            extractedUrls: [] as string[],
            homoglyphDetected: false,
            brandInBody: null as string | null
        };

        if (options.checkBody && emailBody) {
            const text = (emailBody.text || "") + (emailBody.html || "");
            bodySignals = this.extractBodyFeatures(text, emailBody.html || "");
        }

        // 4. Attachment Signals
        const attachments: AttachmentSignal[] = [];
        if (options.checkAttachments && emailBody && emailBody.attachments) {
            emailBody.attachments.forEach((att: any) => {
                const ext = att.filename.split('.').pop()?.toLowerCase() || "";
                const filename = att.filename.toLowerCase();

                // Check for double extension
                const parts = filename.split('.');
                const hasDoubleExtension = parts.length > 2 &&
                    ['exe', 'scr', 'bat', 'com', 'pif', 'js', 'vbs'].includes(parts[parts.length - 1]) &&
                    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'png'].includes(parts[parts.length - 2]);

                attachments.push({
                    filename: att.filename,
                    extension: ext,
                    size: att.size,
                    hasDoubleExtension,
                    isExecutable: ['exe', 'scr', 'bat', 'cmd', 'com', 'pif'].includes(ext),
                    isMacroEnabled: ['docm', 'xlsm', 'pptm'].includes(ext),
                    isScript: ['js', 'vbs', 'ps1', 'jar', 'py', 'sh'].includes(ext)
                });
            });
        }

        // 5. Cross-Context Prep
        const fromArray = headerResult.headers['From'] ? (Array.isArray(headerResult.headers['From']) ? headerResult.headers['From'][0] : headerResult.headers['From']) : "";
        const fromMatch = fromArray.match(/^(?:"?([^"<]+)"?\s)?(?:<?(.+@[^>]+)>?)$/);
        const fromDisplayName = fromMatch ? (fromMatch[1] || "").trim() : "";
        const fromEmail = fromMatch ? (fromMatch[2] || fromArray).trim() : fromArray;
        const fromDomain = fromEmail.split('@')[1] || "";

        // Reply-To
        const replyTo = headerResult.headers['Reply-To'];
        let replyToDomain = null;
        if (replyTo) {
            const rt = Array.isArray(replyTo) ? replyTo[0] : replyTo;
            const rtMatch = rt.match(/@([^>]+)/);
            if (rtMatch) replyToDomain = rtMatch[1].trim();
        }

        return {
            // Auth
            spfResult: spf,
            dkimResult: dkim,
            dmarcResult: dmarc,
            dmarcPolicy,
            arcResult: arc,

            authenticationResultsPresent: !!headerResult.auth.spf.details || !!headerResult.auth.dkim.details,
            multipleAuthHeaders: Array.isArray(headerResult.headers['Authentication-Results']) && headerResult.headers['Authentication-Results'].length > 1,
            authservId: this.extractAuthServId(headerResult.headers['Authentication-Results']),

            // Routing
            receivedHopCount: headerResult.hops.length,
            hasReceivedHeaders: headerResult.hops.length > 0,
            headerInjectionDetected: false,
            receivedTimestampsValid: timestampsValid,

            // Sender
            fromDomain: fromDomain.toLowerCase(),
            fromDisplayName,
            replyToDomain: replyToDomain ? replyToDomain.toLowerCase() : null,
            returnPathDomain: (headerResult.headers['Return-Path'] || "").replace(/[<>]/g, '').split('@')[1] || "",

            // Body
            bodyAnalysisEnabled: options.checkBody,
            ...bodySignals,

            // Attachments
            attachmentAnalysisEnabled: options.checkAttachments,
            attachments,

            // Cross Context
            brandInFrom: null,
            isFreeEmailProvider: false,
            isHighValueRole: false
        };
    }

    private static mapAuthStatus(status: string): any {
        const valid = ["pass", "fail", "softfail", "none", "neutral", "temperror", "permerror"];
        return valid.includes(status) ? status : "none";
    }

    private static extractAuthServId(header: string | string[]): string | null {
        if (!header) return null;
        const h = Array.isArray(header) ? header[0] : header;
        const match = h.match(/^([^;]+)/);
        return match ? match[1].trim() : null;
    }

    private static extractBodyFeatures(text: string, html: string) {
        const t = text.toLowerCase();

        // NLP Regex
        const urgency = /\b(immediately|urgent|24 hours|suspend|unauthorized|terminate|lock|verify)\b/i;
        const credential = /\b(password|credential|login|sign in|verify account|update security)\b/i;

        // HTML Forms
        const hasForm = /<form|<input[^>]*type=["']?password["']?|action=["']?/i.test(html);

        // Links
        const urlRegex = /https?:\/\/[^\s<>"']+/g;
        const urls = (text.match(urlRegex) || []);
        // Basic IP check: http://1.2.3.4
        const ipLink = urls.some(u => /https?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?:\/|$)/.test(u));

        return {
            hasUrgency: urgency.test(t),
            hasCredentialHarvesting: credential.test(t),
            hasHtmlForm: hasForm,
            suspiciousLinks: false,
            rawIpLinks: ipLink,
            extractedUrls: urls,
            homoglyphDetected: false,
            brandInBody: null
        };
    }
}
