import { HelmetProvider } from 'react-helmet-async'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
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
const UrlDefangTool = lazy(() => import('@/pages/tools/UrlDefangTool'))
const TimestampTool = lazy(() => import('@/pages/tools/TimestampTool'))

// Popular Tools
const RegexTool = lazy(() => import('@/pages/tools/RegexTool'))
const JwtTool = lazy(() => import('@/pages/tools/JwtTool'))
const JwtVerifierTool = lazy(() => import('@/pages/tools/JwtVerifierTool'))
const EmailHeaderTool = lazy(() => import('@/pages/tools/EmailHeaderTool'))
const IocExtractorTool = lazy(() => import('@/pages/tools/IocExtractorTool'))
const IocCorrelatorTool = lazy(() => import('@/pages/tools/IocCorrelatorTool'))
const UserAgentTool = lazy(() => import('@/pages/tools/UserAgentTool'))
const SubnetTool = lazy(() => import('@/pages/tools/SubnetTool'))
const PasswordGenTool = lazy(() => import('@/pages/tools/PasswordGenTool'))

// Advanced Tools
const WhoisTool = lazy(() => import('@/pages/tools/WhoisTool'))
const CertificateTool = lazy(() => import('@/pages/tools/CertificateTool'))
const IpLookupTool = lazy(() => import('@/pages/tools/IpLookupTool'))
const PortCheckerTool = lazy(() => import('@/pages/tools/PortCheckerTool'))
const DnsToolkitTool = lazy(() => import('@/pages/tools/DnsToolkitTool'))
const TextDiffTool = lazy(() => import('@/pages/tools/TextDiffTool'))
const HttpHeadersTool = lazy(() => import('@/pages/tools/HttpHeadersTool'))
const ReputationEnricherTool = lazy(() => import('@/pages/tools/ReputationEnricherTool'))
const KevCvePrioritizerTool = lazy(() => import('@/pages/tools/KevCvePrioritizerTool'))
const SecretsScannerTool = lazy(() => import('@/pages/tools/SecretsScannerTool'))
const IocNormalizerTool = lazy(() => import('@/pages/tools/IocNormalizerTool'))
const StixTaxiiTool = lazy(() => import('@/pages/tools/StixTaxiiTool'))
const DomainSpoofDetectorTool = lazy(() => import('@/pages/tools/DomainSpoofDetectorTool'))
const SigmaHelperTool = lazy(() => import('@/pages/tools/SigmaHelperTool'))
const YaraLocalMatcherTool = lazy(() => import('@/pages/tools/YaraLocalMatcherTool'))
const SbomDiffTool = lazy(() => import('@/pages/tools/SbomDiffTool'))
const SecurityHeaderBuilderTool = lazy(() => import('@/pages/tools/SecurityHeaderBuilderTool'))

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
        <Route path="/tools/hash" element={<HashTool />} />
        <Route path="/hash-generator" element={<Navigate to="/tools/hash" replace />} />
        <Route path="/tools/json" element={<JsonTool />} />
        <Route path="/tools/url" element={<UrlTool />} />
        <Route path="/tools/url-defang" element={<UrlDefangTool />} />
        <Route path="/tools/timestamp" element={<TimestampTool />} />

        {/* Popular Tools */}
        <Route path="/tools/regex" element={<RegexTool />} />
        <Route path="/tools/jwt" element={<JwtTool />} />
        <Route path="/tools/jwt-verify" element={<JwtVerifierTool />} />
        <Route path="/tools/email" element={<EmailHeaderTool />} />
        <Route path="/tools/ioc" element={<IocExtractorTool />} />
        <Route path="/tools/ioc-correlator" element={<IocCorrelatorTool />} />
        <Route path="/tools/user-agent" element={<UserAgentTool />} />
        <Route path="/tools/subnet" element={<SubnetTool />} />
        <Route path="/tools/password" element={<PasswordGenTool />} />

        {/* Advanced Tools */}
        <Route path="/tools/whois" element={<WhoisTool />} />
        <Route path="/tools/certificate" element={<CertificateTool />} />
        <Route path="/tools/ip" element={<IpLookupTool />} />
        <Route path="/tools/port" element={<PortCheckerTool />} />
        <Route path="/tools/dns" element={<DnsToolkitTool />} />
        <Route path="/tools/diff" element={<TextDiffTool />} />
        <Route path="/tools/http-headers" element={<HttpHeadersTool />} />
        <Route path="/tools/reputation" element={<ReputationEnricherTool />} />
        <Route path="/tools/cve-prioritizer" element={<KevCvePrioritizerTool />} />
        <Route path="/tools/secrets-scanner" element={<SecretsScannerTool />} />
        <Route path="/tools/ioc-normalizer" element={<IocNormalizerTool />} />
        <Route path="/tools/stix-taxii" element={<StixTaxiiTool />} />
        <Route path="/tools/domain-spoof" element={<DomainSpoofDetectorTool />} />
        <Route path="/tools/sigma-helper" element={<SigmaHelperTool />} />
        <Route path="/tools/yara-local" element={<YaraLocalMatcherTool />} />
        <Route path="/tools/sbom-diff" element={<SbomDiffTool />} />
        <Route path="/tools/security-header-builder" element={<SecurityHeaderBuilderTool />} />

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
