/**
 * Utility functions for advanced Base64 operations
 */

export type ContentType = 'json' | 'image' | 'text' | 'binary' | 'hex' | 'exe' | 'elf' | 'zip' | 'pdf' | 'audio' | 'video' | 'unknown';

export interface BinaryDetectionResult {
    type: ContentType;
    mime: string;
    ext: string;
    description: string;
}

export interface Base64Analysis {
    cleaned: string;
    original: string;
    wasFixed: boolean;
    issues: string[];
    contentType: ContentType;
    preview?: string; // e.g., JSON string or Data URL
}

// Map of magic bytes to file types
const MAGIC_BYTES: Record<string, BinaryDetectionResult> = {
    '4D5A': { type: 'exe', mime: 'application/x-msdownload', ext: 'exe', description: 'Windows Executable' },
    '7F454C46': { type: 'elf', mime: 'application/x-elf', ext: 'bin', description: 'Linux Executable (ELF)' },
    '504B0304': { type: 'zip', mime: 'application/zip', ext: 'zip', description: 'ZIP Archive / JAR / APK' },
    '25504446': { type: 'pdf', mime: 'application/pdf', ext: 'pdf', description: 'PDF Document' },
    '89504E47': { type: 'image', mime: 'image/png', ext: 'png', description: 'PNG Image' },
    '47494638': { type: 'image', mime: 'image/gif', ext: 'gif', description: 'GIF Image' },
    'FFD8FF': { type: 'image', mime: 'image/jpeg', ext: 'jpg', description: 'JPEG Image' },
    'CAFEBABE': { type: 'binary', mime: 'application/java-vm', ext: 'class', description: 'Java Class / Mach-O' },
    '1F8B': { type: 'zip', mime: 'application/gzip', ext: 'gz', description: 'GZIP Archive' },
    '424D': { type: 'image', mime: 'image/bmp', ext: 'bmp', description: 'Bitmap Image' },
    '494433': { type: 'audio', mime: 'audio/mpeg', ext: 'mp3', description: 'MP3 Audio' },
    '00000018': { type: 'video', mime: 'video/mp4', ext: 'mp4', description: 'MP4 Video' }, // ftypmp42
    '00000020': { type: 'video', mime: 'video/mp4', ext: 'mp4', description: 'MP4 Video' }, // ftypisom
};

/**
 * Converts Base64 string to Uint8Array safely
 */
export function base64ToBytes(base64: string): Uint8Array {
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    return array;
}

/**
 * Converts Uint8Array to Base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Detects binary file type from magic bytes
 */
export function detectBinaryType(bytes: Uint8Array): BinaryDetectionResult | null {
    if (bytes.length < 4) return null;

    const hex = toHex(bytes.slice(0, 8)).toUpperCase();

    // Check against magic map
    for (const [key, info] of Object.entries(MAGIC_BYTES)) {
        if (hex.startsWith(key)) {
            return info;
        }
    }

    return null;
}

/**
 * Heuristic to check if bytes are likely text (UTF-8/ASCII)
 */
export function isText(bytes: Uint8Array): boolean {
    // If it contains null bytes (except maybe very sparse) or lots of low control chars 
    // (excluding \t \r \n), it's binary.

    let controlChars = 0;
    const len = Math.min(bytes.length, 1000); // Check first 1KB

    for (let i = 0; i < len; i++) {
        const b = bytes[i];

        if (b === 0) return false; // Null byte is dead giveaway for binary (usually)

        // Allowed control chars: Tab (9), LF (10), CR (13)
        if ((b < 32) && (b !== 9 && b !== 10 && b !== 13)) {
            controlChars++;
        }
    }

    // Use a threshold. If > 10% valid control chars (like NUL or others), likely binary.
    // Actually, any non-whitespace control char usually means binary in this context.
    if (controlChars > 0) {
        // Tolerating very few? No, strict is better for switching to HEX view.
        // If it has even one weird control char, show Hex.
        return false;
    }

    return true;
}

/**
 * Heuristically determines content type of decoded string
 */
export function detectContentType(decoded: string): ContentType {
    // Check for JSON
    try {
        const parsed = JSON.parse(decoded);
        if (typeof parsed === 'object' && parsed !== null) {
            return 'json';
        }
    } catch {
        // Non-JSON input should continue to binary/text detection.
    }

    // Convert the decoded "binary string" to Uint8Array for robust binary detection
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
    }

    // Check for specific binary types using magic bytes
    const binaryType = detectBinaryType(bytes);
    if (binaryType) {
        return binaryType.type;
    }

    // Heuristic for text vs. generic binary
    if (!isText(bytes)) {
        return 'binary';
    }

    // If it passed all binary checks and is considered text-like, it's text.
    return 'text';
}

/**
 * Cleans and fixes common Base64 issues
 */
export function cleanBase64(input: string): { cleaned: string, issues: string[] } {
    const issues: string[] = [];
    let cleaned = input.trim();

    // 1. Remove whitespace (newlines, spaces used in formatting)
    if (/\s/.test(cleaned)) {
        issues.push("Removed whitespace/newlines");
        cleaned = cleaned.replace(/\s+/g, '');
    }

    // 2. URL Safe replacements
    if (cleaned.includes('-') || cleaned.includes('_')) {
        issues.push("Converted URL-safe characters (-_ to +/)");
        cleaned = cleaned.replace(/-/g, '+').replace(/_/g, '/');
    }

    // 3. Padding
    if (cleaned.length % 4 !== 0) {
        const missing = 4 - (cleaned.length % 4);
        cleaned += '='.repeat(missing);
        issues.push(`Added ${missing} padding character(s)`);
    }

    // 4. Check for invalid chars remaining
    if (/[^A-Za-z0-9+/=]/.test(cleaned)) {
        const invalidCount = cleaned.match(/[^A-Za-z0-9+/=]/g)?.length || 0;
        issues.push(`Removed ${invalidCount} invalid character(s)`);
        cleaned = cleaned.replace(/[^A-Za-z0-9+/=]/g, '');

        // Re-pad if length changed
        if (cleaned.length % 4 !== 0) {
            const missing = 4 - (cleaned.length % 4);
            cleaned += '='.repeat(missing);
        }
    }

    return { cleaned, issues };
}

/**
 * Attempts to extract Base64 strings from a larger text blob
 */
export function extractBase64(text: string): string[] {
    // Improved Regex:
    // 1. Min length 16 to avoid short words.
    // 2. Looks for continuous blocks of Base64 chars.
    // 3. Handles optional padding at end.
    // 4. Global match.

    // This regex looks for [A-Za-z0-9+/] repeated 16+ times, 
    // optionally ending with = or ==.
    // It captures "lines" of base64 too if we strip whitespace first? 
    // Ideally we find blocks that *look* like base64.

    const pattern = /[A-Za-z0-9+/]{16,}={0,2}/g;
    const matches = text.match(pattern);
    if (!matches) return [];

    return matches.filter(m => m.length % 4 === 0 || m.endsWith('='));
}

/**
 * Converts Uint8Array (or string) to Hex representation
 */
export function toHex(input: string | Uint8Array): string {
    if (typeof input === 'string') {
        let hex = '';
        for (let i = 0; i < input.length; i++) {
            hex += input.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hex;
    } else {
        return Array.from(input)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

/**
 * Checks if a string is valid JSON
 */
export function formatJSON(str: string): string | null {
    try {
        const obj = JSON.parse(str);
        return JSON.stringify(obj, null, 2);
    } catch {
        return null;
    }
}
