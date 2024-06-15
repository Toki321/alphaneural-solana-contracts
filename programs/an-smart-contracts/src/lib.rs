use anchor_lang::prelude::*;

pub mod list;
use list::*;

pub mod delist;
use delist::*;

pub mod mint;
use mint::*;

pub mod constants;

pub mod modify_settings;
use modify_settings::*;

pub mod initialize;
use initialize::*;

pub mod listings_space;
use listings_space::*;

declare_id!("4C7npwRXR3adn6MzkVay5tyuFgMYCAJCUt3GR5aTzAzu");

#[program]
pub mod an_smart_contracts {

    use super::*;

    pub fn mint_nft(ctx: Context<MintNft>, name: String, symbol: String) -> Result<()> {
        mint::mint_nft(ctx, name, symbol)
    }

    pub fn list_nft(ctx: Context<ListNft>, price: u64) -> Result<()> {
        list::list_nft(ctx, price)
    }

    pub fn initialize(
        ctx: Context<Initialize>,
        admin: Pubkey,
        treasury: Pubkey,
        nft_sale_fee: u8,
        sale_fee: u8,
    ) -> Result<()> {
        initialize::initialize(ctx, admin, treasury, nft_sale_fee, sale_fee)
    }

    pub fn delist_nft(ctx: Context<DelistNft>) -> Result<()> {
        delist::delist_nft(ctx)
    }

    pub fn modify_settings(
        ctx: Context<ModifySettings>,
        admin: Option<Pubkey>,
        treasury: Option<Pubkey>,
        nft_sale_fee: Option<u8>,
        sale_fee: Option<u8>,
    ) -> Result<()> {
        modify_settings::modify_settings(ctx, admin, treasury, nft_sale_fee, sale_fee)
    }

    pub fn increase_listings_space(ctx: Context<IncreaseListingsSpace>) -> Result<()> {
        listings_space::increase_listings_space(ctx)
    }
}
