import * as anchor from "@coral-xyz/anchor";
import { AnchorError, Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { AnSmartContracts } from "../target/types/an_smart_contracts";
import { expect } from "chai";

//! Order of tests is important
// When testing functions that have `init` constraint it's important to test the fails first
// because whenever an init function has been succesfully executed, it cannot be executed succesfully
// again because `init` can only happen once in a lifecycle of a solana program, unless account is closed
describe("fn increase_listings_space", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const signer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace
    .AnSmartContracts as Program<AnSmartContracts>;

  it("should increase space successfully", async () => {
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

    const initialSpace = 10196;
    const [globalListingsPubKey, _] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_listings")],
      program.programId
    );

    const globalListingsAccount1 = await provider.connection.getAccountInfo(
      globalListingsPubKey
    );

    expect((globalListingsAccount1 as any).space).eq(10196);

    const globalListingsData = await program.account.globalListings.fetch(
      globalListingsPubKey
    );
    expect(globalListingsData.space.toString()).eq("10196");

    let space = initialSpace;
    for (let i = 0; i < 3; i++) {
      await program.methods
        .increaseListingsSpace()
        .accounts({})
        .signers([])
        .rpc();

      const globalListingsAccount2 = await provider.connection.getAccountInfo(
        globalListingsPubKey
      );
      expect((globalListingsAccount2 as any).space).eq((space += 10188));
    }
  });

  it("should fail if caller is not admin", async () => {
    const notAdmin = anchor.web3.Keypair.generate();

    const airdrop = await provider.connection.requestAirdrop(
      notAdmin.publicKey,
      LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(airdrop);

    try {
      await program.methods
        .increaseListingsSpace()
        .accounts({
          admin: notAdmin.publicKey,
        })
        .signers([notAdmin])
        .rpc();

      throw new Error("should have thrown error");
    } catch (error) {
      expect((error as AnchorError).error.errorCode.code).to.include(
        "ConstraintHasOne"
      );
    }
  });
});
