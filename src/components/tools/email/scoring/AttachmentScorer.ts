import { NormalizedSignals, ValidationPenalty } from "./types.js";

export class AttachmentScorer {
    static score(signals: NormalizedSignals): { totalPenalty: number; penalties: ValidationPenalty[] } {
        if (!signals.attachmentAnalysisEnabled || signals.attachments.length === 0) {
            return { totalPenalty: 0, penalties: [] };
        }

        let totalPenalty = 0;
        const penalties: ValidationPenalty[] = [];

        for (const att of signals.attachments) {
            let basePenalty = 0;

            if (att.hasDoubleExtension) {
                basePenalty = 70;
                penalties.push({ reason: `Double Extension: ${att.filename}`, value: -70, critical: true, source: 'attachment' as const });
            } else if (att.isExecutable) {
                basePenalty = 60;
                penalties.push({ reason: `Executable Attachment: ${att.filename}`, value: -60, critical: true, source: 'attachment' as const });
            } else if (att.isScript) {
                basePenalty = 60;
                penalties.push({ reason: `Script Attachment: ${att.filename}`, value: -60, critical: true, source: 'attachment' as const });
            } else if (att.isMacroEnabled) {
                basePenalty = 30;
                penalties.push({ reason: `Macro Document: ${att.filename}`, value: -30, source: 'attachment' as const });
            }

            if (signals.hasUrgency && basePenalty > 0) {
                basePenalty += 20;
                penalties.push({ reason: "Urgency + Dangerous Attachment", value: -20, source: 'attachment' as const });
            }

            if (att.isMacroEnabled && signals.dmarcResult === "pass" && signals.dmarcPolicy === "reject") {
                const mitigation = 15;
                basePenalty -= mitigation;
                penalties.push({ reason: "Strong Auth Mitigated Macro Risk", value: +15, warning: false, source: 'attachment' as const });
            }

            totalPenalty += basePenalty;
        }

        return { totalPenalty, penalties };
    }
}
