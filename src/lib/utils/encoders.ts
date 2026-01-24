// Helper to support UTF-8 (Unicode) strings
function utf8_to_b64(str: string) {
    return btoa(unescape(encodeURIComponent(str)));
}

function b64_to_utf8(str: string) {
    return decodeURIComponent(escape(atob(str)));
}

export function encodeBase64(input: string): string {
    try {
        return utf8_to_b64(input)
    } catch (e) {
        throw new Error("Invalid input for Base64 encoding")
    }
}

export function decodeBase64(input: string): string {
    try {
        return b64_to_utf8(input)
    } catch (e) {
        throw new Error("Invalid Base64 string")
    }
}

export function encodeBase64Url(input: string): string {
    try {
        return utf8_to_b64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    } catch (e) {
        throw new Error("Invalid input for Base64 URL encoding")
    }
}

export function decodeBase64Url(input: string): string {
    try {
        let base64 = input.replace(/-/g, '+').replace(/_/g, '/')
        while (base64.length % 4) {
            base64 += '='
        }
        return b64_to_utf8(base64)
    } catch (e) {
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
    const doc = new DOMParser().parseFromString(input, 'text/html')
    return doc.documentElement.textContent || ''
}
