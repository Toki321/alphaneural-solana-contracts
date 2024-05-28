import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { AccountLayout, getAssociatedTokenAddress } from "@solana/spl-token";
import {
  findMasterEditionPda,
  findMetadataPda,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { AnSmartContracts } from "../target/types/an_smart_contracts";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { expect } from "chai";

describe("an-smart-contracts", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  const umi = createUmi("https://api.apr.dev")
    .use(walletAdapterIdentity(signer))
    .use(mplTokenMetadata());

  it("should list an nft", async () => {
    const mint = anchor.web3.Keypair.generate();

    const metadataAccount = findMetadataPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];

    const masterEditionAccount = findMasterEditionPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];

    const associatedTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      signer.publicKey
    );

    const metadata = {
      name: "Kobeni",
      symbol: "KBN",
    };

    await program.methods
      .mintNft(metadata.name, metadata.symbol)
      .accounts({
        signer: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        metadataAccount,
        masterEditionAccount,
      })
      .signers([mint])
      .rpc();

    console.log("Finished minting!");
    console.log("seller: ", signer.publicKey);
    console.log("mint: ", mint.publicKey);

    const price = new anchor.BN(1000);
    const [listingInfoPda, bump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        mint.publicKey.toBuffer(),
        signer.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.methods
      .listNft(price)
      .accounts({
        seller: signer.publicKey,
        mint: mint.publicKey,
        tokenAccount: associatedTokenAccount,
        // listingInfo: listingInfoPda,
      })
      .signers([])
      .rpc();

    // const listingInfoAccount = await provider.connection.getAccountInfo(
    // listingInfoPda
    // );
    // if (listingInfoAccount === null) {
    // throw new Error("ListingInfo account not found");
    // }

    const decodedInfo = await program.account.listingInfo.fetch(listingInfoPda);

    expect(decodedInfo.mint.toString()).to.equal(mint.publicKey.toString());
    expect(decodedInfo.price.toString()).to.equal(price.toString());
    expect(decodedInfo.seller.toString()).to.equal(signer.publicKey.toString());

    const accountInfo = await provider.connection.getAccountInfo(
      associatedTokenAccount
    );
    const tokenAccountInfo = AccountLayout.decode(
      Buffer.from(accountInfo.data)
    );
    expect(tokenAccountInfo.delegate.toString()).to.equal(
      program.programId.toString()
    );
  });
});
