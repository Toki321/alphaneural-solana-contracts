use anchor_lang::prelude::*;

use crate::{constants, AdminSettings, GlobalListings};

pub fn increase_listings_space(ctx: Context<IncreaseListingsSpace>) -> Result<()> {
    msg!("admin is::: {:?}", ctx.accounts.admin.to_account_info());
    msg!(
        "admin is::: {:?}",
        ctx.accounts.global_listings_account.to_account_info()
    );

    let global_listings = &mut ctx.accounts.global_listings_account;
    global_listings.space += 10188;

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
        realloc = global_listings_account.get_realloc_size(),
        realloc::payer = admin,
        realloc::zero = false
    )]
    pub global_listings_account: Account<'info, GlobalListings>,
    pub system_program: Program<'info, System>,
}
