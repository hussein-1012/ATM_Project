using AqrabMakinaLeek.Application.Common.Exceptions;
using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Entities;

namespace AqrabMakinaLeek.Application.Services;

public class FavoritesService
{
    private readonly IFavoriteRepository _favoriteRepo;
    private readonly AtmsService _atmsService;

    public FavoritesService(IFavoriteRepository favoriteRepo, AtmsService atmsService)
    {
        _favoriteRepo = favoriteRepo;
        _atmsService = atmsService;
    }

    public async Task<FavoriteListDto> ListAsync(
        string userId,
        double? refLat = null,
        double? refLng = null,
        CancellationToken ct = default)
    {
        var favorites = await _favoriteRepo.GetUserFavoritesAsync(userId, ct);
        if (favorites.Count == 0)
        {
            return new FavoriteListDto([], new FavoriteMetaDto(0));
        }

        var atmIds = favorites.Select(f => f.AtmId).Distinct().ToList();
        var atms = await _atmsService.FindManyByIdsAsync(atmIds, refLat, refLng, ct);
        var byId = atms.ToDictionary(a => a.Id, a => a);

        // Preserve original favorites recency ordering
        var items = new List<AtmResponseDto>();
        foreach (var f in favorites)
        {
            if (byId.TryGetValue(f.AtmId, out var atmDto))
            {
                items.Add(atmDto);
            }
        }

        return new FavoriteListDto(items, new FavoriteMetaDto(items.Count));
    }

    public async Task<AddFavoriteResponseDto> AddAsync(string userId, string atmId, CancellationToken ct = default)
    {
        if (!await _atmsService.ExistsAsync(atmId, ct))
        {
            throw new NotFoundException("ATM not found", "ATM_NOT_FOUND");
        }

        var existing = await _favoriteRepo.FindAsync(userId, atmId, ct);
        if (existing is not null)
        {
            return new AddFavoriteResponseDto(existing.AtmId, existing.CreatedAt);
        }

        var favorite = new Favorite
        {
            UserId = userId,
            AtmId = atmId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        var saved = await _favoriteRepo.InsertAsync(favorite, ct);
        return new AddFavoriteResponseDto(saved.AtmId, saved.CreatedAt);
    }

    public async Task RemoveAsync(string userId, string atmId, CancellationToken ct = default)
    {
        await _favoriteRepo.DeleteAsync(userId, atmId, ct);
    }
}
