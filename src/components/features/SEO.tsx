import { Helmet } from 'react-helmet-async'

interface SEOProps {
    title: string
    description: string
    canonical?: string
}

export function SEO({ title, description, canonical }: SEOProps) {
    return (
        <Helmet>
            <title>{title} | CyberTools Hub</title>
            <meta name="description" content={description} />
            {canonical && <link rel="canonical" href={canonical} />}
            <meta property="og:title" content={`${title} | CyberTools Hub`} />
            <meta property="og:description" content={description} />
        </Helmet>
    )
}
