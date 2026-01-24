import { HelmetProvider } from 'react-helmet-async'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { Toaster } from '@/components/ui/toaster'
import { Loader2 } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'

// Lazy load pages
const Home = lazy(() => import('@/pages/Home'))
const ToolsPage = lazy(() => import('@/pages/ToolsPage'))
const AboutPage = lazy(() => import('@/pages/AboutPage'))

// Core Tools
const Base64Tool = lazy(() => import('@/pages/tools/Base64Tool'))
const HashTool = lazy(() => import('@/pages/tools/HashTool'))
const JsonTool = lazy(() => import('@/pages/tools/JsonTool'))
const UrlTool = lazy(() => import('@/pages/tools/UrlTool'))
const TimestampTool = lazy(() => import('@/pages/tools/TimestampTool'))

// Popular Tools
const RegexTool = lazy(() => import('@/pages/tools/RegexTool'))
const JwtTool = lazy(() => import('@/pages/tools/JwtTool'))
const EmailHeaderTool = lazy(() => import('@/pages/tools/EmailHeaderTool'))
const SubnetTool = lazy(() => import('@/pages/tools/SubnetTool'))
const PasswordGenTool = lazy(() => import('@/pages/tools/PasswordGenTool'))

// Advanced Tools
const WhoisTool = lazy(() => import('@/pages/tools/WhoisTool'))
const CertificateTool = lazy(() => import('@/pages/tools/CertificateTool'))
const IpLookupTool = lazy(() => import('@/pages/tools/IpLookupTool'))
const PortCheckerTool = lazy(() => import('@/pages/tools/PortCheckerTool'))
const TextDiffTool = lazy(() => import('@/pages/tools/TextDiffTool'))

// Utility Tools
const QrCodeTool = lazy(() => import('@/pages/tools/QrCodeTool'))
const ColorConverterTool = lazy(() => import('@/pages/tools/ColorConverterTool'))
const UuidTool = lazy(() => import('@/pages/tools/UuidTool'))
const MarkdownTool = lazy(() => import('@/pages/tools/MarkdownTool'))
const HtmlEncoderTool = lazy(() => import('@/pages/tools/HtmlEncoderTool'))

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

function RoutesContent() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/about" element={<AboutPage />} />

        {/* Core Tools */}
        <Route path="/tools/base64" element={<Base64Tool />} />
        <Route path="/hash-generator" element={<HashTool />} />
        <Route path="/tools/json" element={<JsonTool />} />
        <Route path="/tools/url" element={<UrlTool />} />
        <Route path="/tools/timestamp" element={<TimestampTool />} />

        {/* Popular Tools */}
        <Route path="/tools/regex" element={<RegexTool />} />
        <Route path="/tools/jwt" element={<JwtTool />} />
        <Route path="/tools/email" element={<EmailHeaderTool />} />
        <Route path="/tools/subnet" element={<SubnetTool />} />
        <Route path="/tools/password" element={<PasswordGenTool />} />

        {/* Advanced Tools */}
        <Route path="/tools/whois" element={<WhoisTool />} />
        <Route path="/tools/certificate" element={<CertificateTool />} />
        <Route path="/tools/ip" element={<IpLookupTool />} />
        <Route path="/tools/port" element={<PortCheckerTool />} />
        <Route path="/tools/diff" element={<TextDiffTool />} />

        {/* Utility Tools */}
        <Route path="/tools/qrcode" element={<QrCodeTool />} />
        <Route path="/tools/color" element={<ColorConverterTool />} />
        <Route path="/tools/uuid" element={<UuidTool />} />
        <Route path="/tools/markdown" element={<MarkdownTool />} />
        <Route path="/tools/html" element={<HtmlEncoderTool />} />
      </Routes>
    </AnimatePresence>
  )
}

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <PageLayout>
          <Suspense fallback={<LoadingSpinner />}>
            <RoutesContent />
          </Suspense>
        </PageLayout>
        <Toaster />
      </BrowserRouter>
    </HelmetProvider>
  )
}

export default App
