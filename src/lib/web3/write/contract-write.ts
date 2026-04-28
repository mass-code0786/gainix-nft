import type { Abi, ContractFunctionArgs, ContractFunctionName } from "viem";

export interface GainixWriteRequest<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
> {
  address: `0x${string}`;
  abi: TAbi;
  functionName: TFunctionName;
  args?: ContractFunctionArgs<TAbi, "nonpayable" | "payable", TFunctionName>;
  chainId?: number;
  value?: bigint;
}

export function buildGainixWriteRequest<
  TAbi extends Abi,
  TFunctionName extends ContractFunctionName<TAbi, "nonpayable" | "payable">,
>(request: GainixWriteRequest<TAbi, TFunctionName>) {
  return request;
}
