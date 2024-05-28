use anchor_lang::prelude::*;

pub mod list;
use list::*;

pub mod delist;
use delist::*;

pub mod mint;
use mint::*;

pub mod constants;
use constants::*;

pub mod initialize;
use initialize::*;

declare_id!("4C7npwRXR3adn6MzkVay5tyuFgMYCAJCUt3GR5aTzAzu");

#[program]
pub mod an_smart_contracts {

    use super::*;

    pub fn mint_nft(ctx: Context<MintNft>, name: String, symbol: String) -> Result<()> {
        msg!("{}", ID.to_string());
        mint::mint_nft(ctx, name, symbol)
    }

    pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
        list::list_nft(ctx, price)
    }

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::initialize(ctx)
    }

    pub fn delist_nft(ctx: Context<DelistNft>) -> Result<()> {
        delist::delist_nft(ctx)
    }
}
