import { Github, Twitter } from "lucide-react"

export function Footer() {
    return (
        <footer className="w-full border-t border-border bg-background/50 backdrop-blur-md py-8 mt-auto">
            <div className="container px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col items-center md:items-start gap-1">
                    <p className="text-sm font-medium text-foreground">
                        (c) {new Date().getFullYear()} CyberTools Hub
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Built for security professionals
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Github className="h-5 w-5" />
                        <span className="sr-only">GitHub</span>
                    </a>
                    <a
                        href="https://twitter.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Twitter className="h-5 w-5" />
                        <span className="sr-only">Twitter</span>
                    </a>
                </div>
            </div>
        </footer>
    )
}

