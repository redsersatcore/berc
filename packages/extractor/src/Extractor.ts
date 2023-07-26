import { open } from 'node:fs/promises'
import path from 'node:path'

import { Token } from '@sushiswap/currency'
import { PoolCode } from '@sushiswap/router'
import { Address, PublicClient } from 'viem'

import { MultiCallAggregator } from './MulticallAggregator'
import { TokenManager } from './TokenManager'
import { FactoryV2, UniV2Extractor } from './UniV2Extractor'
import { FactoryV3, UniV3Extractor } from './UniV3Extractor'
import { UniV3PoolWatcher, UniV3PoolWatcherStatus } from './UniV3PoolWatcher'

const delay = async (ms: number) => new Promise((res) => setTimeout(res, ms))

// TODO: UniV3 price diapason +-10% test
// TODO: fullness test
// TODO: All blockchains test
// TODO: correctness terst - now ofter fails? (needs good token list)

// TODO: Back to LogFilter ? Faster events applying
// TODO: spead up logs by calling only once (low level with topics)
// TODO: chain number in warnLog
// TODO: number of pending pools in getPoolCodesForTokens

// TODO: cache for not-existed pools?
// TODO: to fill address cache from pool cache

// Usage recomendation:
//  - getPoolCodesForTokens/getPoolCodesForTokensAsync consumes much processor resources for new token sets -
//    about 50ms. Some quantity of routing requests can be processed on the same process as Extractor
//    But for significant loading it is better to deploy Extractor on a separate server
//    and have several servers for routing. Extractor server can provide all pools by getCurrentPoolCodes()
//  - direct logs (std output) to console
//  - direct warnings (std error) to a file
export class Extractor {
  extractorV2?: UniV2Extractor
  extractorV3?: UniV3Extractor
  multiCallAggregator?: MultiCallAggregator
  cacheDir: string

  /// @param client
  /// @param factoriesV2 list of supported V2 factories
  /// @param factoriesV3 list of supported V3 factories
  /// @param tickHelperContract address of helper contract for pool's ticks download
  /// @param cacheDir directory for cache
  //                  Extremely recomended
  //                  IMPORTANT: Use different cacheDir for Extractors with the same chainId
  /// @param logDepth the depth of logs to keep in memory for reorgs
  /// @param logging to write logs in console or not
  constructor(args: {
    client: PublicClient
    factoriesV2: FactoryV2[]
    factoriesV3: FactoryV3[]
    tickHelperContract: Address
    cacheDir: string
    logDepth: number
    logging?: boolean
  }) {
    this.cacheDir = args.cacheDir
    this.multiCallAggregator = new MultiCallAggregator(args.client)
    const tokenManager = new TokenManager(
      this.multiCallAggregator,
      args.cacheDir,
      `tokens-${this.multiCallAggregator.chainId}`
    )
    if (args.factoriesV2.length > 0)
      this.extractorV2 = new UniV2Extractor(
        args.client,
        args.factoriesV2,
        args.cacheDir,
        args.logDepth,
        args.logging !== undefined ? args.logging : false,
        this.multiCallAggregator,
        tokenManager
      )
    if (args.factoriesV3.length > 0)
      this.extractorV3 = new UniV3Extractor(
        args.client,
        args.tickHelperContract,
        args.factoriesV3,
        args.cacheDir,
        args.logDepth,
        args.logging !== undefined ? args.logging : false,
        this.multiCallAggregator,
        tokenManager
      )
  }

  /// @param tokensPrefetch Prefetch all pools between these tokens
  async start(tokensPrefetch: Token[] = []) {
    await Promise.all([this.extractorV2?.start(), this.extractorV3?.start()].filter((e) => e !== undefined))
    this.getPoolCodesForTokens(tokensPrefetch)
    this.printTokensPoolsQuantity(this.cacheDir, `TokensStatus-${this.multiCallAggregator?.chainId}`)
  }

  getPoolCodesForTokens(tokens: Token[]): PoolCode[] {
    const pools2 = this.extractorV2 ? this.extractorV2.getPoolsForTokens(tokens).prefetched : []
    const pools3 = this.extractorV3
      ? (this.extractorV3
          .getWatchersForTokens(tokens)
          .prefetched.map((w) => w.getPoolCode())
          .filter((pc) => pc !== undefined) as PoolCode[])
      : []
    return pools2.concat(pools3)
  }

  async getPoolCodesForTokensAsync(tokens: Token[], timeout: number): Promise<PoolCode[]> {
    let poolsV2: PoolCode[] = []
    let watchersV3: UniV3PoolWatcher[] = []
    let promises: Promise<void>[] = []

    if (this.extractorV2) {
      const { prefetched, fetching } = this.extractorV2.getPoolsForTokens(tokens)
      poolsV2 = prefetched
      promises = fetching.map(async (p) => {
        const pc = await p
        if (pc !== undefined) poolsV2.push(pc)
      })
    }

    if (this.extractorV3) {
      const { prefetched, fetching } = this.extractorV3.getWatchersForTokens(tokens)
      watchersV3 = prefetched
      prefetched.forEach((w) => {
        if (w.getStatus() != UniV3PoolWatcherStatus.All) promises.push(w.statusAll())
      })
      promises = promises.concat(
        fetching.map(async (p) => {
          const w = await p
          if (w == undefined) return
          watchersV3.push(w)
          if (w.getStatus() != UniV3PoolWatcherStatus.All) await w.statusAll()
        })
      )
    }

    await Promise.any([Promise.allSettled(promises), delay(timeout)])
    const poolsV3 = watchersV3.map((w) => w.getPoolCode()).filter((pc) => pc !== undefined) as PoolCode[]
    return poolsV3.concat(poolsV2)
  }

  getTokensPoolsQuantity(): [Token, number][] {
    const tokenMap: Map<Token, number> = new Map()
    if (this.extractorV2) this.extractorV2.getTokensPoolsQuantity(tokenMap)
    if (this.extractorV3) this.extractorV3.getTokensPoolsQuantity(tokenMap)
    return Array.from(tokenMap.entries()).sort(([, a], [, b]) => b - a)
  }

  async printTokensPoolsQuantity(...paths: string[]) {
    const filePath = path.resolve(...paths)
    const stats = this.getTokensPoolsQuantity()
    const file = await open(filePath, 'w')
    await file.writeFile(`Total tokens: ${stats.length}\n`)
    await file.writeFile('Quantity of pools for tokens\n')
    const tokenNum = Math.min(stats.length, 30)
    for (let i = 0; i < tokenNum; ++i) {
      const [token, num] = stats[i]
      await file.writeFile(`${token.address} ${token.symbol} ${num}\n`)
    }
    await file.close()
  }

  getCurrentPoolCodes() {
    const pools2 = this.extractorV2 ? this.extractorV2.getCurrentPoolCodes() : []
    const pools3 = this.extractorV3 ? this.extractorV3.getCurrentPoolCodes() : []
    return pools2.concat(pools3)
  }
}