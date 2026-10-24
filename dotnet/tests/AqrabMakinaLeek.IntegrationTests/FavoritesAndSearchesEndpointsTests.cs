using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AqrabMakinaLeek.Application.DTOs;
using Xunit;

namespace AqrabMakinaLeek.IntegrationTests;

public class FavoritesAndSearchesEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public FavoritesAndSearchesEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Favorites_And_RecentSearches_Flow_WorksCorrectly()
    {
        // 1. Register a test user and login to get token
        var email = $"fav_{Guid.NewGuid():N}@example.com";
        var password = "Password123!";
        await _client.PostAsJsonAsync("/v1/auth/register", new RegisterRequest("Fav User", email, password));

        var loginRes = await _client.PostAsJsonAsync("/v1/auth/login", new LoginRequest(email, password));
        var authRes = await loginRes.Content.ReadFromJsonAsync<AuthResponseDto>();
        Assert.NotNull(authRes);

        var token = authRes.AccessToken;
        var atmId = "60c72b2f9b1d8b001c8e4d1a";

        // 2. Add Favorite /v1/favorites/{atmId}
        using var addFavReq = new HttpRequestMessage(HttpMethod.Post, $"/v1/favorites/{atmId}");
        addFavReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var addFavRes = await _client.SendAsync(addFavReq);
        Assert.Equal(HttpStatusCode.Created, addFavRes.StatusCode);
        var addedFav = await addFavRes.Content.ReadFromJsonAsync<AddFavoriteResponseDto>();
        Assert.NotNull(addedFav);
        Assert.Equal(atmId, addedFav.AtmId);

        // 3. Get Favorites /v1/favorites
        using var getFavReq = new HttpRequestMessage(HttpMethod.Get, "/v1/favorites");
        getFavReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var getFavRes = await _client.SendAsync(getFavReq);
        Assert.Equal(HttpStatusCode.OK, getFavRes.StatusCode);
        var favList = await getFavRes.Content.ReadFromJsonAsync<FavoriteListDto>();
        Assert.NotNull(favList);
        Assert.Equal(1, favList.Meta.Count);
        Assert.Single(favList.Items);
        Assert.Equal(atmId, favList.Items[0].Id);

        // 4. Remove Favorite /v1/favorites/{atmId}
        using var delFavReq = new HttpRequestMessage(HttpMethod.Delete, $"/v1/favorites/{atmId}");
        delFavReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var delFavRes = await _client.SendAsync(delFavReq);
        Assert.Equal(HttpStatusCode.NoContent, delFavRes.StatusCode);

        // 5. Add Recent Search /v1/settings/recent-searches
        using var addSearchReq = new HttpRequestMessage(HttpMethod.Post, "/v1/settings/recent-searches");
        addSearchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        addSearchReq.Content = JsonContent.Create(new CreateRecentSearchRequest("بنك مصر الفيوم"));
        var addSearchRes = await _client.SendAsync(addSearchReq);
        Assert.Equal(HttpStatusCode.Created, addSearchRes.StatusCode);
        var searchItem = await addSearchRes.Content.ReadFromJsonAsync<RecentSearchResponseDto>();
        Assert.NotNull(searchItem);
        Assert.Equal("بنك مصر الفيوم", searchItem.Query);

        // 6. Get Recent Searches
        using var getSearchesReq = new HttpRequestMessage(HttpMethod.Get, "/v1/settings/recent-searches");
        getSearchesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var getSearchesRes = await _client.SendAsync(getSearchesReq);
        Assert.Equal(HttpStatusCode.OK, getSearchesRes.StatusCode);
        var searchList = await getSearchesRes.Content.ReadFromJsonAsync<RecentSearchListDto>();
        Assert.NotNull(searchList);
        Assert.NotEmpty(searchList.Items);

        // 7. Clear Recent Searches
        using var clearSearchesReq = new HttpRequestMessage(HttpMethod.Delete, "/v1/settings/recent-searches");
        clearSearchesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var clearSearchesRes = await _client.SendAsync(clearSearchesReq);
        Assert.Equal(HttpStatusCode.NoContent, clearSearchesRes.StatusCode);
    }
}
