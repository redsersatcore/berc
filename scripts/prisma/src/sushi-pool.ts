import { Prisma, PrismaClient } from '@prisma/client'
import { ChainId, chainIds, chainName } from '@sushiswap/chain'
import { SUSHISWAP_ENABLED_NETWORKS } from '@sushiswap/graph-config'
import { request } from 'http'
import { performance } from 'perf_hooks'
import { getBuiltGraphSDK, PairsQuery } from '../.graphclient'
import { EXCHANGE_SUBGRAPH_NAME, GRAPH_HOST, SUSHISWAP_CHAINS } from './config'
import { mergePools } from './entity/pool/load'
import { filterPools } from './entity/pool/transform'
import { createTokens } from './entity/token/load'
import { filterTokens } from './entity/token/transform'

const client = new PrismaClient()

const PROTOCOL = 'SushiSwap'
const VERSION = 'V2'
const POOL_TYPE = 'ConstantProductPool'

async function main() {
  const startTime = performance.now()
  console.log(`Preparing to load pools/tokens, protocol: ${PROTOCOL}, version: ${VERSION}, type: ${POOL_TYPE}`)

  // EXTRACT
  const exchanges = await extract()
  console.log(`EXTRACT - Pairs extracted from ${exchanges.length} different exchanges`)

  // TRANSFORM
  const { tokens, pools } = await transform(exchanges)

  // LOAD
  await createTokens(client, tokens)
  await mergePools(client, PROTOCOL, VERSION, pools)
  const endTime = performance.now()

  console.log(`COMPLETE - Script ran for ${((endTime - startTime) / 1000).toFixed(1)} seconds. `)
}

async function extract() {
  console.log(`Fetchin data from chains: `, SUSHISWAP_CHAINS.map((chainId) => chainName[chainId]).join(', '))
  const requests = SUSHISWAP_CHAINS.map((chainId) => {
    const sdk = getBuiltGraphSDK({ chainId, host: GRAPH_HOST[chainId], name: EXCHANGE_SUBGRAPH_NAME[chainId] })
    const data = []
    const size = 1000
    for (let i = 0; i < 8; i++) {
      data.push(sdk.Pairs({ first: size, skip: i * size }).catch(() => undefined))
    }
    return { chainId, data }
  })
  // const allRequests = requests.map( request => request.data).flat()
  return await Promise.all(
    requests.map((request) =>
      Promise.all(request.data).then((data) => {
        const pairs = data.filter((d) => d !== undefined).flat()
        return { chainId: request.chainId, data: pairs }
      })
    )
  )
}

async function transform(data: { chainId: ChainId; data: (PairsQuery | undefined)[] }[]): Promise<{
  pools: Prisma.PoolCreateManyInput[]
  tokens: Prisma.TokenCreateManyInput[]
}> {
  const tokens: Prisma.TokenCreateManyInput[] = []
  const poolsTransformed = data
    .map((exchange) => {
      // const pairs = exchange.data.filter((d) => d !== undefined).flat().reduce( (pair => pair?.pairs.length)
      // index issue, 1 works.. nothing else nope
      return exchange.data
        .map((batch) => {
          if (!batch?.pairs) return []
          if (exchange.chainId == undefined) {
            console.log(`batch.chainId == undefined`)
            return []
          }
          if (!SUSHISWAP_CHAINS.includes(exchange.chainId)) {
            console.log(`Chain ID ${exchange.chainId} is not in the list of supported chains`)
            return []
          }
          // console.log(`TRANSFORM - ${chainName[SUSHISWAP_CHAINS[batch.chainId]]} contains ${exchange.pairs.length} pairs`)
          return batch?.pairs.map((pair) => {
            tokens.push(
              Prisma.validator<Prisma.TokenCreateManyInput>()({
                id: exchange.chainId.toString().concat('_').concat(pair.token0.id),
                address: pair.token0.id,
                network: chainName[exchange.chainId],
                chainId: exchange.chainId.toString(),
                name: pair.token0.name,
                symbol: pair.token0.symbol,
                decimals: Number(pair.token0.decimals),
              })
            )
            tokens.push(
              Prisma.validator<Prisma.TokenCreateManyInput>()({
                id: exchange.chainId.toString().concat('_').concat(pair.token1.id),
                address: pair.token1.id,
                network: chainName[exchange.chainId],
                chainId: exchange.chainId.toString(),
                name: pair.token1.name,
                symbol: pair.token1.symbol,
                decimals: Number(pair.token1.decimals),
              })
            )
            return Prisma.validator<Prisma.PoolCreateManyInput>()({
              id: exchange.chainId.toString().concat('_').concat(pair.id),
              address: pair.id,
              name: pair.name,
              protocol: PROTOCOL,
              version: VERSION,
              type: POOL_TYPE,
              network: chainName[exchange.chainId],
              chainId: exchange.chainId.toString(),
              swapFee: Number(pair.swapFee) / 10000,
              twapEnabled: pair.twapEnabled,
              token0Id: pair.token0.id,
              token1Id: pair.token1.id,
              // reserve0:  BigInt(pair.reserve0),
              // reserve1:  BigInt(pair.reserve1),
              // totalSupply: BigInt(pair.liquidity),
              reserve0: pair.reserve0,
              reserve1: pair.reserve1,
              totalSupply: pair.liquidity,
              liquidityUSD: pair.liquidityUSD,
              liquidityNative: pair.liquidityNative,
              volumeUSD: pair.volumeUSD,
              volumeNative: pair.volumeNative,
              token0Price: pair.token0Price,
              token1Price: pair.token1Price,
              // createdAtTimestamp: new Date(pair.createdAtTimestamp),
              createdAtBlockNumber: pair.createdAtBlock,
              // createdAtBlockNumber: BigInt(pair.createdAtBlock),
            })
          })
        })
        .flat()
    })
    .flat()

  const filteredPools = await filterPools(client, poolsTransformed)
  const filteredTokens = await filterTokens(client, tokens)

  return { pools: filteredPools, tokens: filteredTokens }
}

main()
  .then(async () => {
    await client.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await client.$disconnect()
    process.exit(1)
  })
