import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
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

describe("fn list", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  const umi = createUmi("https://api.apr.dev")
    .use(walletAdapterIdentity(signer))
    .use(mplTokenMetadata());

  it("should fail to list NFT if initialize fn has not been called yet", async () => {
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

    const price = new anchor.BN(1000);

    try {
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
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).equal(
        "AccountNotInitialized"
      );
    }
  });

  it("should list an NFT successfully", async () => {
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

    const admin = signer.publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const nftSaleFee = 5;
    const saleFee = 5;

    await program.methods
      .initialize(admin, treasury, nftSaleFee, saleFee)
      .accounts({
        deployer: admin,
      })
      .signers([])
      .rpc();

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

    const rawListingInfo = await program.account.listingInfo.getAccountInfo(
      listingInfoPda
    );
    expect(rawListingInfo.owner.toString()).equal(program.programId.toString());

    const listingInfo = await program.account.listingInfo.fetch(listingInfoPda);
    expect(listingInfo.seller.toString()).equal(signer.publicKey.toString());
    expect(listingInfo.price.toString()).equal(price.toString());
    expect(listingInfo.mint.toString()).equal(mint.publicKey.toString());

    const rawTokenAccount = await provider.connection.getAccountInfo(
      associatedTokenAccount
    );
    const decodedTokenAccount = AccountLayout.decode(
      Buffer.from(rawTokenAccount.data)
    );
    expect(decodedTokenAccount.delegate.toString()).to.equal(
      program.programId.toString()
    );
  });

  it("should fail to list NFT if lister is not the owner of NFT", async () => {
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

    const nonOwner = anchor.web3.Keypair.generate();

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

    const price = new anchor.BN(1000);

    try {
      await program.methods
        .listNft(price)
        .accounts({
          seller: nonOwner.publicKey, // Use the non-owner wallet here
          mint: mint.publicKey,
          tokenAccount: associatedTokenAccount,
          // listingInfo: listingInfoPda,
        })
        .signers([nonOwner])
        .rpc();
    } catch (error) {
      expect((error as AnchorError).logs).to.exist;
    }
  });

  it("should list 2 listings for 2 different NFTs successfully", async () => {
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

    const price = new anchor.BN(1000);
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

    const price2 = new anchor.BN(1000);
    const newMint = anchor.web3.Keypair.generate();
    const newMetadataAccount = findMetadataPda(umi, {
      mint: publicKey(newMint.publicKey),
    })[0];

    const newMasterEditionAccount = findMasterEditionPda(umi, {
      mint: publicKey(newMint.publicKey),
    })[0];

    const newAssociatedTokenAccount = await getAssociatedTokenAddress(
      newMint.publicKey,
      signer.publicKey
    );

    await program.methods
      .mintNft(metadata.name, metadata.symbol)
      .accounts({
        signer: signer.publicKey,
        mint: newMint.publicKey,
        associatedTokenAccount: newAssociatedTokenAccount,
        metadataAccount: newMetadataAccount,
        masterEditionAccount: newMasterEditionAccount,
      })
      .signers([newMint])
      .rpc();

    await program.methods
      .listNft(price2)
      .accounts({
        seller: signer.publicKey,
        mint: newMint.publicKey,
        tokenAccount: newAssociatedTokenAccount,
        // listingInfo: listingInfoPda,
      })
      .signers([])
      .rpc();

    const [listingInfoPda1, bump1] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        mint.publicKey.toBuffer(),
        signer.publicKey.toBuffer(),
      ],
      program.programId
    );
    const [listingInfoPda2, bump2] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        newMint.publicKey.toBuffer(),
        signer.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Verify the first listing
    const rawListingInfo1 = await program.account.listingInfo.getAccountInfo(
      listingInfoPda1
    );
    expect(rawListingInfo1.owner.toString()).equal(
      program.programId.toString()
    );

    const listingInfo1 = await program.account.listingInfo.fetch(
      listingInfoPda1
    );
    expect(listingInfo1.seller.toString()).equal(signer.publicKey.toString());
    expect(listingInfo1.price.toString()).equal(price.toString());
    expect(listingInfo1.mint.toString()).equal(mint.publicKey.toString());

    const rawTokenAccount1 = await provider.connection.getAccountInfo(
      associatedTokenAccount
    );
    const decodedTokenAccount1 = AccountLayout.decode(
      Buffer.from(rawTokenAccount1.data)
    );
    expect(decodedTokenAccount1.delegate.toString()).to.equal(
      program.programId.toString()
    );

    // Verify the second listing
    const rawListingInfo2 = await program.account.listingInfo.getAccountInfo(
      listingInfoPda2
    );
    expect(rawListingInfo2.owner.toString()).equal(
      program.programId.toString()
    );

    const listingInfo2 = await program.account.listingInfo.fetch(
      listingInfoPda2
    );
    expect(listingInfo2.seller.toString()).equal(signer.publicKey.toString());
    expect(listingInfo2.price.toString()).equal(price2.toString());
    expect(listingInfo2.mint.toString()).equal(newMint.publicKey.toString());

    const rawTokenAccount2 = await provider.connection.getAccountInfo(
      newAssociatedTokenAccount
    );
    const decodedTokenAccount2 = AccountLayout.decode(
      Buffer.from(rawTokenAccount2.data)
    );
    expect(decodedTokenAccount2.delegate.toString()).to.equal(
      program.programId.toString()
    );
  });
});
