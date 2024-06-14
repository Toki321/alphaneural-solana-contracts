use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::{constants, program::AnSmartContracts, GlobalListings, ListingReference};

pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
    let listing_info = &mut ctx.accounts.listing_info;

    msg!("Listing NFT");
    msg!("Seller: {}", ctx.accounts.seller.key());
    msg!("Price: {}", price);
    msg!("Mint: {}", ctx.accounts.mint.key());

    listing_info.seller = ctx.accounts.seller.key();
    listing_info.price = price;
    listing_info.mint = ctx.accounts.mint.key();

    // Ensure the seller actually owns the NFT
    let token_account = &ctx.accounts.token_account;
    msg!("Token account owner: {}", token_account.owner);
    msg!("Token account amount: {}", token_account.amount);

    require!(
        token_account.owner == ctx.accounts.seller.key(),
        ListError::SellerDoesNotOwnNFT
    );
    require!(token_account.amount == 1, ListError::InvalidTokenAmount);

    msg!("Setting program as delegate authority");
    token::approve(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Approve {
                to: token_account.to_account_info(),
                delegate: ctx.accounts.alphaneural_program.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
    )?;

    let listing_ref = ListingReference {
        mint: ctx.accounts.mint.key(),
        seller: ctx.accounts.seller.key(),
    };
    ctx.accounts
        .global_listings_account
        .listings
        .push(listing_ref);

    Ok(())
}

#[derive(Accounts)]
#[instruction(price: u64)]
pub struct ListNft<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(
        init,
        payer = seller,
        space = LISTING_INFO_SIZE,
        seeds = [constants::LISTING.as_bytes(), mint.key().as_ref(), seller.key().as_ref()],
        bump,
    )]
    pub listing_info: Account<'info, ListingInfo>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = token_account.mint == mint.key(),
        constraint = token_account.owner == seller.key(),
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub alphaneural_program: Program<'info, AnSmartContracts>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    #[account(
        mut,
        seeds = [constants::GLOBAL_LISTINGS.as_bytes()],
        bump,
        // space = 8 + (40 * 100)
    )]
    pub global_listings_account: Account<'info, GlobalListings>,
}

#[account]
pub struct ListingInfo {
    pub seller: Pubkey,
    pub price: u64,
    pub mint: Pubkey,
}

#[error_code]
pub enum ListError {
    #[msg("Seller does not own the NFT.")]
    SellerDoesNotOwnNFT,
    #[msg("Invalid token amount.")]
    InvalidTokenAmount,
}

pub const LISTING_INFO_SIZE: usize = 8 + // discriminator
8 +  // price
32 + // seller
32; // mint
