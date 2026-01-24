import { diffChars, Change } from 'diff'

export interface DiffResult {
    value: string
    added?: boolean
    removed?: boolean
}

export function diffText(text1: string, text2: string): Change[] {
    return diffChars(text1, text2)
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

export function countCharacters(text: string): number {
    return text.length
}

export function removeWhitespace(text: string): string {
    return text.replace(/\s/g, '')
}

export function caseTransform(text: string, type: 'upper' | 'lower' | 'title' | 'camel' | 'snake' | 'kebab'): string {
    switch (type) {
        case 'upper': return text.toUpperCase();
        case 'lower': return text.toLowerCase();
        case 'title': return text.replace(/\w\S*/g, (w) => (w.replace(/\w/, (c) => c.toUpperCase())));
        case 'camel': return text.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
            return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
        case 'snake': return text.replace(/\s+/g, '_').toLowerCase();
        case 'kebab': return text.replace(/\s+/g, '-').toLowerCase();
        default: return text;
    }
}
