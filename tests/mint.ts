import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { expect } from "chai";
import {
  AccountLayout,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  MintLayout,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  findMasterEditionPda,
  findMetadataPda,
  mplTokenMetadata,
  deserializeMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { AnSmartContracts } from "../target/types/an_smart_contracts";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

describe("fn mint", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.AnSmartContracts as Program<AnSmartContracts>;

  const umi = createUmi("https://api.apr.dev").use(walletAdapterIdentity(signer)).use(mplTokenMetadata());

  it("should mint an NFT with the correct properties", async () => {
    const mint = anchor.web3.Keypair.generate();

    let metadataPda = findMetadataPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];

    let masterEditionPda = findMasterEditionPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];

    const associatedTokenAccount = await getAssociatedTokenAddress(mint.publicKey, signer.publicKey);

    const name = "Kobeni";
    const symbol = "kBN";

    await program.methods
      .mintNft(name, symbol)
      .accounts({
        signer: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        metadataAccount: metadataPda,
        masterEditionAccount: masterEditionPda,
        // ** the following accounts are placed by anchor automatically
        // tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
        // tokenProgram: TOKEN_PROGRAM_ID,
        // associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        // systemProgram: anchor.web3.SystemProgram.programId,
        // rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        // alphaneuralProgram: program.programId,
      })
      .signers([mint])
      .rpc();

    // associated token account
    const rawTokenAccount = await provider.connection.getAccountInfo(associatedTokenAccount);
    const decodedTokenAccount = AccountLayout.decode(Buffer.from(rawTokenAccount.data));

    const rawMint = await provider.connection.getAccountInfo(mint.publicKey);
    const decodedMint = MintLayout.decode(Buffer.from(rawMint.data));

    expect(decodedTokenAccount.mint.toString()).equal(mint.publicKey.toString());
    expect(decodedTokenAccount.owner.toString()).equal(signer.publicKey.toString());
    expect(decodedTokenAccount.amount.toString()).equal("1"); // 1 nft
    expect(decodedTokenAccount.delegateOption).equal(0);
    expect(decodedTokenAccount.closeAuthorityOption).equal(0);
    expect(decodedTokenAccount.state).equal(1);

    // mint account
    expect(decodedMint.mintAuthority.toString()).equal(masterEditionPda.toString());
    expect(decodedMint.freezeAuthority.toString()).equal(masterEditionPda.toString());
    expect(decodedMint.supply.toString()).equal("1");
    expect(decodedMint.isInitialized).equal(true);

    // metadata account
    const rawMetadata = await provider.connection.getAccountInfo(new PublicKey(metadataPda.toString()));
    const decodedMetadata = deserializeMetadata(rawMetadata as any);
    expect(decodedMetadata.mint.toString()).equal(mint.publicKey.toString());
    expect(decodedMetadata.symbol.length).greaterThan(0);

    expect((decodedMetadata.creators as any).value[0].address).equal(signer.publicKey.toString());
    expect((decodedMetadata.creators as any).value[0].share).equal(100);
  });

  it("should mint an NFT and transfer it successfully", async () => {
    const mint = anchor.web3.Keypair.generate();
    const receiver = anchor.web3.Keypair.generate();

    let metadataPda = findMetadataPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];

    let masterEditionPda = findMasterEditionPda(umi, {
      mint: publicKey(mint.publicKey),
    })[0];

    const associatedTokenAccount = await getAssociatedTokenAddress(mint.publicKey, signer.publicKey);

    const receiverTokenAccount = await getAssociatedTokenAddress(mint.publicKey, receiver.publicKey);

    const name = "Kobeni";
    const symbol = "kBN";

    await program.methods
      .mintNft(name, symbol)
      .accounts({
        signer: signer.publicKey,
        mint: mint.publicKey,
        associatedTokenAccount,
        metadataAccount: metadataPda,
        masterEditionAccount: masterEditionPda,
      })
      .signers([mint])
      .rpc();

    // Ensure the associated token account for the receiver is created
    const ataTx = new Transaction().add(
      createAssociatedTokenAccountInstruction(signer.publicKey, receiverTokenAccount, receiver.publicKey, mint.publicKey)
    );
    await provider.sendAndConfirm(ataTx, [signer.payer]);

    // Transfer the NFT to the receiver
    const transferTx = new Transaction().add(
      createTransferInstruction(associatedTokenAccount, receiverTokenAccount, signer.publicKey, 1, [], TOKEN_PROGRAM_ID)
    );
    await provider.sendAndConfirm(transferTx, [signer.payer]);

    // Verify the receiver's token account
    const rawReceiverTokenAccount = await provider.connection.getAccountInfo(receiverTokenAccount);
    const decodedReceiverTokenAccount = AccountLayout.decode(Buffer.from(rawReceiverTokenAccount.data));

    expect(decodedReceiverTokenAccount.mint.toString()).equal(mint.publicKey.toString());
    expect(decodedReceiverTokenAccount.owner.toString()).equal(receiver.publicKey.toString());
    expect(decodedReceiverTokenAccount.amount.toString()).equal("1"); // 1 NFT

    // Verify the original token account has no NFT
    const rawTokenAccount = await provider.connection.getAccountInfo(associatedTokenAccount);
    const decodedTokenAccount = AccountLayout.decode(Buffer.from(rawTokenAccount.data));

    expect(decodedTokenAccount.amount.toString()).equal("0"); // No NFT

    // Verify creator is still original signer
    const rawMetadata = await provider.connection.getAccountInfo(new PublicKey(metadataPda.toString()));
    const decodedMetadata = deserializeMetadata(rawMetadata as any);
    expect((decodedMetadata.creators as any).value[0].address).equal(signer.publicKey.toString());
  });
});
