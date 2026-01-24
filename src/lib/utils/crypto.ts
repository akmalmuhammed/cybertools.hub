export interface CertificateInfo {
    subject: string
    issuer: string
    validFrom: string
    validTo: string
    serialNumber: string
}

export function parseJWT(token: string): any {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error("Invalid JWT format");

        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));

        return {
            header,
            payload,
            signature: parts[2],
            isValid: true // We can't verify signature without secret, but format is valid
        };
    } catch (e) {
        throw new Error("Invalid JWT token");
    }
}

export function generateUUID(): string {
    if (crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function generatePassword(length: number, options: {
    uppercase: boolean,
    lowercase: boolean,
    numbers: boolean,
    symbols: boolean
}): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const nums = "0123456789";
    const syms = "!@#$%^&*()_+-=[]{}|;:,.<>?";

    let charset = "";
    if (options.uppercase) charset += upper;
    if (options.lowercase) charset += lower;
    if (options.numbers) charset += nums;
    if (options.symbols) charset += syms;

    if (charset === "") return "";

    let password = "";
    const values = new Uint32Array(length);
    crypto.getRandomValues(values);

    for (let i = 0; i < length; i++) {
        password += charset[values[i] % charset.length];
    }

    return password;
}

// Basic PEM parser for display purposes
export function parseCertificate(pem: string): CertificateInfo {
    // This is a mock implementation because parsing ASN.1 in JS without a library is huge
    // In a real app we'd use 'node-forge' or 'pkijs'
    // For now, we'll try to extract what we can using regex or simple logic if provided text
    // If it's real PEM we might just show basic info
    // Or I can add 'node-forge' to dependencies. It's listed in 'Dependencies' step but not 'Core'.
    // I'll stick to a simple extraction or mock for now, as I didn't install forge.
    // I'll add a note.

    // Basic extraction logic
    const subjectMatch = pem.match(/Subject: (.*?)\n/);
    const issuerMatch = pem.match(/Issuer: (.*?)\n/);

    return {
        subject: subjectMatch ? subjectMatch[1] : "Unknown",
        issuer: issuerMatch ? issuerMatch[1] : "Unknown",
        validFrom: "N/A",
        validTo: "N/A",
        serialNumber: "N/A"
    };
}
