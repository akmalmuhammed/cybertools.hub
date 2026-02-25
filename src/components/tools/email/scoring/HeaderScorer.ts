import { NormalizedSignals, ScoreComponent } from "./types.js";
import { TRUSTED_MAIL_SERVERS } from "./Config.js";

export class HeaderScorer {
    static score(signals: NormalizedSignals): ScoreComponent {
        let score = 100;
        const penalties = [];

        // DMARC
        if (signals.dmarcResult === "fail") {
            score -= 50;
            penalties.push({ reason: "DMARC Fail", value: -50, critical: true, source: 'header' as const });
        } else if (signals.dmarcResult === "pass") {
            if (signals.dmarcPolicy === "quarantine") {
                score -= 5;
                penalties.push({ reason: "DMARC Policy is Weak (Quarantine)", value: -5, source: 'header' as const });
            } else if (signals.dmarcPolicy === "none") {
                score -= 15;
                penalties.push({ reason: "DMARC Policy is Monitoring Only (None)", value: -15, source: 'header' as const });
            }
        } else {
            score -= 15;
            penalties.push({ reason: "No DMARC Record Found", value: -15, source: 'header' as const });
        }

        // SPF
        if (signals.spfResult === "fail") {
            score -= 20;
            penalties.push({ reason: "SPF Fail", value: -20, source: 'header' as const });
        } else if (signals.spfResult === "softfail") {
            score -= 5;
            penalties.push({ reason: "SPF Softfail", value: -5, source: 'header' as const });
        }

        // DKIM
        if (signals.dkimResult === "fail") {
            score -= 20;
            penalties.push({ reason: "DKIM Fail", value: -20, source: 'header' as const });
        }

        // ARC OVERRIDE
        if (signals.arcResult === "pass") {
            const spfPenalty = penalties.find(p => p.reason.includes("SPF"));
            const dkimPenalty = penalties.find(p => p.reason.includes("DKIM"));

            if (spfPenalty || dkimPenalty) {
                const refund = Math.abs((spfPenalty?.value || 0)) + Math.abs((dkimPenalty?.value || 0));
                score += refund;
                penalties.push({
                    reason: "ARC Override: Forwarded message validated",
                    value: refund,
                    warning: false,
                    source: 'header' as const
                });
            }
        } else if (signals.arcResult === "fail") {
            score -= 20;
            penalties.push({ reason: "ARC Chain Broken", value: -20, source: 'header' as const });
        }

        // ROUTING
        if (!signals.hasReceivedHeaders) {
            score -= 40;
            penalties.push({ reason: "Missing Received Headers", value: -40, source: 'header' as const });
        } else if (signals.receivedHopCount === 1) {
            score -= 10;
            penalties.push({ reason: "Suspicious Routing (Only 1 Hop)", value: -10, source: 'header' as const });
        }

        if (!signals.receivedTimestampsValid) {
            score -= 20;
            penalties.push({ reason: "Timestamp Anomaly (Out of Order)", value: -20, source: 'header' as const });
        }

        // METADATA
        if (signals.multipleAuthHeaders) {
            score -= 20;
            penalties.push({ reason: "Duplicate Authentication-Results", value: -20, source: 'header' as const });
        }

        if (signals.authservId && !this.isTrustedAuthServ(signals.authservId)) {
            score -= 60;
            penalties.push({ reason: `Untrusted AuthServ-ID: ${signals.authservId}`, value: -60, critical: true, source: 'header' as const });
        }

        return {
            score: Math.max(0, Math.min(100, score)),
            penalties
        };
    }

    private static isTrustedAuthServ(id: string): boolean {
        const lowerId = id.toLowerCase();
        return TRUSTED_MAIL_SERVERS.some(trusted => lowerId.includes(trusted));
    }
}
