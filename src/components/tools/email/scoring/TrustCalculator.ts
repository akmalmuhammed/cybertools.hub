import { NormalizedSignals, ScoreComponent, ScoringResult, ValidationPenalty } from "./types.js";

export class TrustCalculator {
    static calculate(
        headerResult: ScoreComponent,
        bodyResult: ScoreComponent,
        crossResult: ScoreComponent,
        attachmentResult: { totalPenalty: number; penalties: ValidationPenalty[] },
        signals: NormalizedSignals
    ): ScoringResult['trust'] {

        let finalScore = 0;
        const allPenalties = [
            ...headerResult.penalties,
            ...bodyResult.penalties,
            ...crossResult.penalties
        ];

        if (signals.bodyAnalysisEnabled) {
            finalScore =
                (headerResult.score * 0.55) +
                (bodyResult.score * 0.35) +
                (crossResult.score * 0.10);
        } else {
            finalScore =
                (headerResult.score * 0.85) +
                (crossResult.score * 0.15);

            allPenalties.push({
                reason: "Body Analysis Disabled (Limited Verdict)",
                value: 0,
                warning: true,
                source: 'body' as const // or generic
            });
        }

        if (attachmentResult.totalPenalty > 0) {
            finalScore -= attachmentResult.totalPenalty;
            allPenalties.push(...attachmentResult.penalties);
        }

        if (signals.bodyAnalysisEnabled && bodyResult.score < 40) {
            const cap = 45;
            if (finalScore > cap) {
                allPenalties.push({
                    reason: "Weak Link Rule: Dangerous Content Overrides Strong Headers",
                    value: -(finalScore - cap),
                    critical: true,
                    source: 'cross' as const
                });
                finalScore = cap;
            }
        }

        finalScore = Math.max(0, Math.min(100, finalScore));

        return {
            score: Math.round(finalScore),
            penalties: allPenalties,
            components: {
                header: headerResult.score,
                body: bodyResult.score,
                cross: crossResult.score
            }
        };
    }
}
