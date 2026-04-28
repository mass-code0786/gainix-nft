import type { Abi, ContractFunctionArgs, ContractFunctionName, PublicClient } from "viem";
import { readContract } from "viem/actions";
import { GAINIX_RPC_READ_TIMEOUT_MS } from "@/lib/web3/rpc-resilience";

interface GainixReadParams<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
> {
  client: PublicClient;
  address: `0x${string}`;
  abi: TAbi;
  functionName: TFunctionName;
  args?: ContractFunctionArgs<TAbi, "pure" | "view", TFunctionName>;
}

export const GAINIX_CONTRACT_READ_TIMEOUT_MS = GAINIX_RPC_READ_TIMEOUT_MS;

function withTimeout<T>(promise: Promise<T>, timeoutMs = GAINIX_CONTRACT_READ_TIMEOUT_MS) {
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`Contract read timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    }),
  ]);
}

export async function readGainixContract<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
>({ client, address, abi, functionName, args }: GainixReadParams<TAbi, TFunctionName>) {
  return withTimeout(
    readContract(client, {
      address,
      abi,
      functionName,
      args,
    }),
  );
}

export async function readGainixContractOrNull<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "pure" | "view">,
>(params: GainixReadParams<TAbi, TFunctionName>) {
  try {
    return await readGainixContract(params);
  } catch {
    return null;
  }
}
