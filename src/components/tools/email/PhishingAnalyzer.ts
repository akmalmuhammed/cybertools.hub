import { BodyAnalyzer, BodyAnalysisResult } from "./BodyAnalyzer.js";
import { AttachmentScanner, AttachmentMeta } from "./AttachmentScanner.js";
import { CrossContextValidator, CrossContextAnalysis } from "./CrossContextValidator.js";
import { AnalysisResult } from "./HeaderParser.js";
import type { Attachment } from "postal-mime";

export interface PhishingAnalysisResult {
    body: BodyAnalysisResult | null;
    attachments: AttachmentMeta[];
    crossContext: CrossContextAnalysis;
}

export class PhishingAnalyzer {
    static async analyze(
        text: string | null,
        html: string | null,
        rawAttachments: Attachment[],
        headerAnalysis: AnalysisResult,
        analyzeBody: boolean,
        analyzeAttachments: boolean
    ): Promise<PhishingAnalysisResult> {

        let bodyResult: BodyAnalysisResult | null = null;
        if (analyzeBody) {
            // Note: In a real app we might sanitise HTML here, but we are just analyzing strings
            bodyResult = BodyAnalyzer.analyze(text, html);
        }

        let attachResult: AttachmentMeta[] = [];
        if (analyzeAttachments) {
            attachResult = AttachmentScanner.analyze(rawAttachments);
        }

        let crossResult: CrossContextAnalysis = { flags: [], scorePenalties: 0 };
        if (analyzeBody && bodyResult) {
            crossResult = CrossContextValidator.validate(headerAnalysis, bodyResult);
        }

        return {
            body: bodyResult,
            attachments: attachResult,
            crossContext: crossResult
        };
    }
}
