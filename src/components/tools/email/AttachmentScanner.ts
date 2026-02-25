import type { Attachment } from "postal-mime";

export interface AttachmentMeta {
    filename: string;
    mimeType: string;
    size: number;
    riskScore: number;
    warnings: string[];
}

export class AttachmentScanner {
    static analyze(attachments: Attachment[]): AttachmentMeta[] {
        return attachments.map(att => {
            const contentLength =
                typeof att.content === "string" ? att.content.length : att.content.byteLength;
            const meta: AttachmentMeta = {
                filename: att.filename || 'unknown',
                mimeType: att.mimeType || 'application/octet-stream',
                size: contentLength,
                riskScore: 0,
                warnings: []
            };

            const ext = meta.filename.split('.').pop()?.toLowerCase() || '';
            const dangerousExts = ['exe', 'bat', 'scr', 'vbs', 'js', 'cmd', 'iso', 'img', 'cab'];
            const suspiciousExts = ['zip', 'rar', '7z', 'docm', 'xlsm'];

            // Double extension check (e.g., invoice.pdf.exe)
            if (meta.filename.split('.').length > 2) {
                const secondLast = meta.filename.split('.').reverse()[1].toLowerCase();
                const commonDocs = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'];
                if (commonDocs.includes(secondLast) && dangerousExts.includes(ext)) {
                    meta.warnings.push(`Double extension detected (${secondLast}.${ext})`);
                    meta.riskScore += 50;
                }
            }

            if (dangerousExts.includes(ext)) {
                meta.warnings.push(`Dangerous file extension: .${ext}`);
                meta.riskScore += 40;
            } else if (suspiciousExts.includes(ext)) {
                meta.warnings.push(`Suspicious container/macro extension: .${ext}`);
                meta.riskScore += 20;
            }

            return meta;
        });
    }
}
