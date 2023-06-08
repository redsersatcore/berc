'use client'

import '@sushiswap/ui/index.css'

import { App } from '@sushiswap/ui'
import { Analytics } from '@vercel/analytics/react'
import Head from 'next/head'
import Script from 'next/script'
import { DefaultSeo } from 'next-seo'

import React, { FC } from 'react'

import SEO from '../../next-seo.config.mjs'
import { QueryClientProvider, WagmiConfig } from '../../providers'
import { LayoutProps } from '.next/types/app/(landing)/layout.js'

declare global {
  interface Window {
    dataLayer: Record<string, any>[]
  }
}

const Layout: FC<LayoutProps> = ({ children }) => {
  return (
    <>
      <Head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png?v=1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png?v=1" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png?v=1" />
        <link rel="manifest" href="/site.webmanifest?v=1" />
        <link rel="mask-icon" href="/safari-pinned-tab.svg?v=1" color="#fa52a0" />
        <link rel="shortcut icon" href="/favicon.ico?v=1" />
      </Head>
      <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=G-JW8KWJ48EF`} />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-JW8KWJ48EF', {
            page_path: window.location.pathname,
          });
        `,
        }}
      />
      <WagmiConfig>
        <QueryClientProvider>
          <App.Shell>
            <DefaultSeo {...SEO} />
            {children}
          </App.Shell>
        </QueryClientProvider>
      </WagmiConfig>
      <Analytics />
    </>
  )
}

export default Layout