"use client";

import { useState } from "react";

import { CreateWallet } from "@/components/CreateWallet";

import styles from "./page.module.css";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
  const [userAddress, setUserAddress] = useState("");
  const [userPrivateKey, setUserPrivateKey] = useState("");

  const { publicKey } = useWallet();

  const wallet = () => {
    const create = CreateWallet();

    const address = create.publicKey.toString();
    setUserAddress(address);
    const privateKey = bs58.encode(create.secretKey);
    setUserPrivateKey(privateKey);
  };
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <WalletMultiButton />

        {publicKey && !userAddress.length && (
          <button className={styles.btn} onClick={wallet}>
            Create Wallet
          </button>
        )}

        {publicKey && userAddress && (
          <>
            <p>User Address: {userAddress}</p>
            <p>User PrivateKey: {userPrivateKey}</p>
          </>
        )}
      </main>
    </div>
  );
}
