"use client";
import { useState, useEffect } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import styles from "../../styles/send.module.css";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { get } from "http";

export default function Send() {
  const [recipientAddress, setRecipientAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [solBalance, setSolBalance] = useState(0);
  const [selectedToSend, setSelectedoSend] = useState<string>("");
  const [tokens, setTokens] = useState<{ mint: string; balance: string }[]>([]);
  const [showSendDetails, setShowSendDetails] = useState(false);
  const [balFetched, setBalFetched] = useState(false);

  const { publicKey, sendTransaction } = useWallet();

  const connection = new Connection(
    "https://api.devnet.solana.com",
    "confirmed"
  );

  const getSolBalance = async () => {
    if (!publicKey) return;

    await connection.getBalance(publicKey).then((res) => {
      setBalFetched(true);
      setSolBalance(res / LAMPORTS_PER_SOL);
    });
  };

  const solAirdrop = async () => {
    if (!publicKey) return;
    const signature = await connection.requestAirdrop(
      publicKey,
      LAMPORTS_PER_SOL * 2
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    });

    getSolBalance();

    console.log("Airdrop completed", signature);
  };

  const sendSol = async () => {
    if (!publicKey) return;

    if (!recipientAddress || !amount) {
      alert("Please enter recipient address and amount");
      return;
    }

    setIsLoading(true);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: publicKey,
        toPubkey: new PublicKey(recipientAddress),
        lamports: LAMPORTS_PER_SOL * parseFloat(amount),
      })
    );

    tx.feePayer = publicKey;
    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const signature = await sendTransaction(tx, connection);

    await connection.confirmTransaction({
      blockhash,
      lastValidBlockHeight,
      signature,
    });

    console.log("Transaction sent", signature);

    getSolBalance();
    setShowSendDetails(false);

    setIsLoading(false);
  };

  const getSPLToken = async () => {
    if (!publicKey) return;

    const userTokenAccounts = await connection.getParsedTokenAccountsByOwner(
      publicKey,
      { programId: TOKEN_PROGRAM_ID }
    );

    const tokens = await Promise.all(
      userTokenAccounts.value.map((account) => {
        const token = account.account.data.parsed.info;

        return {
          mint: token.mint,
          balance: token.tokenAmount.uiAmountString,
        };
      })
    );

    setTokens(tokens);
  };

  const sendSPLToken = async (mint: string) => {
    console.log(mint, "hi");

    if (!publicKey) return;

    if (!recipientAddress || !amount) {
      alert("Please enter recipient address and amount");
      return;
    }

    try {
      const tx = new Transaction();
      const mintPubKey = new PublicKey(mint);
      const recipientPubKey = new PublicKey(recipientAddress);

      setIsLoading(true);

      const userTokenAccount = await getAssociatedTokenAddress(
        mintPubKey,
        publicKey
      );

      const toTokenAccount = await getAssociatedTokenAddress(
        mintPubKey,
        recipientPubKey
      );

      const checkATA = await connection.getAccountInfo(toTokenAccount);

      if (!checkATA) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            publicKey,
            toTokenAccount,
            recipientPubKey,
            mintPubKey
          )
        );
      }

      const decimals = await getTokenDecimals(mintPubKey);

      const amountLamports = +amount * Math.pow(10, decimals);

      tx.add(
        createTransferInstruction(
          userTokenAccount,
          toTokenAccount,
          publicKey,
          amountLamports
        )
      );

      tx.feePayer = publicKey;

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      tx.recentBlockhash = blockhash;

      const signature = await sendTransaction(tx, connection);

      await connection.confirmTransaction({
        blockhash,
        lastValidBlockHeight,
        signature,
      });

      console.log("Transaction sent", signature);
    } catch (error) {
      console.log(error);
    } finally {
      getSolBalance();
      getSPLToken();
      setShowSendDetails(false);

      setRecipientAddress("");
      setAmount("");

      setSelectedoSend("");

      setIsLoading(false);
    }
  };

  const getTokenDecimals = async (mint: PublicKey) => {
    const info = await connection.getParsedAccountInfo(mint);
    if (!info.value) throw Error("Failed to fetch decimal");

    return (info.value.data as ParsedAccountData).parsed.info
      .decimals as number;
  };

  useEffect(() => {
    getSolBalance();
    getSPLToken();
  }, [publicKey]);

  return (
    <main className={styles.send}>
      <WalletMultiButton />
      {publicKey && (
        <>
          <p>Connected wallet: {publicKey.toBase58()}</p>
          {balFetched && (solBalance < 2 || solBalance === 0) ? (
            <button className={styles.btn} onClick={solAirdrop}>
              Airdrop Sol
            </button>
          ) : null}

          {balFetched ? <p>Solana (SOL) Balance: {solBalance}</p> : null}
          {selectedToSend !== "sol" && balFetched && solBalance > 2 && (
            <button
              className={styles.btn}
              onClick={() => {
                setShowSendDetails(true);
                setSelectedoSend("sol");
              }}
            >
              Send
            </button>
          )}
          {tokens && tokens.length
            ? tokens.map((token, index) => (
                <div key={index} className={styles.token}>
                  <span>Token: {token.mint}</span>
                  <span>Balance: {token.balance}</span>
                  {selectedToSend !== `spl${index + 1}` && (
                    <button
                      onClick={() => {
                        setShowSendDetails(true);
                        setSelectedoSend(`spl${index + 1}`);
                      }}
                    >
                      Send SPL Token {index + 1}
                    </button>
                  )}
                </div>
              ))
            : null}

          {showSendDetails && (
            <>
              <hr style={{ width: "30%" }} />
              <p>Sending {selectedToSend}</p>
              <div className={styles.inputsContainer}>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  className={styles.inputs}
                  placeholder="Enter address"
                />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={styles.inputs}
                  placeholder="Enter amount"
                />
                <div className={styles.btnContainer}>
                  <button
                    className={styles.btnConfirm}
                    onClick={
                      selectedToSend === "sol"
                        ? sendSol
                        : selectedToSend === "spl1"
                        ? () => sendSPLToken(tokens[0].mint)
                        : () => sendSPLToken(tokens[1].mint)
                    }
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading.." : "Confirm"}
                  </button>
                  <button
                    className={styles.btnCancel}
                    onClick={() => {
                      setShowSendDetails(false);
                      setSelectedoSend("");
                      setRecipientAddress("");
                      setAmount("");
                      setIsLoading(false);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
function aysnc() {
  throw new Error("Function not implemented.");
}
