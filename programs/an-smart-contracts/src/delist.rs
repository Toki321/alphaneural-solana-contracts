use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::{constants, program::AnSmartContracts, GlobalListings, ListingInfo};

pub fn delist_nft(ctx: Context<DelistNft>) -> Result<()> {
    let listing_info = &mut ctx.accounts.listing_info;
    let associated_token_account = &ctx.accounts.associated_token_account;

    msg!("De-listing NFT");
    msg!("Seller: {}", listing_info.seller);
    msg!("Mint: {}", listing_info.mint);

    // Revoke the program's delegate authority
    msg!("Revoking delegate authority");
    token::revoke(CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        token::Revoke {
            source: associated_token_account.to_account_info(),
            authority: ctx.accounts.seller.to_account_info(),
        },
    ))?;

    // Remove the listing from the global listings
    let mint_to_remove = listing_info.mint;
    ctx.accounts
        .global_listings_account
        .listings
        .retain(|listing| listing.mint != mint_to_remove);

    msg!("NFT de-listed successfully");

    Ok(())
}

#[derive(Accounts)]
pub struct DelistNft<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        mut,
        seeds = [constants::LISTING.as_bytes(), listing_info.mint.as_ref(), listing_info.seller.as_ref()],
        bump,
        close = seller,
    )]
    pub listing_info: Account<'info, ListingInfo>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = associated_token_account.mint == mint.key(),
        constraint = associated_token_account.owner == seller.key(),
    )]
    pub associated_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"global_listings"],
        bump,
    )]
    pub global_listings_account: Account<'info, GlobalListings>,
    pub token_program: Program<'info, Token>,
    pub alphaneural_program: Program<'info, AnSmartContracts>,
}
