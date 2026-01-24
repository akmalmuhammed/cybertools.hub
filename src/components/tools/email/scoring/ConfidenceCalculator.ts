import { NormalizedSignals, ScoringResult } from "./types";
import { TRUSTED_MAIL_SERVERS } from "./Config";

export class ConfidenceCalculator {
    static calculate(signals: NormalizedSignals): ScoringResult['confidence'] {
        let confidence = 0;
        const factors = [];

        // ============ DATA COMPLETENESS ============
        // Does it have the "Big Three" auth headers?
        if (signals.spfResult !== "none" && signals.dkimResult !== "none" && signals.dmarcResult !== "none") {
            confidence += 30;
            factors.push({ reason: "Complete Authentication Headers", value: 30 });
        }

        if (signals.receivedHopCount > 2) {
            confidence += 20;
            factors.push({ reason: "Complete Routing Chain", value: 20 });
        }

        if (signals.bodyAnalysisEnabled) {
            confidence += 20;
            factors.push({ reason: "Body Content Analyzed", value: 20 });
        }

        if (signals.attachmentAnalysisEnabled && signals.attachments.length > 0) {
            confidence += 10;
            factors.push({ reason: "Attachments Parsed", value: 10 });
        }

        // ============ DATA QUALITY ============
        if (signals.arcResult !== "none") {
            confidence += 10;
            factors.push({ reason: "ARC Chain Present", value: 10 });
        }

        if (signals.authservId && TRUSTED_MAIL_SERVERS.some(t => signals.authservId?.includes(t))) {
            confidence += 15;
            factors.push({ reason: "Trusted Authentication Source", value: 15 });
        }

        if (!signals.headerInjectionDetected && signals.receivedTimestampsValid) {
            confidence += 5;
            factors.push({ reason: "No Parsing Anomalies", value: 5 });
        }

        // ============ PENALTIES/CAPS ============
        if (!signals.authenticationResultsPresent) {
            // Allow a cap
            if (confidence > 35) {
                factors.push({ reason: "Missing Authentication-Results (Confidence Capped)", value: "Cap @ 35" });
                confidence = 35;
            }
        }

        // Clamp
        confidence = Math.max(0, Math.min(100, confidence));

        return {
            score: confidence,
            factors,
            level: confidence >= 70 ? "High" : confidence >= 40 ? "Medium" : "Low"
        };
    }
}
