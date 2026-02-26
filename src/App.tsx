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
const DomainPage = lazy(() => import('@/pages/DomainPage'))
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
const AlertDeduplicationTool = lazy(() => import('@/pages/tools/AlertDeduplicationTool'))
const DetectionUnitTestHarnessTool = lazy(() => import('@/pages/tools/DetectionUnitTestHarnessTool'))
const AttackCoverageTool = lazy(() => import('@/pages/tools/AttackCoverageTool'))
const EventTimelineTool = lazy(() => import('@/pages/tools/EventTimelineTool'))
const LogSchemaMapperTool = lazy(() => import('@/pages/tools/LogSchemaMapperTool'))
const IocConfidenceTtlTool = lazy(() => import('@/pages/tools/IocConfidenceTtlTool'))
const MispStixMapperTool = lazy(() => import('@/pages/tools/MispStixMapperTool'))
const ArtifactIntegrityPackagerTool = lazy(() => import('@/pages/tools/ArtifactIntegrityPackagerTool'))
const ExposureNormalizerTool = lazy(() => import('@/pages/tools/ExposureNormalizerTool'))
const FirewallAclAnalyzerTool = lazy(() => import('@/pages/tools/FirewallAclAnalyzerTool'))
const TlsRiskExplainerTool = lazy(() => import('@/pages/tools/TlsRiskExplainerTool'))
const OpenApiAuthzGapTool = lazy(() => import('@/pages/tools/OpenApiAuthzGapTool'))
const CorsPolicyAnalyzerTool = lazy(() => import('@/pages/tools/CorsPolicyAnalyzerTool'))
const OAuthOidcLinterTool = lazy(() => import('@/pages/tools/OAuthOidcLinterTool'))
const IamPolicyAnalyzerTool = lazy(() => import('@/pages/tools/IamPolicyAnalyzerTool'))
const LockfileRiskDiffTool = lazy(() => import('@/pages/tools/LockfileRiskDiffTool'))
const OsintQueryBuilderTool = lazy(() => import('@/pages/tools/OsintQueryBuilderTool'))
const PentestScanPlannerTool = lazy(() => import('@/pages/tools/PentestScanPlannerTool'))
const AiPromptInjectionTriageTool = lazy(() => import('@/pages/tools/AiPromptInjectionTriageTool'))
const AiConnectorEgressAuditTool = lazy(() => import('@/pages/tools/AiConnectorEgressAuditTool'))
const PlannedToolPage = lazy(() => import('@/pages/tools/PlannedToolPage'))

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
        <Route path="/domains/:domainSlug" element={<DomainPage />} />
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
        <Route path="/tools/alert-dedupe" element={<AlertDeduplicationTool />} />
        <Route path="/tools/detection-unit-test" element={<DetectionUnitTestHarnessTool />} />
        <Route path="/tools/attack-coverage" element={<AttackCoverageTool />} />
        <Route path="/tools/event-timeline" element={<EventTimelineTool />} />
        <Route path="/tools/log-schema-mapper" element={<LogSchemaMapperTool />} />
        <Route path="/tools/ioc-confidence-ttl" element={<IocConfidenceTtlTool />} />
        <Route path="/tools/misp-stix-mapper" element={<MispStixMapperTool />} />
        <Route path="/tools/artifact-integrity" element={<ArtifactIntegrityPackagerTool />} />
        <Route path="/tools/exposure-normalizer" element={<ExposureNormalizerTool />} />
        <Route path="/tools/firewall-acl-analyzer" element={<FirewallAclAnalyzerTool />} />
        <Route path="/tools/tls-risk-explainer" element={<TlsRiskExplainerTool />} />
        <Route path="/tools/openapi-authz-gap" element={<OpenApiAuthzGapTool />} />
        <Route path="/tools/cors-policy-analyzer" element={<CorsPolicyAnalyzerTool />} />
        <Route path="/tools/oauth-oidc-linter" element={<OAuthOidcLinterTool />} />
        <Route path="/tools/iam-policy-analyzer" element={<IamPolicyAnalyzerTool />} />
        <Route path="/tools/lockfile-risk-diff" element={<LockfileRiskDiffTool />} />
        <Route path="/tools/osint-query-builder" element={<OsintQueryBuilderTool />} />
        <Route path="/tools/pentest-scan-planner" element={<PentestScanPlannerTool />} />
        <Route path="/tools/ai-prompt-injection-triage" element={<AiPromptInjectionTriageTool />} />
        <Route path="/tools/ai-connector-egress-audit" element={<AiConnectorEgressAuditTool />} />

        {/* Utility Tools */}
        <Route path="/tools/qrcode" element={<QrCodeTool />} />
        <Route path="/tools/color" element={<ColorConverterTool />} />
        <Route path="/tools/uuid" element={<UuidTool />} />
        <Route path="/tools/markdown" element={<MarkdownTool />} />
        <Route path="/tools/html" element={<HtmlEncoderTool />} />
        <Route path="/tools/:toolSlug" element={<PlannedToolPage />} />
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
