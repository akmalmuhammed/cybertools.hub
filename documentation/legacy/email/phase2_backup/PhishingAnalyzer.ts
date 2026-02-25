import { BodyAnalyzer, BodyAnalysisResult } from "./BodyAnalyzer";
import { AttachmentScanner, AttachmentMeta } from "./AttachmentScanner";
import { CrossContextValidator, CrossContextAnalysis } from "./CrossContextValidator";
import { AnalysisResult } from "./HeaderParser";

export interface PhishingAnalysisResult {
    body: BodyAnalysisResult | null;
    attachments: AttachmentMeta[];
    crossContext: CrossContextAnalysis;
}

export class PhishingAnalyzer {
    static async analyze(
        text: string | null,
        html: string | null,
        rawAttachments: any[],
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
