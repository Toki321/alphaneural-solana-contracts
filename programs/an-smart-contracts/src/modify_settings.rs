use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;

use crate::{constants, AdminSettings, AdminSettingsError};

pub fn modify_settings(
    ctx: Context<ModifySettings>,
    admin: Option<Pubkey>,
    treasury: Option<Pubkey>,
    nft_sale_fee: Option<u8>,
    sale_fee: Option<u8>,
) -> Result<()> {
    let admin_settings = &mut ctx.accounts.admin_settings;

    if let Some(new_admin) = admin {
        admin_settings.admin = new_admin;
    }

    if let Some(new_treasury) = treasury {
        admin_settings.treasury = new_treasury;
    }

    if let Some(new_nft_sale_fee) = nft_sale_fee {
        require!(
            new_nft_sale_fee < constants::MAX_NFT_SALE_FEE,
            AdminSettingsError::FeeTooBig
        );
        admin_settings.nft_sale_fee = new_nft_sale_fee;
    }

    if let Some(new_sale_fee) = sale_fee {
        require!(
            new_sale_fee < constants::MAX_SALE_FEE,
            AdminSettingsError::FeeTooBig
        );
        admin_settings.sale_fee = new_sale_fee;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ModifySettings<'info> {
    #[account(
        mut,
        seeds = [constants::ADMIN_SETTINGS.as_bytes()],
        bump,
        has_one = admin, // Ensures that the admin field of the account matches the admin signer.
        // constraint = admin_settings.admin == admin.key() @ ProgramError::InvalidArgument
    )]
    pub admin_settings: Account<'info, AdminSettings>,
    pub admin: Signer<'info>,
}
