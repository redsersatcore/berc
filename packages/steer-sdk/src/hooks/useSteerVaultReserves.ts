import { getChainIdAddressFromId } from '@sushiswap/format'
import { usePublicClient } from '@sushiswap/wagmi'
import { useQuery } from '@tanstack/react-query'
import { clientsFromIds } from 'src/helpers/clientsFromIds.js'

import { getSteerVaultReserves, getSteerVaultsReserves } from '../functions/getSteerVaultReserves.js'

interface UseSteerVaultsReserves {
  vaultIds: string[] | undefined
  enabled?: boolean
}

export const useSteerVaultsReserves = ({ vaultIds, enabled = true }: UseSteerVaultsReserves) => {
  const client = usePublicClient()

  return useQuery({
    queryKey: ['useSteerVaultsReserves', { vaultIds, client }],
    queryFn: () => {
      if (!vaultIds) return null

      return getSteerVaultsReserves({ clients: clientsFromIds(vaultIds), vaultIds: vaultIds })
    },
    refetchInterval: 10000,
    enabled: Boolean(enabled && vaultIds),
  })
}

interface UseSteerVaultReserve {
  vaultId: string | undefined
  enabled?: boolean
}

export const useSteerVaultReserves = ({ vaultId, enabled = true }: UseSteerVaultReserve) => {
  const client = usePublicClient({ chainId: vaultId ? getChainIdAddressFromId(vaultId).chainId : undefined })

  return useQuery({
    queryKey: ['useSteerVaultsReserve', { vaultId, client }],
    queryFn: () => (vaultId ? getSteerVaultReserves({ client, vaultId: vaultId }) : null),
    refetchInterval: 10000,
    enabled: Boolean(enabled && vaultId),
  })
}