import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnSmartContracts } from "../target/types/an_smart_contracts";
import { expect } from "chai";

//! Order of tests is important
// When testing functions that have `init` constraint it's important to test the fails first
// because whenever an init function has been succesfully executed, it cannot be executed succesfully
// again because `init` can only happen once in a lifecycle of a solana program, unless account is closed
describe.only("fn initialize", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  it("should fail if nftSaleFee is more than the max", async () => {
    const admin = signer.publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const nftSaleFee = 11;
    const saleFee = 5;

    try {
      await program.methods
        .initialize(admin, treasury, nftSaleFee, saleFee)
        .accounts({
          deployer: admin,
        })
        .signers([])
        .rpc();
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).eq("FeeTooBig");
    }
  });

  it("should fail if saleFee is more than the max", async () => {
    const admin = signer.publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const nftSaleFee = 5;
    const saleFee = 11;

    try {
      await program.methods
        .initialize(admin, treasury, nftSaleFee, saleFee)
        .accounts({
          deployer: admin,
        })
        .signers([])
        .rpc();
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).eq("FeeTooBig");
    }
  });

  it("should fail if signer is not the deployer", async () => {
    const admin = anchor.web3.Keypair.generate();
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const nftSaleFee = 5;
    const saleFee = 5;

    const airdrop = await provider.connection.requestAirdrop(
      admin.publicKey,
      LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(airdrop);

    try {
      await program.methods
        .initialize(admin.publicKey, treasury, nftSaleFee, saleFee)
        .accounts({
          deployer: admin.publicKey,
        })
        .signers([admin])
        .rpc();
    } catch (error) {
      expect((error as AnchorError).logs[6]).to.include("InvalidAccountData.");
    }
  });

  it("should set `AdminSettings` successfully", async () => {
    const admin = signer.publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const nftSaleFee = 5;
    const saleFee = 5;

    const [globalListingsPda, globalListingsBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("global_listings")],
        program.programId
      );

    const [adminSettingsPda, adminSettingsBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("admin_settings")],
        program.programId
      );

    await program.methods
      .initialize(admin, treasury, nftSaleFee, saleFee)
      .accounts({
        deployer: admin,
      })
      .signers([])
      .rpc();

    const globalListingsAccount = await program.account.globalListings.fetch(
      globalListingsPda
    );
    const adminSettingsAccount = await program.account.adminSettings.fetch(
      adminSettingsPda
    );

    expect(globalListingsAccount.listings.length).eq(0);
    expect(adminSettingsAccount.admin.toString()).eq(admin.toString());
    expect(adminSettingsAccount.treasury.toString()).eq(treasury.toString());
    expect(adminSettingsAccount.nftSaleFee).eq(nftSaleFee);
    expect(adminSettingsAccount.saleFee).eq(saleFee);
  });

  it("should fail if it has previously been called", async () => {
    const admin = signer.publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const nftSaleFee = 5;
    const saleFee = 5;

    try {
      await program.methods
        .initialize(admin, treasury, nftSaleFee, saleFee)
        .accounts({
          deployer: admin,
        })
        .signers([])
        .rpc();
    } catch (error) {
      expect((error as AnchorError).logs[3]).to.include("already in use");
    }
  });
});
