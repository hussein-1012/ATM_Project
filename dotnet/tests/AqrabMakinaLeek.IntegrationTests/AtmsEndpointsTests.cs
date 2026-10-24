using System.Net;
using System.Net.Http.Json;
using AqrabMakinaLeek.Application.DTOs;
using AqrabMakinaLeek.Domain.Enums;
using Xunit;

namespace AqrabMakinaLeek.IntegrationTests;

public class AtmsEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AtmsEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetNearby_Returns200_WithAtmsList()
    {
        // Act
        var response = await _client.GetAsync("/v1/atms/nearby?lat=29.3084&lng=30.8428&radius=5000");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var nearby = await response.Content.ReadFromJsonAsync<NearbyResponseDto>();
        Assert.NotNull(nearby);
        Assert.NotEmpty(nearby.Items);
        Assert.Equal(AtmBank.NBE, nearby.Items[0].Bank);
    }

    [Fact]
    public async Task Search_Returns200_WithMatchingAtms()
    {
        // Act (Search with Arabic query)
        var response = await _client.GetAsync("/v1/atms/search?q=" + Uri.EscapeDataString("الاهلي"));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var search = await response.Content.ReadFromJsonAsync<SearchResponseDto>();
        Assert.NotNull(search);
        Assert.NotEmpty(search.Items);
    }

    [Fact]
    public async Task GetById_Returns200_ForExistingAtm_And404_ForUnknown()
    {
        // Act 1: Existing
        var okResponse = await _client.GetAsync("/v1/atms/60c72b2f9b1d8b001c8e4d1a");
        Assert.Equal(HttpStatusCode.OK, okResponse.StatusCode);
        var atm = await okResponse.Content.ReadFromJsonAsync<AtmDetailResponseDto>();
        Assert.NotNull(atm);
        Assert.Equal("60c72b2f9b1d8b001c8e4d1a", atm.Id);

        // Act 2: Non-existent
        var notFoundResponse = await _client.GetAsync("/v1/atms/60c72b2f9b1d8b001c8e4d99");
        Assert.Equal(HttpStatusCode.NotFound, notFoundResponse.StatusCode);
    }
}
