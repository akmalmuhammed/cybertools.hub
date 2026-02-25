import { AnalysisResult } from "../HeaderParser.js";
import { NormalizedSignals, AttachmentSignal } from "./types.js";
import type { Attachment, Email } from "postal-mime";

export class SignalNormalizer {
    static normalize(
        headerResult: AnalysisResult,
        emailBody: Email | null,
        options: {
            checkBody: boolean;
            checkAttachments: boolean;
        }
    ): NormalizedSignals {

        // 1. Normalize Auth Signals
        const spf = this.mapSpfStatus(headerResult.auth.spf.status);
        const dkim = this.mapDkimStatus(headerResult.auth.dkim.status);
        const dmarc = this.mapDmarcStatus(headerResult.auth.dmarc.status);
        const arc = headerResult.arc ? this.mapArcStatus(headerResult.arc.status) : "none";

        // Extract DMARC Policy
        let dmarcPolicy: NormalizedSignals['dmarcPolicy'] = "unknown";
        const dmarcDetails = headerResult.auth.dmarc.details.toLowerCase();
        if (dmarcDetails.includes("p=reject")) dmarcPolicy = "reject";
        else if (dmarcDetails.includes("p=quarantine")) dmarcPolicy = "quarantine";
        else if (dmarcDetails.includes("p=none")) dmarcPolicy = "none";

        // 2. Normalize Routing
        let timestampsValid = true;
        for (let i = 1; i < headerResult.hops.length; i++) {
            const previous = headerResult.hops[i - 1].timestamp;
            const current = headerResult.hops[i].timestamp;
            // Small tolerance for parser/timezone quirks.
            if (current + 2000 < previous) {
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
            emailBody.attachments.forEach((att: Attachment) => {
                const attachmentFilename = att.filename || "unknown";
                const ext = attachmentFilename.split('.').pop()?.toLowerCase() || "";
                const filename = attachmentFilename.toLowerCase();
                const size =
                    typeof att.content === "string" ? att.content.length : att.content.byteLength;

                // Check for double extension
                const parts = filename.split('.');
                const hasDoubleExtension = parts.length > 2 &&
                    ['exe', 'scr', 'bat', 'com', 'pif', 'js', 'vbs'].includes(parts[parts.length - 1]) &&
                    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'jpg', 'png'].includes(parts[parts.length - 2]);

                attachments.push({
                    filename: attachmentFilename,
                    extension: ext,
                    size,
                    hasDoubleExtension,
                    isExecutable: ['exe', 'scr', 'bat', 'cmd', 'com', 'pif'].includes(ext),
                    isMacroEnabled: ['docm', 'xlsm', 'pptm'].includes(ext),
                    isScript: ['js', 'vbs', 'ps1', 'jar', 'py', 'sh'].includes(ext)
                });
            });
        }

        // 5. Cross-Context Prep
        const fromArray = this.getHeaderString(headerResult.headers, 'from');
        const fromMatch = fromArray.match(/^(?:"?([^"<]+)"?\s)?(?:<?(.+@[^>]+)>?)$/);
        const fromDisplayName = fromMatch ? (fromMatch[1] || "").trim() : "";
        const fromEmail = fromMatch ? (fromMatch[2] || fromArray).trim() : fromArray;
        const fromDomain = fromEmail.split('@')[1] || "";

        // Reply-To
        const replyTo = headerResult.headers['reply-to'];
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

            authenticationResultsPresent: !!this.getHeaderString(headerResult.headers, 'authentication-results'),
            multipleAuthHeaders: Array.isArray(headerResult.headers['authentication-results']) && headerResult.headers['authentication-results'].length > 1,
            authservId: this.extractAuthServId(headerResult.headers['authentication-results']),

            // Routing
            receivedHopCount: headerResult.hops.length,
            hasReceivedHeaders: headerResult.hops.length > 0,
            headerInjectionDetected: false,
            receivedTimestampsValid: timestampsValid,

            // Sender
            fromDomain: fromDomain.toLowerCase(),
            fromDisplayName,
            replyToDomain: replyToDomain ? replyToDomain.toLowerCase() : null,
            returnPathDomain: this.getHeaderString(headerResult.headers, 'Return-Path').replace(/[<>]/g, '').split('@')[1] || "",

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

    private static mapSpfStatus(status: string): NormalizedSignals['spfResult'] {
        const normalized = status.toLowerCase();
        const valid: NormalizedSignals['spfResult'][] = ["pass", "fail", "softfail", "none", "neutral", "temperror", "permerror"];
        return valid.includes(normalized as NormalizedSignals['spfResult']) ? (normalized as NormalizedSignals['spfResult']) : "none";
    }

    private static mapDkimStatus(status: string): NormalizedSignals['dkimResult'] {
        const normalized = status.toLowerCase();
        const valid: NormalizedSignals['dkimResult'][] = ["pass", "fail", "none", "neutral", "temperror", "permerror"];
        return valid.includes(normalized as NormalizedSignals['dkimResult']) ? (normalized as NormalizedSignals['dkimResult']) : "none";
    }

    private static mapDmarcStatus(status: string): NormalizedSignals['dmarcResult'] {
        const normalized = status.toLowerCase();
        const valid: NormalizedSignals['dmarcResult'][] = ["pass", "fail", "none", "temperror", "permerror"];
        return valid.includes(normalized as NormalizedSignals['dmarcResult']) ? (normalized as NormalizedSignals['dmarcResult']) : "none";
    }

    private static mapArcStatus(status: string): NormalizedSignals['arcResult'] {
        const normalized = status.toLowerCase();
        const valid: NormalizedSignals['arcResult'][] = ["pass", "fail", "none", "neutral", "temperror", "permerror"];
        return valid.includes(normalized as NormalizedSignals['arcResult']) ? (normalized as NormalizedSignals['arcResult']) : "none";
    }

    private static getHeaderString(headers: AnalysisResult['headers'], key: string): string {
        const value = headers[key];
        if (!value) return "";
        return Array.isArray(value) ? value[0] || "" : value;
    }

    private static extractAuthServId(header: string | string[] | undefined): string | null {
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
