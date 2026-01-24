import { useState, useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { Menu, Search, Terminal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DarkModeToggle } from "@/components/features/DarkModeToggle"
import { cn } from "@/lib/utils/cn"
import { SearchDialog } from "@/components/features/SearchDialog"
import { useSearchStore } from "@/store/useSearchStore"

export function Header() {
    const [isScrolled, setIsScrolled] = useState(false)
    const location = useLocation()

    const { setIsOpen } = useSearchStore()

    // Handle scroll effect
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    const openSearch = () => {
        setIsOpen(true)
    }

    return (
        <>
            <header
                className={cn(
                    "sticky top-0 z-50 w-full border-b backdrop-blur-md transition-all duration-300",
                    isScrolled ? "bg-background/80 border-border" : "bg-transparent border-transparent"
                )}
            >
                <div className="container flex h-16 items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center space-x-2 group">
                        <div className="bg-primary/10 p-2 rounded-lg group-hover:bg-primary/20 transition-colors">
                            <Terminal className="h-6 w-6 text-primary" />
                        </div>
                        <span className="font-bold text-xl tracking-tight hidden sm:inline-block">
                            CyberTools<span className="text-primary">.Hub</span>
                        </span>
                    </Link>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex items-center gap-1">
                        <Link
                            to="/"
                            className={cn(
                                "px-4 py-2 text-sm font-medium transition-colors hover:text-primary relative rounded-md hover:bg-muted",
                                location.pathname === "/" ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            Home
                        </Link>

                        {/* Tools Dropdown */}
                        <div className="relative group">
                            <Link
                                to="/tools"
                                className={cn(
                                    "flex items-center gap-1 px-4 py-2 text-sm font-medium transition-colors hover:text-primary relative rounded-md hover:bg-muted",
                                    location.pathname.startsWith("/tools") ? "text-primary" : "text-muted-foreground"
                                )}
                            >
                                Tools
                            </Link>

                            <div className="absolute left-0 top-full pt-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-in-out z-50">
                                <div className="bg-popover border border-border rounded-lg shadow-lg overflow-hidden p-1">
                                    {[
                                        { name: "All Tools", path: "/tools" },
                                        { name: "Security", path: "/tools?category=security" },
                                        { name: "Network", path: "/tools?category=network" },
                                        { name: "Application", path: "/tools?category=application" },
                                        { name: "Others", path: "/tools?category=others" },
                                    ].map((subItem) => (
                                        <Link
                                            key={subItem.path}
                                            to={subItem.path}
                                            className={cn(
                                                "block px-4 py-2 text-sm rounded-md transition-colors hover:bg-muted hover:text-primary",
                                                location.search === subItem.path.split('?')[1] ? "bg-muted text-primary" : "text-muted-foreground"
                                            )}
                                        >
                                            {subItem.name}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <Link
                            to="/about"
                            className={cn(
                                "px-4 py-2 text-sm font-medium transition-colors hover:text-primary relative rounded-md hover:bg-muted",
                                location.pathname === "/about" ? "text-primary" : "text-muted-foreground"
                            )}
                        >
                            About
                        </Link>
                    </nav>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="hidden sm:flex h-9 w-64 items-center justify-between px-4 text-muted-foreground hover:text-foreground"
                            onClick={openSearch}
                        >
                            <span className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                <span>Search tools...</span>
                            </span>
                            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
                                <span className="text-xs">⌘</span>K
                            </kbd>
                        </Button>

                        <Button variant="ghost" size="icon" className="sm:hidden" onClick={openSearch}>
                            <Search className="h-5 w-5" />
                        </Button>

                        <DarkModeToggle />

                        {/* Mobile Menu Trigger - To be connected with MobileNav */}
                        <Button variant="ghost" size="icon" className="md:hidden">
                            <Menu className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
            </header>
            <SearchDialog />
        </>
    )
}
