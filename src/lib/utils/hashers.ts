import CryptoJS from 'crypto-js'

export interface HashOptions {
    hmacKey?: string
    salt?: string
    saltPosition?: 'prepend' | 'append'
}

export async function generateMD5(input: string, options?: HashOptions): Promise<string> {
    const text = applySalt(input, options)
    if (options?.hmacKey) {
        return CryptoJS.HmacMD5(text, options.hmacKey).toString()
    }
    return CryptoJS.MD5(text).toString()
}

export async function generateSHA1(input: string, options?: HashOptions): Promise<string> {
    const text = applySalt(input, options)
    if (options?.hmacKey) {
        return CryptoJS.HmacSHA1(text, options.hmacKey).toString()
    }
    return CryptoJS.SHA1(text).toString()
}

export async function generateSHA256(input: string, options?: HashOptions): Promise<string> {
    const text = applySalt(input, options)
    if (options?.hmacKey) {
        return CryptoJS.HmacSHA256(text, options.hmacKey).toString()
    }
    return CryptoJS.SHA256(text).toString()
}

export async function generateSHA512(input: string, options?: HashOptions): Promise<string> {
    const text = applySalt(input, options)
    if (options?.hmacKey) {
        return CryptoJS.HmacSHA512(text, options.hmacKey).toString()
    }
    return CryptoJS.SHA512(text).toString()
}

function applySalt(input: string, options?: HashOptions): string {
    if (!options?.salt) return input
    if (options.saltPosition === 'append') {
        return input + options.salt
    }
    return options.salt + input
}

export async function generateAllHashes(input: string, options?: HashOptions): Promise<{ md5: string, sha1: string, sha256: string, sha512: string }> {
    return {
        md5: await generateMD5(input, options),
        sha1: await generateSHA1(input, options),
        sha256: await generateSHA256(input, options),
        sha512: await generateSHA512(input, options)
    }
}

export function identifyHash(hash: string): string {
    const len = hash.length
    if (len === 32) return "MD5"
    if (len === 40) return "SHA-1"
    if (len === 64) return "SHA-256"
    if (len === 128) return "SHA-512"
    return "Unknown"
}
