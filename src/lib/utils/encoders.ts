function ensureBase64Support() {
    if (typeof btoa !== "function" || typeof atob !== "function") {
        throw new Error("Base64 helpers are unavailable in this runtime");
    }
}

function utf8ToBase64(value: string): string {
    ensureBase64Support();
    const bytes = new TextEncoder().encode(value);
    const binary = Array.from(bytes)
        .map((byte) => String.fromCharCode(byte))
        .join("");
    return btoa(binary);
}

function base64ToUtf8(value: string): string {
    ensureBase64Support();
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeBase64(input: string): string {
    try {
        return utf8ToBase64(input)
    } catch {
        throw new Error("Invalid input for Base64 encoding")
    }
}

export function decodeBase64(input: string): string {
    try {
        return base64ToUtf8(input)
    } catch {
        throw new Error("Invalid Base64 string")
    }
}

export function encodeBase64Url(input: string): string {
    try {
        return utf8ToBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    } catch {
        throw new Error("Invalid input for Base64 URL encoding")
    }
}

export function decodeBase64Url(input: string): string {
    try {
        let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
        while (base64.length % 4) {
            base64 += '='
        }
        return base64ToUtf8(base64)
    } catch {
        throw new Error("Invalid Base64 URL string")
    }
}

export function splitLines(str: string, length = 76): string {
    return str.match(new RegExp(`.{1,${length}}`, 'g'))?.join('\n') || str;
}

export function encodeURL(input: string): string {
    return encodeURIComponent(input)
}

export function decodeURL(input: string): string {
    return decodeURIComponent(input)
}

export function encodeHTML(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

export function decodeHTML(input: string): string {
    if (typeof DOMParser !== "undefined") {
        const doc = new DOMParser().parseFromString(input, "text/html");
        return doc.documentElement.textContent || "";
    }

    // Fallback for non-DOM runtimes (test environment).
    return input
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&");
}
