import { SignalNormalizer } from "./SignalNormalizer.js";
import { HeaderScorer } from "./HeaderScorer.js";
import { BodyScorer } from "./BodyScorer.js";
import { CrossContextScorer } from "./CrossContextScorer.js";
import { AttachmentScorer } from "./AttachmentScorer.js";
import { TrustCalculator } from "./TrustCalculator.js";
import { ConfidenceCalculator } from "./ConfidenceCalculator.js";
import { NormalizedSignals, ScoringResult } from "./types.js";
import { AnalysisResult } from "../HeaderParser.js";
import type { Email } from "postal-mime";

export class AnalysisEngine {
    static analyze(
        headerResult: AnalysisResult,
        emailBody: Email | null,
        options: { checkBody: boolean; checkAttachments: boolean }
    ): { signals: NormalizedSignals; result: ScoringResult } {

        // 1. Normalize
        const signals = SignalNormalizer.normalize(headerResult, emailBody, options);

        // 2. Score Components
        const headerScore = HeaderScorer.score(signals);
        const bodyScore = BodyScorer.score(signals);
        const crossScore = CrossContextScorer.score(signals);
        const attachmentScore = AttachmentScorer.score(signals);

        // 3. Aggregate Trust
        const trustResult = TrustCalculator.calculate(
            headerScore,
            bodyScore,
            crossScore,
            attachmentScore,
            signals
        );

        // 4. Calculate Confidence
        const confidenceResult = ConfidenceCalculator.calculate(signals);

        // 5. Determine Final Verdict Label
        const verdict = this.determineVerdict(trustResult.score, confidenceResult.score, signals, trustResult);

        return {
            signals,
            result: {
                trust: trustResult,
                confidence: confidenceResult,
                verdict
            }
        };
    }

    private static determineVerdict(
        trustScore: number,
        confidenceScore: number,
        signals: NormalizedSignals,
        trustResult: ScoringResult['trust']
    ): ScoringResult['verdict'] {

        // ============ CRITICAL OVERRIDES ============

        // 1. DMARC Fail Enforcement
        if (signals.dmarcResult === "fail" && signals.dmarcPolicy === "reject") {
            return {
                verdict: "High Risk",
                reason: "Critical: DMARC Enforcement Failure (p=reject)",
                overridden: true
            };
        }

        // 2. Disguised Malware
        const hasCriticalAttachment = signals.attachments.some(att =>
            att.hasDoubleExtension ||
            (att.isExecutable && trustScore < 70)
        );
        if (hasCriticalAttachment) {
            return {
                verdict: "High Risk",
                reason: "Critical: Disguised Malware Detected",
                overridden: true
            };
        }

        // 3. Active Credential Theft
        if (signals.hasCredentialHarvesting &&
            (signals.hasHtmlForm || signals.suspiciousLinks) &&
            signals.homoglyphDetected) {
            return {
                verdict: "High Risk",
                reason: "Critical: Active Credential Phishing Detected",
                overridden: true
            };
        }

        // 4. Weak Link Rule (already handled in TrustCalculator via scoring cap, but label reinforcement)
        // If the Trust Score was capped by Weak Link, ensure High Risk
        if (trustResult.penalties.some(p => p.reason.includes("Weak Link"))) {
            return {
                verdict: "High Risk",
                reason: "High Risk: Dangerous Content Overrides Strong Headers",
                overridden: true
            };
        }

        // ============ SCORE-BASED VERDICT ============
        let label: ScoringResult['verdict']['verdict'] = "Unknown";
        let reason = "";

        if (trustScore >= 80) {
            label = "Likely Legitimate";
            reason = "Strong authentication and no significant threats found.";
        } else if (trustScore >= 50) {
            label = "Suspicious";
            reason = "Inconclusive signals or weak authentication.";
        } else {
            label = "High Risk";
            reason = "Significant threats or critical authentication failures.";
        }

        if (confidenceScore < 40) {
            reason += " (Low data confidence)";
        }

        return {
            verdict: label,
            reason,
            overridden: false
        };
    }
}
