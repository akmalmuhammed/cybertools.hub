import yaml from 'js-yaml'

export function formatJSON(input: string, spaces: number = 2): string {
    try {
        const obj = JSON.parse(input)
        return JSON.stringify(obj, null, spaces)
    } catch (e) {
        throw new Error("Invalid JSON")
    }
}

export function minifyJSON(input: string): string {
    try {
        const obj = JSON.parse(input)
        return JSON.stringify(obj)
    } catch (e) {
        throw new Error("Invalid JSON")
    }
}

export function validateJSON(input: string): { valid: boolean, error?: string } {
    try {
        JSON.parse(input)
        return { valid: true }
    } catch (e) {
        return { valid: false, error: (e as Error).message }
    }
}

// Simple XML formatter without heavy dependency if possible
// For now, basic indentation
export function formatXML(input: string): string {
    let formatted = '';
    let indent = '';
    const tab = '  ';
    input.split(/>\s*</).forEach(function (node) {
        if (node.match(/^\/\w/)) indent = indent.substring(tab.length);
        formatted += indent + '<' + node + '>\r\n';
        if (node.match(/^<?\w[^>]*[^\/]$/)) indent += tab;
    });
    return formatted.substring(1, formatted.length - 3);
}

export function formatYAML(input: string): string {
    // We can't really "format" YAML easily from string to string without parsing
    // So we parse then dump
    try {
        const obj = yaml.load(input);
        return yaml.dump(obj);
    } catch (e) {
        throw new Error("Invalid YAML")
    }
}

export function jsonToYaml(input: string): string {
    try {
        const obj = JSON.parse(input)
        return yaml.dump(obj)
    } catch (e) {
        throw new Error("Invalid JSON input")
    }
}
