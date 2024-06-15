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

describe("fn delist", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  const umi = createUmi("https://api.apr.dev")
    .use(walletAdapterIdentity(signer))
    .use(mplTokenMetadata());

  it("should delist NFT successfully", async () => {
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
    const [globalListingsPda, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_listings")],
      program.programId
    );

    await program.methods
      .listNft(price)
      .accounts({
        seller: signer.publicKey,
        mint: mint.publicKey,
        tokenAccount: associatedTokenAccount,
        listingInfo: listingInfoPda,
      })
      .signers([])
      .rpc();

    const globalListingsAccount1 = await program.account.globalListings.fetch(
      globalListingsPda
    );
    const expectedListing = {
      mint: mint.publicKey.toBase58(),
      seller: signer.publicKey.toBase58(),
    };
    expect(
      globalListingsAccount1.listings.map((listing) => ({
        mint: listing.mint.toBase58(),
        seller: listing.seller.toBase58(),
      }))
    ).to.deep.include(expectedListing);

    await program.methods
      .delistNft()
      .accounts({
        seller: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        listingInfo: listingInfoPda, // include this. otherwise u get: Error: Reached maximum depth for account resolution
      })
      .signers([])
      .rpc();

    try {
      await program.account.listingInfo.fetch(listingInfoPda);
    } catch (error) {
      expect(error.message).to.contain("Account does not exist");
    }

    const globalListingsAccount = await program.account.globalListings.fetch(
      globalListingsPda
    );
    expect(globalListingsAccount.listings).to.not.deep.include({
      mint: mint.publicKey,
      seller: signer.publicKey,
    });

    const rawTokenAccount = await provider.connection.getAccountInfo(
      associatedTokenAccount
    );
    const decodedTokenAccount = AccountLayout.decode(
      Buffer.from(rawTokenAccount.data)
    );

    expect(decodedTokenAccount.delegateOption).to.equal(0);
  });

  it("should fail if seller is not the owner of the NFT", async () => {
    const mint = anchor.web3.Keypair.generate();

    // Metadata and master edition accounts for the mint
    const metadataAccount = findMetadataPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];
    const masterEditionAccount = findMasterEditionPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];

    // Token account associated with the mint
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      signer.publicKey // Assuming 'signer' is the initial owner
    );

    // Mint the NFT
    await program.methods
      .mintNft("Kobeni", "KBN")
      .accounts({
        signer: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        metadataAccount,
        masterEditionAccount,
      })
      .signers([mint])
      .rpc();

    // List the NFT
    const price = new anchor.BN(1000);
    const [listingInfoPda] = PublicKey.findProgramAddressSync(
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
        listingInfo: listingInfoPda,
      })
      .signers([])
      .rpc();

    // Attempt to delist with a different signer who is not the owner
    const wrongSigner = anchor.web3.Keypair.generate(); // This should be a new, unauthorized signer

    try {
      await program.methods
        .delistNft()
        .accounts({
          seller: wrongSigner.publicKey,
          mint: mint.publicKey,
          associatedTokenAccount,
          listingInfo: listingInfoPda,
        })
        .signers([wrongSigner])
        .rpc();
      throw new Error("The delisting should have failed, but it succeeded.");
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).to.include(
        "ConstraintRaw"
      );
    }
  });

  it("should fail if signer tries to delist an NFT that isn't listed yet", async () => {
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

    await program.methods
      .mintNft("Kobeni", "KBN")
      .accounts({
        signer: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        metadataAccount,
        masterEditionAccount,
      })
      .signers([mint])
      .rpc();

    const [listingInfoPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        mint.publicKey.toBuffer(),
        signer.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Attempt to delist the NFT that was never listed
    try {
      await program.methods
        .delistNft()
        .accounts({
          seller: signer.publicKey,
          mint: mint.publicKey,
          associatedTokenAccount,
          listingInfo: listingInfoPda, // Referencing a listing PDA that should not exist
        })
        .signers([])
        .rpc();
      throw new Error("The delisting should have failed, but it succeeded.");
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).to.include(
        "AccountNotInitialized"
      );
      expect((error as AnchorError).error.origin).to.include("listing_info");
    }
  });

  it("should fail to delist the same NFT multiple times", async () => {
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

    // Mint and list the NFT
    await program.methods
      .mintNft("Kobeni", "KBN")
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
    const [listingInfoPda] = PublicKey.findProgramAddressSync(
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
        listingInfo: listingInfoPda,
      })
      .signers([])
      .rpc();

    // Delist the NFT
    await program.methods
      .delistNft()
      .accounts({
        seller: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        listingInfo: listingInfoPda,
      })
      .signers([])
      .rpc();

    // Attempt to delist again
    try {
      await program.methods
        .delistNft()
        .accounts({
          seller: signer.publicKey,
          mint: mint.publicKey,
          associatedTokenAccount,
          listingInfo: listingInfoPda,
        })
        .signers([])
        .rpc();
      throw new Error(
        "The second delisting should have failed, but it succeeded."
      );
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).to.include(
        "AccountNotInitialized"
      );
      expect((error as AnchorError).error.origin).to.include("listing_info");
    }
  });
});
