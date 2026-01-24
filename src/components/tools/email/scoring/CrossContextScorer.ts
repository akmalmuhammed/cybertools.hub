import { NormalizedSignals, ScoreComponent } from "./types";
import { FREE_PROVIDERS, HIGH_VALUE_ROLES } from "./Config";

export class CrossContextScorer {
    static score(signals: NormalizedSignals): ScoreComponent {
        let score = 100;
        const penalties = [];

        if (signals.replyToDomain && signals.replyToDomain !== signals.fromDomain) {
            const isFree = this.isFreeProvider(signals.replyToDomain);
            const isHighValue = this.isHighValueRole(signals.fromDisplayName);

            if (isFree && isHighValue && signals.hasUrgency) {
                score -= 40;
                penalties.push({ reason: "High Risk BEC Pattern (Exec + Free Reply-To + Urgency)", value: -40, critical: true, source: 'cross' as const });
            } else if (isFree && signals.hasUrgency) {
                score -= 20;
                penalties.push({ reason: "Suspicious Reply-To (Free Provider + Urgency)", value: -20, source: 'cross' as const });
            } else if (isFree) {
                score -= 10;
                penalties.push({ reason: "Reply-To uses Free Provider", value: -10, source: 'cross' as const });
            }
        }

        if (signals.brandInBody && signals.fromDomain) {
            if (!signals.fromDomain.includes(signals.brandInBody) && !signals.fromDisplayName.toLowerCase().includes(signals.brandInBody)) {
                if (signals.hasCredentialHarvesting || signals.hasUrgency) {
                    score -= 50;
                    penalties.push({ reason: `Brand Impersonation: Claims ${signals.brandInBody} but sent from ${signals.fromDomain}`, value: -50, critical: true, source: 'cross' as const });
                } else {
                    score -= 20;
                    penalties.push({ reason: "Brand Mismatch (Body vs Sender)", value: -20, source: 'cross' as const });
                }
            }
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            penalties
        };
    }

    private static isFreeProvider(domain: string): boolean {
        return FREE_PROVIDERS.includes(domain.toLowerCase());
    }

    private static isHighValueRole(name: string): boolean {
        const lower = name.toLowerCase();
        return HIGH_VALUE_ROLES.some(role => lower.includes(role));
    }
}
