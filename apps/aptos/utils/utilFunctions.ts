import { usePoolActions, usePoolState } from 'components/Pool/PoolProvider'
import { SupportedNetwork, chains } from 'config/chains'
import { useMemo } from 'react'
import { baseTokens } from './baseTokens'
import { Token } from './tokenType'
import { useNetwork } from './useNetwork'
import { Pool } from './usePools'

export type Route = {
  route: string[]
  amountOut: number
  priceImpact: number
}

interface GetAllCommonPairs {
  amount_in?: number
  coinA: Token
  coinB: Token
  pairs: Pool[] | undefined
  network: SupportedNetwork
}

export async function getAllCommonPairs({
  amount_in = 0,
  coinA,
  coinB,
  pairs,
  network,
}: GetAllCommonPairs) {
  const {
    api: { fetchUrlPrefix },
    contracts: { swap: swapContract },
  } = chains[network]

  // all base pairs
  const basePairs = new Set([...baseTokens, coinA.address, coinB.address])

  pairs?.map((pair) => {
    basePairs.add(pair?.data?.token_x_details?.token_address)
    basePairs.add(pair?.data?.token_y_details?.token_address)
  })
  let reserves
  const pairArray = [...basePairs]
  let returnRoutes: Route = {} as Route

  const allPairs: string[][] = []

  for (let i = 0; i < pairArray.length; i++) {
    for (let j = i + 1; j < pairArray.length; j++) {
      allPairs.push([pairArray[i], pairArray[j]])
    }
  }

  await fetch(`${fetchUrlPrefix}/v1/accounts/${swapContract}/resources`)
    .then((res) => res.json())
    .then((data) => {
      const t: any = {}
      const reserve_tokens: any = {}
      const reserve_token_info: any = {}

      if (data?.error_code) return
      reserves = data.filter((d: any) => {
        if (d.type.includes('swap::TokenPairReserve')) {
          reserve_tokens[d.type] = d

          return true
        }

        if (
          d.type.includes(`0x1::coin::CoinInfo<${swapContract}::swap::LPToken<`)
        ) {
          reserve_token_info[d.type] = d
        }
      })
      allPairs.map((token) => {
        if (
          reserve_tokens[
            `${swapContract}::swap::TokenPairReserve<${token[0]}, ${token[1]}>`
          ]
        ) {
          const info = {
            lpTokenInfo:
              reserve_token_info[
                `0x1::coin::CoinInfo<${swapContract}::swap::LPToken<${token[0]}, ${token[1]}>>`
              ],
          }
          const data =
            reserve_tokens[
              `${swapContract}::swap::TokenPairReserve<${token[0]}, ${token[1]}>`
            ]

          t[`${token[0]}|||${token[1]}`] = {
            pairs: `${token[0]}|||${token[1]}`,
            res_x: data.data.reserve_x,
            res_y: data.data.reserve_y,
            ...info,
            ...data,
          }
        }

        if (
          reserve_tokens[
            `${swapContract}::swap::TokenPairReserve<${token[1]}, ${token[0]}>`
          ]
        ) {
          const info = {
            lpTokenInfo:
              reserve_token_info[
                `0x1::coin::CoinInfo<${swapContract}::swap::LPToken<${token[1]}, ${token[0]}>>`
              ],
          }
          const data =
            reserve_tokens[
              `${swapContract}::swap::TokenPairReserve<${token[1]}, ${token[0]}>`
            ]

          t[`${token[1]}|||${token[0]}`] = {
            pairs: `${token[0]}|||${token[1]}`,
            res_x: data.data.reserve_x,
            res_y: data.data.reserve_y,
            ...info,
            ...data,
          }
        }
      })

      const graph = Object.values(t).reduce((data: any, coin: any) => {
        const coins_data = coin.pairs.split('|||')

        if (data[coins_data[0]]) {
          data[coins_data[0]].push(coins_data[1])
        } else {
          data[coins_data[0]] = [coins_data[1]]
        }

        if (data[coins_data[1]]) {
          data[coins_data[1]].push(coins_data[0])
        } else {
          data[coins_data[1]] = [coins_data[0]]
        }

        return data
      }, {})

      returnRoutes = RouteDemo(amount_in, t, graph, coinA, coinB) as Route
    })

  return returnRoutes as Route
}

type TokenPairReserve = {
  type: string
  data: {
    block_timestamp_last: string
    reserve_x: string
    reserve_y: string
  }
}

export async function usePoolPairs() {
  const {
    api: { fetchUrlPrefix },
    contracts: { swap: swapContract },
  } = useNetwork()
  const { token0, token1, isTransactionPending } = usePoolState()
  const { setPairs, setLoadingPrice, setPoolPairRatio } = usePoolActions()

  return useMemo(async () => {
    let reserves: TokenPairReserve[] = [{}] as TokenPairReserve[]
    let inverse = false
    try {
      setLoadingPrice(true)
      await fetch(`${fetchUrlPrefix}/v1/accounts/${swapContract}/resources`)
        .then((res) => res.json())
        .then((data) => {
          reserves = data.filter((d: TokenPairReserve) => {
            if (
              d.type ===
              `${swapContract}::swap::TokenPairReserve<${token0.address}, ${token1.address}>`
            ) {
              inverse = false
              return true
            } else if (
              d.type ===
              `${swapContract}::swap::TokenPairReserve<${token1.address}, ${token0.address}>`
            ) {
              inverse = true
              return true
            }
          })
        })

      setLoadingPrice(false)
    } catch (err) {
      console.log(err)
    } finally {
      setLoadingPrice(false)
    }
    if (reserves?.length) {
      setPairs(reserves[0])
      if (inverse) {
        setPoolPairRatio(
          Number(reserves[0]?.data?.reserve_x) /
            Number(reserves[0]?.data?.reserve_y),
        )
      } else {
        setPoolPairRatio(
          Number(reserves[0]?.data?.reserve_y) /
            Number(reserves[0]?.data?.reserve_x),
        )
      }
    } else {
      setPairs({})
      setPoolPairRatio(0)
    }
    return reserves
  }, [token0, token1, isTransactionPending, swapContract, fetchUrlPrefix])
}

export const exactOutput = (amt_in: number, res_x: number, res_y: number) => {
  const amt_with_fee = amountWithFee(amt_in)
  const amt_out = (amt_with_fee * res_y) / (res_x * 10000 + amt_with_fee)
  return amt_out
}

const amountWithFee = (amt_in: number) => {
  return amt_in * 9975
}

function findPossibleRoutes(
  tokenA: string,
  tokenB: string,
  graph: any,
  visited: any,
  currentRoute: any,
  routes: any,
) {
  // Mark the current token as visited
  visited[tokenA] = true

  // Add the current token to the current route
  currentRoute.push(tokenA)

  // If the current token is the desired tokenB, add the current route to the routes array
  if (tokenA === tokenB) {
    routes.push([...currentRoute])
  } else {
    // Iterate through the adjacent tokens of the current token
    if (graph[tokenA]) {
      for (const adjacentToken of graph[tokenA]) {
        // If the adjacent token is not visited, recursively find possible routes
        if (!visited[adjacentToken]) {
          findPossibleRoutes(
            adjacentToken,
            tokenB,
            graph,
            visited,
            currentRoute,
            routes,
          )
        }
      }
    }
  }

  // Remove the current token from the current route and mark it as unvisited
  currentRoute.pop()
  visited[tokenA] = false
}

function RouteDemo(
  firstInput: any,
  ARR: any,
  tokenGraph: any,
  coinA: any,
  coinB: any,
) {
  const visitedTokens = {}
  const currentTokenRoute: any[] = []
  const allRoutes: any[] = []

  findPossibleRoutes(
    coinA.address,
    coinB.address,
    tokenGraph,
    visitedTokens,
    currentTokenRoute,
    allRoutes,
  )

  // let firstInput = 100000000
  let lastOutput = 0
  const bestFinder = []
  for (const route of allRoutes) {
    const prices = []
    if (route.length < 6) {
      if (
        ARR[route[0] + '|||' + route[1]] ||
        ARR[route[1] + '|||' + route[0]]
      ) {
        const res_x =
          ARR[route[0] + '|||' + route[1]]?.res_x ||
          ARR[route[1] + '|||' + route[0]]?.res_y
        const res_y =
          ARR[route[0] + '|||' + route[1]]?.res_y ||
          ARR[route[1] + '|||' + route[0]]?.res_x
        lastOutput = exactOutput(firstInput, res_x, res_y)
        prices.push(res_y / res_x)

        if (
          ARR[route[1] + '|||' + route[2]] ||
          ARR[route[2] + '|||' + route[1]]
        ) {
          const res_x =
            ARR[route[1] + '|||' + route[2]]?.res_x ||
            ARR[route[2] + '|||' + route[1]]?.res_y
          const res_y =
            ARR[route[1] + '|||' + route[2]]?.res_y ||
            ARR[route[2] + '|||' + route[1]]?.res_x
          lastOutput = exactOutput(lastOutput, res_x, res_y)
          prices.push(res_y / res_x)

          if (
            ARR[route[2] + '|||' + route[3]] ||
            ARR[route[3] + '|||' + route[2]]
          ) {
            const res_x =
              ARR[route[2] + '|||' + route[3]]?.res_x ||
              ARR[route[3] + '|||' + route[2]]?.res_y
            const res_y =
              ARR[route[2] + '|||' + route[3]]?.res_y ||
              ARR[route[3] + '|||' + route[2]]?.res_x
            lastOutput = exactOutput(lastOutput, res_x, res_y)
            prices.push(res_y / res_x)

            if (
              ARR[route[3] + '|||' + route[4]] ||
              ARR[route[4] + '|||' + route[3]]
            ) {
              const res_x =
                ARR[route[3] + '|||' + route[4]]?.res_x ||
                ARR[route[4] + '|||' + route[3]]?.res_y
              const res_y =
                ARR[route[3] + '|||' + route[4]]?.res_y ||
                ARR[route[4] + '|||' + route[3]]?.res_x
              lastOutput = exactOutput(lastOutput, res_x, res_y)
              prices.push(res_y / res_x)
            }
          }
        }
      }
      const midPrice = prices
        .slice(1)
        .reduce(
          (accumulator, currentValue) => accumulator * currentValue,
          prices[0],
        )
      const priceImpact = computePriceImpact(midPrice, firstInput, lastOutput)

      bestFinder.push({
        route: route,
        amountOut: lastOutput,
        priceImpact: priceImpact.toFixed(2),
      })
    }
  }
  const bestRoutePrice = bestFinder.length
    ? bestFinder.reduce((r: any, b: any) => (r.amountOut > b.amountOut ? r : b))
    : {}
  return bestRoutePrice
}

function computePriceImpact(
  midPrice: number,
  amountIn: number,
  amountOut: number,
) {
  const quotedOutputAmount = amountIn * midPrice
  const priceImpact =
    ((quotedOutputAmount - amountOut) / quotedOutputAmount) * 100
  return priceImpact
}

export const formatNumber = (number: number, decimals: number) => {
  if (number === 0) return '0'
  let _number = (number / 10 ** decimals).toFixed(decimals)
  if (_number) {
    if (_number.includes('.') && _number.split('.')[1].length > 8) {
      _number = Number(_number).toFixed(8)
    }
    if (_number.includes('.') && parseFloat(_number.split('.')[0]) > 0) {
      _number = Number(_number).toFixed(4)
    }
  } else {
    _number = '0'
  }
  if (Number(_number) < 0.000000001) {
    return '0'
  }
  return _number
}