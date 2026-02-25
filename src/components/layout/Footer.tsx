import { Link } from "react-router-dom"
import { ShieldCheck } from "lucide-react"

export function Footer() {
    return (
        <footer className="w-full border-t border-border bg-background/50 backdrop-blur-md py-8 mt-auto">
            <div className="container px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex flex-col items-center md:items-start gap-1">
                    <p className="text-sm font-medium text-foreground">
                        © {new Date().getFullYear()} CyberTools Hub
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        Local-first processing. Network access only on explicitly marked tools.
                    </p>
                </div>

                <div className="flex items-center gap-5 text-sm">
                    <Link to="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
                        Tools
                    </Link>
                    <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                        About
                    </Link>
                </div>
            </div>
        </footer>
    )
}
