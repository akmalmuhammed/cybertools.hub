export const DESIGN_SYSTEM = {
    colors: {
        light: {
            background: 'hsl(0, 0%, 100%)',      // #FFFFFF
            foreground: 'hsl(0, 0%, 0%)',        // #000000
            primary: 'hsl(145, 81%, 50%)',       // #19E76E
            muted: 'hsl(0, 0%, 96%)',
            card: 'hsl(0, 0%, 100%)',
            border: 'hsl(0, 0%, 0%)',
        },
        dark: {
            background: 'hsl(0, 0%, 100%)',
            foreground: 'hsl(0, 0%, 0%)',
            primary: 'hsl(145, 81%, 50%)',
            muted: 'hsl(0, 0%, 96%)',
            card: 'hsl(0, 0%, 100%)',
            border: 'hsl(0, 0%, 0%)',
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
