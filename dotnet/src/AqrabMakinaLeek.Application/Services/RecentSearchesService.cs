using AqrabMakinaLeek.Application.Common.Interfaces;
using AqrabMakinaLeek.Application.DTOs;

namespace AqrabMakinaLeek.Application.Services;

public class RecentSearchesService
{
    private const int KeepCount = 10;
    private readonly IRecentSearchRepository _repo;

    public RecentSearchesService(IRecentSearchRepository repo)
    {
        _repo = repo;
    }

    public async Task<RecentSearchListDto> ListAsync(string userId, CancellationToken ct = default)
    {
        var searches = await _repo.GetUserSearchesAsync(userId, KeepCount, ct);
        var items = searches.Select(s => new RecentSearchResponseDto(s.Id, s.Query, s.CreatedAt)).ToList();
        return new RecentSearchListDto(items);
    }

    public async Task<RecentSearchResponseDto> AddAsync(string userId, string query, CancellationToken ct = default)
    {
        var saved = await _repo.AddAsync(userId, query, KeepCount, ct);
        return new RecentSearchResponseDto(saved.Id, saved.Query, saved.CreatedAt);
    }

    public async Task ClearAsync(string userId, CancellationToken ct = default)
    {
        await _repo.ClearUserSearchesAsync(userId, ct);
    }
}
