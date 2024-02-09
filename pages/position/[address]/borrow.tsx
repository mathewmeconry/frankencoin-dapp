import Head from "next/head";
import AppPageHeader from "@components/AppPageHeader";
import { useRouter } from "next/router";
import { useEffect } from 'react';
import { formatUnits, getAddress, zeroAddress, maxUint256 } from "viem";
import SwapFieldInput from "@components/SwapFieldInput";
import { usePositionStats } from "@hooks";
import { useState } from "react";
import DisplayAmount from "@components/DisplayAmount";
import Button from "@components/Button";
import { erc20ABI, useAccount, useChainId, useContractWrite } from "wagmi";
import { waitForTransaction } from "wagmi/actions";
import { ABIS, ADDRESS } from "@contracts";
import { formatBigInt, formatDate, min, shortenAddress } from "@utils";
import { toast } from "react-toastify";
import { TxToast, renderErrorToast } from "@components/TxToast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendarDays,
  faHourglassStart,
} from "@fortawesome/free-solid-svg-icons";
import AppBox from "@components/AppBox";

export default function PositionBorrow({}) {
  const router = useRouter();
  const [amount, setAmount] = useState(0n);
  const [error, setError] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const { address: positionAddr } = router.query;
  
  const chainId = useChainId();
  const { address } = useAccount();
  const position = getAddress(String(positionAddr || zeroAddress));
  const positionStats = usePositionStats(position);
  const [expirationDate, setExpirationDate] = useState(new Date());

  useEffect(()=>{
    // to set initial date during loading
    setExpirationDate(toDate(positionStats.expiration));
  },[positionStats.expiration])

  const requiredColl =
    positionStats.liqPrice == 0n
      ? 0n
      : (BigInt(1e18) * amount) / positionStats.liqPrice;
  const borrowersReserveContribution =
    (positionStats.reserveContribution * amount) / 1_000_000n;

  function toDate(blocktime: bigint){
    return new Date(Number(blocktime) * 1000);
  }

  // max(4 weeks, ((chosen expiration) - (current block))) * position.annualInterestPPM() / (365 days) / 1000000
  const feePercent =
    (BigInt(
      Math.max(
        60 * 60 * 24 * 30,
        Math.floor((expirationDate.getTime() - Date.now()) / 1000)
      )
    ) *
      positionStats.annualInterestPPM) /
    BigInt(60 * 60 * 24 * 365);
  const fees = (feePercent * amount) / 1_000_000n;
  const paidOutToWallet = amount - borrowersReserveContribution - fees;
  const availableAmount = positionStats.available;
  const userValue =
    (positionStats.collateralUserBal * positionStats.liqPrice) / BigInt(1e18);
  const borrowingLimit = min(availableAmount, userValue);

  const onChangeAmount = (value: string) => {
    const valueBigInt = BigInt(value);
    setAmount(valueBigInt);
    if (valueBigInt > borrowingLimit) {
      if (availableAmount > userValue) {
        setError(
          `Not enough ${positionStats.collateralSymbol} in your wallet.`
        );
      } else {
        setError("Not enough ZCHF available for this position.");
      }
    } else {
      setError("");
    }
  };

  const onChangeCollateral = (value: string) => {
    const valueBigInt = (BigInt(value) * positionStats.liqPrice) / BigInt(1e18);
    if (valueBigInt > borrowingLimit) {
      setError("Cannot borrow more than " + borrowingLimit + "." + valueBigInt);
    } else {
      setError("");
    }
    setAmount(valueBigInt);
  };

  const onMaxExpiration = () => {
    setExpirationDate(toDate(positionStats.expiration));
  };

  const approveWrite = useContractWrite({
    address: positionStats.collateral,
    abi: erc20ABI,
    functionName: "approve",
  });
  const cloneWrite = useContractWrite({
    address: ADDRESS[chainId].mintingHub,
    abi: ABIS.MintingHubABI,
    functionName: "clone",
  });

  const handleApprove = async () => {
    const tx = await approveWrite.writeAsync({
      args: [ADDRESS[chainId].mintingHub, maxUint256],
    });

    const toastContent = [
      {
        title: "Amount:",
        value: "infinite " + positionStats.collateralSymbol,
      },
      {
        title: "Spender: ",
        value: shortenAddress(ADDRESS[chainId].mintingHub),
      },
      {
        title: "Transaction:",
        hash: tx.hash,
      },
    ];

    await toast.promise(
      waitForTransaction({ hash: tx.hash, confirmations: 1 }),
      {
        pending: {
          render: (
            <TxToast
              title={`Approving ${positionStats.collateralSymbol}`}
              rows={toastContent}
            />
          ),
        },
        success: {
          render: (
            <TxToast
              title={`Successfully Approved ${positionStats.collateralSymbol}`}
              rows={toastContent}
            />
          ),
        },
        error: {
          render(error: any) {
            return renderErrorToast(error);
          },
        },
      }
    );
  };

  const handleClone = async () => {
    const expirationTime = Math.floor(expirationDate.getTime() / 1000);
    const tx = await cloneWrite.writeAsync({
      args: [position, requiredColl, amount, BigInt(expirationTime)],
    });

    const toastContent = [
      {
        title: `Amount: `,
        value: formatBigInt(amount) + " ZCHF",
      },
      {
        title: `Collateral: `,
        value:
          formatBigInt(requiredColl, positionStats.collateralDecimal) +
          " " +
          positionStats.collateralSymbol,
      },
      {
        title: "Transaction:",
        hash: tx.hash,
      },
    ];

    await toast.promise(
      waitForTransaction({ hash: tx.hash, confirmations: 1 }),
      {
        pending: {
          render: <TxToast title={`Borrowing ZCHF`} rows={toastContent} />,
        },
        success: {
          render: (
            <TxToast title="Successfully Borrowed ZCHF" rows={toastContent} />
          ),
        },
        error: {
          render(error: any) {
            return renderErrorToast(error);
          },
        },
      }
    );
  };

  return (
    <>
      <Head>
        <title>Frankencoin - Borrow</title>
      </Head>
      <div>
        <AppPageHeader
          title="Borrow"
          backText="Back to position"
          backTo={`/position/${position}`}
        />
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950 rounded-xl p-4 flex flex-col gap-y-4">
            <div className="text-lg font-bold text-center mt-3">
              Borrow by Cloning an Existing Position
            </div>
            <div className="space-y-8">
              <SwapFieldInput
                label="Amount"
                balanceLabel="Limit:"
                symbol="ZCHF"
                error={error}
                max={availableAmount}
                value={amount.toString()}
                onChange={onChangeAmount}
                placeholder="Borrow Amount"
              />
              <SwapFieldInput
                showOutput
                label="Required Collateral"
                balanceLabel="Your balance:"
                max={positionStats.collateralUserBal}
                digit={positionStats.collateralDecimal}
                onChange={onChangeCollateral}
                output={formatUnits(
                  requiredColl,
                  positionStats.collateralDecimal
                )}
                symbol={positionStats.collateralSymbol}
                note={`Valued at ${formatBigInt(
                  positionStats.liqPrice,
                  36 - positionStats.collateralDecimal
                )} ZCHF per unit`}
              />
              <div>
                <div className="mb-1 flex gap-2 px-1">
                  <div className="flex-1">Expiration</div>
                  <div>
                    Limit:{" "}
                    <span
                      className="text-link cursor-pointer"
                      onClick={onMaxExpiration}
                    >
                      {formatDate(positionStats.expiration)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center rounded-lg bg-slate-800 p-2">
                  <FontAwesomeIcon
                    icon={faHourglassStart}
                    className="w-10 h-8 mr-2"
                  />
                  <div className="flex-1">
                    <div
                      className={`flex gap-1 rounded-lg text-white p-1 bg-slate-600 border-2 border-neutral-100 border-slate-600`}
                    >
                      <DatePicker
                        selected={expirationDate}
                        onChange={(date: any) => setExpirationDate(date)}
                      />
                    </div>
                  </div>
                  <div className="hidden w-20 px-4 text-end font-bold sm:block">
                    <FontAwesomeIcon
                      icon={faCalendarDays}
                      className="w-10 h-8 ml-2"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="mx-auto mt-8 w-72 max-w-full flex-col">
              {requiredColl > positionStats.collateralAllowance ? (
                <Button
                  disabled={amount == 0n || !!error}
                  isLoading={approveWrite.isLoading || isConfirming}
                  onClick={() => handleApprove()}
                >
                  Approve
                </Button>
              ) : (
                <Button
                  variant="primary"
                  disabled={amount == 0n || !!error || requiredColl < positionStats.minimumCollateral}
                  isLoading={cloneWrite.isLoading || isConfirming}
                  onClick={() => handleClone()}
                  error={requiredColl < positionStats.minimumCollateral ? "A position must have at least " + formatBigInt(positionStats.minimumCollateral, Number(positionStats.collateralDecimal))  + " " + positionStats.collateralSymbol : ""}
                >
                  Clone Position
                </Button>
              )}
            </div>
          </div>
          <div>
            <div className="bg-slate-950 rounded-xl p-4 flex flex-col">
              <div className="text-lg font-bold text-center mt-3">Outcome</div>
              <div className="bg-slate-900 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex">
                  <div className="flex-1">Paid to your wallet</div>
                  <DisplayAmount
                    amount={paidOutToWallet}
                    currency="ZCHF"
                    address={ADDRESS[chainId].frankenCoin}
                    hideLogo
                  />
                </div>
                <div className="flex">
                  <div className="flex-1">Locked in borrowers reserve</div>
                  <DisplayAmount
                    amount={borrowersReserveContribution}
                    currency="ZCHF"
                    address={ADDRESS[chainId].frankenCoin}
                    hideLogo
                  />
                </div>
                <div className="flex">
                  <div className="flex-1">
                    Fees ({formatBigInt(feePercent, 4)}%)
                  </div>
                  <DisplayAmount
                    amount={fees}
                    currency="ZCHF"
                    address={ADDRESS[chainId].frankenCoin}
                    hideLogo
                  />
                </div>
                <hr className="border-slate-700 border-dashed" />
                <div className="flex font-bold">
                  <div className="flex-1">Total</div>
                  <DisplayAmount
                    amount={amount}
                    currency="ZCHF"
                    address={ADDRESS[chainId].frankenCoin}
                    hideLogo
                  />
                </div>
              </div>
            </div>
            <div className="bg-slate-950 rounded-xl p-4 flex flex-col mt-4">
              <div className="text-lg font-bold text-center mt-3">Notes</div>
              <AppBox className="flex-1 mt-4">
                <p>
                  Note that in the current version, the following limits apply:
                </p>
                <ol className="flex flex-col gap-y-2 pl-6 [&>li]:list-decimal">
                  <li>
                    The amount borrowed can be changed later, but never
                    increased beyond the initial amount provided at this point
                    in time
                  </li>
                  <li>
                    The initial price must match that of the parent position,
                    but can be adjusted later in either direction
                  </li>
                  <li>
                    The expiration date cannot be changed any more and the fees
                    are not returned when repaying early
                  </li>
                </ol>
              </AppBox>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
