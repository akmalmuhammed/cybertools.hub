export const DESIGN_SYSTEM = {
    colors: {
        light: {
            background: 'hsl(212, 24%, 95%)',
            foreground: 'hsl(220, 23%, 14%)',
            primary: 'hsl(145, 81%, 50%)',       // #19E76E
            muted: 'hsl(218, 20%, 91%)',
            card: 'hsl(0, 0%, 100%)',
            border: 'hsl(216, 16%, 78%)',
        },
        dark: {
            background: 'hsl(0, 0%, 8%)',
            foreground: 'hsl(0, 0%, 95%)',
            primary: 'hsl(145, 81%, 50%)',
            muted: 'hsl(0, 0%, 16%)',
            card: 'hsl(0, 0%, 11%)',
            border: 'hsl(0, 0%, 28%)',
        }
    },
    animations: {
        // Apple-like easing
        spring: { type: 'spring', stiffness: 300, damping: 30 },
        smooth: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
        bounce: { duration: 0.5, ease: [0.68, -0.55, 0.265, 1.55] }
    },
    transitions: {
        fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
        normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
        slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    }
}
