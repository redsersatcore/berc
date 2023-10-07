import { ChainId } from '@sushiswap/chain'

export const STEER_SUPPORTED_CHAIN_IDS = [
  ChainId.BASE,
  ChainId.OPTIMISM,
  ChainId.BSC,
  ChainId.THUNDERCORE,
  ChainId.POLYGON,
  ChainId.METIS,
  ChainId.POLYGON_ZKEVM,
  ChainId.ARBITRUM,
  ChainId.CELO,
  ChainId.AVALANCHE,
]

export const SteerChainIds = STEER_SUPPORTED_CHAIN_IDS

export type SteerChainId = (typeof STEER_SUPPORTED_CHAIN_IDS)[number]

export const isSteerChainId = (chainId: ChainId): chainId is SteerChainId =>
  STEER_SUPPORTED_CHAIN_IDS.includes(chainId as SteerChainId)

export const STEER_PERIPHERY_ADDRESS: Record<SteerChainId, `0x${string}`> = {
  [ChainId.BASE]: '0x16BA7102271dC83Fff2f709691c2B601DAD7668e',
  [ChainId.OPTIMISM]: '0x7c464A0AB1f5ebf3E2dCccfec7EF41D02ED7a2f4',
  [ChainId.BSC]: '0xe240B9a2936f6Fb8860219bC059349e50F03492e',
  [ChainId.THUNDERCORE]: '0xab36D30C1A1C683037Bd7AAC67f29B2e3ECC6576',
  [ChainId.POLYGON]: '0x29E1888F7DD0757f2873E494463Ec389dab38D27',
  [ChainId.METIS]: '0x806c2240793b3738000fcb62C66BF462764B903F',
  [ChainId.POLYGON_ZKEVM]: '0xcA19bEc25A41443F35EeAE03411Dce87D8c0Edc4',
  [ChainId.ARBITRUM]: '0x806c2240793b3738000fcb62C66BF462764B903F',
  [ChainId.CELO]: '0xdca3251Ebe8f85458E8d95813bCb816460e4bef1',
  [ChainId.AVALANCHE]: '0x5D8249e3F5f702e1Fd720167b40424fc2daDCd1e',
}