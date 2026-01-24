import { format, fromUnixTime, getUnixTime, parseISO } from 'date-fns'


export function unixToDate(timestamp: number): string {
    try {
        // Check if milliseconds (13 digits) or seconds (10 digits)
        const date = timestamp.toString().length === 13 ? new Date(timestamp) : fromUnixTime(timestamp)
        return format(date, "yyyy-MM-dd HH:mm:ss")
    } catch (e) {
        return "Invalid Timestamp"
    }
}

export function dateToUnix(date: string | Date): number {
    try {
        const d = typeof date === 'string' ? parseISO(date) : date
        return getUnixTime(d)
    } catch (e) {
        return 0
    }
}

export function getCurrentUnix(): number {
    return getUnixTime(new Date())
}

export function formatDate(date: Date | string, fmt: string = "yyyy-MM-dd HH:mm:ss"): string {
    try {
        const d = typeof date === 'string' ? parseISO(date) : date
        return format(d, fmt)
    } catch (e) {
        return "Invalid Date"
    }
}

// Basic timezone support using date-fns-tz if installed, or simplified
// I didn't install date-fns-tz. I'll stick to basic date-fns for now.
export function parseTimezone(date: Date, timezone: string): string {
    try {
        // Fallback to simpler method if toZonedTime is not available or if we want native behavior
        // Since I didn't install date-fns-tz explicitly in the prompt list 
        //(Wait, the prompt asked for "TimestampTool.tsx - Unix <-> Date with multiple timezones")
        // I should probably install date-fns-tz or just use Intl.DateTimeFormat
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        }).format(date)
    } catch (e) {
        return "Invalid Timezone"
    }
}
