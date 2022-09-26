import { z } from 'zod';

export interface ActionResult<T> {
  readonly result: T;
  readonly message: string;
}

export enum EvmChain {
  ETHEREUM = 'ethereum',
  OPTIMISM = 'optimism',
  BINANCE = 'binance',
  GNOSIS = 'gnosis',
  MATIC = 'matic',
  FANTOM = 'fantom',
  ARBITRUM = 'arbitrum',
  AVALANCHE = 'avalanche'
}

export const EvmChainEnum = z.nativeEnum(EvmChain);
export type EvmChainEnum = z.infer<typeof EvmChainEnum>;

export enum EvmTokenKind {
  ERC20 = 'erc20',
  ERC721 = 'erc721'
}

export const EvmTokenKindEnum = z.nativeEnum(EvmTokenKind);
export type EvmTokenKindEnum = z.infer<typeof EvmTokenKindEnum>;

export const UnderlyingToken = z.object({
  address: z.string(),
  tokenKind: EvmTokenKindEnum,
  weight: z.string()
});

export type UnderlyingToken = z.infer<typeof UnderlyingToken>;

export const BaseAsset = z.object({
  identifier: z.string(),
  coingecko: z.string().nullish(),
  cryptocompare: z.string().nullish(),
  started: z.number().nullish(),
  name: z.string().nullish(),
  symbol: z.string().nullish(),
  swappedFor: z.string().nullish(),
  chain: EvmChainEnum.nullish(),
  tokenKind: EvmTokenKindEnum.nullish()
});

export type BaseAsset = z.infer<typeof BaseAsset>;

export const SupportedAsset = BaseAsset.extend({
  active: z.boolean().optional(),
  ended: z.number().nullish(),
  decimals: z.number().nullish(),
  type: z.string().nullish(),
  forked: z.string().nullish(),
  address: z.string().nullish(),
  underlyingTokens: z.array(UnderlyingToken).optional(),
  protocol: z.string().nullish()
})

export type SupportedAsset = z.infer<typeof SupportedAsset>;

export const AssetInfo = z.object({
  name: z.string().nullish(),
  symbol: z.string().nullish()
});

export type AssetInfo = z.infer<typeof AssetInfo>;
