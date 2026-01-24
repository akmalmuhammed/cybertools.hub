import { AnalysisResult } from "./HeaderParser";
import { PhishingAnalysisResult } from "./PhishingAnalyzer";

export interface Verdict {
    level: "Legitimate" | "Suspicious" | "Phishing";
    score: number;
    categories: {
        header: number;
        body: number;
        cross: number;
    };
    explanations: string[];
}

export class VerdictEngine {
    static calculate(header: AnalysisResult, phishing: PhishingAnalysisResult): Verdict {
        // 1. Header Score (0-100) -> Converted to weight 0.6
        // Current header score is 0-100.
        // We use the existing header.score as the base.
        const headerScoreRaw = header.score;

        // 2. Body Score (Calculation)
        // Start at 100 (Clean) and subtract penalties
        let bodyScoreRaw = 100;
        const bodyExplanations: string[] = [];

        if (phishing.body) {
            phishing.body.indicators.forEach(ind => {
                if (ind.type === 'urgency') bodyScoreRaw -= 10;
                if (ind.type === 'credential_prompt') bodyScoreRaw -= 20;
                if (ind.type === 'suspicious_link') bodyScoreRaw -= 20;
                if (ind.type === 'html_form') bodyScoreRaw -= 30;
                bodyExplanations.push(`Body: ${ind.description}`);
            });
            phishing.body.urls.forEach(u => {
                if (u.suspicious) {
                    // Already handled by indicator usually, but double check
                }
            });
        }
        bodyScoreRaw = Math.max(0, bodyScoreRaw);

        // 3. Cross Context Penalties
        let crossPenaltyRaw = 0;
        phishing.crossContext.flags.forEach(flag => {
            if (flag.risk === 'high') crossPenaltyRaw += 30;
            if (flag.risk === 'medium') crossPenaltyRaw += 15;
            if (flag.risk === 'low') crossPenaltyRaw += 5;
            bodyExplanations.push(`Correlation: ${flag.description}`);
        });

        // 4. Attachment Penalties
        let attachPenalty = 0;
        phishing.attachments.forEach(att => {
            attachPenalty += att.riskScore;
            if (att.riskScore > 0) {
                bodyExplanations.push(`Attachment: ${att.filename} carries risk (${att.warnings.join(', ')})`);
            }
        });

        // WEIGHTED SCORING
        // Header: 60%
        // Body: 30% (If enabled, otherwise Header takes more weight? No, spec says "If bodyAnalysis disabled: Score = HeaderScore only")
        // Cross: 10% (Integrated into CrossScore really)

        let finalScore = 0;
        let categories = { header: 0, body: 0, cross: 0 };

        if (!phishing.body) {
            // Limited Mode
            finalScore = headerScoreRaw;
            categories.header = headerScoreRaw;
        } else {
            // Full Mode
            // Header Score (0-100) * 0.6
            const wHeader = headerScoreRaw * 0.6;

            // Body Score (0-100) * 0.3
            // Attachment penalties affect Body Score context conceptually (Payload)
            const wBody = Math.max(0, bodyScoreRaw - attachPenalty) * 0.3;

            // Cross Score
            // This is a bit tricky. Let's say Cross Score is 100 - penalties.
            const wCross = Math.max(0, 100 - crossPenaltyRaw) * 0.1;

            finalScore = wHeader + wBody + wCross;

            categories = {
                header: wHeader,
                body: wBody,
                cross: wCross
            };
        }

        // Logic for Level
        let level: Verdict['level'] = "Legitimate";
        if (finalScore < 50) level = "Phishing";
        else if (finalScore < 80) level = "Suspicious";

        // Critical Overrides
        // If critical known bad signal in headers
        if (header.verdict === 'high_risk') level = "Phishing";

        return {
            level,
            score: Math.round(finalScore),
            categories,
            explanations: [...header.anomalies, ...bodyExplanations]
        };
    }
}
