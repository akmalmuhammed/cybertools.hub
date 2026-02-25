import { format, fromUnixTime, getUnixTime, parseISO } from 'date-fns'


export function unixToDate(timestamp: number): string {
    if (!Number.isFinite(timestamp)) {
        return "Invalid Timestamp"
    }

    try {
        const asNumber = Number(timestamp)
        const date =
            Math.abs(asNumber) >= 1_000_000_000_000
                ? new Date(asNumber)
                : fromUnixTime(asNumber)

        if (Number.isNaN(date.getTime())) {
            return "Invalid Timestamp"
        }

        return format(date, "yyyy-MM-dd HH:mm:ss")
    } catch {
        return "Invalid Timestamp"
    }
}

export function dateToUnix(date: string | Date): number {
    try {
        let d: Date
        if (typeof date === 'string') {
            const trimmed = date.trim()
            if (!trimmed) return Number.NaN

            // parseISO handles strict ISO values; fallback to native parsing for common forms.
            const isoCandidate = parseISO(trimmed)
            d = Number.isNaN(isoCandidate.getTime()) ? new Date(trimmed) : isoCandidate
        } else {
            d = date
        }

        if (Number.isNaN(d.getTime())) {
            return Number.NaN
        }

        return getUnixTime(d)
    } catch {
        return Number.NaN
    }
}

export function getCurrentUnix(): number {
    return getUnixTime(new Date())
}

export function formatDate(date: Date | string, fmt: string = "yyyy-MM-dd HH:mm:ss"): string {
    try {
        const d = typeof date === 'string' ? new Date(date) : date
        if (Number.isNaN(d.getTime())) return "Invalid Date"
        return format(d, fmt)
    } catch {
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
    } catch {
        return "Invalid Timezone"
    }
}
