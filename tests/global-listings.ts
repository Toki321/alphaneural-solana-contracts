import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  findMasterEditionPda,
  findMetadataPda,
  mplTokenMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { AccountLayout, getAssociatedTokenAddress } from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import { AnSmartContracts } from "../target/types/an_smart_contracts";

describe.only("global listings pda", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  const umi = createUmi("https://api.apr.dev")
    .use(walletAdapterIdentity(signer))
    .use(mplTokenMetadata());

  it("should list and delist multiple NFTs and maintain correct global listings", async () => {
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

    const [globalListingsPda, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_listings")],
      program.programId
    );

    for (let i = 0; i < 5; i++) {
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
          listingInfo: listingInfoPda,
        })
        .signers([])
        .rpc();

      // Verify that the listing has been added to global listings
      let globalListings = await program.account.globalListings.fetch(
        globalListingsPda
      );
      console.log(globalListings);
      const addedListing = globalListings.listings.find(
        (listing) =>
          listing.mint.toBase58() === mint.publicKey.toBase58() &&
          listing.seller.toBase58() === signer.publicKey.toBase58()
      );
      expect(addedListing).to.not.be.undefined;

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

      // Verify that the listing has been added to global listings
      globalListings = await program.account.globalListings.fetch(
        globalListingsPda
      );
      const removedListing = globalListings.listings.find(
        (listing) =>
          listing.mint.toBase58() === mint.publicKey.toBase58() &&
          listing.seller.toBase58() === signer.publicKey.toBase58()
      );
      expect(removedListing).eq(undefined);
    }
  });
});
