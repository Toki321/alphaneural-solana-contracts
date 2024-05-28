import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnSmartContracts } from "../target/types/an_smart_contracts";
import { expect } from "chai";

describe("fn modify_settings", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  beforeEach(async () => {
    const admin = signer.publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const fee = 5;

    await program.methods
      .initialize(admin, treasury, fee)
      .accounts({
        deployer: admin,
      })
      .signers([])
      .rpc();
  });

  it("should modify `fee` successfully", async () => {
    const admin = signer.publicKey;
    const treasury = anchor.web3.Keypair.generate().publicKey;
    const fee = 1;

    const [adminSettingsPda, adminSettingsBump] =
      PublicKey.findProgramAddressSync(
        [Buffer.from("admin_settings")],
        program.programId
      );

    await program.methods
      .modifySettings(admin, treasury, fee)
      .accounts({
        adminSettings: adminSettingsPda,
      })
      .signers([])
      .rpc();

    const adminSettingsAccount = await program.account.adminSettings.fetch(
      adminSettingsPda
    );
    expect(adminSettingsAccount.admin.toString()).eq(admin.toString());
    expect(adminSettingsAccount.treasury.toString()).eq(treasury.toString());
    expect(adminSettingsAccount.fee).eq(fee);
  });
});
