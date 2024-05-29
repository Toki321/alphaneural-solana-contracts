import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnSmartContracts } from "../target/types/an_smart_contracts";
import { expect } from "chai";

//! Order of tests is important
// When testing functions that have `init` constraint it's important to test the fails first
// because whenever an init function has been succesfully executed, it cannot be executed succesfully
// again because `init` can only happen once in a lifecycle of a solana program, unless account is closed
describe.only("fn modify_settings", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  const [adminSettingsPda, adminSettingsBump] =
    PublicKey.findProgramAddressSync(
      [Buffer.from("admin_settings")],
      program.programId
    );

  let admin;
  let treasury;
  let nftSaleFee;
  let saleFee;

  it("should fail if initialize fn has not been called yet", async () => {
    const newAdmin = anchor.web3.Keypair.generate();
    const newTreasury = anchor.web3.Keypair.generate();
    const newNftSaleFee = 1;
    const newSaleFee = 1;

    try {
      await program.methods
        .modifySettings(
          newAdmin.publicKey,
          newTreasury.publicKey,
          newNftSaleFee,
          newSaleFee
        )
        .accounts({
          adminSettings: adminSettingsPda,
        })
        .signers([]) // no signer because the initial admin is the anchor signer local wallet. anchor automatically sets the local wallet as signer if not specified but needed
        .rpc();
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).to.include(
        "AccountNotInitialized"
      );
    }
  });

  it("should modify all fields successfully", async () => {
    admin = signer.publicKey;
    treasury = anchor.web3.Keypair.generate().publicKey;
    nftSaleFee = 5;
    saleFee = 5;

    // First initialize the `AdminSettings` account
    await program.methods
      .initialize(admin, treasury, nftSaleFee, saleFee)
      .accounts({
        deployer: admin,
      })
      .signers([])
      .rpc();

    // Test modify_settings
    const newAdmin = anchor.web3.Keypair.generate();
    const newTreasury = anchor.web3.Keypair.generate();
    const newNftSaleFee = 1;
    const newSaleFee = 1;

    await program.methods
      .modifySettings(
        newAdmin.publicKey,
        newTreasury.publicKey,
        newNftSaleFee,
        newSaleFee
      )
      .accounts({
        adminSettings: adminSettingsPda,
      })
      .signers([]) // no signer because the initial admin is the anchor signer local wallet. anchor automatically sets the local wallet as signer if not specified but needed
      .rpc();

    const adminSettingsAccount = await program.account.adminSettings.fetch(
      adminSettingsPda
    );

    expect(adminSettingsAccount.admin.toString()).eq(
      newAdmin.publicKey.toString()
    );
    expect(adminSettingsAccount.treasury.toString()).eq(
      newTreasury.publicKey.toString()
    );
    expect(adminSettingsAccount.nftSaleFee).eq(newNftSaleFee);
    expect(adminSettingsAccount.saleFee).eq(newSaleFee);

    // Set the newly set settings
    admin = newAdmin;
    treasury = newTreasury;
    nftSaleFee = newNftSaleFee;
    saleFee = newSaleFee;
  });

  it("should modify `nft_sale_fee` successfully", async () => {
    const newNftSaleFee = 2;

    await program.methods
      .modifySettings(null, null, newNftSaleFee, null)
      .accounts({
        admin: admin.publicKey,
        adminSettings: adminSettingsPda,
      })
      .signers([admin])
      .rpc();

    const adminSettingsAccount = await program.account.adminSettings.fetch(
      adminSettingsPda
    );

    expect(adminSettingsAccount.admin.toString()).eq(
      admin.publicKey.toString()
    );
    expect(adminSettingsAccount.treasury.toString()).eq(
      treasury.publicKey.toString()
    );
    expect(adminSettingsAccount.nftSaleFee).eq(newNftSaleFee);
    expect(adminSettingsAccount.nftSaleFee).not.eq(nftSaleFee);
    expect(adminSettingsAccount.saleFee).eq(saleFee);

    nftSaleFee = newNftSaleFee;
  });

  it("should fail if admin is not the caller", async () => {
    const newAdmin = anchor.web3.Keypair.generate();
    const newTreasury = anchor.web3.Keypair.generate();
    const newNftSaleFee = 1;
    const newSaleFee = 1;

    const airdrop = await provider.connection.requestAirdrop(
      newAdmin.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);

    try {
      await program.methods
        .modifySettings(
          newAdmin.publicKey,
          newTreasury.publicKey,
          newNftSaleFee,
          newSaleFee
        )
        .accounts({
          admin: newAdmin.publicKey,
        })
        .signers([newAdmin])
        .rpc();
    } catch (error) {
      expect((error as AnchorError).errorLogs[0]).to.include(
        "Error Code: ConstraintHasOne"
      );
    }

    const [adminSettingsPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("admin_settings")],
      program.programId
    );

    const adminSettingsAccount = await program.account.adminSettings.fetch(
      adminSettingsPda
    );

    expect(adminSettingsAccount.admin.toString()).eq(
      admin.publicKey.toString()
    );
    expect(adminSettingsAccount.treasury.toString()).eq(
      treasury.publicKey.toString()
    );
    expect(adminSettingsAccount.nftSaleFee).eq(nftSaleFee);
    expect(adminSettingsAccount.saleFee).eq(saleFee);
  });

  it("should modify `sale_fee` and admin successfully", async () => {
    const newSaleFee = 2;
    const newAdmin = anchor.web3.Keypair.generate();

    await program.methods
      .modifySettings(newAdmin.publicKey, null, null, newSaleFee)
      .accounts({
        admin: admin.publicKey,
        adminSettings: adminSettingsPda,
      })
      .signers([admin])
      .rpc();

    const adminSettingsAccount = await program.account.adminSettings.fetch(
      adminSettingsPda
    );

    expect(adminSettingsAccount.admin.toString()).eq(
      newAdmin.publicKey.toString()
    );
    expect(adminSettingsAccount.admin.toString()).not.eq(
      admin.publicKey.toString()
    );

    expect(adminSettingsAccount.treasury.toString()).eq(
      treasury.publicKey.toString()
    );
    expect(adminSettingsAccount.nftSaleFee).eq(nftSaleFee);

    expect(adminSettingsAccount.saleFee).eq(newSaleFee);
    expect(adminSettingsAccount.saleFee).not.eq(saleFee);

    saleFee = newSaleFee;
    admin = newAdmin;
  });

  it("should not modify anything if all parameters are null", async () => {
    await program.methods
      .modifySettings(null, null, null, null)
      .accounts({
        admin: admin.publicKey,
        adminSettings: adminSettingsPda,
      })
      .signers([admin])
      .rpc();

    const adminSettingsAccount = await program.account.adminSettings.fetch(
      adminSettingsPda
    );

    expect(adminSettingsAccount.admin.toString()).eq(
      admin.publicKey.toString()
    );
    expect(adminSettingsAccount.treasury.toString()).eq(
      treasury.publicKey.toString()
    );
    expect(adminSettingsAccount.nftSaleFee).eq(nftSaleFee);
    expect(adminSettingsAccount.saleFee).eq(saleFee);
  });
});
