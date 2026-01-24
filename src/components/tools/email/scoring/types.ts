export interface AttachmentSignal {
    filename: string;
    extension: string;
    size: number;
    hasDoubleExtension: boolean;          // e.g., invoice.pdf.exe
    isExecutable: boolean;                // .exe, .scr, .bat, .cmd
    isMacroEnabled: boolean;              // .docm, .xlsm, .pptm
    isScript: boolean;                    // .js, .ps1, .vbs, .jar
}

export interface NormalizedSignals {
    spfResult: "pass" | "fail" | "softfail" | "none" | "neutral" | "temperror" | "permerror";
    dkimResult: "pass" | "fail" | "none" | "neutral" | "temperror" | "permerror";
    dmarcResult: "pass" | "fail" | "none" | "temperror" | "permerror";
    dmarcPolicy: "reject" | "quarantine" | "none" | "unknown";
    arcResult: "pass" | "fail" | "none" | "neutral" | "temperror" | "permerror";

    authenticationResultsPresent: boolean;
    multipleAuthHeaders: boolean;
    authservId: string | null;

    receivedHopCount: number;
    hasReceivedHeaders: boolean;
    headerInjectionDetected: boolean;
    receivedTimestampsValid: boolean;

    fromDomain: string;
    fromDisplayName: string;
    replyToDomain: string | null;
    returnPathDomain: string;

    bodyAnalysisEnabled: boolean;
    hasUrgency: boolean;
    hasCredentialHarvesting: boolean;
    hasHtmlForm: boolean;
    suspiciousLinks: boolean;
    rawIpLinks: boolean;
    extractedUrls: string[];
    homoglyphDetected: boolean;
    brandInBody: string | null;

    attachmentAnalysisEnabled: boolean;
    attachments: AttachmentSignal[];

    brandInFrom: string | null;
    isFreeEmailProvider: boolean;
    isHighValueRole: boolean;
}

export interface ValidationPenalty {
    reason: string;
    value: number; // Negative number
    critical?: boolean;
    warning?: boolean;
    source?: 'header' | 'body' | 'cross' | 'attachment';
}

export interface ScoreComponent {
    score: number;
    penalties: ValidationPenalty[];
}

export interface ScoringResult {
    trust: {
        score: number;
        penalties: ValidationPenalty[];
        components: {
            header: number;
            body: number;
            cross: number;
        };
    };
    confidence: {
        score: number;
        level: "High" | "Medium" | "Low";
        factors: { reason: string; value: number | string }[];
    };
    verdict: {
        verdict: "Likely Legitimate" | "Suspicious" | "High Risk" | "Unknown";
        reason: string;
        overridden: boolean;
    };
}
