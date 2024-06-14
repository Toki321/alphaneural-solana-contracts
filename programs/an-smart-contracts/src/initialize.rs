use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;

use crate::constants;

pub fn initialize(
    ctx: Context<Initialize>,
    admin: Pubkey,
    treasury: Pubkey,
    nft_sale_fee: u8,
    sale_fee: u8,
) -> Result<()> {
    require!(
        nft_sale_fee < constants::MAX_NFT_SALE_FEE && sale_fee < constants::MAX_SALE_FEE,
        AdminSettingsError::FeeTooBig
    );

    let admin_settings = &mut ctx.accounts.admin_settings;

    admin_settings.admin = admin;
    admin_settings.treasury = treasury;
    admin_settings.nft_sale_fee = nft_sale_fee;
    admin_settings.sale_fee = sale_fee;

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
    pub global_listings_account: Account<'info, GlobalListings>,
}

#[account]
pub struct AdminSettings {
    pub admin: Pubkey,
    pub treasury: Pubkey,
    pub nft_sale_fee: u8,
    pub sale_fee: u8,
}

pub const ADMIN_SETTINGS_SIZE: usize = 8 + // discriminator
32 +  // admin
32 + // treasury
1 +  // nft_sale_fee (1 byte)
1; // sale_fee (1 byte)

#[account]
pub struct GlobalListings {
    pub listings: Vec<ListingReference>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ListingReference {
    pub mint: Pubkey,
    pub seller: Pubkey,
}

/// Solana has a limit of 10240 which is 10kb (1024 bytes x 10 = 10240) per init/reallloc
/// We use the max number of listings we can store which is about 159.
/// Which equates to 10192 bytes
/// Use Increase Listings Space function to increase the amount of listings we can store
pub const GLOBAL_LISTINGS_SIZE: usize = 8 + // discriminator
4 + // length of vector
159 * (32+32); // 100 listings * (1mint + 1seller);

#[error_code]
pub enum AdminSettingsError {
    #[msg("Fee is too big!")]
    FeeTooBig,
}
