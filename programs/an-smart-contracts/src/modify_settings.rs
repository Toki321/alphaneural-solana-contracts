use anchor_lang::prelude::*;
use anchor_lang::solana_program::program_error::ProgramError;

use crate::AdminSettings;

pub fn modify_settings(
    ctx: Context<ModifySettings>,
    admin: Option<Pubkey>,
    treasury: Option<Pubkey>,
    fee: Option<u8>,
) -> Result<()> {
    let admin_settings = &mut ctx.accounts.admin_settings;

    // if ctx.accounts.admin.key() != admin_settings.admin {
    //     return Err(ProgramError::IllegalOwner.into());
    // }

    if let Some(new_admin) = admin {
        admin_settings.admin = new_admin;
    }

    if let Some(new_treasury) = treasury {
        admin_settings.treasury = new_treasury;
    }

    if let Some(new_fee) = fee {
        admin_settings.fee = new_fee;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct ModifySettings<'info> {
    #[account(
        mut,
        has_one = admin, // Ensures that the admin field of the account matches the admin signer.
        constraint = admin_settings.admin == admin.key() @ ProgramError::InvalidArgument
    )]
    pub admin_settings: Account<'info, AdminSettings>,
    pub admin: Signer<'info>,
}
