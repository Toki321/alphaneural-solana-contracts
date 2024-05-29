import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { LAMPORTS_PER_SOL, Keypair, PublicKey } from "@solana/web3.js";
import { expect } from "chai";
import {
  AccountLayout,
  getAssociatedTokenAddress,
  MintLayout,
} from "@solana/spl-token";
import {
  findMasterEditionPda,
  findMetadataPda,
  mplTokenMetadata,
  MPL_TOKEN_METADATA_PROGRAM_ID,
} from "@metaplex-foundation/mpl-token-metadata";
import { AnSmartContracts } from "../target/types/an_smart_contracts";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("fn mint", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  const umi = createUmi("https://api.apr.dev")
    .use(walletAdapterIdentity(signer))
    .use(mplTokenMetadata());

  const mint = anchor.web3.Keypair.generate();

  let metadataAccount = findMetadataPda(umi, {
    mint: publicKey(mint.publicKey),
  })[0];

  let masterEditionAccount = findMasterEditionPda(umi, {
    mint: publicKey(mint.publicKey),
  })[0];

  it("Mint NFT", async () => {
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mint.publicKey,
      signer.publicKey
    );

    const airdrop = await provider.connection.requestAirdrop(
      signer.publicKey,
      LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(airdrop);

    const metadata = {
      name: "Kobeni",
      symbol: "kBN",
    };

    console.log("mint:", mint.publicKey);
    console.log("signer:", signer.publicKey);
    console.log("associatedtokenAccount:", associatedTokenAccount);
    console.log("masterEditionAccount:", masterEditionAccount);

    await program.methods
      .mintNft(metadata.name, metadata.symbol)
      .accounts({
        signer: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        metadataAccount,
        masterEditionAccount,
        // tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        // tokenProgram: TOKEN_PROGRAM_ID,
        // associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        // systemProgram: anchor.web3.SystemProgram.programId,
        // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([mint])
      .rpc();

    const accountInfo = await provider.connection.getAccountInfo(
      associatedTokenAccount
    );
    console.log(accountInfo);

    const tokenAccountInfo = AccountLayout.decode(
      Buffer.from(accountInfo.data)
    );
    console.log("tokenAccountInfo:", tokenAccountInfo);

    const mintInfo = await provider.connection.getAccountInfo(mint.publicKey);
    const mintAccountInfo = MintLayout.decode(Buffer.from(mintInfo.data));
    console.log("mintAccountInfo:", mintAccountInfo);

    expect(tokenAccountInfo.owner.toString()).equal(
      signer.publicKey.toString()
    );
    expect(tokenAccountInfo.mint.toString()).equal(mint.publicKey.toString());
    expect(tokenAccountInfo.amount.toString()).equal("1"); // 1 nft
  });
});
