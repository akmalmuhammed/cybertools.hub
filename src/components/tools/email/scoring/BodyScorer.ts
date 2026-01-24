import { NormalizedSignals, ScoreComponent } from "./types";

export class BodyScorer {
    static score(signals: NormalizedSignals): ScoreComponent {
        if (!signals.bodyAnalysisEnabled) {
            return { score: 100, penalties: [] };
        }

        let score = 100;
        const penalties = [];

        if (signals.hasUrgency) {
            score -= 10;
            penalties.push({ reason: "Urgency Language Detected", value: -10, source: 'body' as const });
        }

        if (signals.hasCredentialHarvesting) {
            score -= 30;
            penalties.push({ reason: "Credential Harvesting Keywords", value: -30, critical: true, source: 'body' as const });
        }

        if (signals.hasHtmlForm) {
            score -= 40;
            penalties.push({ reason: "HTML Form in Body", value: -40, critical: true, source: 'body' as const });
        }

        if (signals.rawIpLinks) {
            score -= 40;
            penalties.push({ reason: "Raw IP Address Link", value: -40, source: 'body' as const });
        }

        if (signals.homoglyphDetected) {
            score -= 60;
            penalties.push({ reason: "Homoglyph/Confusable Characters", value: -60, critical: true, source: 'body' as const });
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            penalties
        };
    }
}
