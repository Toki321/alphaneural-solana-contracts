use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;

use crate::constants;

pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut, constraint = deployer.key() == constants::DEPLOYER @ ProgramError::InvalidAccountData
)]
    pub deployer: Signer<'info>,
    #[account(
        init,
        payer = deployer,
        seeds = [constants::ADMIN_SETTINGS.as_bytes()],
        bump,
        space = ADMIN_SETTINGS_SIZE,
        constraint = admin_settings.fee <= constants::MAX_LIMIT @ ProgramError::InvalidArgument
    )]
    pub admin_settings: Account<'info, AdminSettings>,
    pub system_program: Program<'info, System>,
    #[account(
        init,
        payer = deployer,
        seeds = [constants::GLOBAL_LISTINGS.as_bytes()],
        bump,
        space = GLOBAL_LISTINGS_SIZE
    )]
    pub listings_accounts: Account<'info, GlobalListings>,
}

#[account]
pub struct AdminSettings {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub fee: u8,
}

pub const ADMIN_SETTINGS_SIZE: usize = 8 + // discriminator
32 +  // admin
32 + // treasury
1; // fee (1 byte)

#[account]
pub struct GlobalListings {
    pub listings: Vec<ListingReference>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ListingReference {
    pub mint: Pubkey,
    pub seller: Pubkey,
}

pub const GLOBAL_LISTINGS_SIZE: usize = 8 + // discriminator
8 + // length of vector
1000 * (32+32); // 1000 listings * (1mint + 1seller); 1 pubkey is 32 bytes hence 32+32
