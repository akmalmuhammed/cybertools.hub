export const DESIGN_SYSTEM = {
    colors: {
        light: {
            background: 'hsl(40, 14%, 97%)',     // #FAF9F6
            foreground: 'hsl(215, 25%, 27%)',    // #2D3748
            primary: 'hsl(160, 60%, 45%)',       // #10B981
            muted: 'hsl(40, 10%, 90%)',
            card: 'hsl(0, 0%, 100%)',
            border: 'hsl(40, 10%, 85%)',
        },
        dark: {
            background: 'hsl(0, 0%, 10%)',       // #1A1A1A
            foreground: 'hsl(220, 9%, 90%)',     // #E5E7EB
            primary: 'hsl(130, 100%, 50%)',      // #00FF41
            muted: 'hsl(0, 0%, 15%)',
            card: 'hsl(0, 0%, 15%)',             // #262626
            border: 'hsl(0, 0%, 20%)',
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
