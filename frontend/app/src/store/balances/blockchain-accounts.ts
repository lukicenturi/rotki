import { Balance, BigNumber, HasBalance } from '@rotki/common';
import { GeneralAccount } from '@rotki/common/lib/account';
import { Blockchain } from '@rotki/common/lib/blockchain';
import { Message, Severity } from '@rotki/common/lib/messages';
import {
  Eth2ValidatorEntry,
  Eth2Validators
} from '@rotki/common/lib/staking/eth2';
import { computed, Ref, ref } from '@vue/composition-api';
import { get, set } from '@vueuse/core';
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia';
import { bigNumberSum } from '@/filters';
import i18n from '@/i18n';
import {
  BlockchainAssetBalances,
  BlockchainBalances,
  BtcBalances
} from '@/services/balances/types';
import { api } from '@/services/rotkehlchen-api';
import {
  BtcAccountData,
  GeneralAccountData,
  XpubAccountData
} from '@/services/types-api';
import { useBalancesStore } from '@/store/balances';
import { useBlockchainBalancesStore } from '@/store/balances/blockchain-balances';
import { useEthNamesStore } from '@/store/balances/ethereum-names';
import {
  AccountPayload,
  AddAccountsPayload,
  BasicBlockchainAccountPayload,
  BlockchainAccountPayload,
  BlockchainAccountWithBalance,
  BlockchainTotal,
  SubBlockchainTotal,
  XpubPayload
} from '@/store/balances/types';
import { Section, Status } from '@/store/const';
import { useDefiStore } from '@/store/defi';
import { useMainStore } from '@/store/main';
import { useNotifications } from '@/store/notifications';
import { useSettingsStore } from '@/store/settings';
import { useGeneralSettingsStore } from '@/store/settings/general';
import { useTasks } from '@/store/tasks';
import { getStatus, getStatusUpdater } from '@/store/utils';
import { Eth2Validator } from '@/types/balances';
import { Module } from '@/types/modules';
import { L2_LOOPRING } from '@/types/protocols';
import { BlockchainMetadata, TaskMeta } from '@/types/task';
import { TaskType } from '@/types/task-type';
import { ReadOnlyTag } from '@/types/user';
import { assert } from '@/utils/assertions';
import { sortDesc, Zero, zeroBalance } from '@/utils/bignumbers';
import { assetSum, balanceSum } from '@/utils/calculation';
import { uniqueStrings } from '@/utils/data';
import { logger } from '@/utils/logging';

const removeTag = (tags: string[] | null, tagName: string): string[] | null => {
  if (!tags) {
    return null;
  }

  const index = tags.indexOf(tagName);

  if (index < 0) {
    return null;
  }

  return [...tags.slice(0, index), ...tags.slice(index + 1)];
};

const removeTags = <T extends { tags: string[] | null }>(
  data: T[],
  tagName: string
): T[] => {
  const accounts = [...data];
  for (let i = 0; i < accounts.length; i++) {
    const account = accounts[i];
    const tags = removeTag(account.tags, tagName);

    if (!tags) {
      continue;
    }

    accounts[i] = {
      ...accounts[i],
      tags
    };
  }
  return accounts;
};

const accountsWithBalances = (
  accounts: GeneralAccountData[],
  balances: BlockchainAssetBalances,
  blockchain: Exclude<Blockchain, 'BTC'>
): BlockchainAccountWithBalance[] => {
  const data: BlockchainAccountWithBalance[] = [];
  for (const account of accounts) {
    const accountAssets = balances[account.address];

    const balance: Balance = accountAssets
      ? {
          amount: accountAssets?.assets[blockchain]?.amount ?? Zero,
          usdValue: assetSum(accountAssets.assets)
        }
      : zeroBalance();

    data.push({
      address: account.address,
      label: account.label ?? '',
      tags: account.tags ?? [],
      chain: blockchain,
      balance
    });
  }
  return data;
};

const btcAccountsWithBalances = (
  accountsData: BtcAccountData,
  balances: BtcBalances,
  blockchain: Blockchain.BTC | Blockchain.BCH
) => {
  const accounts: BlockchainAccountWithBalance[] = [];

  const { standalone, xpubs } = accountsData;
  for (const { address, label, tags } of standalone) {
    const balance = balances.standalone?.[address] ?? zeroBalance();
    accounts.push({
      address,
      label: label ?? '',
      tags: tags ?? [],
      chain: blockchain,
      balance
    });
  }

  for (const { addresses, derivationPath, label, tags, xpub } of xpubs) {
    accounts.push({
      chain: blockchain,
      xpub,
      derivationPath: derivationPath ?? '',
      address: '',
      label: label ?? '',
      tags: tags ?? [],
      balance: zeroBalance()
    });

    if (!addresses) {
      continue;
    }

    for (const { address, label, tags } of addresses) {
      const { xpubs } = balances;
      if (!xpubs) {
        continue;
      }
      const index = xpubs.findIndex(xpub => xpub.addresses[address]) ?? -1;
      const balance =
        index >= 0 ? xpubs[index].addresses[address] : zeroBalance();
      accounts.push({
        chain: blockchain,
        xpub,
        derivationPath: derivationPath ?? '',
        address,
        label: label ?? '',
        tags: tags ?? [],
        balance
      });
    }
  }
  return accounts;
};

export const useBlockchainAccountsStore = defineStore(
  'balances/blockchain/account',
  () => {
    const ethAccountsState = ref<GeneralAccountData[]>([]);
    const eth2ValidatorsState = ref<Eth2Validators>({
      entries: [],
      entriesFound: 0,
      entriesLimit: 0
    });
    const btcAccountsState = ref<BtcAccountData>({
      standalone: [],
      xpubs: []
    });
    const bchAccountsState = ref<BtcAccountData>({
      standalone: [],
      xpubs: []
    });
    const ksmAccountsState = ref<GeneralAccountData[]>([]);
    const dotAccountsState = ref<GeneralAccountData[]>([]);
    const avaxAccountsState = ref<GeneralAccountData[]>([]);

    const { awaitTask, isTaskRunning } = useTasks();
    const { notify } = useNotifications();
    const { setMessage } = useMainStore();

    const fetchAccounts = async (blockchains: Blockchain[] | null = null) => {
      const error = (error: any, blockchain: Blockchain) => {
        logger.error(error);
        notify({
          title: i18n.t('actions.get_accounts.error.title').toString(),
          message: i18n
            .t('actions.get_accounts.error.description', {
              blockchain: Blockchain[blockchain],
              message: error.message
            })
            .toString(),
          display: true
        });
      };

      const getAccounts = async (
        blockchain: Exclude<
          Blockchain,
          Blockchain.BTC | Blockchain.BCH | Blockchain.ETH2
        >
      ) => {
        try {
          const accounts = await api.accounts(blockchain);
          const listState = {
            [Blockchain.ETH]: ethAccountsState,
            [Blockchain.KSM]: ksmAccountsState,
            [Blockchain.DOT]: dotAccountsState,
            [Blockchain.AVAX]: avaxAccountsState
          };

          const state = listState[blockchain];
          if (state) {
            set(state, accounts);

            if (blockchain === Blockchain.ETH) {
              const addresses = accounts.map(account => account.address);
              const { fetchEnsNames } = useEthNamesStore();
              fetchEnsNames(addresses, true);
            }
          } else {
            throw Error(`invalid argument ${Blockchain[blockchain]}`);
          }
        } catch (e) {
          error(e, blockchain);
        }
      };

      const getBtcAccounts = async (
        blockchain: Blockchain.BTC | Blockchain.BCH
      ) => {
        try {
          const accounts = await api.btcAccounts(blockchain);
          const listState = {
            [Blockchain.BTC]: btcAccountsState,
            [Blockchain.BCH]: bchAccountsState
          };
          const state = listState[blockchain];
          set(state, accounts);
        } catch (e) {
          error(e, blockchain);
        }
      };

      const getEth2Validators = async () => {
        const { activeModules } = useGeneralSettingsStore();
        if (!activeModules.includes(Module.ETH2)) {
          return;
        }
        try {
          const validators = await api.balances.getEth2Validators();
          set(eth2ValidatorsState, validators);
        } catch (e: any) {
          error(e, Blockchain.ETH2);
        }
      };

      const requests: Promise<void>[] = [];

      const addRequest = <T extends Blockchain>(
        blockchain: T,
        getRequest: (blockchain: T) => Promise<void>
      ) => {
        if (
          !blockchains ||
          blockchains.length === 0 ||
          blockchains.includes(blockchain)
        ) {
          requests.push(getRequest(blockchain));
        }
      };

      [Blockchain.ETH, Blockchain.KSM, Blockchain.DOT, Blockchain.AVAX].forEach(
        blockchain => {
          addRequest(blockchain, chain => getAccounts(chain));
        }
      );

      [Blockchain.BTC, Blockchain.BCH].forEach(blockchain => {
        addRequest(blockchain, chain => getBtcAccounts(chain));
      });

      addRequest(Blockchain.ETH2, () => getEth2Validators());
      await Promise.allSettled(requests);
    };

    const blockchainBalancesStore = useBlockchainBalancesStore();

    const {
      ethBalancesState,
      eth2BalancesState,
      dotBalancesState,
      ksmBalancesState,
      avaxBalancesState,
      btcBalancesState,
      bchBalancesState,
      loopringBalancesState
    } = storeToRefs(blockchainBalancesStore);

    const { updateBlockchainBalances, fetchBlockchainBalances } =
      blockchainBalancesStore;

    const { refreshPrices, fetchNfBalances } = useBalancesStore();

    const addAccounts = async ({
      blockchain,
      payload,
      modules
    }: AddAccountsPayload) => {
      const taskType = TaskType.ADD_ACCOUNT;
      if (get(isTaskRunning(taskType))) {
        return;
      }

      // Check if accounts have already registered
      const listState = {
        [Blockchain.ETH]: ethAccountsState,
        [Blockchain.AVAX]: avaxAccountsState,
        [Blockchain.DOT]: dotAccountsState,
        [Blockchain.KSM]: ksmAccountsState
      };
      let accountsToAdd = payload;

      // @ts-ignore
      const existingAccounts = listState[blockchain];
      if (existingAccounts) {
        const existingAccountsVal = get(existingAccounts);

        const existingAddresses = existingAccountsVal.map(address =>
          address.address.toLocaleLowerCase()
        );
        accountsToAdd = payload.filter(
          value =>
            !existingAddresses.includes(value.address.toLocaleLowerCase())
        );
      }

      if (accountsToAdd.length === 0) {
        const title = i18n.tc(
          'actions.balances.blockchain_accounts_add.no_new.title',
          0,
          { blockchain }
        );
        const description = i18n.tc(
          'actions.balances.blockchain_accounts_add.no_new.description'
        );
        notify({
          title,
          message: description,
          severity: Severity.INFO,
          display: true
        });
        return;
      }

      const addAccount = async (
        blockchain: Blockchain,
        { address, label, tags }: AccountPayload,
        modules?: Module[]
      ) => {
        try {
          const { taskId } = await api.addBlockchainAccount({
            blockchain,
            address,
            label,
            tags
          });

          const { result } = await awaitTask<
            BlockchainBalances,
            BlockchainMetadata
          >(
            taskId,
            taskType,
            {
              title: i18n.tc(
                'actions.balances.blockchain_accounts_add.task.title',
                0,
                { blockchain }
              ),
              description: i18n.tc(
                'actions.balances.blockchain_accounts_add.task.description',
                0,
                { address }
              ),
              blockchain,
              numericKeys: []
            } as BlockchainMetadata,
            true
          );

          if (modules && blockchain === Blockchain.ETH) {
            const { enableModule } = useSettingsStore();
            await enableModule({
              enable: modules,
              addresses: [address]
            });
          }

          const balances = BlockchainBalances.parse(result);
          await updateBlockchainBalances({ chain: blockchain, balances });
        } catch (e) {
          logger.error(e);
        }
      };

      const requests = accountsToAdd.map(value =>
        addAccount(blockchain, value, modules)
      );

      try {
        await Promise.allSettled(requests);
        useDefiStore().reset();
        useMainStore().resetDefiStatus();
        fetchNfBalances();

        if (blockchain === Blockchain.ETH) {
          await fetchBlockchainBalances({
            blockchain: Blockchain.ETH2,
            ignoreCache: false
          });
        }
        await refreshPrices({ ignoreCache: false });
      } catch (e: any) {
        logger.error(e);
        const title = i18n.tc(
          'actions.balances.blockchain_accounts_add.error.title',
          0,
          { blockchain }
        );
        const description = i18n.tc(
          'actions.balances.blockchain_accounts_add.error.description',
          0,
          {
            error: e.message,
            address: accountsToAdd.length,
            blockchain
          }
        );
        notify({
          title,
          message: description,
          display: true
        });
      }
    };

    const editAccount = async (payload: BlockchainAccountPayload) => {
      const { blockchain } = payload;
      const list = [
        {
          blockchain: Blockchain.ETH,
          state: ethAccountsState
        },
        {
          blockchain: Blockchain.DOT,
          state: dotAccountsState
        },
        {
          blockchain: Blockchain.KSM,
          state: ksmAccountsState
        },
        {
          blockchain: Blockchain.AVAX,
          state: avaxAccountsState
        },
        {
          blockchain: Blockchain.BTC,
          state: btcAccountsState,
          caller: api.editBtcAccount
        },
        {
          blockchain: Blockchain.BCH,
          state: bchAccountsState,
          caller: api.editBtcAccount
        }
      ];

      list.forEach(async item => {
        const caller = item.caller ?? api.editAccount;
        const accountData = await caller(payload);
        set(item.state, accountData);
      });

      const { fetchEthNames } = useEthNamesStore();
      if (blockchain === Blockchain.ETH) {
        fetchEthNames();
      }
    };

    const deleteXpub = async (payload: XpubPayload) => {
      try {
        const taskType = TaskType.REMOVE_ACCOUNT;
        if (get(isTaskRunning(taskType))) {
          return;
        }
        const { taskId } = await api.deleteXpub(payload);
        const { result } = await awaitTask<
          BlockchainBalances,
          BlockchainMetadata
        >(taskId, taskType, {
          title: i18n.tc('actions.balances.xpub_removal.task.title'),
          description: i18n.tc(
            'actions.balances.xpub_removal.task.description',
            0,
            {
              xpub: payload.xpub
            }
          ),
          blockchain: payload.blockchain,
          numericKeys: []
        } as BlockchainMetadata);
        const balances = BlockchainBalances.parse(result);
        await updateBlockchainBalances({
          chain: payload.blockchain,
          balances
        });
      } catch (e: any) {
        logger.error(e);
        const title = i18n.tc('actions.balances.xpub_removal.error.title');
        const description = i18n.tc(
          'actions.balances.xpub_removal.error.description',
          0,
          {
            xpub: payload.xpub,
            error: e.message
          }
        );
        notify({
          title,
          message: description,
          display: true
        });
      }
    };

    const removeAccount = async (payload: BasicBlockchainAccountPayload) => {
      const { accounts, blockchain } = payload;
      assert(accounts, 'Accounts was empty');
      const { taskId } = await api.removeBlockchainAccount(
        blockchain,
        accounts
      );
      try {
        const taskType = TaskType.REMOVE_ACCOUNT;
        const { result } = await awaitTask<
          BlockchainBalances,
          BlockchainMetadata
        >(taskId, taskType, {
          title: i18n.tc(
            'actions.balances.blockchain_account_removal.task.title',
            0,
            {
              blockchain
            }
          ),
          description: i18n.tc(
            'actions.balances.blockchain_account_removal.task.description',
            0,
            { count: accounts.length }
          ),
          blockchain,
          numericKeys: []
        } as BlockchainMetadata);

        const balances = BlockchainBalances.parse(result);

        useDefiStore().reset();
        useMainStore().resetDefiStatus();
        fetchNfBalances();

        await updateBlockchainBalances({ chain: blockchain, balances });
        await refreshPrices({ ignoreCache: false });
      } catch (e: any) {
        logger.error(e);
        const title = i18n.tc(
          'actions.balances.blockchain_account_removal.error.title',
          0,
          { count: accounts.length, blockchain }
        );
        const description = i18n.tc(
          'actions.balances.blockchain_account_removal.error.description',
          0,
          {
            error: e.message
          }
        );
        notify({
          title,
          message: description,
          display: true
        });
      }
    };

    const addEth2Validator = async (payload: Eth2Validator) => {
      const { activeModules } = useGeneralSettingsStore();
      if (!activeModules.includes(Module.ETH2)) {
        return;
      }
      const id = payload.publicKey || payload.validatorIndex;
      try {
        const taskType = TaskType.ADD_ETH2_VALIDATOR;
        const { taskId } = await api.balances.addEth2Validator(payload);
        const { result } = await awaitTask<Boolean, TaskMeta>(
          taskId,
          taskType,
          {
            title: i18n.t('actions.add_eth2_validator.task.title').toString(),
            description: i18n
              .t('actions.add_eth2_validator.task.description', { id })
              .toString(),
            numericKeys: []
          }
        );
        if (result) {
          const { resetStatus } = getStatusUpdater(Section.STAKING_ETH2);
          await fetchBlockchainBalances({
            blockchain: Blockchain.ETH2,
            ignoreCache: true
          });
          resetStatus();
          resetStatus(Section.STAKING_ETH2_DEPOSITS);
          resetStatus(Section.STAKING_ETH2_STATS);
        }

        return result;
      } catch (e: any) {
        logger.error(e);
        setMessage({
          description: i18n
            .t('actions.add_eth2_validator.error.description', {
              id,
              message: e.message
            })
            .toString(),
          title: i18n.t('actions.add_eth2_validator.error.title').toString(),
          success: false
        });
        return false;
      }
    };

    const editEth2Validator = async (payload: Eth2Validator) => {
      const { activeModules } = useGeneralSettingsStore();
      if (!activeModules.includes(Module.ETH2)) {
        return;
      }

      const id = payload.validatorIndex;
      try {
        const success = await api.balances.editEth2Validator(payload);

        if (success) {
          const { resetStatus } = getStatusUpdater(Section.STAKING_ETH2);
          await fetchBlockchainBalances({
            blockchain: Blockchain.ETH2,
            ignoreCache: true
          });
          resetStatus();
          resetStatus(Section.STAKING_ETH2_DEPOSITS);
          resetStatus(Section.STAKING_ETH2_STATS);
        }

        return success;
      } catch (e: any) {
        logger.error(e);
        const message: Message = {
          description: i18n
            .t('actions.edit_eth2_validator.error.description', {
              id,
              message: e.message
            })
            .toString(),
          title: i18n.t('actions.edit_eth2_validator.error.title').toString(),
          success: false
        };
        await setMessage(message);
        return false;
      }
    };

    const deleteEth2Validators = async (validators: string[]) => {
      try {
        const validatorsState = get(eth2ValidatorsState);
        const entries = [...validatorsState.entries];
        const eth2Validators = entries.filter(({ publicKey }) =>
          validators.includes(publicKey)
        );
        const success = await api.balances.deleteEth2Validators(eth2Validators);
        if (success) {
          const remainingValidators = entries.filter(
            ({ publicKey }) => !validators.includes(publicKey)
          );
          const data: Eth2Validators = {
            entriesLimit: validatorsState.entriesLimit,
            entriesFound: remainingValidators.length,
            entries: remainingValidators
          };
          set(eth2ValidatorsState, data);
          const balances = { ...get(eth2BalancesState) };
          for (const validator of validators) {
            delete balances[validator];
          }
          set(eth2BalancesState, balances);
        }
        return success;
      } catch (e: any) {
        logger.error(e);
        setMessage({
          description: i18n
            .t('actions.delete_eth2_validator.error.description', {
              message: e.message
            })
            .toString(),
          title: i18n.t('actions.delete_eth2_validator.error.title').toString(),
          success: false
        });
        return false;
      }
    };

    const removeBlockchainTags = async (tagName: string) => {
      const updateDefaultBlockchainTags = (
        state: Ref<GeneralAccountData[]>
      ) => {
        const accounts = removeTags(get(state), tagName);
        set(state, accounts);
      };

      [
        ethAccountsState,
        dotAccountsState,
        ksmAccountsState,
        avaxAccountsState
      ].forEach(state => updateDefaultBlockchainTags(state));

      const updateBtcNetworkTags = (state: Ref<BtcAccountData>) => {
        const accounts = get(state);
        const standalone = removeTags(accounts.standalone, tagName);

        const xpubs: XpubAccountData[] = [];

        for (let i = 0; i < accounts.xpubs.length; i++) {
          const xpub = accounts.xpubs[i];
          xpubs.push({
            ...xpub,
            tags: removeTag(xpub.tags, tagName),
            addresses: xpub.addresses
              ? removeTags(xpub.addresses, tagName)
              : null
          });
        }

        set(state, {
          standalone,
          xpubs
        });
      };

      updateBtcNetworkTags(btcAccountsState);
      updateBtcNetworkTags(bchAccountsState);
    };

    const ethAccounts = computed<BlockchainAccountWithBalance[]>(() => {
      const accounts = accountsWithBalances(
        get(ethAccountsState),
        get(ethBalancesState),
        Blockchain.ETH
      );

      return accounts.map(ethAccount => {
        const address = ethAccount.address;
        const tags = ethAccount.tags ? [...ethAccount.tags] : [];

        // check if account have loopring balances
        const loopringAssetBalances = get(loopringBalancesState)[address];
        if (loopringAssetBalances) {
          tags.push(ReadOnlyTag.LOOPRING);
        }

        return {
          ...ethAccount,
          tags: tags.filter(uniqueStrings)
        };
      });
    });

    const ksmAccounts = computed<BlockchainAccountWithBalance[]>(() => {
      return accountsWithBalances(
        get(ksmAccountsState),
        get(ksmBalancesState),
        Blockchain.KSM
      );
    });

    const dotAccounts = computed<BlockchainAccountWithBalance[]>(() => {
      return accountsWithBalances(
        get(dotAccountsState),
        get(dotBalancesState),
        Blockchain.DOT
      );
    });

    const avaxAccounts = computed<BlockchainAccountWithBalance[]>(() => {
      return accountsWithBalances(
        get(avaxAccountsState),
        get(avaxBalancesState),
        Blockchain.AVAX
      );
    });

    const eth2Accounts = computed<BlockchainAccountWithBalance[]>(() => {
      const balances: BlockchainAccountWithBalance[] = [];
      for (const { publicKey, validatorIndex, ownershipPercentage } of get(
        eth2ValidatorsState
      ).entries) {
        const validatorBalances = get(eth2BalancesState)[publicKey];
        let balance: Balance = zeroBalance();
        if (validatorBalances && validatorBalances.assets) {
          const assets = validatorBalances.assets;
          balance = {
            amount: assets[Blockchain.ETH2].amount,
            usdValue: assetSum(assets)
          };
        }
        balances.push({
          address: publicKey,
          chain: Blockchain.ETH2,
          balance,
          label: validatorIndex.toString() ?? '',
          tags: [],
          ownershipPercentage
        });
      }
      return balances;
    });

    const btcAccounts = computed<BlockchainAccountWithBalance[]>(() => {
      return btcAccountsWithBalances(
        get(btcAccountsState),
        get(btcBalancesState),
        Blockchain.BTC
      );
    });

    const bchAccounts = computed<BlockchainAccountWithBalance[]>(() => {
      return btcAccountsWithBalances(
        get(bchAccountsState),
        get(bchBalancesState),
        Blockchain.BCH
      );
    });

    const loopringAccounts = computed<BlockchainAccountWithBalance[]>(() => {
      const accounts: BlockchainAccountWithBalance[] = [];
      const loopringBalances = get(loopringBalancesState);
      for (const address in loopringBalances) {
        const assets = loopringBalances[address];

        const tags =
          get(ethAccountsState).find(account => account.address === address)
            ?.tags || [];

        const balance = zeroBalance();

        for (const asset in assets) {
          const assetBalance = assets[asset];

          const sum = balanceSum(balance, assetBalance);
          balance.amount = sum.amount;
          balance.usdValue = sum.usdValue;
        }

        accounts.push({
          address,
          balance,
          chain: Blockchain.ETH,
          label: '',
          tags: [...tags, ReadOnlyTag.LOOPRING].filter(uniqueStrings)
        });
      }
      return accounts;
    });

    const blockchainSummary = computed<BlockchainTotal[]>(() => {
      const sum = (accounts: HasBalance[]): BigNumber => {
        return bigNumberSum(accounts.map(account => account.balance.usdValue));
      };

      const getEthChildrenTotals = () => {
        const childrenTotals: SubBlockchainTotal[] = [];

        const loopring = get(loopringBalancesState);
        if (Object.keys(loopring).length > 0) {
          const balances: { [asset: string]: HasBalance } = {};
          for (const address in loopring) {
            for (const asset in loopring[address]) {
              if (!balances[asset]) {
                balances[asset] = {
                  balance: loopring[address][asset]
                };
              } else {
                balances[asset] = {
                  balance: balanceSum(
                    loopring[address][asset],
                    balances[asset].balance
                  )
                };
              }
            }
          }
          const loopringStatus = getStatus(Section.L2_LOOPRING_BALANCES);
          childrenTotals.push({
            protocol: L2_LOOPRING,
            usdValue: sum(Object.values(balances)),
            loading:
              loopringStatus === Status.NONE ||
              loopringStatus === Status.LOADING
          });
        }

        return childrenTotals.sort((a, b) => sortDesc(a.usdValue, b.usdValue));
      };

      const list = [
        {
          blockchain: Blockchain.ETH,
          section: Section.BLOCKCHAIN_ETH,
          childrenTotals: getEthChildrenTotals(),
          accounts: get(ethAccounts)
        },
        {
          blockchain: Blockchain.BTC,
          section: Section.BLOCKCHAIN_BTC,
          childrenTotals: [],
          accounts: get(btcAccounts)
        },
        {
          blockchain: Blockchain.BCH,
          section: Section.BLOCKCHAIN_BCH,
          childrenTotals: [],
          accounts: get(bchAccounts)
        },
        {
          blockchain: Blockchain.KSM,
          section: Section.BLOCKCHAIN_KSM,
          childrenTotals: [],
          accounts: get(ksmAccounts)
        },
        {
          blockchain: Blockchain.DOT,
          section: Section.BLOCKCHAIN_DOT,
          childrenTotals: [],
          accounts: get(dotAccounts)
        },
        {
          blockchain: Blockchain.AVAX,
          section: Section.BLOCKCHAIN_AVAX,
          childrenTotals: [],
          accounts: get(avaxAccounts)
        },
        {
          blockchain: Blockchain.ETH2,
          section: Section.BLOCKCHAIN_ETH2,
          childrenTotals: [],
          accounts: get(eth2Accounts)
        }
      ];

      const totals: BlockchainTotal[] = [];

      list.forEach(item => {
        if (item.accounts.length > 0) {
          const sectionStatus = getStatus(item.section);
          totals.push({
            chain: item.blockchain,
            children: item.childrenTotals,
            usdValue: sum(item.accounts),
            loading:
              sectionStatus === Status.NONE || sectionStatus === Status.LOADING
          });
        }
      });

      return totals
        .filter(item => item.usdValue.gt(0))
        .sort((a, b) => sortDesc(a.usdValue, b.usdValue));
    });

    const ethAddresses = computed<string[]>(() => {
      return get(ethAccountsState).map(({ address }) => address);
    });

    const accounts = computed<GeneralAccount[]>(() => {
      return get(ethAccounts)
        .concat(get(btcAccounts))
        .concat(get(bchAccounts))
        .concat(get(ksmAccounts))
        .concat(get(dotAccounts))
        .concat(get(avaxAccounts))
        .filter((account: BlockchainAccountWithBalance) => !!account.address)
        .map((account: BlockchainAccountWithBalance) => ({
          chain: account.chain,
          address: account.address,
          label: account.label,
          tags: account.tags
        }));
    });

    const getAccountByAddress = (address: string) =>
      computed<GeneralAccount | undefined>(() => {
        return get(accounts).find(acc => acc.address === address);
      });

    const getEth2Account = (publicKey: string) =>
      computed(() => {
        const validator = get(eth2ValidatorsState).entries.find(
          (eth2Validator: Eth2ValidatorEntry) =>
            eth2Validator.publicKey === publicKey
        );

        if (!validator) return undefined;

        return {
          address: validator.publicKey,
          label: validator.validatorIndex.toString() ?? '',
          tags: [],
          chain: Blockchain.ETH2
        };
      });

    const reset = () => {
      set(ethAccountsState, []);
      set(eth2ValidatorsState, {
        entries: [],
        entriesFound: 0,
        entriesLimit: 0
      });
      set(btcAccountsState, {
        standalone: [],
        xpubs: []
      });
      set(bchAccountsState, {
        standalone: [],
        xpubs: []
      });
      set(ksmAccountsState, []);
      set(dotAccountsState, []);
      set(avaxAccountsState, []);
    };

    return {
      ethAccountsState,
      ksmAccountsState,
      dotAccountsState,
      avaxAccountsState,
      btcAccountsState,
      bchAccountsState,
      eth2ValidatorsState,
      ethAccounts,
      ksmAccounts,
      dotAccounts,
      avaxAccounts,
      btcAccounts,
      bchAccounts,
      eth2Accounts,
      loopringAccounts,
      accounts,
      ethAddresses,
      blockchainSummary,
      fetchAccounts,
      addAccounts,
      editAccount,
      deleteXpub,
      removeAccount,
      addEth2Validator,
      editEth2Validator,
      deleteEth2Validators,
      removeBlockchainTags,
      getAccountByAddress,
      getEth2Account,
      reset
    };
  }
);

if (import.meta.hot) {
  import.meta.hot.accept(
    acceptHMRUpdate(useBlockchainAccountsStore, import.meta.hot)
  );
}
