use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;

use crate::{constants, AdminSettings, GlobalListings, GLOBAL_LISTINGS_SIZE};

pub fn increase_listings_space(ctx: Context<IncreaseListingsSpace>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct IncreaseListingsSpace<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        seeds = [constants::ADMIN_SETTINGS.as_bytes()],
        bump,
        has_one=admin
    )]
    pub admin_settings: Account<'info, AdminSettings>,
    #[account(
        mut,
        seeds = [constants::GLOBAL_LISTINGS.as_bytes()],
        bump,
        realloc = 8 + GLOBAL_LISTINGS_SIZE + std::mem::size_of_val(&global_listings_account.listings) + std::mem::size_of::<GlobalListings>(),
        realloc::payer = admin,
        realloc::zero = false

    )]
    pub global_listings_account: Account<'info, GlobalListings>,
    pub system_program: Program<'info, System>,
}
