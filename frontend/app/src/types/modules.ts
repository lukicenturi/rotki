import { z } from 'zod';

export enum Module {
  YEARN = 'yearn_vaults',
  YEARN_V2 = 'yearn_vaults_v2',
  COMPOUND = 'compound',
  MAKERDAO_VAULTS = 'makerdao_vaults',
  MAKERDAO_DSR = 'makerdao_dsr',
  AAVE = 'aave',
  UNISWAP = 'uniswap',
  BALANCER = 'balancer',
  LOOPRING = 'loopring',
  ETH2 = 'eth2',
  SUSHISWAP = 'sushiswap',
  NFTS = 'nfts',
  PICKLE = 'pickle_finance',
  LIQUITY = 'liquity',
}

export const ModuleEnum = z.nativeEnum(Module);

export type ModuleEnum = z.infer<typeof ModuleEnum>;

export const DECENTRALIZED_EXCHANGES = [
  Module.UNISWAP,
  Module.BALANCER,
  Module.SUSHISWAP,
];

export interface SupportedModule {
  name: string;
  icon: string;
  identifier: Module;
}

export const SUPPORTED_MODULES = [
  Module.AAVE,
  Module.MAKERDAO_VAULTS,
  Module.MAKERDAO_DSR,
  Module.COMPOUND,
  Module.YEARN,
  Module.YEARN_V2,
  Module.UNISWAP,
  Module.LOOPRING,
  Module.BALANCER,
  Module.ETH2,
  Module.SUSHISWAP,
  Module.NFTS,
  Module.PICKLE,
  Module.LIQUITY,
];

export enum DefiProtocol {
  YEARN_VAULTS = 'yearn_vaults',
  YEARN_VAULTS_V2 = 'yearn_vaults_v2',
  AAVE = 'aave',
  MAKERDAO_DSR = 'makerdao_dsr',
  MAKERDAO_VAULTS = 'makerdao_vaults',
  COMPOUND = 'compound',
  UNISWAP = 'uniswap',
  LIQUITY = 'liquity',
}

export function isDefiProtocol(protocol: any): protocol is DefiProtocol {
  return Object.values(DefiProtocol).includes(protocol);
}
