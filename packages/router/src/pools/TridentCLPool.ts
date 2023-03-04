import type { MultiRoute, RouteLeg, UniV3Pool } from '@sushiswap/tines'

import { HEXer } from '../HEXer'
import { PoolCode } from './PoolCode'

export class TridentCLPoolCode extends PoolCode {
  constructor(pool: UniV3Pool, providerName: string) {
    super(pool, `${providerName} ${pool.fee * 100}%`)
  }

  override getStartPoint(): string {
    return PoolCode.RouteProcessorAddress
  }

  // eslint-disable-next-line unused-imports/no-unused-vars, no-unused-vars, @typescript-eslint/no-unused-vars
  getSwapCodeForRouteProcessor(leg: RouteLeg, route: MultiRoute, to: string): string {
    return 'unsupported'
  }

  getSwapCodeForRouteProcessor2(leg: RouteLeg, _route: MultiRoute, to: string): string {
    const code = new HEXer()
      .uint8(5) // TridentCL pool
      .address(this.pool.address)
      .bool(leg.tokenFrom.address == this.pool.tokens[0].address)
      .address(to)
      .toString()
    return code
  }
}
